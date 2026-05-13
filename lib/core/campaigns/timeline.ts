/**
 * Pure timeline math for campaign loads.
 *
 * Given a `CampaignLoad` (with a `loadDate`), the list of milestones for its
 * campaign, and "now", we compute:
 *   - elapsed days since the carga
 *   - which milestones are done / current / next / future
 *   - the next upcoming time-based milestone with its absolute date
 *   - a progress percentage from 0% (carga) to 100% (last milestone)
 *
 * Event-based milestones (`triggerType !== 'time'`) are NOT on the timeline
 * — they live in a side panel because their timing depends on user actions
 * or HSBC notifications.
 */

import type { CampaignMilestone, CampaignLoad } from "@/lib/adapters/supabase/campaigns";

export type MilestoneState = "done" | "current" | "next" | "future";

export interface TimelinePoint {
  milestone: CampaignMilestone;
  /** Absolute calendar date computed from `loadDate + dayOffset`. */
  date: Date;
  state: MilestoneState;
}

export interface CampaignTimelineView {
  load: CampaignLoad;
  elapsedDays: number;
  totalDays: number;
  progressPercent: number; // 0..100, clamped
  ended: boolean;
  timeline: TimelinePoint[];
  /** Next time-based milestone (the "Próxima notificación" card source). */
  next: TimelinePoint | null;
  /** Non-time milestones (events, HSBC-triggered) for display elsewhere. */
  conditional: CampaignMilestone[];
  /** Days until deadline; null when no deadline set. */
  daysToDeadline: number | null;
}

const MS_PER_DAY = 86_400_000;

const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * MS_PER_DAY);

const floorDays = (ms: number): number => Math.floor(ms / MS_PER_DAY);

export function computeCampaignTimeline(
  load: CampaignLoad,
  milestones: CampaignMilestone[],
  now: Date,
): CampaignTimelineView {
  // Strip time-of-day so "elapsedDays" stays an integer regardless of tz nudges.
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const loadDay = new Date(load.loadDate);
  loadDay.setUTCHours(0, 0, 0, 0);

  const elapsedDays = floorDays(today.getTime() - loadDay.getTime());

  // Time-based milestones only, ordered by dayOffset ascending.
  const timeBased = milestones
    .filter((m) => m.triggerType === "time" && m.dayOffset !== null)
    .sort((a, b) => (a.dayOffset ?? 0) - (b.dayOffset ?? 0));

  const conditional = milestones.filter((m) => m.triggerType !== "time");

  const totalDays = timeBased.length > 0 ? (timeBased[timeBased.length - 1]?.dayOffset ?? 0) : 0;
  const ended = totalDays > 0 ? elapsedDays >= totalDays : false;
  const progressPercent =
    totalDays > 0 ? Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100)) : 0;

  const nextIdx = timeBased.findIndex((m) => (m.dayOffset ?? 0) > elapsedDays);
  const prevIdx = nextIdx === -1 ? timeBased.length - 1 : nextIdx - 1;

  const timeline: TimelinePoint[] = timeBased.map((m, i) => {
    const date = addDays(loadDay, m.dayOffset ?? 0);
    let state: MilestoneState;
    if ((m.dayOffset ?? 0) <= elapsedDays) {
      state = i === prevIdx && !ended ? "current" : "done";
    } else if (i === nextIdx) {
      state = "next";
    } else {
      state = "future";
    }
    return { milestone: m, date, state };
  });

  const next = nextIdx >= 0 ? (timeline[nextIdx] ?? null) : null;

  const daysToDeadline = load.deadline
    ? floorDays(load.deadline.getTime() - today.getTime())
    : null;

  return {
    load,
    elapsedDays,
    totalDays,
    progressPercent,
    ended,
    timeline,
    next,
    conditional,
    daysToDeadline,
  };
}
