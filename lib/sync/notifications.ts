/**
 * Sync engine: Kublau ClickHouse → Supabase notifications_cache.
 *
 * Run by:
 *  - Vercel Cron (`/api/sync` GET, scheduled hourly)
 *  - Manual button (`/api/sync` POST from the app)
 *  - CLI script (`pnpm sync:run`)
 *
 * Strategy: full snapshot. Each run fetches all rows from blazer_query_401,
 * upserts them by id, and records the run in `sync_runs`. Simpler and safer
 * than incremental sync given the modest table size (~767 rows).
 */

import { sql } from "drizzle-orm";
import { getClickhouseClient } from "@/lib/adapters/clickhouse-kublau/client";
import { getDb } from "@/lib/db/client";
import { notificationsCache, syncRuns } from "@/lib/db/schema";

interface RawKublauRow {
  id: string;
  themeName: string;
  subject: string;
  smsText: string;
  productsRaw: string;
  movementsRaw: string;
  clientTypesRaw: string;
  debitFlag: string;
  employeeFlag: string;
  hasThemeFlag: string;
  updatedAt: string | null;
  themeLink: string;
  templateLink: string;
  lastMailTo: string | null;
  htmlBody: string | null;
  lastSentAt: string | null;
  postmarkUrl: string | null;
}

const KUBLAU_SELECT = `
  id,
  \`NOMBRE DE THEME/TRIGGER\`           AS themeName,
  \`ASUNTO DEL CORREO\`                 AS subject,
  \`TEXTO DE SMS\`                      AS smsText,
  \`PRODUCTO\`                          AS productsRaw,
  \`MOVIMIENTO\`                        AS movementsRaw,
  \`TIPO DE CLIENTE\`                   AS clientTypesRaw,
  \`DEBITO\`                            AS debitFlag,
  \`EMPLEADO\`                          AS employeeFlag,
  \`CON THEME\`                         AS hasThemeFlag,
  \`ULTIMA ACTUALIZACIÓN\`              AS updatedAt,
  \`LINK AL THEME O TRIGGER\`           AS themeLink,
  \`LINK AL THEME/TEMPLATE\`            AS templateLink,
  \`ULTIMO MAIL DEST\`                  AS lastMailTo,
  \`CUERPO DEL ULTIMO MAIL\`            AS htmlBody,
  \`FECHA DE ENVIO\`                    AS lastSentAt,
  \`POSTMARK_URL\`                      AS postmarkUrl
`;

const parseJsonArray = (raw: string | null | undefined): string[] => {
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const yesNo = (v: string | null | undefined): boolean => v?.toUpperCase() === "SI";

const parseDate = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const nullIfEmpty = (v: string | null | undefined): string | null =>
  !v || v.trim() === "" ? null : v;

export interface SyncResult {
  rowsSynced: number;
  durationMs: number;
}

/**
 * Pulls every notification from Kublau and upserts into our cache.
 * Returns count + duration. Records the run in `sync_runs`.
 */
export async function runSync(kind: "cron" | "manual"): Promise<SyncResult> {
  const db = getDb();
  const startedAt = new Date();

  // Insert a sync_runs row up front so we can correlate failures.
  const [run] = await db.insert(syncRuns).values({ kind, startedAt }).returning();
  if (!run) throw new Error("Failed to insert sync_runs row");

  try {
    const ch = getClickhouseClient();
    const result = await ch.query({
      query: `SELECT ${KUBLAU_SELECT} FROM blazer_query_401`,
      format: "JSON",
    });
    const data = (await result.json()) as { data: RawKublauRow[] };
    const rows = data.data;

    if (rows.length === 0) {
      throw new Error("Kublau returned 0 rows — refusing to wipe cache.");
    }

    // Map to cache rows
    const mapped = rows.map((r) => ({
      id: r.id,
      themeName: r.themeName ?? "",
      subject: r.subject ?? "",
      smsText: nullIfEmpty(r.smsText),
      products: parseJsonArray(r.productsRaw),
      movements: parseJsonArray(r.movementsRaw),
      clientTypes: parseJsonArray(r.clientTypesRaw),
      isDebit: yesNo(r.debitFlag),
      isEmployee: yesNo(r.employeeFlag),
      hasTheme: yesNo(r.hasThemeFlag),
      updatedAtKublau: parseDate(r.updatedAt),
      themeLink: nullIfEmpty(r.themeLink),
      templateLink: nullIfEmpty(r.templateLink),
      lastMailTo: nullIfEmpty(r.lastMailTo),
      htmlBody: nullIfEmpty(r.htmlBody),
      lastSentAt: parseDate(r.lastSentAt),
      postmarkUrl: nullIfEmpty(r.postmarkUrl),
      syncedAt: new Date(),
    }));

    // Upsert in chunks (Postgres has parameter limits)
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
            lastMailTo: sql`excluded.last_mail_to`,
            htmlBody: sql`excluded.html_body`,
            lastSentAt: sql`excluded.last_sent_at`,
            postmarkUrl: sql`excluded.postmark_url`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    await db
      .update(syncRuns)
      .set({ finishedAt, rowsSynced: rows.length })
      .where(sql`${syncRuns.id} = ${run.id}`);

    return { rowsSynced: rows.length, durationMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(syncRuns)
      .set({ finishedAt: new Date(), error: message })
      .where(sql`${syncRuns.id} = ${run.id}`);
    throw err;
  }
}

/** Returns the timestamp of the most recent successful sync, or null. */
export async function getLastSyncedAt(): Promise<Date | null> {
  const db = getDb();
  const result = await db.query.syncRuns.findFirst({
    where: (runs, { isNotNull }) => isNotNull(runs.finishedAt),
    orderBy: (runs, { desc }) => [desc(runs.finishedAt)],
  });
  return result?.finishedAt ?? null;
}
