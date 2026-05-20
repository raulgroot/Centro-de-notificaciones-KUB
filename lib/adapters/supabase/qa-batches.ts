/**
 * CRUD para QA persistente + inbox de notificaciones.
 *
 * Vía PostgREST de Supabase (NO Drizzle/TCP) por la misma razón que el resto
 * del runtime — Vercel free tier no puede llegar al endpoint Postgres
 * directo de Supabase por IPv6.
 *
 * Scope por `owner_email`: todos los métodos públicos exigen el email del
 * dueño para que un usuario no pueda enumerar batches/notifs de otro
 * (defensa adicional sobre la auth de NextAuth en el middleware).
 */

import { getSupabaseAdmin } from "./admin";
import type { QAItemStatus, QANotificationKind, QANotificationPayload } from "@/lib/db/schema";

/* ─────────────────── Types ─────────────────── */

export interface QABatch {
  id: string;
  ownerEmail: string;
  name: string;
  referenceDate: Date;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
}

export interface QABatchItem {
  id: string;
  batchId: string;
  themeName: string;
  initialStatus: QAItemStatus;
  initialLastSentAt: Date | null;
  currentStatus: QAItemStatus;
  currentLastSentAt: Date | null;
  lastCheckedAt: Date;
  becameReadyAt: Date | null;
}

export interface QANotification {
  id: string;
  ownerEmail: string;
  batchId: string | null;
  itemId: string | null;
  kind: QANotificationKind;
  themeName: string | null;
  payload: QANotificationPayload;
  readAt: Date | null;
  createdAt: Date;
}

/* ─────────────────── Raw row → domain ─────────────────── */

interface BatchRow {
  id: string;
  owner_email: string;
  name: string;
  reference_date: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
}
interface ItemRow {
  id: string;
  batch_id: string;
  theme_name: string;
  initial_status: QAItemStatus;
  initial_last_sent_at: string | null;
  current_status: QAItemStatus;
  current_last_sent_at: string | null;
  last_checked_at: string;
  became_ready_at: string | null;
}
interface NotifRow {
  id: string;
  owner_email: string;
  batch_id: string | null;
  item_id: string | null;
  kind: QANotificationKind;
  theme_name: string | null;
  payload: QANotificationPayload;
  read_at: string | null;
  created_at: string;
}

const toDate = (s: string | null): Date | null => (s ? new Date(s) : null);

const mapBatch = (r: BatchRow): QABatch => ({
  id: r.id,
  ownerEmail: r.owner_email,
  name: r.name,
  referenceDate: new Date(r.reference_date),
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
  archived: r.archived,
});

const mapItem = (r: ItemRow): QABatchItem => ({
  id: r.id,
  batchId: r.batch_id,
  themeName: r.theme_name,
  initialStatus: r.initial_status,
  initialLastSentAt: toDate(r.initial_last_sent_at),
  currentStatus: r.current_status,
  currentLastSentAt: toDate(r.current_last_sent_at),
  lastCheckedAt: new Date(r.last_checked_at),
  becameReadyAt: toDate(r.became_ready_at),
});

const mapNotif = (r: NotifRow): QANotification => ({
  id: r.id,
  ownerEmail: r.owner_email,
  batchId: r.batch_id,
  itemId: r.item_id,
  kind: r.kind,
  themeName: r.theme_name,
  payload: r.payload ?? {},
  readAt: toDate(r.read_at),
  createdAt: new Date(r.created_at),
});

/* ─────────────────── Batches ─────────────────── */

export async function createBatch(args: {
  ownerEmail: string;
  name: string;
  referenceDate: Date;
  items: Array<{
    themeName: string;
    initialStatus: QAItemStatus;
    initialLastSentAt: Date | null;
  }>;
}): Promise<QABatch> {
  const supa = getSupabaseAdmin();

  // 1. Insert batch
  const { data: batchRow, error: batchErr } = await supa
    .from("qa_batches")
    .insert({
      owner_email: args.ownerEmail,
      name: args.name,
      reference_date: args.referenceDate.toISOString(),
    })
    .select("*")
    .single();
  if (batchErr || !batchRow) {
    throw new Error(`createBatch: ${batchErr?.message ?? "no row returned"}`);
  }
  const batch = mapBatch(batchRow as BatchRow);

  // 2. Insert items (en chunks de 100 por defensa frente a payloads grandes).
  const CHUNK = 100;
  for (let i = 0; i < args.items.length; i += CHUNK) {
    const slice = args.items.slice(i, i + CHUNK);
    const rows = slice.map((it) => ({
      batch_id: batch.id,
      theme_name: it.themeName,
      initial_status: it.initialStatus,
      initial_last_sent_at: it.initialLastSentAt?.toISOString() ?? null,
      current_status: it.initialStatus,
      current_last_sent_at: it.initialLastSentAt?.toISOString() ?? null,
      // Items que ya estaban "ready" al subir NO disparan notificación
      // — se marcan ready desde el inicio.
      became_ready_at: it.initialStatus === "ready" ? new Date().toISOString() : null,
    }));
    const { error } = await supa.from("qa_batch_items").insert(rows);
    if (error) throw new Error(`createBatch items: ${error.message}`);
  }

  return batch;
}

