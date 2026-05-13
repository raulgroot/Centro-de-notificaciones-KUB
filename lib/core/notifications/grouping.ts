/**
 * Group notifications into journey buckets using the first entry of
 * `movements[]`. Returns groups sorted by descending member count, with each
 * group's items sorted by `lastSentAt` desc (active templates surface first,
 * zombies sink).
 *
 * Items with no movement are bucketed under "Sin clasificar".
 */

import type { NotificationRecord } from "@/lib/ports/notification-source";
import { computeStatus, type NotificationStatus } from "./status";

const UNCLASSIFIED = "Sin clasificar";

export interface MovementGroupSummary {
  total: number;
  active: number;
  inactive: number;
  zombie: number;
  never: number;
}

export interface MovementGroup {
  movement: string;
  items: NotificationRecord[];
  summary: MovementGroupSummary;
}

export function groupByMovement(items: NotificationRecord[]): MovementGroup[] {
  const buckets = new Map<string, NotificationRecord[]>();
  for (const item of items) {
    const key = item.movements[0]?.trim() || UNCLASSIFIED;
    const arr = buckets.get(key);
    if (arr) arr.push(item);
    else buckets.set(key, [item]);
  }

  const now = new Date();
  const groups: MovementGroup[] = [];
  for (const [movement, members] of buckets) {
    const summary: MovementGroupSummary = {
      total: members.length,
      active: 0,
      inactive: 0,
      zombie: 0,
      never: 0,
    };
    for (const m of members) {
      const s = computeStatus(m.lastSentAt, now).status;
      summary[s]++;
    }
    members.sort((a, b) => {
      const at = a.lastSentAt?.getTime() ?? 0;
      const bt = b.lastSentAt?.getTime() ?? 0;
      return bt - at;
    });
    groups.push({ movement, items: members, summary });
  }

  groups.sort((a, b) => {
    if (a.movement === UNCLASSIFIED) return 1;
    if (b.movement === UNCLASSIFIED) return -1;
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
