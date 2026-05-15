/**
 * Sync engine: Kublau ClickHouse → Supabase `notifications_cache`.
 *
 * Runs from:
 *  - Vercel Cron (`/api/sync` GET, scheduled daily at 06:00 UTC in vercel.json)
 *  - Manual button (`/api/sync` POST from the dashboard)
 *  - CLI script (`pnpm sync:run`)
 *
 * Strategy: full snapshot. Each run pulls every row from `blazer_query_401`,
 * upserts them by `id`, and records the run in `sync_runs`. Simpler and safer
 * than incremental sync given the modest table size (~767 rows).
 *
 * Transport: we use the Supabase JS client (HTTPS / PostgREST), NOT the
 * direct Postgres TCP connection. Direct Postgres is unreachable from Vercel
 * Functions on Supabase free tier (IPv6-only). PostgREST is always reachable.
 */

import { getClickhouseClient } from "@/lib/adapters/clickhouse-kublau/client";
import { getSupabaseAdmin } from "@/lib/adapters/supabase/admin";

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

const parseDate = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const nullIfEmpty = (v: string | null | undefined): string | null =>
  !v || v.trim() === "" ? null : v;

export interface SyncResult {
  rowsSynced: number;
  durationMs: number;
}

/** Snake-case row shape that matches the Supabase `notifications_cache` schema. */
interface CacheRowInsert {
  id: string;
  theme_name: string;
  subject: string;
  sms_text: string | null;
  products: string[];
  movements: string[];
  client_types: string[];
  is_debit: boolean;
  is_employee: boolean;
  has_theme: boolean;
  updated_at_kublau: string | null;
  theme_link: string | null;
  template_link: string | null;
  last_mail_to: string | null;
  html_body: string | null;
  last_sent_at: string | null;
  postmark_url: string | null;
  synced_at: string;
}

/**
 * Pulls every notification from Kublau and upserts into our Supabase cache.
 * Returns count + duration. Records the run in `sync_runs`.
 */
export async function runSync(kind: "cron" | "manual"): Promise<SyncResult> {
  const supabase = getSupabaseAdmin();
  const startedAtIso = new Date().toISOString();
  const startedAtMs = Date.now();

  // Open a sync_runs row up front so failures get correlated even if the
  // function throws partway through.
  const { data: run, error: runInsertErr } = await supabase
    .from("sync_runs")
    .insert({ kind, started_at: startedAtIso })
    .select("id")
    .single();
  if (runInsertErr || !run) {
    throw new Error(`Failed to open sync_runs row: ${runInsertErr?.message ?? "unknown"}`);
  }
  const runId = run.id as string;

  try {
    // 1. Read everything from ClickHouse Kublau.
    const ch = getClickhouseClient();
    const result = await ch.query({
      query: `SELECT ${KUBLAU_SELECT} FROM blazer_query_401`,
      format: "JSON",
    });
    const { data: rows } = (await result.json()) as { data: RawKublauRow[] };

    if (rows.length === 0) {
      throw new Error("Kublau returned 0 rows — refusing to wipe cache.");
    }

    const syncedAtIso = new Date().toISOString();
    const mapped: CacheRowInsert[] = rows.map((r) => ({
      id: r.id,
      theme_name: r.themeName ?? "",
      subject: r.subject ?? "",
      sms_text: nullIfEmpty(r.smsText),
      products: parseJsonArray(r.productsRaw),
      movements: parseJsonArray(r.movementsRaw),
      client_types: parseJsonArray(r.clientTypesRaw),
      is_debit: yesNo(r.debitFlag),
      is_employee: yesNo(r.employeeFlag),
      has_theme: yesNo(r.hasThemeFlag),
      updated_at_kublau: parseDate(r.updatedAt),
      theme_link: nullIfEmpty(r.themeLink),
      template_link: nullIfEmpty(r.templateLink),
      last_mail_to: nullIfEmpty(r.lastMailTo),
      html_body: nullIfEmpty(r.htmlBody),
      last_sent_at: parseDate(r.lastSentAt),
      postmark_url: nullIfEmpty(r.postmarkUrl),
      synced_at: syncedAtIso,
    }));

    // 2. Upsert in chunks. PostgREST has a per-request size cap (typically
    //    1 MB by default), and html_body alone can run 50-100 KB per row, so
    //    we use small chunks. 25 keeps each request comfortably under the
    //    limit while still cutting the round-trip count by ~30x vs single
    //    inserts.
    const CHUNK = 25;
    for (let i = 0; i < mapped.length; i += CHUNK) {
      const chunk = mapped.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("notifications_cache")
        .upsert(chunk, { onConflict: "id" });
      if (error) {
        throw new Error(`upsert chunk ${i}: ${error.message}`);
      }
    }

    // 3. Close the run row with success metadata.
    const finishedAtIso = new Date().toISOString();
    const durationMs = Date.now() - startedAtMs;
    await supabase
      .from("sync_runs")
      .update({ finished_at: finishedAtIso, rows_synced: rows.length })
      .eq("id", runId);

    return { rowsSynced: rows.length, durationMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Best-effort: record the error and re-throw.
    await supabase
      .from("sync_runs")
      .update({ finished_at: new Date().toISOString(), error: message })
      .eq("id", runId)
      .then(undefined, () => undefined);
    throw err;
  }
}

/** Returns the timestamp of the most recent successful sync, or null. */
export async function getLastSyncedAt(): Promise<Date | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sync_runs")
    .select("finished_at")
    .not("finished_at", "is", null)
    .is("error", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.finished_at) return null;
  return new Date(data.finished_at);
}
