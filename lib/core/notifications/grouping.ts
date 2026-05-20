/**
 * Two-level grouping for the notifications catalog: bucket by journey
 * (`movements[0]`) at the top level, then by product (`products[0]`) inside
 * each journey. Items with no movement go to "Sin clasificar"; items with
 * no product to "Sin producto".
 *
 * Each bucket carries a status summary (active/inactive/zombie/never) so the
 * UI can show counts without re-walking the list.
 */

import type { NotificationRecord } from "@/lib/ports/notification-source";
import { computeStatus, type NotificationStatus } from "./status";
import { toEpoch } from "./dates";

const UNCLASSIFIED_MOVEMENT = "Sin clasificar";
const UNCLASSIFIED_PRODUCT = "Sin producto";

export interface MovementGroupSummary {
  total: number;
  active: number;
  inactive: number;
  zombie: number;
  never: number;
}

export interface ProductSubgroup {
  product: string;
  items: NotificationRecord[];
  summary: MovementGroupSummary;
}

export interface MovementGroup {
  movement: string;
  items: NotificationRecord[];
  summary: MovementGroupSummary;
  /** Items sub-grouped by `products[0]`, sorted by member count desc. */
  subgroups: ProductSubgroup[];
}

function emptySummary(): MovementGroupSummary {
  return { total: 0, active: 0, inactive: 0, zombie: 0, never: 0 };
}

function summarize(items: NotificationRecord[], now: Date): MovementGroupSummary {
  const s = emptySummary();
  for (const m of items) {
    const status = computeStatus(m.lastSentAt, now).status;
    s[status]++;
    s.total++;
  }
  return s;
}

function sortByRecentSendDesc(a: NotificationRecord, b: NotificationRecord): number {
  // toEpoch maneja el caso Date|string|null — ver dates.ts para por qué
  // pueden venir como string desde unstable_cache.
  return toEpoch(b.lastSentAt) - toEpoch(a.lastSentAt);
}

function bucketByProduct(items: NotificationRecord[], now: Date): ProductSubgroup[] {
  const buckets = new Map<string, NotificationRecord[]>();
  for (const item of items) {
    const key = item.products[0]?.trim() || UNCLASSIFIED_PRODUCT;
    const arr = buckets.get(key);
    if (arr) arr.push(item);
    else buckets.set(key, [item]);
  }

  const subgroups: ProductSubgroup[] = [];
  for (const [product, members] of buckets) {
    members.sort(sortByRecentSendDesc);
    subgroups.push({ product, items: members, summary: summarize(members, now) });
  }

  subgroups.sort((a, b) => {
    // Push the catch-all bucket to the bottom; otherwise rank by size.
    if (a.product === UNCLASSIFIED_PRODUCT) return 1;
    if (b.product === UNCLASSIFIED_PRODUCT) return -1;
    return b.summary.total - a.summary.total;
  });

  return subgroups;
}

export function groupByMovement(items: NotificationRecord[]): MovementGroup[] {
  const buckets = new Map<string, NotificationRecord[]>();
  for (const item of items) {
    const key = item.movements[0]?.trim() || UNCLASSIFIED_MOVEMENT;
    const arr = buckets.get(key);
    if (arr) arr.push(item);
    else buckets.set(key, [item]);
  }

  const now = new Date();
  const groups: MovementGroup[] = [];
  for (const [movement, members] of buckets) {
    members.sort(sortByRecentSendDesc);
    groups.push({
      movement,
      items: members,
      summary: summarize(members, now),
      subgroups: bucketByProduct(members, now),
    });
  }

  groups.sort((a, b) => {
    if (a.movement === UNCLASSIFIED_MOVEMENT) return 1;
    if (b.movement === UNCLASSIFIED_MOVEMENT) return -1;
    return b.summary.total - a.summary.total;
  });

  return groups;
}

/** Filter a list of notifications by computed status. */
export function filterByStatus(
  items: NotificationRecord[],
  status: NotificationStatus | undefined,
  now: Date = new Date(),
): NotificationRecord[] {
  if (!status) return items;
  return items.filter((n) => computeStatus(n.lastSentAt, now).status === status);
}
