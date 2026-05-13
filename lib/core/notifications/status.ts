/**
 * Liveness classification for a notification template, derived from the last
 * time it was sent (`lastSentAt`). Pure function — no IO. Used both in the
 * server to feed filters and in the UI to render the status badge.
 *
 * Thresholds were picked to match Raúl's mental model: a template that hasn't
 * fired in a month feels "stale"; nothing in 3 months feels effectively dead.
 */

export type NotificationStatus = "active" | "inactive" | "zombie" | "never";

const DAY_MS = 1000 * 60 * 60 * 24;
const ACTIVE_THRESHOLD_DAYS = 30;
const ZOMBIE_THRESHOLD_DAYS = 90;

export interface NotificationStatusInfo {
  status: NotificationStatus;
  daysSinceLastSent: number | null;
  label: string;
}

export function computeStatus(
  lastSentAt: Date | null,
  now: Date = new Date(),
): NotificationStatusInfo {
  if (!lastSentAt) {
    return { status: "never", daysSinceLastSent: null, label: "Sin enviar" };
  }
  const days = Math.floor((now.getTime() - lastSentAt.getTime()) / DAY_MS);
  if (days <= ACTIVE_THRESHOLD_DAYS) {
    return { status: "active", daysSinceLastSent: days, label: "Activa" };
  }
  if (days <= ZOMBIE_THRESHOLD_DAYS) {
    return { status: "inactive", daysSinceLastSent: days, label: "Inactiva" };
  }
  return { status: "zombie", daysSinceLastSent: days, label: "Zombie" };
}

/** Visual tokens used by the UI components so the meaning stays consistent. */
export const STATUS_STYLES: Record<
  NotificationStatus,
  { dot: string; bg: string; text: string; border: string }
> = {
  active: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  inactive: {
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  zombie: {
    dot: "bg-rose-500",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
  never: {
    dot: "bg-neutral-300",
    bg: "bg-neutral-50",
    text: "text-neutral-500",
    border: "border-neutral-200",
  },
};
