/**
 * Tests para `classifyVerification` — la lógica que define el badge de
 * "Verificado / Desactualizado / Sin coincidencia / Sin datos" cuando
 * cruzamos el catálogo Kublau con los envíos reales en Postmark.
 *
 * Ventanas:
 *   - ≤ 24h entre Kublau y Postmark → "verified"
 *   - Postmark más fresco por ≥ 48h → "kublau_outdated"
 *   - Kublau dice "salió" pero Postmark no encuentra → "no_match"
 *   - Ambos null → "no_data"
 */

import { describe, it, expect } from "vitest";
import { classifyVerification } from "./postmark-link";

const NOW = new Date("2026-05-25T12:00:00Z");

function hoursOffset(hours: number): Date {
  return new Date(NOW.getTime() + hours * 3_600_000);
}

describe("classifyVerification", () => {
  it("ambos null → no_data", () => {
    const r = classifyVerification({
      kublauLastSentAt: null,
      postmarkLastSentAt: null,
    });
    expect(r).toBe("no_data");
  });

  it("solo Kublau → no_match (Postmark debió haber visto el envío)", () => {
    const r = classifyVerification({
      kublauLastSentAt: NOW,
      postmarkLastSentAt: null,
    });
    expect(r).toBe("no_match");
  });

  it("solo Postmark → kublau_outdated (sync atrasado)", () => {
    const r = classifyVerification({
      kublauLastSentAt: null,
      postmarkLastSentAt: NOW,
    });
    expect(r).toBe("kublau_outdated");
  });

  it("mismas fechas → verified", () => {
    const r = classifyVerification({
      kublauLastSentAt: NOW,
      postmarkLastSentAt: NOW,
    });
    expect(r).toBe("verified");
  });

  it("diferencia de 12h → verified (dentro de ventana de 24h)", () => {
    const r = classifyVerification({
      kublauLastSentAt: NOW,
      postmarkLastSentAt: hoursOffset(12),
    });
    expect(r).toBe("verified");
  });

  it("diferencia exacta de 24h → verified (límite inclusivo)", () => {
    const r = classifyVerification({
      kublauLastSentAt: NOW,
      postmarkLastSentAt: hoursOffset(24),
    });
    expect(r).toBe("verified");
  });

  it("Postmark 48h+ más fresco que Kublau → kublau_outdated", () => {
    const r = classifyVerification({
      kublauLastSentAt: NOW,
      postmarkLastSentAt: hoursOffset(48),
    });
    expect(r).toBe("kublau_outdated");
  });

  it("Postmark mucho más fresco (72h) → kublau_outdated", () => {
    const r = classifyVerification({
      kublauLastSentAt: NOW,
      postmarkLastSentAt: hoursOffset(72),
    });
    expect(r).toBe("kublau_outdated");
  });

  it("Postmark MÁS VIEJO que Kublau por mucho → no_match (mismatch raro)", () => {
    const r = classifyVerification({
      kublauLastSentAt: NOW,
      postmarkLastSentAt: hoursOffset(-72),
    });
    expect(r).toBe("no_match");
  });

  it("diferencia entre 24h y 48h con Postmark fresco → no_match (zona gris)", () => {
    // 36h: fuera de "verified" pero no llega al threshold de "kublau_outdated"
    const r = classifyVerification({
      kublauLastSentAt: NOW,
      postmarkLastSentAt: hoursOffset(36),
    });
    expect(r).toBe("no_match");
  });
});
