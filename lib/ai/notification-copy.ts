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
import type { DraftBrief, DraftCopy } from "@/lib/db/schema";
import { serializeKeyInfoTags, productDisplayName } from "@/lib/notifications/key-info";

/** What the wizard receives back after a "Generar" click. */
export const NotificationCopySchema = z.object({
  subject: z
    .string()
    .min(5)
    .max(100)
    .describe("Asunto del email. Espan~ol mexicano. Sin emojis al inicio."),
  preheader: z
    .string()
    .max(120)
    .describe("Preheader (texto que se ve junto al asunto en la bandeja)."),
  headline: z
    .string()
    .min(5)
    .max(120)
    .describe("Titular grande del email. Una frase, sin punto final."),
  body: z
    .string()
    .min(40)
    .max(700)
    .describe("Cuerpo principal del email. 1-2 parrafos, conversacional."),
  cta_label: z
    .string()
    .min(2)
    .max(40)
    .describe("Texto del boton CTA. Verbo en imperativo. Sin punto final."),
  sms: z
    .string()
    .min(20)
    .max(160)
    .describe(
      "Texto SMS. Maximo 160 caracteres. Sin emojis. Incluye el call to action en una sola frase.",
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
 * Compose the system prompt. We bake in HSBC brand voice constraints so the
 * copy comes out usable without 5 rounds of refinement.
 */
function systemPrompt(): string {
  return [
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
  const { object } = await generateObject({
    model: model(),
    schema: NotificationCopySchema,
    system: systemPrompt(),
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
}

/**
 * Refine a single field given the current copy and a natural-language
 * instruction. Returns just the new value for that field. Keeps the rest
 * untouched on the client (we don't re-write the whole bundle).
 */
export async function refineField(args: {
  field: keyof DraftCopy;
  current: string;
  instruction: string; // "hazlo mas corto", "mas formal", "otra opcion"
  brief: DraftBrief; // context so the refinement stays on-brand
}): Promise<string> {
  const { field, current, instruction, brief } = args;

  const constraints: Record<keyof DraftCopy, string> = {
    subject: "5-12 palabras. Descriptivo. Sin emojis. Sin punto final.",
    preheader: "Maximo 120 caracteres. Complementa al subject, no lo repita.",
    headline: "Una frase clara. Sin punto final.",
    body: "1-2 parrafos cortos. Conversacional. No repita el headline.",
    cta_label: "Verbo en imperativo. 2-4 palabras. Sin punto.",
    sms: "Maximo 160 caracteres. Centrado en el call to action.",
  };

  const sys = [
    systemPrompt(),
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
 * Convenience helper: derive a Freepik search query from the brief so the
 * default hero image search is decent without the user typing anything.
 */
export function defaultImageQuery(brief: DraftBrief): string {
  const parts = [brief.product, brief.objective, brief.audience, "tarjeta credito mexicana"]
    .filter((p): p is string => Boolean(p))
    .map((p) => p.toLowerCase());
  return parts.join(" ");
}
