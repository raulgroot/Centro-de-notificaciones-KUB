/**
 * Verify whether each milestone of a campaign cohort actually fired.
 *
 * Strategy (Phase 1 — pre-Postmark):
 *  1. Match each `time`-based milestone to its templates via the well-known
 *     HSBC naming convention: position N → "NN reminder" prefix in
 *     `theme_name`, scoped by the campaign family in the same string
 *     ("bono de bienvenida" for BB, "ret" suffix for RP). See
 *     `templatePatternForMilestone()` for the rules.
 *  2. For each matched template, take its `last_sent_at` from the Supabase
 *     cache (single timestamp per template — the most recent send).
 *  3. Compare expected vs actual:
 *       - expected = cohort.loadDate + milestone.dayOffset
 *       - if today < expected           → "pending"
 *       - if any matched template was   → "sent" (use latest matched ts)
 *         sent within ±TOLERANCE_DAYS
 *         of expected
 *       - otherwise (expected in past,  → "missed"  (ALERT)
 *         no recent send)
 *  4. Event-based milestones aren't time-anchored, so they stay
 *     "not_applicable" — we'll wire those once Postmark is connected.
 *
 * Phase 1 caveat: `last_sent_at` is one timestamp per template. For OLDER
 * cohorts of the same campaign, that timestamp is usually from a NEWER
 * cohort. We compensate by:
 *   - Trusting verification for the most-recent active cohort.
 *   - Marking older cohorts as "stale_data" when the most-recent send is
 *     newer than the cohort window — the alert system won't fire false
 *     positives for ancient cohorts.
 *
 * Pure function — no IO, no React.
 */

import type { CampaignMilestone, CampaignLoad } from "@/lib/adapters/supabase/campaigns";

const MS_PER_DAY = 86_400_000;
const TOLERANCE_DAYS = 2;

export type MilestoneVerificationStatus =
  | "sent" //   confirmed: a matching template was sent within ±2 days of expected
  | "pending" //   expected date hasn't arrived yet
  | "missed" //   expected date passed, no matching send → ALERT
  | "stale_data" //   cohort is old; data we have can't disambiguate it from a newer cohort
  | "not_applicable"; //   event-based milestone or no day_offset

export interface MilestoneVerification {
  milestoneId: string;
  status: MilestoneVerificationStatus;
  expectedDate: Date | null;
  /** When the latest matching send happened (null if status !== "sent"). */
  actualSentAt: Date | null;
  /** Days late — positive when sent after expected, null when not sent. */
  daysOff: number | null;
  /** How many template rows matched the milestone's pattern (for debugging). */
  matchedCount: number;
}

/** Subset of a notification row we need to verify milestones. */
export interface MinimalSendInfo {
  themeName: string;
  lastSentAt: Date | null;
}

const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * MS_PER_DAY);
const stripTime = (d: Date): Date => {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};
const diffDays = (a: Date, b: Date): number => Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY);

/**
 * Build the predicate that matches templates belonging to one milestone.
 *
 * Conventions in the HSBC catalog (verified empirically on May 14):
 *   - BB milestones: theme_name like "01 reminder ... bono de bienvenida ..."
 *                    or "02 reminder ...", etc.
 *   - RP milestones: theme_name like "01 reminder ... - ret" (suffix)
 *   - Invitation / confirmation milestones don't follow the "NN reminder"
 *     scheme — we'll handle them once Postmark gives us tagged sends.
 */
