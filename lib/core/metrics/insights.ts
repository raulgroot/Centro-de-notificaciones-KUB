/**
 * Pure insight derivations from Kublau metrics data.
 *
 * Takes the raw outputs of `MetricsSource` (plus a couple of metadata helpers)
 * and produces concrete, human-readable insights for the dashboard. No I/O —
 * keeps the rules testable and independent of the data source.
 *
 * Conventions:
 *  - Percentages are returned as 0..1 fractions; UI formats them.
 *  - Anything that would be misleading with thin data (e.g. open-rate winners
 *    on a piece that only had 3 sends) is gated by `MIN_SENT_FOR_RATE`.
 *  - "Last week" = the most recent week present in the weekly tables, since
 *    Kublau decides cadence. "Previous week" = the one immediately before it.
 */

import type {
  PieceMetrics,
  MetricsSummary,
  WeeklyByMovementRow,
  WeeklyByProductRow,
} from "@/lib/ports/metrics-source";
import type { TemplateAnalysisRow } from "@/lib/adapters/clickhouse-kublau/notification-source";

/** Minimum sent volume before a piece is eligible for "best/worst by rate". */
const MIN_SENT_FOR_RATE = 100;

export interface WeeklyDelta {
  key: string;
  current: number;
  previous: number;
  /** Absolute change. `current - previous`. */
  delta: number;
  /** Relative change (0..N). NaN if previous=0 and current>0; 0 if both=0. */
  pct: number;
}

export interface WeeklyMomentum {
  /** Always non-null when there is data, otherwise null. */
  current: { label: string; total: number } | null;
  previous: { label: string; total: number } | null;
  /** Total delta vs prior week. Null if not computable. */
  totalDelta: WeeklyDelta | null;
  /** Top product by absolute growth (positive). Null if no growth or no data. */
  topGrowingProduct: WeeklyDelta | null;
  /** Top product by absolute decline (negative). Null if nothing falling. */
  topFallingProduct: WeeklyDelta | null;
  topGrowingMovement: WeeklyDelta | null;
  topFallingMovement: WeeklyDelta | null;
}

export interface WinnersInsights {
  bestByOpenRate: PieceMetrics | null;
  topByClickRate: PieceMetrics[]; // up to 3
  bestProductByOpenRate: { product: string; openRate: number; sent: number } | null;
}

export interface AttentionInsights {
  lowOpenRate: PieceMetrics[]; // open < 10% AND sent >= MIN_SENT_FOR_RATE
  zeroOpens: PieceMetrics[]; // opens=0 with sent >= MIN_SENT_FOR_RATE
  outOfTimeRate: number; // outOfTime / sent across all pieces (0..1)
  outOfTimeOffenders: PieceMetrics[]; // pieces with >25% RSR-out-of-time, top 5
}

export interface ExecutiveSummary {
  totalSent: number;
  avgOpenRate: number;
  avgClickRate: number;
  pieceCount: number;
  openRateHealth: "healthy" | "average" | "poor";
}

export interface Comparison {
  label: string;
  groupA: { label: string; sent: number; openRate: number };
  groupB: { label: string; sent: number; openRate: number };
  /** Percentage points difference (A.openRate - B.openRate). */
  diff: number;
}

