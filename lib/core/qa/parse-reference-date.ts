/**
 * Parse a `YYYY-MM-DD` string into a Date anchored at midnight in CDMX
 * (UTC-6, sin DST). Acepta el formato del `<input type="date">` HTML5.
 *
 * Anchor en CDMX porque coincide con el modelo mental del usuario que sube
 * los cambios "el día X" — cualquier envío de Kublau con timestamp ≥ medianoche
 * CDMX cuenta como "después de los cambios".
 *
 * Devuelve `null` si el input es null, vacío, mal formado, o una fecha inválida
 * (ej. "2026-02-30").
 *
 * Pure function — no IO, no side effects. Testable.
 */
export function parseReferenceDate(raw: string | null | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00-06:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
