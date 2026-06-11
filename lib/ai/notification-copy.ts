/**
 * AI-driven copy generation for the /creation wizard.
 *
 * Uses `@ai-sdk/anthropic` + `ai`'s `generateObject` so Claude returns a
 * strict JSON object matching our Zod schema. No regex parsing, no
 * hand-rolled JSON repair — if the model deviates, the SDK throws.
 *
 * Two entry points:
 *   - generateNotificationCopy(brief)   → fresh draft from a brief
 *   - refineField(field, current, instr) → tweak one field in place
 *
 * Pure-ish: takes data in, returns data out. No DB writes. The wizard
 * calls these from server actions.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { anthropicEnv } from "@/lib/env";
import type {
  DraftBanner,
  DraftBannerStyle,
  DraftBrief,
  DraftCopy,
  DraftCopyTextField,
} from "@/lib/db/schema";
import { serializeKeyInfoTags, productDisplayName } from "@/lib/notifications/key-info";
import { buildPremierPromptBlock, type PillarId } from "@/lib/notifications/premier-rules";

/**
 * What the wizard receives back after a "Generar" click.
 *
 * IMPORTANTE sobre los límites: los `.max()` son GENEROSOS a propósito.
 * `generateObject` rechaza TODA la respuesta si UN solo campo se pasa del
 * límite (error "response did not match schema"), tirando una pieza por lo
 * demás buena. Los tamaños "ideales" de marca (subject 5-12 palabras, sms
 * ≤160, etc.) se piden en el system prompt como guía, y el UI muestra los
 * contadores. Aquí solo ponemos topes amplios como red de seguridad para
 * que la generación no truene por unos caracteres de más.
 */
export const NotificationCopySchema = z.object({
  subject: z
    .string()
    .min(3)
    .max(200)
    .describe("Asunto del email. Ideal 5-12 palabras. Espan~ol mexicano. Sin emojis al inicio."),
  preheader: z
    .string()
    .max(240)
    .describe("Preheader (texto que se ve junto al asunto en la bandeja). Ideal <=120 chars."),
  headline: z
    .string()
    .min(3)
    .max(240)
    .describe("Titular grande del email. Una frase, sin punto final."),
  body: z
    .string()
    .min(20)
    .max(1600)
    .describe("Cuerpo principal del email. Ideal 1-2 parrafos cortos, conversacional."),
  cta_label: z
    .string()
    .min(2)
    .max(80)
    .describe("Texto del boton CTA. Verbo en imperativo. Sin punto final."),
  sms: z
    .string()
    .min(10)
    .max(400)
    .describe(
      "Texto SMS. IDEAL maximo 160 caracteres. Sin emojis. Incluye el call to action en una sola frase.",
    ),
});

export type NotificationCopy = z.infer<typeof NotificationCopySchema>;

function anthropic() {
  const env = anthropicEnv();
  return createAnthropic({ apiKey: env.apiKey });
}

function model() {
  const env = anthropicEnv();
  return anthropic()(env.model);
}

/**
 * ¿La pieza debe seguir el overlay Premier? Centralizado aquí para que
 * `generateNotificationCopy`, `refineField` e `improveTopic` decidan igual.
 */
function premierContext(brief: DraftBrief): { isPremier: boolean; pillar: PillarId | null } {
  return {
    isPremier: Boolean(brief.isPremier),
    pillar: brief.premierPillar ?? null,
  };
}

/**
 * Compose the system prompt. We bake in HSBC brand voice constraints so the
 * copy comes out usable without 5 rounds of refinement. When the brief is
 * Premier, we append the catalog-driven Premier overlay block.
 */
