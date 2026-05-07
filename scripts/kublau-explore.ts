/**
 * Discovery script: for each table in kublau_report, fetches a sample row and
 * column types using SELECT ... LIMIT 1 with JSON format metadata.
 */

import { getClickhouseClient } from "../lib/adapters/clickhouse-kublau/client";

interface JsonMeta {
  meta: Array<{ name: string; type: string }>;
  data: Array<Record<string, unknown>>;
  rows: number;
}

async function main() {
  const client = getClickhouseClient();
  const tablesResult = await client.query({ query: "SHOW TABLES", format: "JSON" });
  const tablesData = (await tablesResult.json()) as { data: Array<{ name: string }> };
  const tables = tablesData.data.map((r) => r.name);

  for (const table of tables) {
    console.log(`\n━━━ ${table} ━━━`);
    try {
      const sample = await client.query({
        query: `SELECT * FROM ${table} LIMIT 1`,
        format: "JSON",
      });
      const result = (await sample.json()) as JsonMeta;
      const columns = result.meta;
      const row = result.data[0];

      console.log(`Columns (${columns.length}):`);
      for (const col of columns) {
        const value = row?.[col.name];
        const valuePreview =
          value === null || value === undefined
            ? "(null)"
            : typeof value === "string" && value.length > 60
              ? `"${value.slice(0, 60)}…"`
              : JSON.stringify(value);
        console.log(`  ${col.name.padEnd(30)} ${col.type.padEnd(20)} ${valuePreview}`);
      }

      const countResult = await client.query({
        query: `SELECT count() AS n FROM ${table}`,
        format: "JSON",
      });
      const countData = (await countResult.json()) as { data: Array<{ n: string }> };
      console.log(`Rows: ${countData.data[0]?.n ?? "?"}`);
    } catch (err) {
      console.log(`  (error: ${err instanceof Error ? err.message : "unknown"})`);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
