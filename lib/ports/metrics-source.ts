/**
 * Port: MetricsSource
 *
 * Read-only access to performance metrics aggregated from Kublau.
 * Today implemented by `lib/adapters/clickhouse-kublau/metrics-source.ts`.
 */

export interface PieceMetrics {
  piece: string;
  product: string;
  sent: number;
  opened: number;
  clicked: number;
  rsr: number;
  outOfTimeClicks: number;
  /** Computed: opened / sent, 0..1 */
  openRate: number;
  /** Computed: clicked / sent, 0..1 */
  clickRate: number;
  /** Computed: clicked / opened, 0..1 (CTOR) */
  clickToOpenRate: number;
}

export interface MetricsSummary {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalRsr: number;
  /** Weighted by sent volume. */
  avgOpenRate: number;
  avgClickRate: number;
  pieceCount: number;
}

export interface WeeklyByProductRow {
  week: string; // ISO date of Monday
  weekLabel: string; // "Semana 19 - 2026"
  /** counts by product slug (`zero`, `air`, ...) */
  counts: Record<string, number>;
  total: number;
}

export interface WeeklyByMovementRow {
  week: string;
  weekLabel: string;
  counts: Record<string, number>;
  total: number;
}

export interface MetricsSource {
  summary(): Promise<MetricsSummary>;
  listPieceMetrics(opts?: { limit?: number; sortBy?: keyof PieceMetrics }): Promise<PieceMetrics[]>;
  weeklyByProduct(): Promise<WeeklyByProductRow[]>;
  weeklyByMovement(): Promise<WeeklyByMovementRow[]>;
}