function systemPrompt(brief?: DraftBrief): string {
  const base = [
    "Eres un copywriter senior de comunicaciones transaccionales de HSBC Mexico.",
    "Tu objetivo: redactar notificaciones de email + SMS para titulares de tarjeta de credito.",
    "",
    "Reglas de marca HSBC:",
    "- Espan~ol mexicano. Tu / informal salvo que el brief indique 'formal'.",
    "- No menciones promociones / descuentos a menos que el brief lo pida explicitamente.",
    "- Nunca pidas datos sensibles (numero de tarjeta, NIP, CVV) en el mensaje.",
    "- No prometas tiempos especificos a menos que vengan del brief.",
    "- Tono base: claro, util, breve. Una sola idea por parrafo.",
    "- SMS: pivote alrededor del call to action. Sin URL shorteners genericos.",
    "",
    "Reglas estructurales:",
    "- subject: 5-12 palabras, descriptivo, primer caracter en mayuscula.",
    "- preheader: complemento del subject, no lo repita.",
    "- headline: una frase, lo mas concreto posible (que va a pasar / que hacer).",
    "- body: 1-2 parrafos cortos. NO repitas el headline literal.",
    "- cta_label: verbo en imperativo (Activa, Verifica, Confirma...). Sin punto.",
    "- sms: <=160 chars total. Pueden incluir un placeholder tipo {{tracking_link}} si aplica.",
    "",
    "Formato de datos clave (negritas markdown con doble asterisco):",
    "- El NOMBRE COMPLETO DEL PRODUCTO (ej. 'Tarjeta de Credito HSBC 2Now') va en negritas EN CADA APARICION: **Tarjeta de Credito HSBC 2Now**.",
    "- Terminacion de tarjeta en negritas: **4823**.",
    "- MONTOS: formato SIEMPRE '$X,XXX M.N.' en negritas. Correcto: **$5,000 M.N.**, **$150 M.N.**. INCORRECTO: $5,000 MXN, $5000, 5000 pesos.",
    "- Fechas en negritas: **15 de junio de 2026**.",
    "- URLs / codigos en negritas: **PROMO2026**.",
    "- Aplica en subject, headline, body y sms cuando esos datos aparezcan.",
    "- SOLO usa ** para esos datos especificos, NO para enfatizar otras palabras.",
    "- IMPORTANTE: el campo body es TEXTO PLANO con markdown, NO un objeto JSON. NO envuelvas el body en {...}.",
    "",
    "Output: SIEMPRE el objeto JSON definido por el schema. Nada antes ni despues.",
  ].join("\n");

  if (brief) {
    const { isPremier, pillar } = premierContext(brief);
    if (isPremier) return `${base}\n${buildPremierPromptBlock(pillar)}`;
  }
  return base;
}

/**
 * Map an objective key to a verbalized hint for Claude. The wizard stores
 * IDs ("activar", "verificar"…) but the model benefits from the explicit
 * "queremos que el usuario X" framing.
 */
const OBJECTIVE_HINT: Record<string, string> = {
  activar: "Queremos que el usuario ACTIVE su tarjeta / un servicio.",
  verificar: "Queremos que el usuario VERIFIQUE datos o una transacción.",
  agradecer: "Queremos AGRADECER al usuario (post-compra / lealtad).",
  informar: "Queremos INFORMAR al usuario de un cambio o actualización.",
  recordar: "Queremos RECORDAR al usuario una acción pendiente.",
  bienvenida: "Queremos DAR LA BIENVENIDA al usuario a un nuevo producto.",
};

const AUDIENCE_HINT: Record<string, string> = {
  nuevos:
    "Tarjetahabientes recién emitidos (primer mes). Lenguaje acogedor, sin asumir conocimiento previo.",
  recurrentes: "Clientes con historial. Puedes asumir familiaridad con la marca y los flujos.",
  vip: "Segmento Premier / Advance / Air. Tono más cuidado, sobrio, premium.",
  morosos: "Clientes con saldo vencido. Tono firme pero respetuoso, evita estigmatizar.",
  todos: "Audiencia mixta. Mantén el lenguaje accesible y universal.",
};

const URGENCY_HINT: Record<string, string> = {
  baja: "Urgencia baja: informativo, sin presión, recordatorio amable.",
  media: "Urgencia media: claridad sobre tiempos, llama a la acción sin alarmar.",
  alta: "Urgencia alta: pide acción inmediata, enfatiza consecuencias de no actuar a tiempo. NO uses lenguaje amenazante.",
};

