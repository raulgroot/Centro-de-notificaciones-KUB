/**
 * Discovery script: lists every table in Kublau's ClickHouse warehouse.
 * Run with: `pnpm kublau:tables`
 *
 * Once we know which tables hold notifications, we map them in
 * `lib/adapters/clickhouse-kublau/notification-source.ts`.
 */

import { kublauNotificationSource } from "../lib/adapters/clickhouse-kublau/notification-source";

async function main() {
  console.log("→ Connecting to Kublau ClickHouse…\n");

  const tables = await kublauNotificationSource.listTables();

  if (tables.length === 0) {
    console.log("⚠️  No tables found. Verify CLICKHOUSE_DATABASE in .env.local.");
    return;
  }

  console.log(`✓ Found ${tables.length} table(s) in the database:\n`);
  for (const table of tables) {
    console.log(`  • ${table}`);
  }
  console.log("\nNext: pick the relevant tables and run DESCRIBE on each to map columns.");
}

main().catch((err) => {
  console.error("\n✗ Error:", err instanceof Error ? err.message : err);
  console.error(
    "\nCheck that CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD are set in .env.local.",
  );
  process.exit(1);
});
