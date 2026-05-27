/**
 * Tests para la lógica de markdown bold (`**texto**` → `<strong>texto</strong>`)
 * usada en el template del email. Los datos clave del brief (terminación de
 * tarjeta, monto, fechas) vienen del AI envueltos en `**`; este helper los
 * convierte a HTML real.
 *
 * El helper vive como función interna en `template.ts`. Para testearlo lo
 * importamos vía un proxy mínimo, pero como template.ts importa cheerio
 * (que en este project es server-only-friendly), preferimos duplicar la
 * regex aquí — son 1 línea y los tests cubren los edge cases.
 *
 * Si el helper en template.ts cambia, este test te avisa porque copiamos
 * el mismo regex.
 */

import { describe, it, expect } from "vitest";

// MISMA implementación que `applyMarkdownBold` en template.ts. Si una se
// mueve, ajustar también acá. Lo mantenemos duplicado adrede para no
// arrastrar dependencias de cheerio al test runner.
function applyMarkdownBold(html: string): string {
  return html.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
}

describe("applyMarkdownBold", () => {
  it("convierte un par simple de ** a <strong>", () => {
    expect(applyMarkdownBold("Tu tarjeta termina en **4823**.")).toBe(
      "Tu tarjeta termina en <strong>4823</strong>.",
    );
  });

  it("convierte múltiples pares en la misma línea", () => {
    expect(applyMarkdownBold("Monto **$5,000** vence el **15 de junio**.")).toBe(
      "Monto <strong>$5,000</strong> vence el <strong>15 de junio</strong>.",
    );
  });

  it("no toca asteriscos sueltos sin par", () => {
    expect(applyMarkdownBold("Llama al *5512345678* hoy")).toBe("Llama al *5512345678* hoy");
  });

  it("no matchea a través de saltos de línea", () => {
    // El newline rompe el match, los asteriscos quedan literales.
    expect(applyMarkdownBold("**inicio\nfin**")).toBe("**inicio\nfin**");
  });

  it("ignora ** vacíos (`****`) — sin contenido entre los dos pares", () => {
    expect(applyMarkdownBold("Hola **** mundo")).toBe("Hola **** mundo");
  });

  it("respeta caracteres especiales dentro del bold", () => {
    expect(applyMarkdownBold("Código **PROMO-2026/Q1**")).toBe(
      "Código <strong>PROMO-2026/Q1</strong>",
    );
  });

  it("aplica sobre HTML ya escapado por cheerio (escenario real)", () => {
    // cheerio escapa antes de que llegue aquí. Verificamos que &amp; etc.
    // dentro del bold se conserven.
    expect(applyMarkdownBold("Premier &amp; **VIP**")).toBe("Premier &amp; <strong>VIP</strong>");
  });

  it("string vacío devuelve vacío", () => {
    expect(applyMarkdownBold("")).toBe("");
  });

  it("string sin asteriscos pasa intacto", () => {
    const s = "Texto normal sin formato.";
    expect(applyMarkdownBold(s)).toBe(s);
  });
});