function briefToUserPrompt(brief: DraftBrief): string {
  const lines: string[] = ["Datos del brief:"];
  if (brief.product) {
    lines.push(`- Producto: ${brief.product}`);
    const displayName = productDisplayName(brief.product);
    if (displayName && displayName !== brief.product) {
      lines.push(
        `- Nombre completo del producto (úsalo así, EN NEGRITAS en cada aparición): **${displayName}**`,
      );
    }
  }
  if (brief.objective) {
    const hint = OBJECTIVE_HINT[brief.objective] ?? "";
    lines.push(`- Objetivo: ${brief.objective}${hint ? ` — ${hint}` : ""}`);
  }
  if (brief.topic) lines.push(`- De qué se trata: ${brief.topic}`);
  // Prefer chips estructurados (keyInfoTags) sobre el texto libre legacy
  // (keyInfo). Si ambos vienen, mandamos los dos: lo estructurado se
  // serializa formal, lo libre como notas extra.
  const tagsText = serializeKeyInfoTags(brief.keyInfoTags);
  const keyInfoText = [tagsText, brief.keyInfo].filter(Boolean).join(". ");
  if (keyInfoText) {
    lines.push(
      `- Información clave (debe aparecer en la copy, sin inventar nada extra): ${keyInfoText}`,
    );
  }
  if (brief.audience) {
    const hint = AUDIENCE_HINT[brief.audience] ?? "";
    lines.push(`- Audiencia: ${brief.audience}${hint ? ` — ${hint}` : ""}`);
  }
  if (brief.urgency) {
    const hint = URGENCY_HINT[brief.urgency] ?? "";
    lines.push(`- Urgencia: ${brief.urgency}${hint ? ` — ${hint}` : ""}`);
  }
  if (brief.tone) lines.push(`- Tono: ${brief.tone}`);
  if (brief.isPremier) {
    const pillarLabel = brief.premierPillar ? ` (pilar: ${brief.premierPillar})` : "";
    lines.push(
      `- Segmento: HSBC Premier / World Elite${pillarLabel}. Aplica el overlay Premier descrito en las reglas de marca.`,
    );
  }
  // Legacy fields (drafts antes de la simplificación). Si vienen, los
  // adjuntamos como contexto extra para no perder lo que ya escribió.
  if (brief.lifecycle) lines.push(`- Etapa del ciclo (legacy): ${brief.lifecycle}`);
  if (brief.movement) lines.push(`- Movimiento (legacy): ${brief.movement}`);
  if (brief.context) lines.push(`- Contexto extra (legacy): ${brief.context}`);
  return lines.join("\n");
}

/**
 * Defensa: ocasionalmente el modelo emite un field de string envuelto en
 * JSON anidado (ej. body = '{"body":"texto real"}'). Lo detectamos y
 * desenvolvemos para que el template renderee texto plano.
 */
function unwrapAccidentalJsonField(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return value;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && typeof parsed[fieldName] === "string") {
      return parsed[fieldName];
    }
  } catch {
    /* no es JSON, dejar tal cual */
  }
  return value;
}

/** Generate a full copy bundle from a brief. */
export async function generateNotificationCopy(brief: DraftBrief): Promise<NotificationCopy> {
  // `generateObject` lanza NoObjectGeneratedError si el modelo devuelve algo
  // que no cuadra con el schema (longitud, JSON mal formado, etc.) y NO lo
  // reintenta solo. Como con temperature 0.7 cada intento varía, hacemos
  // hasta 2 intentos antes de rendirnos con un mensaje claro.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { object } = await generateObject({
        model: model(),
        schema: NotificationCopySchema,
        system: systemPrompt(brief),
        prompt: briefToUserPrompt(brief),
        temperature: 0.7,
      });
      // Sanitizar cada field por si el modelo wrapeó en JSON anidado.
      return {
        subject: unwrapAccidentalJsonField(object.subject, "subject"),
        preheader: unwrapAccidentalJsonField(object.preheader, "preheader"),
        headline: unwrapAccidentalJsonField(object.headline, "headline"),
        body: unwrapAccidentalJsonField(object.body, "body"),
        cta_label: unwrapAccidentalJsonField(object.cta_label, "cta_label"),
        sms: unwrapAccidentalJsonField(object.sms, "sms"),
      };
    } catch (e) {
      lastError = e;
      console.error(
        `[notification-copy] generateObject falló (intento ${attempt + 1}/2):`,
        e instanceof Error ? e.message : e,
      );
    }
  }
  throw new Error(
    "La IA no logró generar una copy válida tras 2 intentos. Intenta de nuevo, o ajusta un poco el brief (a veces un tema muy largo o ambiguo confunde al modelo).",
    { cause: lastError },
  );
}

/**
 * Refine a single field given the current copy and a natural-language
 * instruction. Returns just the new value for that field. Keeps the rest
 * untouched on the client (we don't re-write the whole bundle).
 */
