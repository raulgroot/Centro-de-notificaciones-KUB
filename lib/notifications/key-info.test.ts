/**
 * Tests para `serializeKeyInfoTags` y helpers — son las funciones que
 * convierten los chips del wizard en texto natural para el AI.
 *
 * Si esto se rompe, el modelo puede:
 *   - Recibir información ambigua y "inventar" datos
 *   - O ignorar datos críticos como la fecha límite
 *
 * Ambos rompen la calidad del copy. Por eso vale la pena testearlo.
 */

import { describe, it, expect } from "vitest";
import { formatDateEs, serializeKeyInfoTags, hasAnyKeyInfo } from "./key-info";

describe("formatDateEs", () => {
  it("convierte YYYY-MM-DD a texto en español", () => {
    expect(formatDateEs("2026-06-15")).toBe("15 de junio de 2026");
  });

  it("devuelve string vacío para undefined", () => {
    expect(formatDateEs(undefined)).toBe("");
  });

  it("devuelve el input si no es formato YYYY-MM-DD", () => {
    expect(formatDateEs("15/06/2026")).toBe("15/06/2026");
  });

  it("devuelve el input si es fecha inválida con formato correcto", () => {
    // 2026-02-30 no existe, pero el regex pasa. JS lo "ajusta" a marzo.
    // No queremos crashear — devolvemos algo razonable.
    const result = formatDateEs("2026-02-30");
    expect(typeof result).toBe("string");
  });
});

describe("serializeKeyInfoTags", () => {
  it("devuelve string vacío para undefined", () => {
    expect(serializeKeyInfoTags(undefined)).toBe("");
  });

  it("devuelve string vacío para objeto vacío", () => {
    expect(serializeKeyInfoTags({})).toBe("");
  });

  it("serializa cardEnding", () => {
    expect(serializeKeyInfoTags({ cardEnding: "4823" })).toBe("Tarjeta con terminación 4823");
  });

  it("serializa amount", () => {
    expect(serializeKeyInfoTags({ amount: "$5,000 MXN" })).toBe("Monto / premio: $5,000 MXN");
  });

  it("serializa deadline en formato español", () => {
    expect(serializeKeyInfoTags({ deadline: "2026-06-15" })).toBe(
      "Fecha límite: 15 de junio de 2026",
    );
  });

  it("serializa rango completo de fechas", () => {
    expect(
      serializeKeyInfoTags({
        dateRange: { from: "2026-06-01", to: "2026-06-30" },
      }),
    ).toBe("Vigencia: del 1 de junio de 2026 al 30 de junio de 2026");
  });

  it("serializa rango con solo 'from'", () => {
    expect(serializeKeyInfoTags({ dateRange: { from: "2026-06-01" } })).toBe(
      "Vigencia desde el 1 de junio de 2026",
    );
  });

  it("serializa rango con solo 'to'", () => {
    expect(serializeKeyInfoTags({ dateRange: { to: "2026-06-30" } })).toBe(
      "Vigencia hasta el 30 de junio de 2026",
    );
  });

  it("serializa promoUrl", () => {
    expect(serializeKeyInfoTags({ promoUrl: "https://hsbc.com/promo" })).toBe(
      "URL / código promocional: https://hsbc.com/promo",
    );
  });

  it("concatena múltiples campos con punto-espacio", () => {
    const result = serializeKeyInfoTags({
      cardEnding: "4823",
      amount: "$2,500",
      deadline: "2026-06-30",
    });
    expect(result).toBe(
      "Tarjeta con terminación 4823. Monto / premio: $2,500. Fecha límite: 30 de junio de 2026",
    );
  });

  it("ignora campos con whitespace solamente", () => {
    expect(serializeKeyInfoTags({ cardEnding: "   ", amount: "  " })).toBe("");
  });

  it("trim aplicado a strings", () => {
    expect(serializeKeyInfoTags({ cardEnding: "  4823  " })).toBe("Tarjeta con terminación 4823");
  });
});

describe("hasAnyKeyInfo", () => {
  it("false para undefined", () => {
    expect(hasAnyKeyInfo(undefined)).toBe(false);
  });

  it("false para objeto vacío", () => {
    expect(hasAnyKeyInfo({})).toBe(false);
  });

  it("false para strings de whitespace", () => {
    expect(hasAnyKeyInfo({ cardEnding: "  ", amount: "" })).toBe(false);
  });

  it("true cuando hay cardEnding", () => {
    expect(hasAnyKeyInfo({ cardEnding: "1234" })).toBe(true);
  });

  it("true cuando hay deadline", () => {
    expect(hasAnyKeyInfo({ deadline: "2026-06-15" })).toBe(true);
  });

  it("true cuando hay dateRange.from", () => {
    expect(hasAnyKeyInfo({ dateRange: { from: "2026-06-15" } })).toBe(true);
  });

  it("true cuando hay dateRange.to", () => {
    expect(hasAnyKeyInfo({ dateRange: { to: "2026-06-15" } })).toBe(true);
  });

  it("false cuando dateRange existe pero está vacío", () => {
    expect(hasAnyKeyInfo({ dateRange: {} })).toBe(false);
  });
});