export interface OperationalHealth {
  lastSyncedAt: Date | null;
  /** Pre-formatted human label (e.g. "Hace 3 minutos"). Computed server-side
   *  so the component stays pure (no `Date.now()` during render). */
  lastSyncedLabel: string;
  templatesUpdatedLast7Days: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance — templates needing operational attention.

export interface ZombieTemplate {
  themeName: string;
  daysSinceLastSent: number | null;
}

export interface ZombiesInsight {
  thresholdDays: number;
  totalZombies: number;
  /** Templates with `hasTheme=true` (i.e. active) but no send in `thresholdDays`. */
  samples: ZombieTemplate[];
  /** Templates flagged as having a theme but with NO send ever recorded. */
  neverSent: number;
}

export interface QAQueueItem {
  themeName: string;
  updatedAt: Date;
  lastSentAt: Date | null;
}

export interface QAQueueInsight {
  /** Templates edited recently but last_sent_at < updated_at (or null). */
  pending: QAQueueItem[];
  /** Templates edited recently AND last_sent_at >= updated_at — QA-able now. */
  readyForReview: QAQueueItem[];
  windowDays: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content patterns — what the templates themselves look like.

export interface SendTimeBucket {
  label: string;
  startHour: number;
  endHour: number;
  count: number;
}

export interface SendTimeInsight {
  buckets: SendTimeBucket[];
  busiest: SendTimeBucket | null;
  templatesWithSendTime: number;
  templatesWithoutSendTime: number;
}

export interface SubjectInsight {
  total: number;
  emptyCount: number;
  avgLength: number;
  medianLength: number;
  withEmojiCount: number;
  withExclamationCount: number;
  withQuestionCount: number;
  allCapsCount: number;
  /** 5 longest subject lines — usually a sign of cluttered content. */
  longestSamples: { themeName: string; subject: string; length: number }[];
  /** 5 shortest non-empty subject lines — may signal missing context. */
  shortestSamples: { themeName: string; subject: string; length: number }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume anomalies — drastic swings in send volume by product/movement.

export interface VolumeAnomaly {
  key: string;
  current: number;
  baseline: number; // 4-week average
  delta: number;
  /** Relative change vs baseline. */
  pct: number;
  direction: "up" | "down";
}

export interface VolumeAnomalyInsight {
  /** Drop > 30% vs 4-week baseline. */
  drops: VolumeAnomaly[];
  /** Spike > 50% vs 4-week baseline. */
  spikes: VolumeAnomaly[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Top opens — pieces with most absolute opens + heuristic "why" analysis.

export interface TopOpenEntry {
  piece: string;
  product: string;
  sent: number;
  opened: number;
  openRate: number;
  /** Multiplier vs global avg open rate (1 = same, 2 = double). */
  vsAverage: number;
  /** Plain-Spanish hypotheses about why this piece performs well. */
  reasons: string[];
  /**
   * Subjects from the template catalog whose `theme_name` overlaps the piece
   * label by enough significant words. Best-effort heuristic (piece names live
   * in 425/426 and don't have a clean join to templates in 401). Up to 3.
   */
  candidateSubjects: string[];
}

export interface TopOpensInsight {
  globalAvgOpenRate: number;
  entries: TopOpenEntry[];
}

export interface MetricsInsights {
  generatedAt: Date;
  executive: ExecutiveSummary;
  weekly: WeeklyMomentum;
  winners: WinnersInsights;
  attention: AttentionInsights;
  comparisons: Comparison[];
  health: OperationalHealth;
  zombies: ZombiesInsight;
  qaQueue: QAQueueInsight;
  sendTime: SendTimeInsight;
  subjects: SubjectInsight;
  volumeAnomalies: VolumeAnomalyInsight;
  topOpens: TopOpensInsight;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

const safeRatio = (a: number, b: number): number => (b > 0 ? a / b : 0);

const makeDelta = (key: string, current: number, previous: number): WeeklyDelta => {
  const delta = current - previous;
  let pct: number;
  if (previous === 0 && current === 0) pct = 0;
  else if (previous === 0) pct = Number.POSITIVE_INFINITY;
  else pct = (current - previous) / previous;
  return { key, current, previous, delta, pct };
};

/** Pick top entry from a record-of-numbers, optionally filtered by sign of delta. */
const topDelta = (
  current: Record<string, number>,
  previous: Record<string, number>,
  direction: "growing" | "falling",
): WeeklyDelta | null => {
  const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);
  let best: WeeklyDelta | null = null;
  for (const k of keys) {
    const d = makeDelta(k, current[k] ?? 0, previous[k] ?? 0);
    if (direction === "growing" && d.delta <= 0) continue;
    if (direction === "falling" && d.delta >= 0) continue;
    if (!best || Math.abs(d.delta) > Math.abs(best.delta)) best = d;
  }
  return best;
};

// ─────────────────────────────────────────────────────────────────────────────
// Section computations

const buildExecutive = (summary: MetricsSummary): ExecutiveSummary => {
  const openRate = summary.avgOpenRate;
  const health: ExecutiveSummary["openRateHealth"] =
    openRate >= 0.25 ? "healthy" : openRate >= 0.15 ? "average" : "poor";
  return {
    totalSent: summary.totalSent,
    avgOpenRate: summary.avgOpenRate,
    avgClickRate: summary.avgClickRate,
    pieceCount: summary.pieceCount,
    openRateHealth: health,
  };
};

const buildWeekly = (
  byProduct: WeeklyByProductRow[],
  byMovement: WeeklyByMovementRow[],
): WeeklyMomentum => {
  if (byProduct.length === 0) {
    return {
      current: null,
      previous: null,
      totalDelta: null,
      topGrowingProduct: null,
      topFallingProduct: null,
      topGrowingMovement: null,
      topFallingMovement: null,
    };
  }

  const cur = byProduct[byProduct.length - 1] ?? null;
  const prev = byProduct.length >= 2 ? (byProduct[byProduct.length - 2] ?? null) : null;
  const curM = byMovement[byMovement.length - 1] ?? null;
  const prevM = byMovement.length >= 2 ? (byMovement[byMovement.length - 2] ?? null) : null;

  const totalDelta = cur && prev ? makeDelta("total", cur.total, prev.total) : null;

  return {
    current: cur ? { label: cur.weekLabel, total: cur.total } : null,
    previous: prev ? { label: prev.weekLabel, total: prev.total } : null,
    totalDelta,
    topGrowingProduct: cur && prev ? topDelta(cur.counts, prev.counts, "growing") : null,
    topFallingProduct: cur && prev ? topDelta(cur.counts, prev.counts, "falling") : null,
    topGrowingMovement: curM && prevM ? topDelta(curM.counts, prevM.counts, "growing") : null,
    topFallingMovement: curM && prevM ? topDelta(curM.counts, prevM.counts, "falling") : null,
  };
};

const buildWinners = (pieces: PieceMetrics[]): WinnersInsights => {
  const eligible = pieces.filter((p) => p.sent >= MIN_SENT_FOR_RATE);

  const bestByOpenRate =
    eligible.length > 0 ? ([...eligible].sort((a, b) => b.openRate - a.openRate)[0] ?? null) : null;

  const topByClickRate = [...eligible].sort((a, b) => b.clickRate - a.clickRate).slice(0, 3);

  // Best product (weighted by sent volume)
  const productTotals = new Map<string, { sent: number; opened: number }>();
  for (const p of pieces) {
    const cur = productTotals.get(p.product) ?? { sent: 0, opened: 0 };
    cur.sent += p.sent;
    cur.opened += p.opened;
    productTotals.set(p.product, cur);
  }
  let bestProduct: WinnersInsights["bestProductByOpenRate"] = null;
  for (const [product, { sent, opened }] of productTotals) {
    if (sent < MIN_SENT_FOR_RATE) continue;
    const openRate = safeRatio(opened, sent);
    if (!bestProduct || openRate > bestProduct.openRate) {
      bestProduct = { product, openRate, sent };
    }
  }

  return { bestByOpenRate, topByClickRate, bestProductByOpenRate: bestProduct };
};

const buildAttention = (pieces: PieceMetrics[], summary: MetricsSummary): AttentionInsights => {
  const eligible = pieces.filter((p) => p.sent >= MIN_SENT_FOR_RATE);

  const lowOpenRate = eligible
    .filter((p) => p.openRate < 0.1)
    .sort((a, b) => b.sent - a.sent) // worst impact first
    .slice(0, 8);

  const zeroOpens = eligible.filter((p) => p.opened === 0).sort((a, b) => b.sent - a.sent);

  const totalOutOfTime = pieces.reduce((acc, p) => acc + p.outOfTimeClicks, 0);
  const outOfTimeRate = safeRatio(totalOutOfTime, summary.totalSent);

  const outOfTimeOffenders = eligible
    .map((p) => ({ ...p, outRate: safeRatio(p.outOfTimeClicks, p.sent) }))
    .filter((p) => p.outRate > 0.25)
    .sort((a, b) => b.outRate - a.outRate)
    .slice(0, 5);

  return { lowOpenRate, zeroOpens, outOfTimeRate, outOfTimeOffenders };
};

/** Detect "Titular" vs "Adicional" pieces by substring (case insensitive). */
const buildComparisons = (
  pieces: PieceMetrics[],
  byMovement: WeeklyByMovementRow[],
): Comparison[] => {
  const out: Comparison[] = [];

  // Titular vs Adicional
  const titular = pieces.filter((p) => /titular/i.test(p.piece));
  const adicional = pieces.filter((p) => /adicional/i.test(p.piece));
  if (titular.length > 0 && adicional.length > 0) {
    const aggA = aggregate(titular);
    const aggB = aggregate(adicional);
    if (aggA.sent > 0 && aggB.sent > 0) {
      out.push({
        label: "Tarjetahabiente vs adicional",
        groupA: { label: "Titular", sent: aggA.sent, openRate: aggA.openRate },
        groupB: { label: "Adicional", sent: aggB.sent, openRate: aggB.openRate },
        diff: aggA.openRate - aggB.openRate,
      });
    }
  }

  // Trascodificadas vs resto (movement-level, all-time)
  if (byMovement.length > 0) {
    let trascSent = 0;
    let otherSent = 0;
    for (const w of byMovement) {
      for (const [k, v] of Object.entries(w.counts)) {
        if (k.toLowerCase().includes("trascodif")) trascSent += v;
        else otherSent += v;
      }
    }
    if (trascSent > 0 && otherSent > 0) {
      // We can't compute open rate per movement from current data (only counts).
      // Volume-only comparison.
      out.push({
        label: "Trascodificadas vs resto (volumen)",
        groupA: { label: "Trascodificadas", sent: trascSent, openRate: 0 },
        groupB: { label: "Otros movimientos", sent: otherSent, openRate: 0 },
        diff: 0,
      });
    }
  }

  return out;
};

const aggregate = (pieces: PieceMetrics[]): { sent: number; openRate: number } => {
  let sent = 0;
  let opened = 0;
  for (const p of pieces) {
    sent += p.sent;
    opened += p.opened;
  }
  return { sent, openRate: safeRatio(opened, sent) };
};

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance computations

const ZOMBIE_THRESHOLD_DAYS = 60;
const QA_WINDOW_DAYS = 14;

const buildZombies = (templates: TemplateAnalysisRow[], now: Date): ZombiesInsight => {
  const cutoff = now.getTime() - ZOMBIE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const eligible = templates.filter((t) => t.hasTheme);

  let neverSent = 0;
  const zombies: (ZombieTemplate & { __sortKey: number })[] = [];

  for (const t of eligible) {
    if (!t.lastSentAt) {
      neverSent++;
      continue;
    }
    if (t.lastSentAt.getTime() < cutoff) {
      const daysSince = Math.floor((now.getTime() - t.lastSentAt.getTime()) / 86_400_000);
      zombies.push({
        themeName: t.themeName,
        daysSinceLastSent: daysSince,
        __sortKey: daysSince,
      });
    }
  }

  zombies.sort((a, b) => b.__sortKey - a.__sortKey);

  return {
    thresholdDays: ZOMBIE_THRESHOLD_DAYS,
    totalZombies: zombies.length,
    neverSent,
    samples: zombies.slice(0, 10).map(({ themeName, daysSinceLastSent }) => ({
      themeName,
      daysSinceLastSent,
    })),
  };
};

const buildQAQueue = (templates: TemplateAnalysisRow[], now: Date): QAQueueInsight => {
  const cutoff = now.getTime() - QA_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const pending: QAQueueItem[] = [];
  const readyForReview: QAQueueItem[] = [];

  for (const t of templates) {
    if (!t.updatedAt) continue;
    if (t.updatedAt.getTime() < cutoff) continue;

    const item: QAQueueItem = {
      themeName: t.themeName,
      updatedAt: t.updatedAt,
      lastSentAt: t.lastSentAt,
    };

    if (!t.lastSentAt || t.lastSentAt < t.updatedAt) {
      pending.push(item);
    } else {
      readyForReview.push(item);
    }
  }

  // Most recently edited first.
  pending.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  readyForReview.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return {
    pending: pending.slice(0, 8),
    readyForReview: readyForReview.slice(0, 8),
    windowDays: QA_WINDOW_DAYS,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Content pattern computations

const SEND_TIME_BUCKETS: Array<Pick<SendTimeBucket, "label" | "startHour" | "endHour">> = [
  { label: "Madrugada (00–06)", startHour: 0, endHour: 6 },
  { label: "Mañana temprana (06–09)", startHour: 6, endHour: 9 },
  { label: "Media mañana (09–12)", startHour: 9, endHour: 12 },
  { label: "Tarde (12–15)", startHour: 12, endHour: 15 },
  { label: "Tarde-noche (15–18)", startHour: 15, endHour: 18 },
  { label: "Noche (18–21)", startHour: 18, endHour: 21 },
  { label: "Noche tardía (21–24)", startHour: 21, endHour: 24 },
];

const parseHour = (sendTime: string | null): number | null => {
  if (!sendTime) return null;
  const m = /^(\d{1,2}):/.exec(sendTime);
  if (!m || !m[1]) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) && h >= 0 && h < 24 ? h : null;
};

const buildSendTime = (rows: Array<{ sendTime: string | null }>): SendTimeInsight => {
  const buckets: SendTimeBucket[] = SEND_TIME_BUCKETS.map((b) => ({ ...b, count: 0 }));
  let withSendTime = 0;
  let withoutSendTime = 0;

  for (const r of rows) {
    const h = parseHour(r.sendTime);
    if (h === null) {
      withoutSendTime++;
      continue;
    }
    withSendTime++;
    const bucket = buckets.find((b) => h >= b.startHour && h < b.endHour);
    if (bucket) bucket.count++;
  }

  const busiest =
    [...buckets].filter((b) => b.count > 0).sort((a, b) => b.count - a.count)[0] ?? null;

  return {
    buckets,
    busiest,
    templatesWithSendTime: withSendTime,
    templatesWithoutSendTime: withoutSendTime,
  };
};

// Unicode emoji detector — covers the symbol blocks most likely to appear in subject lines.
const EMOJI_REGEX = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

const buildSubjects = (templates: TemplateAnalysisRow[]): SubjectInsight => {
  const subjects = templates.map((t) => ({ themeName: t.themeName, subject: t.subject ?? "" }));

  let emptyCount = 0;
  let withEmoji = 0;
  let withExclamation = 0;
  let withQuestion = 0;
  let allCaps = 0;
  const lengths: number[] = [];

  for (const { subject } of subjects) {
    const s = subject.trim();
    if (!s) {
      emptyCount++;
      continue;
    }
    lengths.push(s.length);
    if (EMOJI_REGEX.test(s)) withEmoji++;
    if (s.includes("!") || s.includes("¡")) withExclamation++;
    if (s.includes("?") || s.includes("¿")) withQuestion++;
    // All-caps heuristic: >70% of letters are uppercase, ignoring punctuation/digits/spaces.
    const letters = s.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, "");
    if (letters.length >= 5) {
      const upper = letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, "").length;
      if (upper / letters.length > 0.7) allCaps++;
    }
  }

  const sortedLengths = [...lengths].sort((a, b) => a - b);
  const sum = lengths.reduce((a, b) => a + b, 0);
  const avgLength = lengths.length > 0 ? sum / lengths.length : 0;
  const medianLength =
    sortedLengths.length > 0 ? (sortedLengths[Math.floor(sortedLengths.length / 2)] ?? 0) : 0;

  const ranked = subjects
    .map((s) => ({ ...s, length: s.subject.trim().length }))
    .filter((s) => s.length > 0)
    .sort((a, b) => a.length - b.length);

  return {
    total: subjects.length,
    emptyCount,
    avgLength,
    medianLength,
    withEmojiCount: withEmoji,
    withExclamationCount: withExclamation,
    withQuestionCount: withQuestion,
    allCapsCount: allCaps,
    longestSamples: ranked.slice(-5).reverse(),
    shortestSamples: ranked.slice(0, 5),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Volume anomaly computations

const VOLUME_BASELINE_WEEKS = 4;
const DROP_THRESHOLD = -0.3; // -30%
const SPIKE_THRESHOLD = 0.5; // +50%

const detectVolumeAnomalies = (
  weekly: Array<{ counts: Record<string, number> }>,
): VolumeAnomaly[] => {
  if (weekly.length < 2) return [];

  const current = weekly[weekly.length - 1];
  if (!current) return [];

  // 4 weeks before the current one. If there aren't 4, use what we have.
  const baselineSlice = weekly.slice(
    Math.max(0, weekly.length - 1 - VOLUME_BASELINE_WEEKS),
    weekly.length - 1,
  );
  if (baselineSlice.length === 0) return [];

  // Aggregate baseline averages per key.
  const baselineAvg = new Map<string, number>();
  for (const w of baselineSlice) {
    for (const [k, v] of Object.entries(w.counts)) {
      baselineAvg.set(k, (baselineAvg.get(k) ?? 0) + v / baselineSlice.length);
    }
  }

  const anomalies: VolumeAnomaly[] = [];
  for (const [k, baseline] of baselineAvg) {
    const cur = current.counts[k] ?? 0;
    if (baseline < 50 && cur < 50) continue; // ignore noise
    const delta = cur - baseline;
    const pct = baseline > 0 ? delta / baseline : 0;
    if (pct <= DROP_THRESHOLD || pct >= SPIKE_THRESHOLD) {
      anomalies.push({
        key: k,
        current: cur,
        baseline,
        delta,
        pct,
        direction: pct > 0 ? "up" : "down",
      });
    }
  }

  return anomalies;
};

// ─────────────────────────────────────────────────────────────────────────────
// Top opens — heuristic explanation engine.
//
// We can't tally opens per individual subject (Kublau aggregates opens per
// "Pieza"/flight, not per template). So we surface the 10 flights with most
// absolute opens and generate plausible reasons from name + product patterns.

const PREMIUM_PRODUCTS = ["world elite", "premier", "platinum", "viva plus", "vivaplus"];

/**
 * Spanish stop-words + Kublau-specific noise tokens to drop before matching
 * piece descriptors against template theme names. Acronyms like "RET" (retention)
 * and "MSI" (meses sin intereses) repeat in many pieces and would dominate noise.
 */
const SUBJECT_STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "o",
  "a",
  "en",
  "un",
  "una",
  "por",
  "para",
  "con",
  "sin",
  "tu",
  "tus",
  "su",
  "ret",
  "msi",
  "reminder",
  "primer",
  "segundo",
  "tercer",
]);

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SUBJECT_STOPWORDS.has(w));

const extractPieceDescriptor = (pieceLabel: string): string => {
  const idx = pieceLabel.indexOf("|");
  return (idx >= 0 ? pieceLabel.slice(idx + 1) : pieceLabel).trim();
};

const findCandidateSubjects = (pieceLabel: string, templates: TemplateAnalysisRow[]): string[] => {
  const descriptor = extractPieceDescriptor(pieceLabel);
  const descriptorTokens = tokenize(descriptor);
  if (descriptorTokens.length < 2) return [];

  // Score each template by how many descriptor tokens appear in its theme_name.
  // Min overlap: half the descriptor tokens OR at least 2 — whichever is greater.
  const minOverlap = Math.max(2, Math.ceil(descriptorTokens.length / 2));
  const matches: Array<{ subject: string; score: number }> = [];

  for (const t of templates) {
    const subject = (t.subject ?? "").trim();
    if (!subject || !t.themeName) continue;
    const themeTokens = new Set(tokenize(t.themeName));
    if (themeTokens.size === 0) continue;
    let overlap = 0;
    for (const tok of descriptorTokens) {
      if (themeTokens.has(tok)) overlap++;
    }
    if (overlap >= minOverlap) matches.push({ subject, score: overlap });
  }

  // Dedupe identical subjects, keeping the highest score; then take top 3.
  const bySubject = new Map<string, number>();
  for (const { subject, score } of matches) {
    bySubject.set(subject, Math.max(bySubject.get(subject) ?? 0, score));
  }
  return [...bySubject.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s);
};

const buildTopOpens = (
  pieces: PieceMetrics[],
  templates: TemplateAnalysisRow[],
  globalAvgOpenRate: number,
): TopOpensInsight => {
  const minSent = MIN_SENT_FOR_RATE;
  // Rank by OPEN RATE (effectiveness), not by absolute opens (volume).
  // The min-sent gate prevents trivially-small samples from gaming the top.
  const ranked = pieces
    .filter((p) => p.sent >= minSent && p.opened > 0)
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 10);