export async function refineField(args: {
  field: DraftCopyTextField;
  current: string;
  instruction: string; // "hazlo mas corto", "mas formal", "otra opcion"
  brief: DraftBrief; // context so the refinement stays on-brand
}): Promise<string> {
  const { field, current, instruction, brief } = args;

  const constraints: Record<DraftCopyTextField, string> = {
    subject: "5-12 palabras. Descriptivo. Sin emojis. Sin punto final.",
    preheader: "Maximo 120 caracteres. Complementa al subject, no lo repita.",
    headline: "Una frase clara. Sin punto final.",
    body: "1-2 parrafos cortos. Conversacional. No repita el headline.",
    cta_label: "Verbo en imperativo. 2-4 palabras. Sin punto.",
    sms: "Maximo 160 caracteres. Centrado en el call to action.",
  };

  const sys = [
    systemPrompt(brief),
    "",
    `Estas refinando UN solo campo: ${field}.`,
    `Restriccion del campo: ${constraints[field] ?? ""}`,
    "Responde SOLO con el nuevo texto del campo, sin envoltura, sin explicaciones.",
  ].join("\n");

  const userPrompt = [
    briefToUserPrompt(brief),
    "",
    `Valor actual del campo "${field}":`,
    current,
    "",
    `Instruccion del usuario: ${instruction}`,
  ].join("\n");

  const { text } = await generateText({
    model: model(),
    system: sys,
    prompt: userPrompt,
    temperature: 0.7,
  });
  return text.trim();
}

/**
 * Mejora la redacción del "topic" (de qué se trata la notificación) que
 * escribe el usuario en el wizard. Si el usuario puso algo ambiguo, corto o
 * desordenado, Claude lo reescribe en 1-3 frases claras y accionables.
 *
 * REGLA DURA: NO inventa datos que el usuario no dio (montos, fechas,
 * terminaciones de tarjeta, nombres). Solo aclara y estructura lo que ya
 * está. Devuelve texto plano (sin markdown, sin comillas, sin viñetas).
 */
export async function improveTopic(args: { topic: string; brief: DraftBrief }): Promise<string> {
  const { topic, brief } = args;

  const sys = [
    "Eres un asistente que ayuda a un copywriter de HSBC México a aclarar el brief de una notificación de tarjeta de crédito.",
    "El usuario escribió, de forma posiblemente ambigua o incompleta, DE QUÉ se trata la notificación.",
    "Tu tarea: reescribirlo en 1 a 3 frases claras, concretas y accionables en español mexicano.",
    "",
    "Reglas duras:",
    "- NO inventes datos que el usuario no dio: montos, fechas, terminaciones de tarjeta, nombres, porcentajes, plazos. Si no los mencionó, no aparecen.",
    "- Conserva TODOS los hechos que sí mencionó.",
    "- No agregues saludo, ni copy final, ni CTA: esto es solo la descripción del tema para el brief, no el mensaje al cliente.",
    "- Devuelve SOLO el texto mejorado: sin comillas, sin markdown, sin viñetas, sin explicaciones.",
    "- Si el texto del usuario ya es claro, mejóralo levemente sin cambiar el sentido.",
  ].join("\n");

  const userPrompt = [
    briefToUserPrompt(brief),
    "",
    "Descripción del tema escrita por el usuario (mejórala):",
    topic,
  ].join("\n");

  const { text } = await generateText({
    model: model(),
    system: sys,
    prompt: userPrompt,
    temperature: 0.5,
  });
  // Quita comillas envolventes que el modelo a veces agrega.
  return text
    .trim()
    .replace(/^["“]|["”]$/g, "")
    .trim();
}

