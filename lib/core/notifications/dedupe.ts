/**
 * Deduplica filas por `id` antes del upsert a `notifications_cache`.
 *
 * Por qué existe: alrededor de las 6:00 UTC el `blazer_query_401` de Kublau
 * a veces devuelve la misma fila dos veces (probablemente mientras refrescan
 * la tabla). Si dos filas con el mismo `id` caen en el mismo lote del upsert,
 * Postgres aborta con "ON CONFLICT DO UPDATE command cannot affect row a
 * second time" y el sync completo falla. Pasaba en ~43% de las corridas.
 *
 * Regla de desempate: gana la fila con el `last_sent_at` más reciente (es la
 * que trae el último envío real). Si empatan, gana la última que llegó.
 * Pure function — sin IO.
 */

export interface DedupeResult<T> {
  rows: T[];
  /** Cuántas filas se descartaron por `id` repetido. */
  duplicates: number;
}

export function dedupeById<T extends { id: string; last_sent_at: string | null }>(
  rows: T[],
): DedupeResult<T> {
  const byId = new Map<string, T>();
  for (const row of rows) {
    const prev = byId.get(row.id);
    if (!prev || isNewerOrEqual(row.last_sent_at, prev.last_sent_at)) {
      byId.set(row.id, row);
    }
  }
  return { rows: [...byId.values()], duplicates: rows.length - byId.size };
}

/** ISO strings (salen de `toISOString()`) comparan bien lexicográficamente. */
function isNewerOrEqual(a: string | null, b: string | null): boolean {
  if (a === null) return b === null;
  if (b === null) return true;
  return a >= b;
}
