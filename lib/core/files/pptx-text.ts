/**
 * Extracción de texto plano desde un PowerPoint (.pptx), sin dependencias
 * pesadas: un .pptx es un ZIP de XMLs (Office Open XML), así que basta
 * descomprimir con fflate y sacar los text runs (`<a:t>`) de cada slide.
 *
 * Por qué no mandamos el .pptx directo a Claude: la API solo acepta
 * imágenes y PDFs como adjuntos. El texto de las diapositivas (+ notas del
 * presentador, que suelen traer el contexto real de la solicitud) cubre el
 * caso de uso del wizard. Las imágenes embebidas se ignoran a propósito —
 * si la info clave está en una imagen, el usuario puede subir el screenshot.
 *
 * Pure function: bytes adentro, string afuera. Sin IA, sin IO.
 */

import { unzipSync } from "fflate";

/** MIME oficial de .pptx (Office Open XML presentation). */
export const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/**
 * Decodifica las 5 entidades XML predefinidas + referencias numéricas
 * (&#233; / &#xE9;). Suficiente para texto de slides; no hay HTML aquí.
 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Saca el texto legible de un XML de slide: concatena los runs `<a:t>` y
 * convierte cada cierre de párrafo (`</a:p>`) en salto de línea para que
 * los bullets no queden pegados en una sola línea.
 */
function slideXmlToText(xml: string): string {
  const paragraphs = xml.split("</a:p>");
  const lines: string[] = [];
  for (const p of paragraphs) {
    const runs = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXmlEntities(m[1]!));
    const line = runs.join("").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

/** Ordena "ppt/slides/slide10.xml" numéricamente (no lexicográfico). */
function bySlideNumber(a: string, b: string): number {
  const num = (s: string) => parseInt(s.match(/(\d+)\.xml$/)?.[1] ?? "0", 10);
  return num(a) - num(b);
}

/**
 * Extrae el texto de todas las diapositivas (en orden) y de las notas del
 * presentador. Lanza un Error legible si el archivo no es un .pptx válido.
 */
export function extractPptxText(data: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error("El archivo no parece ser un PowerPoint válido (.pptx).");
  }

  const slideKeys = Object.keys(files)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort(bySlideNumber);
  if (slideKeys.length === 0) {
    throw new Error(
      "El PowerPoint no tiene diapositivas legibles. Si es un .ppt viejo (binario), guárdalo como .pptx e intenta de nuevo.",
    );
  }

  const decoder = new TextDecoder("utf-8");
  const parts: string[] = [];

  slideKeys.forEach((key, i) => {
    const text = slideXmlToText(decoder.decode(files[key]!));
    if (text) parts.push(`— Diapositiva ${i + 1} —\n${text}`);
  });

  // Notas del presentador: a menudo el "qué queremos comunicar" vive aquí.
  const noteKeys = Object.keys(files)
    .filter((k) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(k))
    .sort(bySlideNumber);
  const notes = noteKeys
    .map((key, i) => {
      const text = slideXmlToText(decoder.decode(files[key]!));
      return text ? `— Notas ${i + 1} —\n${text}` : "";
    })
    .filter(Boolean);
  if (notes.length > 0) parts.push(...notes);

  if (parts.length === 0) {
    throw new Error(
      "El PowerPoint no contiene texto (¿solo imágenes?). Sube un screenshot de la diapositiva clave en su lugar.",
    );
  }

  return parts.join("\n\n");
}