export async function listBatches(ownerEmail: string): Promise<QABatch[]> {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa
    .from("qa_batches")
    .select("*")
    .eq("owner_email", ownerEmail)
    .eq("archived", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listBatches: ${error.message}`);
  return (data as BatchRow[]).map(mapBatch);
}

export async function getBatch(
  id: string,
  ownerEmail: string,
): Promise<{ batch: QABatch; items: QABatchItem[] } | null> {
  const supa = getSupabaseAdmin();
  const { data: batchData, error: batchErr } = await supa
    .from("qa_batches")
    .select("*")
    .eq("id", id)
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  if (batchErr) throw new Error(`getBatch: ${batchErr.message}`);
  if (!batchData) return null;

  const { data: itemData, error: itemErr } = await supa
    .from("qa_batch_items")
    .select("*")
    .eq("batch_id", id)
    .order("theme_name");
  if (itemErr) throw new Error(`getBatch items: ${itemErr.message}`);

  return {
    batch: mapBatch(batchData as BatchRow),
    items: (itemData as ItemRow[]).map(mapItem),
  };
}

export async function archiveBatch(id: string, ownerEmail: string): Promise<void> {
  const supa = getSupabaseAdmin();
  const { error } = await supa
    .from("qa_batches")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_email", ownerEmail);
  if (error) throw new Error(`archiveBatch: ${error.message}`);
}

/* ─────────────────── Pending items lookup (for cron) ─────────────────── */

/**
 * Devuelve TODOS los items que aún no han transicionado a ready (de TODOS
 * los batches activos de TODOS los users). El cron lo usa para saber qué
 * theme names re-consultar contra Kublau.
 */
export async function listPendingItemsAcrossAllBatches(): Promise<
  Array<QABatchItem & { ownerEmail: string; referenceDate: Date }>
> {
  const supa = getSupabaseAdmin();
  // PostgREST: join batches via embedded select para traer reference_date
  // y owner_email en una sola query.
  const { data, error } = await supa
    .from("qa_batch_items")
    .select("*, qa_batches!inner(owner_email, reference_date, archived)")
    .is("became_ready_at", null);
  if (error) throw new Error(`listPendingItems: ${error.message}`);

  type JoinedRow = ItemRow & {
    qa_batches: { owner_email: string; reference_date: string; archived: boolean };
  };
  return (data as JoinedRow[])
    .filter((r) => !r.qa_batches.archived)
    .map((r) => ({
      ...mapItem(r),
      ownerEmail: r.qa_batches.owner_email,
      referenceDate: new Date(r.qa_batches.reference_date),
    }));
}

/**
 * Actualiza el estado actual de un item. Si la transición lo marca como
 * "ready" por primera vez, setea `became_ready_at`.
 */
export async function updateItemStatus(args: {
  itemId: string;
  currentStatus: QAItemStatus;
  currentLastSentAt: Date | null;
  becameReadyAt: Date | null;
}): Promise<void> {
  const supa = getSupabaseAdmin();
  const update: Record<string, unknown> = {
    current_status: args.currentStatus,
    current_last_sent_at: args.currentLastSentAt?.toISOString() ?? null,
    last_checked_at: new Date().toISOString(),
  };
  if (args.becameReadyAt) {
    update.became_ready_at = args.becameReadyAt.toISOString();
  }
  const { error } = await supa.from("qa_batch_items").update(update).eq("id", args.itemId);
  if (error) throw new Error(`updateItemStatus: ${error.message}`);
}

/* ─────────────────── Notifications inbox ─────────────────── */

export async function createNotification(args: {
  ownerEmail: string;
  batchId: string | null;
  itemId: string | null;
  kind: QANotificationKind;
  themeName: string | null;
  payload: QANotificationPayload;
}): Promise<void> {
  const supa = getSupabaseAdmin();
  const { error } = await supa.from("qa_notifications").insert({
    owner_email: args.ownerEmail,
    batch_id: args.batchId,
    item_id: args.itemId,
    kind: args.kind,
    theme_name: args.themeName,
    payload: args.payload,
  });
  if (error) throw new Error(`createNotification: ${error.message}`);
}

export async function listNotifications(args: {
  ownerEmail: string;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<QANotification[]> {
  const supa = getSupabaseAdmin();
  let q = supa
    .from("qa_notifications")
    .select("*")
    .eq("owner_email", args.ownerEmail)
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 50);
  if (args.unreadOnly) q = q.is("read_at", null);
  const { data, error } = await q;
  if (error) throw new Error(`listNotifications: ${error.message}`);
  return (data as NotifRow[]).map(mapNotif);
}

export async function countUnread(ownerEmail: string): Promise<number> {
  const supa = getSupabaseAdmin();
  const { count, error } = await supa
    .from("qa_notifications")
    .select("*", { count: "exact", head: true })
    .eq("owner_email", ownerEmail)
    .is("read_at", null);
  if (error) throw new Error(`countUnread: ${error.message}`);
  return count ?? 0;
}

export async function markRead(args: {
  ownerEmail: string;
  /** Si vacío o undefined, marca todas como leídas. */
  ids?: string[];
}): Promise<void> {
  const supa = getSupabaseAdmin();
  const now = new Date().toISOString();
  let q = supa
    .from("qa_notifications")
    .update({ read_at: now })
    .eq("owner_email", args.ownerEmail)
    .is("read_at", null);
  if (args.ids && args.ids.length > 0) q = q.in("id", args.ids);
  const { error } = await q;
  if (error) throw new Error(`markRead: ${error.message}`);
}
