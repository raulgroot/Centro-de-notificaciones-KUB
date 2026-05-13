/**
 * Print the RLS state of every public table.
 *   pnpm exec tsx --env-file=.env.local scripts/check-rls.ts
 */
import postgres from "postgres";
import { databaseEnv } from "../lib/env";

async function main() {
  const env = databaseEnv();
  const sql = postgres(env.url, { prepare: false, max: 1 });
  try {
    const rows = await sql<{ tablename: string; rowsecurity: boolean }[]>`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    console.log("RLS state (public schema):");
    for (const r of rows) {
      console.log(`  ${r.rowsecurity ? "✓" : "✗"} ${r.tablename}`);
    }
    const off = rows.filter((r) => !r.rowsecurity);
    if (off.length === 0) console.log("\nAll tables protected.");
    else
      console.log(
        `\n${off.length} table(s) still without RLS:`,
        off.map((r) => r.tablename),
      );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