  const entries: TopOpenEntry[] = ranked.map((p) => {
    const vsAverage = globalAvgOpenRate > 0 ? p.openRate / globalAvgOpenRate : 0;
    return {
      piece: p.piece,
      product: p.product,
      sent: p.sent,
      opened: p.opened,
      openRate: p.openRate,
      vsAverage,
      reasons: analyzePieceReasons(p, vsAverage),
      candidateSubjects: findCandidateSubjects(p.piece, templates),
    };
  });

  return { globalAvgOpenRate, entries };
};

const analyzePieceReasons = (p: PieceMetrics, vsAverage: number): string[] => {
  const reasons: string[] = [];
  const name = p.piece.toLowerCase();
  const product = p.product.toLowerCase();

  // Performance framing
  if (vsAverage >= 2) {
    reasons.push(`Open rate ${vsAverage.toFixed(1)}× sobre el promedio global.`);
  } else if (vsAverage >= 1.3) {
    reasons.push(`Open rate ${Math.round((vsAverage - 1) * 100)}% sobre el promedio.`);
  }

  // Content-type heuristics
  if (/confirmaci[oó]n|confirmation/.test(name)) {
    reasons.push(
      "Confirmación transaccional: el usuario espera el correo, por lo que abre con altísima probabilidad.",
    );
  }
  if (/registro|registration|alta nueva/.test(name)) {
    reasons.push(
      "Toca al usuario en el momento de mayor engagement (registro o activación reciente).",
    );
  }
  if (/bono|bonus/.test(name)) {
    reasons.push(
      "Promete un beneficio monetario o promoción concreta — el incentivo refuerza la apertura.",
    );
  }
  if (/recordatorio|reminder/.test(name)) {
    if (/01 reminder|primer recordatorio/.test(name)) {
      reasons.push(
        "Primer recordatorio: aún cerca del momento de la primera comunicación, así que mantiene atención.",
      );
    } else {
      reasons.push(
        "Es un recordatorio (segunda o tercera comunicación) — el open rate típicamente baja con cada repetición.",
      );
    }
  }
  if (/\bret\b|retention/.test(name)) {
    reasons.push(
      "Flujo de retención: dirigido a usuarios de alta intención que están considerando salir.",
    );
  }
  if (/vuelo|flight|travel/.test(name) && !/proactive-retention-flights/.test(name)) {
    reasons.push("Contenido de viaje/vuelo — categoría con alta carga emocional y FOMO.");
  }
  if (/6msi|msi|meses sin intereses/.test(name)) {
    reasons.push("Promoción de meses sin intereses: oferta financiera concreta y atractiva.");
  }
  if (/redenci[oó]n|redeem|canje/.test(name)) {
    reasons.push("Mensaje de redención de puntos o recompensa — alta motivación de apertura.");
  }
  if (/entregada|delivered|entrega/.test(name)) {
    reasons.push("Notificación de entrega de tarjeta: hito muy esperado por el cliente.");
  }
  if (/problem|rechazo|error/.test(name)) {
    reasons.push("Toca una preocupación urgente del usuario (problema o rechazo).");
  }

  // Audience heuristics
  if (PREMIUM_PRODUCTS.some((p) => product.includes(p))) {
    reasons.push(
      `Audiencia premium (${p.product}): segmento con engagement habitualmente más alto.`,
    );
  }
  if (/titular/.test(name)) {
    reasons.push("Dirigido al titular de la tarjeta (vs adicional) — mayor sentido de propiedad.");
  }

  // Volume context
  if (p.sent >= 10_000) {
    reasons.push(
      `Volumen muy alto (${formatInt(p.sent)} envíos): aunque el rate sea moderado, los opens absolutos suben por escala.`,
    );
  } else if (p.sent >= 3_000) {
    reasons.push(`Volumen significativo (${formatInt(p.sent)} envíos).`);
  }

  // If nothing matched, leave a neutral note rather than empty.
  if (reasons.length === 0) {
    reasons.push(
      "Sin patrones obvios en el nombre; vale la pena revisar el contenido manualmente.",
    );
  }

  return reasons;
};

const formatInt = (n: number): string => new Intl.NumberFormat("es-MX").format(n);

const buildVolumeAnomalies = (
  byProduct: WeeklyByProductRow[],
  byMovement: WeeklyByMovementRow[],
): VolumeAnomalyInsight => {
  const productAnoms = detectVolumeAnomalies(byProduct);
  const movementAnoms = detectVolumeAnomalies(byMovement);
  const all = [...productAnoms, ...movementAnoms];
  return {
    drops: all
      .filter((a) => a.direction === "down")
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 5),
    spikes: all
      .filter((a) => a.direction === "up")
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Public

export interface InsightsInput {
  summary: MetricsSummary;
  pieces: PieceMetrics[];
  weeklyByProduct: WeeklyByProductRow[];
  weeklyByMovement: WeeklyByMovementRow[];
  lastSyncedAt: Date | null;
  templatesUpdatedLast7Days: number;
  templates: TemplateAnalysisRow[];
  /** Send-time rows from the Supabase cache (ClickHouse doesn't expose this column). */
  sendTimes: Array<{ sendTime: string | null }>;
}

const formatRelative = (d: Date | null, now: Date): string => {
  if (!d) return "Nunca sincronizado";
  const diffMin = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (diffMin < 1) return "Hace menos de 1 minuto";
  if (diffMin < 60) return `Hace ${diffMin} ${diffMin === 1 ? "minuto" : "minutos"}`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} ${diffH === 1 ? "hora" : "horas"}`;
  const diffD = Math.round(diffH / 24);
  return `Hace ${diffD} ${diffD === 1 ? "día" : "días"}`;
};

export function computeInsights(input: InsightsInput): MetricsInsights {
  const now = new Date();
  return {
    generatedAt: now,
    executive: buildExecutive(input.summary),
    weekly: buildWeekly(input.weeklyByProduct, input.weeklyByMovement),
    winners: buildWinners(input.pieces),
    attention: buildAttention(input.pieces, input.summary),
    comparisons: buildComparisons(input.pieces, input.weeklyByMovement),
    health: {
      lastSyncedAt: input.lastSyncedAt,
      lastSyncedLabel: formatRelative(input.lastSyncedAt, now),
      templatesUpdatedLast7Days: input.templatesUpdatedLast7Days,
    },
    zombies: buildZombies(input.templates, now),
    qaQueue: buildQAQueue(input.templates, now),
    sendTime: buildSendTime(input.sendTimes),
    subjects: buildSubjects(input.templates),
    volumeAnomalies: buildVolumeAnomalies(input.weeklyByProduct, input.weeklyByMovement),
    topOpens: buildTopOpens(input.pieces, input.templates, input.summary.avgOpenRate),
  };
}
