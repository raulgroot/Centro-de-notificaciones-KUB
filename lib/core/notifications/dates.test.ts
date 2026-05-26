/**
 * Tests para los helpers de fechas usados en `NotificationRecord`.
 *
 * Estos helpers existen específicamente para sobrevivir el round-trip por
 * `unstable_cache` (que serializa Date → ISO string sin rehidratar). Los
 * tests reproducen el escenario:
 *   1. Entrada como Date (cache miss)
 *   2. Entrada como ISO string (cache hit)
 *   3. Entradas nulas / inválidas (defensive)
 */

import { describe, it, expect } from "vitest";
import { toDate, toEpoch, toIso } from "./dates";

describe("toDate", () => {
  it("acepta un Date real y lo devuelve tal cual", () => {
    const d = new Date("2026-05-25T10:00:00Z");
    expect(toDate(d)).toBe(d);
  });

  it("convierte un ISO string a Date (simula cache hit de unstable_cache)", () => {
    const iso = "2026-05-25T10:00:00.000Z";
    const result = toDate(iso);
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe(iso);
  });

  it("devuelve null para null", () => {
    expect(toDate(null)).toBeNull();
  });

  it("devuelve null para undefined", () => {
    expect(toDate(undefined)).toBeNull();
  });

  it("devuelve null para string vacío", () => {
    expect(toDate("")).toBeNull();
  });

  it("devuelve null para una fecha inválida", () => {
    expect(toDate("not-a-date")).toBeNull();
  });

  it("devuelve null para un Date inválido (NaN)", () => {
    // `new Date("invalid")` produce un Date con tiempo NaN.
    expect(toDate(new Date("invalid"))).toBeNull();
  });
});

describe("toEpoch", () => {
  it("devuelve los ms del Date", () => {
    const d = new Date("2026-05-25T10:00:00Z");
    expect(toEpoch(d)).toBe(d.getTime());
  });

  it("convierte un ISO string a epoch ms", () => {
    const iso = "2026-05-25T10:00:00.000Z";
    expect(toEpoch(iso)).toBe(new Date(iso).getTime());
  });

  it("devuelve 0 para null (apto para sort comparator)", () => {
    expect(toEpoch(null)).toBe(0);
  });

  it("devuelve 0 para fechas inválidas", () => {
    expect(toEpoch("invalid")).toBe(0);
    expect(toEpoch(undefined)).toBe(0);
  });
});

describe("toIso", () => {
  it("convierte un Date a ISO string", () => {
    const d = new Date("2026-05-25T10:00:00Z");
    expect(toIso(d)).toBe("2026-05-25T10:00:00.000Z");
  });

  it("normaliza un ISO string round-trip", () => {
    const iso = "2026-05-25T10:00:00.000Z";
    expect(toIso(iso)).toBe(iso);
  });

  it("devuelve null para null", () => {
    expect(toIso(null)).toBeNull();
  });

  it("devuelve null para fechas inválidas (no crashea)", () => {
    expect(toIso("invalid")).toBeNull();
  });
});
