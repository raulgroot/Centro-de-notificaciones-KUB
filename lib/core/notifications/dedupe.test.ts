/**
 * Tests para `dedupeById`. Lo que importa: que nunca queden dos filas con el
 * mismo `id` (eso es lo que tumbaba el upsert) y que gane la que trae el
 * envío más reciente, no la primera que llegó.
 */

import { describe, it, expect } from "vitest";
import { dedupeById } from "./dedupe";

const row = (id: string, last_sent_at: string | null, tag = "") => ({ id, last_sent_at, tag });

describe("dedupeById", () => {
  it("sin duplicados devuelve las mismas filas y duplicates=0", () => {
    const rows = [row("a", "2026-09-01T00:00:00.000Z"), row("b", null)];
    const r = dedupeById(rows);
    expect(r.rows).toHaveLength(2);
    expect(r.duplicates).toBe(0);
  });

  it("deja una sola fila por id y cuenta los descartes", () => {
    const rows = [
      row("a", "2026-09-01T00:00:00.000Z"),
      row("a", "2026-09-01T00:00:00.000Z"),
      row("b", null),
    ];
    const r = dedupeById(rows);
    expect(r.rows.map((x) => x.id).sort()).toEqual(["a", "b"]);
    expect(r.duplicates).toBe(1);
  });

  it("gana la fila con el last_sent_at más reciente, sin importar el orden", () => {
    const viejo = row("a", "2026-09-01T00:00:00.000Z", "viejo");
    const nuevo = row("a", "2026-09-25T05:55:44.000Z", "nuevo");
    expect(dedupeById([viejo, nuevo]).rows[0]?.tag).toBe("nuevo");
    expect(dedupeById([nuevo, viejo]).rows[0]?.tag).toBe("nuevo");
  });

  it("una fecha siempre le gana a null", () => {
    const sinFecha = row("a", null, "null");
    const conFecha = row("a", "2026-09-01T00:00:00.000Z", "fecha");
    expect(dedupeById([conFecha, sinFecha]).rows[0]?.tag).toBe("fecha");
    expect(dedupeById([sinFecha, conFecha]).rows[0]?.tag).toBe("fecha");
  });

  it("si empatan, gana la última que llegó", () => {
    const r = dedupeById([row("a", null, "primera"), row("a", null, "segunda")]);
    expect(r.rows[0]?.tag).toBe("segunda");
  });
});
