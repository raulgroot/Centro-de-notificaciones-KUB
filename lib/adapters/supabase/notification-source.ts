/**
 * NotificationSource backed by our Supabase cache (`notifications_cache`).
 * This is what the app reads in normal operation — fast (~50ms) and resilient
 * to Kublau outages. The Kublau adapter is reserved for sync + QA.
 *
 * See `docs/adr/0005-supabase-cache.md` (TODO).
 */

import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { notificationsCache } from "@/lib/db/schema";
import type {
  NotificationFacets,
  NotificationFilter,
  NotificationRecord,
  NotificationSource,
} from "@/lib/ports/notification-source";

type CacheRow = typeof notificationsCache.$inferSelect;

const mapRow = (row: CacheRow): NotificationRecord => ({
  id: row.id,
  themeName: row.themeName,
  subject: row.subject,
  smsText: row.smsText,
  products: row.products,
  movements: row.movements,
  clientTypes: row.clientTypes,
  isDebit: row.isDebit,
  isEmployee: row.isEmployee,
  hasTheme: row.hasTheme,
  updatedAt: row.updatedAtKublau,
  themeLink: row.themeLink,
  templateLink: row.templateLink,
  lastMailTo: row.lastMailTo,
  htmlBody: row.htmlBody,
  lastSentAt: row.lastSentAt,
  postmarkUrl: row.postmarkUrl,
});

function buildWhere(filter: NotificationFilter) {
  const clauses = [] as Array<ReturnType<typeof eq> | ReturnType<typeof or>>;

  if (filter.search) {
    const term = `%${filter.search}%`;
    const c = or(
      ilike(notificationsCache.subject, term),
      ilike(notificationsCache.themeName, term),
    );
    if (c) clauses.push(c);
  }
  // jsonb array contains: use the @> operator
  if (filter.product) {
    clauses.push(sql`${notificationsCache.products} @> ${JSON.stringify([filter.product])}::jsonb`);
  }
  if (filter.movement) {
    clauses.push(
      sql`${notificationsCache.movements} @> ${JSON.stringify([filter.movement])}::jsonb`,
    );
  }
  if (filter.clientType) {
    clauses.push(
      sql`${notificationsCache.clientTypes} @> ${JSON.stringify([filter.clientType])}::jsonb`,
    );
  }
  if (typeof filter.isDebit === "boolean") {
    clauses.push(eq(notificationsCache.isDebit, filter.isDebit));
  }
  if (typeof filter.isEmployee === "boolean") {
    clauses.push(eq(notificationsCache.isEmployee, filter.isEmployee));
  }
  if (typeof filter.hasTheme === "boolean") {
    clauses.push(eq(notificationsCache.hasTheme, filter.hasTheme));
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

export const supabaseNotificationSource: NotificationSource = {
  async list(filter: NotificationFilter = {}): Promise<NotificationRecord[]> {
    const db = getDb();
    const where = buildWhere(filter);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
    const offset = Math.max(filter.offset ?? 0, 0);

    const rows = await db
      .select()
      .from(notificationsCache)
      .where(where)
      .orderBy(desc(notificationsCache.updatedAtKublau), asc(notificationsCache.id))
      .limit(limit)
      .offset(offset);

    return rows.map(mapRow);
  },

  async getById(id: string): Promise<NotificationRecord | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(notificationsCache)
      .where(eq(notificationsCache.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  },

  async count(filter: NotificationFilter = {}): Promise<number> {
    const db = getDb();
    const where = buildWhere(filter);
    const [row] = await db.select({ n: count() }).from(notificationsCache).where(where);
    return row?.n ?? 0;
  },

  async facets(): Promise<NotificationFacets> {
    const db = getDb();
    // Use jsonb_array_elements_text to flatten the arrays and SELECT DISTINCT.
    const result = await db.execute<{ kind: string; v: string }>(sql`
      SELECT 'product' AS kind, value AS v
        FROM ${notificationsCache}, jsonb_array_elements_text(${notificationsCache.products})
      UNION
      SELECT 'movement', value
        FROM ${notificationsCache}, jsonb_array_elements_text(${notificationsCache.movements})
      UNION
      SELECT 'clientType', value
        FROM ${notificationsCache}, jsonb_array_elements_text(${notificationsCache.clientTypes})
    `);

    const products = new Set<string>();
    const movements = new Set<string>();
    const clientTypes = new Set<string>();
    for (const row of result) {
      if (!row.v) continue;
      if (row.kind === "product") products.add(row.v);
      else if (row.kind === "movement") movements.add(row.v);
      else if (row.kind === "clientType") clientTypes.add(row.v);
    }

    return {
      products: [...products].sort(),
      movements: [...movements].sort(),
      clientTypes: [...clientTypes].sort(),
    };
  },

  async listTables(): Promise<string[]> {
    // N/A for the Supabase cache adapter.
    return ["notifications_cache"];
  },
};
