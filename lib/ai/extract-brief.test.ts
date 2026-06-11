/**
 * Tests para los helpers puros de `extract-brief`:
 *
 * - `extractionToKeyInfo`: mapea la salida del modelo a DraftKeyInfo. Lo
 *   riesgoso es que deje pasar fechas no-ISO (el modelo a veces responde
 *   "junio 2026") o que convierta nulls en strings — cubrimos ambos.
 * - `inferMediaType`: fallback por extensión cuando el browser reporta
 *   type vacío (pasa con .txt/.md arrastrados).
 */

import { describe, it, expect } from "vitest";
import { extractionToKeyInfo, inferMediaType } from "./extract-brief";

const base = {
  topic: "Aviso de renovación de tarjeta con beneficios nuevos.",
  cardEnding: null,
  amount: null,
  deadline: null,
  dateFrom: null,
  dateTo: null,
  promoUrl: null,
  docSummary: "Correo de solicitud",
};

describe("extractionToKeyInfo", () => {
  it("con todo en null devuelve objeto vacío (sin keys basura)", () => {
    expect(extractionToKeyInfo(base)).toEqual({});
  });

  it("mapea los campos presentes y recorta espacios", () => {
    const tags = extractionToKeyInfo({
      ...base,
      cardEnding: " 4823 ",
      amount: "$5,000 MXN",
      promoUrl: "https://hsbc.mx/promo",
    });
    expect(tags).toEqual({
      cardEnding: "4823",
      amount: "$5,000 MXN",
      promoUrl: "https://hsbc.mx/promo",
    });
  });

  it("acepta deadline ISO válida", () => {
    expect(extractionToKeyInfo({ ...base, deadline: "2026-07-15" })).toEqual({
      deadline: "2026-07-15",
    });
  });

  it("descarta deadline NO-ISO en lugar de llenar el chip con basura", () => {
    expect(extractionToKeyInfo({ ...base, deadline: "julio 2026" })).toEqual({});
    expect(extractionToKeyInfo({ ...base, deadline: "15/07/26" })).toEqual({});
  });

  it("arma dateRange con from/to válidos y tolera rangos parciales", () => {
    expect(extractionToKeyInfo({ ...base, dateFrom: "2026-07-01", dateTo: "2026-07-31" })).toEqual({
      dateRange: { from: "2026-07-01", to: "2026-07-31" },
    });
    expect(extractionToKeyInfo({ ...base, dateFrom: "2026-07-01" })).toEqual({
      dateRange: { from: "2026-07-01" },
    });
  });

  it("descarta el lado no-ISO de un rango sin tirar el lado válido", () => {
    expect(extractionToKeyInfo({ ...base, dateFrom: "julio", dateTo: "2026-07-31" })).toEqual({
      dateRange: { to: "2026-07-31" },
    });
  });

  it("strings vacíos o de puros espacios cuentan como ausentes", () => {
    expect(extractionToKeyInfo({ ...base, amount: "   ", cardEnding: "" })).toEqual({});
  });
});

describe("inferMediaType", () => {
  it("respeta el type del browser cuando viene", () => {
    expect(inferMediaType("solicitud.pdf", "application/pdf")).toBe("application/pdf");
  });

  it("infiera por extensión cuando el type viene vacío", () => {
    expect(inferMediaType("notas.txt", "")).toBe("text/plain");
    expect(inferMediaType("brief.MD", "")).toBe("text/markdown");
    expect(inferMediaType("scan.PDF", "")).toBe("application/pdf");
  });

  it("application/octet-stream se trata como 'sin type' e infiere", () => {
    expect(inferMediaType("foto.png", "application/octet-stream")).toBe("image/png");
  });

  it("extensión desconocida devuelve el type original (lo rechaza la allowlist)", () => {
    expect(inferMediaType("video.mov", "")).toBe("");
  });
});
