/**
 * Imports a Kublau notifications CSV into Supabase `notifications_cache`.
 * Run: pnpm exec tsx --env-file=.env.local scripts/import-csv.ts <path-to-csv>
 *
 * Strategy: full snapshot upsert (same semantics as the live sync), but reads
 * from a static CSV file instead of ClickHouse. Idempotent — safe to re-run.
 */

import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { sql } from "drizzle-orm";
import { getDb } from "../lib/db/client";
import { notificationsCache, syncRuns } from "../lib/db/schema";

interface CsvRow {
  id: string;
  "CON THEME": string;
  "NOMBRE DE THEME/TRIGGER": string;
  "ASUNTO DEL CORREO": string;
  "TEXTO DE SMS": string;
  PRODUCTO: string;
  MOVIMIENTO: string;
  "TIPO DE CLIENTE": string;
  DEBITO: string;
  EMPLEADO: string;
  "ULTIMA ACTUALIZACIÓN": string;
  "LINK AL THEME O TRIGGER": string;
  "LINK AL THEME/TEMPLATE": string;
  "LINK AL TEMPLATE/PREVIEW"?: string;
  "MOMENTO EN QUE SE ENVIA (HH:MM)"?: string;
  RSR?: string;
  ACR?: string;
}

const parseJsonArray = (raw: string | undefined): string[] => {
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter((s) => s.trim() !== "");
  } catch {
    return [];
  }
};

const yesNo = (v: string | undefined): boolean => v?.toUpperCase() === "SI";
const nullIfEmpty = (v: string | undefined): string | null => (!v || v.trim() === "" ? null : v);

const parseDate = (v: string | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: tsx scripts/import-csv.ts <path-to-csv>");
    process.exit(1);
  }

  console.log(`→ Reading ${filePath}…`);
  const content = await readFile(filePath, "utf-8");
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  console.log(`→ Parsed ${rows.length} rows. Mapping…`);

  const mapped = rows.map((r) => ({
    id: r.id,
    themeName: r["NOMBRE DE THEME/TRIGGER"] ?? "",
    subject: r["ASUNTO DEL CORREO"] ?? "",
    smsText: nullIfEmpty(r["TEXTO DE SMS"]),
    products: parseJsonArray(r.PRODUCTO),
    movements: parseJsonArray(r.MOVIMIENTO),
    clientTypes: parseJsonArray(r["TIPO DE CLIENTE"]),
    isDebit: yesNo(r.DEBITO),
    isEmployee: yesNo(r.EMPLEADO),
    hasTheme: yesNo(r["CON THEME"]),
    updatedAtKublau: parseDate(r["ULTIMA ACTUALIZACIÓN"]),
    themeLink: nullIfEmpty(r["LINK AL THEME O TRIGGER"]),
    templateLink: nullIfEmpty(r["LINK AL THEME/TEMPLATE"]),
    templatePreviewLink: nullIfEmpty(r["LINK AL TEMPLATE/PREVIEW"]),
    sendTime: nullIfEmpty(r["MOMENTO EN QUE SE ENVIA (HH:MM)"]),
    rsr: yesNo(r.RSR),
    acr: yesNo(r.ACR),
    lastMailTo: null,
    htmlBody: null,
    lastSentAt: null,
    postmarkUrl: null,
    syncedAt: new Date(),
  }));

  const db = getDb();
  console.log(`→ Recording sync run…`);
  const [run] = await db.insert(syncRuns).values({ kind: "manual" }).returning();

  console.log(`→ Upserting in chunks of 100…`);
  const CHUNK = 100;
  for (let i = 0; i < mapped.length; i += CHUNK) {
    const chunk = mapped.slice(i, i + CHUNK);
    await db
      .insert(notificationsCache)
      .values(chunk)
      .onConflictDoUpdate({
        target: notificationsCache.id,
        set: {
          themeName: sql`excluded.theme_name`,
          subject: sql`excluded.subject`,
          smsText: sql`excluded.sms_text`,
          products: sql`excluded.products`,
          movements: sql`excluded.movements`,
          clientTypes: sql`excluded.client_types`,
          isDebit: sql`excluded.is_debit`,
          isEmployee: sql`excluded.is_employee`,
          hasTheme: sql`excluded.has_theme`,
          updatedAtKublau: sql`excluded.updated_at_kublau`,
          themeLink: sql`excluded.theme_link`,
          templateLink: sql`excluded.template_link`,
          templatePreviewLink: sql`excluded.template_preview_link`,
          sendTime: sql`excluded.send_time`,
          rsr: sql`excluded.rsr`,
          acr: sql`excluded.acr`,
          syncedAt: sql`excluded.synced_at`,
        },
      });
    process.stdout.write(`  ${Math.min(i + CHUNK, mapped.length)}/${mapped.length}\r`);
  }
  console.log("");

  if (run) {
    await db
      .update(syncRuns)
      .set({ finishedAt: new Date(), rowsSynced: mapped.length })
      .where(sql`${syncRuns.id} = ${run.id}`);
  }

  console.log(`✓ Imported ${mapped.length} rows into notifications_cache`);
  process.exit(0);
}

main().catch((err) => {
  console.error("✗", err instanceof Error ? err.message : err);
  process.exit(1);
});
