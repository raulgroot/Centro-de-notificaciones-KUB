/**
 * Lista columnas + 1 fila de muestra de una pieza "alta nueva" para que
 * sepamos qué quotear y qué columnas exportar.
 */

import { getClickhouseClient } from "@/lib/adapters/clickhouse-kublau/client";

async function main() {
  const client = getClickhouseClient();

  console.log("── Columnas de blazer_query_401 ──");
  const cols = await client.query({
    query: "DESCRIBE blazer_query_401",
    format: "JSONEachRow",
  });
  const colRows = (await cols.json()) as { name: string; type: string }[];
  for (const c of colRows) console.log(`  ${c.name.padEnd(40)} ${c.type}`);

  console.log("\n── 1 fila de muestra con 'alta nueva' ──");
  const sample = await client.query({
    query: `SELECT * FROM blazer_query_401 WHERE has(MOVIMIENTO, 'alta nueva') LIMIT 1`,
    format: "JSONEachRow",
  });
  const samples = (await sample.json()) as Record<string, unknown>[];
  if (samples[0]) {
    for (const [k, v] of Object.entries(samples[0])) {
      const s = String(v).slice(0, 100);
      console.log(`  ${k.padEnd(40)} ${s}`);
    }
  }

  await client.close();
}

main().catch((err) => {
  console.error("\n✗ Error:", err);
  process.exit(1);
});
