/**
 * Cliente para la API de Google Gemini / Imagen ("Nano Banana") via Google
 * AI Studio. Generación text-to-image directa sin necesidad de salir a
 * Midjourney / ChatGPT.
 *
 * Free tier (Google AI Studio): ~50-100 imágenes/día con rate limits suaves,
 * suficiente para uso interno del Centro de Notificaciones.
 *
 * Endpoint: `models/{model}:generateContent`
 * Docs:    https://ai.google.dev/gemini-api/docs/image-generation
 *
 * Devolvemos las imágenes como data URLs (base64 inline) para que el wizard
 * las pueda mostrar inmediatamente y guardarlas en el draft sin necesidad
 * de host externo.
 */

import { googleGenAiEnv } from "@/lib/env";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Una imagen generada, lista para mostrarse en el picker. */
export interface GeneratedImage {
  /** Data URL completo (data:image/png;base64,...) — directamente usable en <img src>. */
  url: string;
  /** Modelo que la generó (para debugging / atribución). */
  model: string;
  /** Prompt resumido para alt text. */
  altSummary: string;
  /** Id de la variación de prompt que la produjo (editorial/contextual). */
  variationId?: string;
  /** Nombre human-readable de la variación. */
  variationName?: string;
}

interface RawCandidate {
  content?: {
    parts?: Array<{
      inlineData?: { mimeType?: string; data?: string };
      text?: string;
    }>;
  };
}

interface RawResponse {
  candidates?: RawCandidate[];
  error?: { code?: number; message?: string; status?: string };
}

/**
 * Genera UNA imagen por cada prompt provisto, en paralelo. Pensado para
 * "3 variaciones" del wizard — cada variación trae su propio prompt y la
 * imagen generada queda taggeada con el `variationId`/`name`.
 *
 * Si una falla individualmente no rompemos todo — devolvemos las que sí
 * llegaron. La UI muestra lo que haya.
 */
export async function generateImagesForVariations(args: {
  variations: Array<{ id: string; name: string; prompt: string }>;
}): Promise<GeneratedImage[]> {
  const { apiKey, model } = googleGenAiEnv();
  if (!args.variations.length) return [];

  const promises = args.variations.map((v, i) =>
    generateOne({
      apiKey,
      model,
      prompt: v.prompt.trim(),
      altSummary: v.prompt.slice(0, 120),
      variationId: v.id,
      variationName: v.name,
    }).catch((e) => {
      console.error(`[nano-banana] variación ${i + 1} (${v.id}) falló:`, e);
      return null;
    }),
  );

  const results = await Promise.all(promises);
  return results.filter((r): r is GeneratedImage => r !== null);
}

/**
 * Legacy: genera N imágenes con el MISMO prompt. Conservado por compat
 * con cualquier caller existente que aún no use variations.
 */
export async function generateImages(args: {
  prompt: string;
  count?: number;
}): Promise<GeneratedImage[]> {
  const { apiKey, model } = googleGenAiEnv();
  const count = Math.min(Math.max(args.count ?? 3, 1), 4);
  const prompt = args.prompt.trim();
  if (!prompt) return [];

  const altSummary = prompt.slice(0, 120);

  const promises: Promise<GeneratedImage | null>[] = [];
  for (let i = 0; i < count; i++) {
    promises.push(
      generateOne({ apiKey, model, prompt, altSummary }).catch((e) => {
        console.error(`[nano-banana] imagen ${i + 1}/${count} falló:`, e);
        return null;
      }),
    );
  }

  const results = await Promise.all(promises);
  return results.filter((r): r is GeneratedImage => r !== null);
}

async function generateOne(args: {
  apiKey: string;
  model: string;
  prompt: string;
  altSummary: string;
  variationId?: string;
  variationName?: string;
}): Promise<GeneratedImage> {
  const url = `${API_BASE}/models/${args.model}:generateContent?key=${args.apiKey}`;
  const body = {
    contents: [{ parts: [{ text: args.prompt }] }],
    generationConfig: {
      // Forzamos modalidad imagen + texto. Algunos modelos lo requieren
      // explícito para emitir image data en lugar de descripción.
      responseModalities: ["IMAGE", "TEXT"],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Sin cache porque cada generación es única.
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as RawResponse;
  if (json.error) {
    throw new Error(`Gemini error: ${json.error.message ?? json.error.status}`);
  }

  // Extraer la PRIMER parte con inlineData (la imagen). Si el modelo
  // mete texto antes, lo ignoramos.
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error(
      `Gemini no devolvió imagen. Parts recibidas: ${parts.map((p) => (p.inlineData ? "image" : "text")).join(", ") || "ninguna"}`,
    );
  }

  const mime = imagePart.inlineData.mimeType ?? "image/png";
  const dataUrl = `data:${mime};base64,${imagePart.inlineData.data}`;

  return {
    url: dataUrl,
    model: args.model,
    altSummary: args.altSummary,
    variationId: args.variationId,
    variationName: args.variationName,
  };
}