export function templatePatternForMilestone(
  campaignId: string,
  milestone: CampaignMilestone,
): ((themeName: string) => boolean) | null {
  if (milestone.triggerType !== "time" || milestone.dayOffset === null) return null;

  // Reminder N milestones: their `position` aligns with the "NN reminder"
  // prefix in the theme name (position 2 = "01 reminder", etc.). We're
  // strict on the position-to-NN mapping for BB; RP also follows it.
  const labelMatch = milestone.label.toLowerCase().match(/reminder\s*0*(\d+)/);
  if (!labelMatch) return null;
  const reminderN = labelMatch[1]?.padStart(2, "0");
  if (!reminderN) return null;

  if (campaignId === "bb") {
    return (themeName: string) => {
      const t = themeName.toLowerCase();
      return t.startsWith(`${reminderN} reminder`) && t.includes("bono de bienvenida");
    };
  }
  if (campaignId === "rp") {
    return (themeName: string) => {
      const t = themeName.toLowerCase();
      return t.startsWith(`${reminderN} reminder`) && /\bret\b/.test(t);
    };
  }
  // Unknown campaign — caller falls back to "not_applicable".
  return null;
}

/**
 * Returns a verification result per milestone. The `cohorts` argument lets us
 * detect "stale_data" — if the cohort is older than the most recent cohort
 * of the same campaign, we can't trust `last_sent_at` to be ours.
 */
export function verifyCohortMilestones(args: {
  load: CampaignLoad;
  milestones: CampaignMilestone[];
  sends: MinimalSendInfo[];
  /** All active+completed loads of the same campaign, used to flag older cohorts as stale. */
  cohortsForCampaign: CampaignLoad[];
  now?: Date;
}): MilestoneVerification[] {
  const now = stripTime(args.now ?? new Date());
  const loadDay = stripTime(args.load.loadDate);

  // Is this load the most-recent active cohort? If a newer cohort exists,
  // most matching templates' `last_sent_at` belong to the newer one.
  const newestCohortDate = args.cohortsForCampaign.reduce<Date | null>((acc, c) => {
    const d = stripTime(c.loadDate);
    if (!acc || d.getTime() > acc.getTime()) return d;
    return acc;
  }, null);
  const isStale = newestCohortDate !== null && newestCohortDate.getTime() > loadDay.getTime();

  return args.milestones.map((m) => {
    const matcher = templatePatternForMilestone(args.load.campaignId, m);
    if (!matcher || m.triggerType !== "time" || m.dayOffset === null) {
      return {
        milestoneId: m.id,
        status: "not_applicable",
        expectedDate: null,
        actualSentAt: null,
        daysOff: null,
        matchedCount: 0,
      };
    }

    const expectedDate = addDays(loadDay, m.dayOffset);
    const matched = args.sends.filter((s) => matcher(s.themeName));

    if (isStale) {
      return {
        milestoneId: m.id,
        status: "stale_data",
        expectedDate,
        actualSentAt: null,
        daysOff: null,
        matchedCount: matched.length,
      };
    }

    if (now.getTime() < expectedDate.getTime()) {
      return {
        milestoneId: m.id,
        status: "pending",
        expectedDate,
        actualSentAt: null,
        daysOff: null,
        matchedCount: matched.length,
      };
    }

    // Find the most recent send among matched templates within tolerance.
    let bestSent: Date | null = null;
    for (const s of matched) {
      if (!s.lastSentAt) continue;
      const d = stripTime(s.lastSentAt);
      const dayDiff = Math.abs(diffDays(d, expectedDate));
      if (dayDiff <= TOLERANCE_DAYS) {
        if (!bestSent || d.getTime() > bestSent.getTime()) bestSent = d;
      }
    }

    if (bestSent) {
      return {
        milestoneId: m.id,
        status: "sent",
        expectedDate,
        actualSentAt: bestSent,
        daysOff: diffDays(bestSent, expectedDate),
        matchedCount: matched.length,
      };
    }

    return {
      milestoneId: m.id,
      status: "missed",
      expectedDate,
      actualSentAt: null,
      daysOff: null,
      matchedCount: matched.length,
    };
  });
}

/** Per-cohort alert helper: count of "missed" milestones for the UI banner. */
export function countMissedMilestones(verifications: MilestoneVerification[]): number {
  return verifications.filter((v) => v.status === "missed").length;
}
