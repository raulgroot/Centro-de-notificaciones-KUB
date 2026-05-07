/**
 * Describes the columns of a specific Kublau table.
 * Run with: `pnpm kublau:describe <table_name>`
 */

import { getClickhouseClient } from "../lib/adapters/clickhouse-kublau/client";

async function main() {
  const tableName = process.argv[2];
  if (!tableName) {
    console.error("Usage: pnpm kublau:describe <table_name>");
    process.exit(1);
  }

  const client = getClickhouseClient();
  const result = await client.query({
    query: `DESCRIBE TABLE ${tableName}`,
    format: "JSON",
  });
  const data = (await result.json()) as { data: Array<Record<string, unknown>> };

  console.log(`\nColumns of ${tableName}:\n`);
  for (const row of data.data) {
    console.log(`  ${row.name}\t${row.type}`);
  }
}

main().catch((err) => {
  console.error("\n✗ Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
