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
    "Output: SIEMPRE el objeto JSON definido por el schema. Nada antes ni despues.",
  ].join("\n");
}

function briefToUserPrompt(brief: DraftBrief): string {
  const lines: string[] = ["Datos del brief:"];
  if (brief.product) lines.push(`- Producto: ${brief.product}`);
  if (brief.movement) lines.push(`- Movimiento: ${brief.movement}`);
  if (brief.lifecycle) lines.push(`- Etapa del ciclo: ${brief.lifecycle}`);
  if (brief.audience) lines.push(`- Audiencia: ${brief.audience}`);
  if (brief.tone) lines.push(`- Tono: ${brief.tone}`);
  if (brief.context) lines.push(`- Contexto adicional: ${brief.context}`);
  return lines.join("\n");
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
  return object;
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
  const parts = [brief.product, brief.lifecycle, "tarjeta credito mexicana"]
    .filter((p): p is string => Boolean(p))
    .map((p) => p.toLowerCase());
  return parts.join(" ");
}
