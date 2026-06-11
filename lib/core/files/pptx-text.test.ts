/**
 * Tests para `extractPptxText`. Construimos .pptx sintéticos en memoria con
 * fflate (zipSync) — mismo formato ZIP+XML que produce PowerPoint real.
 *
 * Lo riesgoso de este extractor: el orden de diapositivas (slide10 debe ir
 * después de slide9, no después de slide1), las entidades XML sin decodificar
 * y los archivos corruptos/sin texto. Eso es lo que cubrimos.
 */

import { describe, it, expect } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { extractPptxText } from "./pptx-text";

/** Arma un slide XML mínimo con los párrafos dados (cada uno con sus runs). */
function slideXml(paragraphs: string[][]): Uint8Array {
  const body = paragraphs
    .map((runs) => `<a:p>${runs.map((r) => `<a:r><a:t>${r}</a:t></a:r>`).join("")}</a:p>`)
    .join("");
  return strToU8(`<?xml version="1.0"?><p:sld><p:txBody>${body}</p:txBody></p:sld>`);
}

function makePptx(files: Record<string, Uint8Array>): Uint8Array {
  return zipSync(files);
}

describe("extractPptxText", () => {
  it("extrae texto de una diapositiva con varios párrafos", () => {
    const pptx = makePptx({
      "ppt/slides/slide1.xml": slideXml([["Título de la pieza"], ["Bullet uno"], ["Bullet dos"]]),
    });
    const text = extractPptxText(pptx);
    expect(text).toContain("— Diapositiva 1 —");
    expect(text).toContain("Título de la pieza\nBullet uno\nBullet dos");
  });

  it("une los runs partidos de un mismo párrafo (formato mixto)", () => {
    // PowerPoint parte "10,000 puntos" en varios <a:t> si cambia el formato.
    const pptx = makePptx({
      "ppt/slides/slide1.xml": slideXml([["Bono de ", "10,000", " puntos"]]),
    });
    expect(extractPptxText(pptx)).toContain("Bono de 10,000 puntos");
  });

  it("ordena slide10 después de slide9 (numérico, no lexicográfico)", () => {
    const files: Record<string, Uint8Array> = {};
    for (const n of [10, 2, 1, 9]) {
      files[`ppt/slides/slide${n}.xml`] = slideXml([[`Contenido ${n}`]]);
    }
    const text = extractPptxText(makePptx(files));
    const order = [...text.matchAll(/Contenido (\d+)/g)].map((m) => Number(m[1]));
    expect(order).toEqual([1, 2, 9, 10]);
  });

  it("decodifica entidades XML (&amp;, &#233;, &#xE9;)", () => {
    const pptx = makePptx({
      "ppt/slides/slide1.xml": slideXml([["Cr&#233;dito &amp; d&#xE9;bito &lt;HSBC&gt;"]]),
    });
    expect(extractPptxText(pptx)).toContain("Crédito & débito <HSBC>");
  });

  it("incluye las notas del presentador después de las diapositivas", () => {
    const pptx = makePptx({
      "ppt/slides/slide1.xml": slideXml([["Slide visible"]]),
      "ppt/notesSlides/notesSlide1.xml": slideXml([["Contexto: enviar antes del 31 de julio"]]),
    });
    const text = extractPptxText(pptx);
    expect(text).toContain("— Notas 1 —");
    expect(text.indexOf("Slide visible")).toBeLessThan(text.indexOf("Contexto:"));
  });

  it("ignora diapositivas vacías sin romper la numeración del resto", () => {
    const pptx = makePptx({
      "ppt/slides/slide1.xml": slideXml([["Con texto"]]),
      "ppt/slides/slide2.xml": slideXml([[]]),
    });
    const text = extractPptxText(pptx);
    expect(text).toContain("Con texto");
    expect(text).not.toContain("— Diapositiva 2 —");
  });

  it("bytes que no son ZIP lanzan error legible", () => {
    expect(() => extractPptxText(strToU8("esto no es un zip"))).toThrow(/PowerPoint válido/);
  });

  it("ZIP sin slides (ej. un .docx) lanza error que sugiere .pptx", () => {
    const zip = makePptx({ "word/document.xml": strToU8("<doc/>") });
    expect(() => extractPptxText(zip)).toThrow(/no tiene diapositivas/);
  });

  it("pptx solo-imágenes (slides sin texto) lanza error con alternativa", () => {
    const pptx = makePptx({ "ppt/slides/slide1.xml": slideXml([[]]) });
    expect(() => extractPptxText(pptx)).toThrow(/no contiene texto/);
  });
});