/** Qué campos usa cada estilo de banner y cómo debe redactarlos el modelo. */
const BANNER_STYLE_HINT: Record<DraftBannerStyle, string> = {
  promo:
    "Estilo PROMO (banda roja con el beneficio principal). Llena: eyebrow (etiqueta corta en mayúsculas tipo 'BONO DE BIENVENIDA', máx 4 palabras), title (el beneficio en sí, corto y contundente, ej. '10,000 puntos HSBC'), subtitle (la condición en una frase, ej. 'Al activar tu tarjeta antes del 31 de julio'). Deja stat e items en null.",
  deadline:
    "Estilo DEADLINE (fecha límite destacada). Llena: eyebrow (frase previa corta, ej. 'Tienes hasta el'), title (la fecha en formato legible, ej. '31 de julio de 2026'). Si el brief no trae fecha límite, usa la acción + plazo que sí venga. Deja subtitle, stat e items en null.",
  benefits:
    "Estilo BENEFITS (lista con palomitas). Llena: title (encabezado corto, ej. 'Tu tarjeta incluye'), items (2 a 4 beneficios, cada uno máx 8 palabras, sin punto final). Deja eyebrow, subtitle y stat en null.",
  stat: "Estilo STAT (número grande destacado). Llena: stat (el número/dato con su unidad, ej. '9.65%' o '$1,000,000'), title (qué es ese dato, máx 5 palabras, ej. 'Tasa inicial desde'), subtitle (la condición o contexto en una frase corta). Deja eyebrow e items en null.",
  image:
    "Estilo IMAGE (foto a la izquierda + texto a la derecha; la imagen la elige el usuario después, tú solo redactas). Llena: title (idea principal, corto y concreto, máx 8 palabras), subtitle (1-2 frases de apoyo). Deja eyebrow, stat e items en null.",
  coupon:
    "Estilo COUPON (código de promoción enmarcado). Llena: eyebrow (instrucción corta, ej. 'Usa el código'), stat (EL CÓDIGO tal cual viene en el brief, ej. 'PROMO2026' — si el brief NO trae código, déjalo en null), subtitle (condición o vigencia en una frase). Deja title e items en null.",
  steps:
    "Estilo STEPS (pasos numerados). Llena: title (encabezado corto, ej. 'Actívala en 3 pasos'), items (2 a 4 pasos en orden, cada uno una instrucción corta empezando con verbo, máx 10 palabras). Deja eyebrow, subtitle y stat en null.",
};

const BannerContentSchema = z.object({
  eyebrow: z.string().max(60).nullable(),
  title: z.string().max(120).nullable(),
  subtitle: z.string().max(160).nullable(),
  stat: z.string().max(40).nullable(),
  items: z.array(z.string().max(80)).max(4).nullable(),
});

/**
 * Sugiere el contenido de un banner a partir del brief. Mismo principio que
 * el resto del wizard: extraer/destilar del brief, NUNCA inventar datos.
 * El usuario edita el resultado en el editor — esto es el primer borrador.
 */
export async function suggestBanner(args: {
  brief: DraftBrief;
  style: DraftBannerStyle;
}): Promise<DraftBanner> {
  const { brief, style } = args;

  const sys = [
    "Eres un copywriter senior de HSBC México. Vas a llenar el contenido de un BANNER visual que complementa el cuerpo de una notificación de email.",
    "El banner destaca UN dato/beneficio clave del brief — no repite el cuerpo completo.",
    "",
    "Reglas duras:",
    "- NO inventes datos: montos, fechas, porcentajes, condiciones. Solo usa lo que viene en el brief.",
    "- Español mexicano. Sin emojis. Sin signos de exclamación dobles.",
    "- Textos CORTOS: esto es un banner, no un párrafo.",
    "- NO uses markdown (nada de **): el banner ya tiene su propio formato visual.",
    "",
    BANNER_STYLE_HINT[style],
    "",
    "Output: SIEMPRE el objeto JSON del schema. Campos que el estilo no usa: null.",
  ].join("\n");

  const { object } = await generateObject({
    model: model(),
    schema: BannerContentSchema,
    system: sys,
    prompt: briefToUserPrompt(brief),
    temperature: 0.4,
  });

  return {
    style,
    ...(object.eyebrow?.trim() && { eyebrow: object.eyebrow.trim() }),
    ...(object.title?.trim() && { title: object.title.trim() }),
    ...(object.subtitle?.trim() && { subtitle: object.subtitle.trim() }),
    ...(object.stat?.trim() && { stat: object.stat.trim() }),
    ...(object.items?.length && { items: object.items.map((i) => i.trim()).filter(Boolean) }),
  };
}

/**
 * Convenience helper: derive a Freepik search query from the brief so the
 * default hero image search is decent without the user typing anything.
 */
export function defaultImageQuery(brief: DraftBrief): string {
  const parts = [brief.product, brief.objective, brief.audience, "tarjeta credito mexicana"]
    .filter((p): p is string => Boolean(p))
    .map((p) => p.toLowerCase());
  return parts.join(" ");
}
