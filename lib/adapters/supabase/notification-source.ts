/**
 * NotificationSource backed by Supabase via the JS client (HTTPS, not Postgres TCP).
 *
 * Why HTTPS instead of Drizzle: Vercel Functions can't reach Supabase's direct
 * Postgres endpoint when it's IPv6-only (which is the default on free tier).
 * The Supabase JS client goes over the REST API (PostgREST) which is always
 * reachable. ~50-150ms per query — still much faster than ClickHouse.
 *
 * Drizzle + Postgres remain useful for migrations and one-off scripts (run
 * locally where IPv6 works) but are not used at runtime.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminEnv } from "@/lib/env";
import type {
  NotificationFacets,
  NotificationFilter,
  NotificationRecord,
  NotificationSource,
} from "@/lib/ports/notification-source";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  const env = supabaseAdminEnv();
  _client = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

interface CacheRow {
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
  template_preview_link: string | null;
  send_time: string | null;
  last_mail_to: string | null;
  html_body: string | null;
  last_sent_at: string | null;
  postmark_url: string | null;
}

const mapRow = (row: CacheRow): NotificationRecord => ({
  id: row.id,
  themeName: row.theme_name,
  subject: row.subject,
  smsText: row.sms_text,
  products: row.products ?? [],
  movements: row.movements ?? [],
  clientTypes: row.client_types ?? [],
  isDebit: row.is_debit,
  isEmployee: row.is_employee,
  hasTheme: row.has_theme,
  updatedAt: row.updated_at_kublau ? new Date(row.updated_at_kublau) : null,
  themeLink: row.theme_link,
  templateLink: row.template_link,
  templatePreviewLink: row.template_preview_link,
  sendTime: row.send_time,
  lastMailTo: row.last_mail_to,
  htmlBody: row.html_body,
  lastSentAt: row.last_sent_at ? new Date(row.last_sent_at) : null,
  postmarkUrl: row.postmark_url,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filter: NotificationFilter): any {
  let q = query;
  if (filter.search) {
    const t = `%${filter.search}%`;
    q = q.or(`subject.ilike.${t},theme_name.ilike.${t}`);
  }
  if (filter.product) q = q.contains("products", [filter.product]);
  if (filter.movement) q = q.contains("movements", [filter.movement]);
  if (filter.clientType) q = q.contains("client_types", [filter.clientType]);
  if (typeof filter.isDebit === "boolean") q = q.eq("is_debit", filter.isDebit);
  if (typeof filter.isEmployee === "boolean") q = q.eq("is_employee", filter.isEmployee);
  if (typeof filter.hasTheme === "boolean") q = q.eq("has_theme", filter.hasTheme);
  return q;
}

export const supabaseNotificationSource: NotificationSource = {
  async list(filter: NotificationFilter = {}): Promise<NotificationRecord[]> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
    const offset = Math.max(filter.offset ?? 0, 0);

    let q = client()
      .from("notifications_cache")
      .select("*")
      .order("updated_at_kublau", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    q = applyFilters(q, filter);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase list error: ${error.message}`);
    return (data as CacheRow[]).map(mapRow);
  },

  async listAllLight(filter: NotificationFilter = {}): Promise<NotificationRecord[]> {
    // Fetch every matching row WITHOUT html_body — the heavy column. Used by
    // the grouped / card views which render hundreds of cards but only need
    // metadata. Supabase caps select at 1000 rows by default which is fine
    // for our ~767-row dataset; if it grows past that we'll paginate.
    const lightFields = [
      "id",
      "theme_name",
      "subject",
      "sms_text",
      "products",
      "movements",
      "client_types",
      "is_debit",
      "is_employee",
      "has_theme",
      "updated_at_kublau",
      "theme_link",
      "template_link",
      "template_preview_link",
      "send_time",
      "last_mail_to",
      "last_sent_at",
      "postmark_url",
    ].join(",");

    let q = client()
      .from("notifications_cache")
      .select(lightFields)
      .order("last_sent_at", { ascending: false, nullsFirst: false })
      .order("updated_at_kublau", { ascending: false, nullsFirst: false })
      .limit(1000);
    q = applyFilters(q, filter);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase listAllLight error: ${error.message}`);
    const rows = data as unknown as Omit<CacheRow, "html_body">[];
    return rows.map((row) => mapRow({ ...row, html_body: null } as CacheRow));
  },

  async getById(id: string): Promise<NotificationRecord | null> {
    const { data, error } = await client()
      .from("notifications_cache")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getById error: ${error.message}`);
    return data ? mapRow(data as CacheRow) : null;
  },

  async count(filter: NotificationFilter = {}): Promise<number> {
    let q = client().from("notifications_cache").select("id", { count: "exact", head: true });
    q = applyFilters(q, filter);
    const { count, error } = await q;
    if (error) throw new Error(`Supabase count error: ${error.message}`);
    return count ?? 0;
  },

  async facets(): Promise<NotificationFacets> {
    // Pull all rows' array columns and aggregate client-side.
    // ~767 rows × 3 small arrays = trivial.
    const { data, error } = await client()
      .from("notifications_cache")
      .select("products,movements,client_types");
    if (error) throw new Error(`Supabase facets error: ${error.message}`);

    const products = new Set<string>();
    const movements = new Set<string>();
    const clientTypes = new Set<string>();
    for (const row of data as Array<Pick<CacheRow, "products" | "movements" | "client_types">>) {
      for (const v of row.products ?? []) if (v) products.add(v);
      for (const v of row.movements ?? []) if (v) movements.add(v);
      for (const v of row.client_types ?? []) if (v) clientTypes.add(v);
    }
    return {
      products: [...products].sort(),
      movements: [...movements].sort(),
      clientTypes: [...clientTypes].sort(),
    };
  },

  async listTables(): Promise<string[]> {
    return ["notifications_cache"];
  },
};

/** Last-synced timestamp for the sync indicator. */
export async function getLastSyncedAt(): Promise<Date | null> {
  const { data, error } = await client()
    .from("sync_runs")
    .select("finished_at")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data?.finished_at ? new Date(data.finished_at) : null;
}

/** How many templates have been modified in Kublau since the given date. */
export async function countRecentlyUpdated(since: Date): Promise<number> {
  const { count, error } = await client()
    .from("notifications_cache")
    .select("id", { count: "exact", head: true })
    .gte("updated_at_kublau", since.toISOString());
  if (error) return 0;
  return count ?? 0;
}

/**
 * Lists every template's scheduled send time. `MOMENTO EN QUE SE ENVIA (HH:MM)`
 * doesn't live in ClickHouse — only in the CSV-fed cache. Snapshot freshness
 * is acceptable: scheduled times rarely change.
 */
export async function listTemplateSendTimes(): Promise<Array<{ sendTime: string | null }>> {
  const { data, error } = await client().from("notifications_cache").select("send_time");
  if (error) return [];
  return (data ?? []).map((row) => ({
    sendTime:
      typeof row.send_time === "string" && row.send_time.trim() ? row.send_time.trim() : null,
  }));
}
