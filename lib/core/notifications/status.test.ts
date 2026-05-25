/**
 * Tests para `computeStatus` — la función que decide si una notificación
 * está active / inactive / zombie / never según `lastSentAt`.
 *
 * Thresholds:
 *   - active: ≤ 30 días
 *   - inactive: 31-90 días
 *   - zombie: > 90 días
 *   - never: sin fecha
 *
 * Tests exactos en los bordes (días 30, 31, 90, 91) porque ahí es donde
 * un off-by-one silencioso causaría más confusión en el UI.
 */

import { describe, it, expect } from "vitest";
import { computeStatus } from "./status";

const FIXED_NOW = new Date("2026-05-25T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(FIXED_NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("computeStatus", () => {
  it("retorna 'never' cuando lastSentAt es null", () => {
    const result = computeStatus(null, FIXED_NOW);
    expect(result.status).toBe("never");
    expect(result.daysSinceLastSent).toBeNull();
    expect(result.label).toBe("Sin enviar");
  });

  it("retorna 'active' para envío de hoy (0 días)", () => {
    const result = computeStatus(FIXED_NOW, FIXED_NOW);
    expect(result.status).toBe("active");
    expect(result.daysSinceLastSent).toBe(0);
    expect(result.label).toBe("Activa");
  });

  it("retorna 'active' en el límite (30 días exactos)", () => {
    const result = computeStatus(daysAgo(30), FIXED_NOW);
    expect(result.status).toBe("active");
    expect(result.daysSinceLastSent).toBe(30);
  });

  it("retorna 'inactive' al día 31 (justo después del límite active)", () => {
    const result = computeStatus(daysAgo(31), FIXED_NOW);
    expect(result.status).toBe("inactive");
    expect(result.daysSinceLastSent).toBe(31);
    expect(result.label).toBe("Inactiva");
  });

  it("retorna 'inactive' en el límite (90 días exactos)", () => {
    const result = computeStatus(daysAgo(90), FIXED_NOW);
    expect(result.status).toBe("inactive");
  });

  it("retorna 'zombie' al día 91 (justo después del límite inactive)", () => {
    const result = computeStatus(daysAgo(91), FIXED_NOW);
    expect(result.status).toBe("zombie");
    expect(result.daysSinceLastSent).toBe(91);
    expect(result.label).toBe("Zombie");
  });

  it("retorna 'zombie' para fechas muy antiguas", () => {
    const result = computeStatus(daysAgo(365), FIXED_NOW);
    expect(result.status).toBe("zombie");
    expect(result.daysSinceLastSent).toBe(365);
  });

  /**
   * Test específico para el bug que disparó la creación de toDate/toEpoch/toIso:
   * unstable_cache devuelve ISO strings en cache hits. computeStatus debe
   * aceptarlos sin crashear.
   */
  it("acepta un ISO string (cache hit de unstable_cache) sin crashear", () => {
    const isoString = daysAgo(5).toISOString();
    const result = computeStatus(isoString, FIXED_NOW);
    expect(result.status).toBe("active");
    expect(result.daysSinceLastSent).toBe(5);
  });
});
