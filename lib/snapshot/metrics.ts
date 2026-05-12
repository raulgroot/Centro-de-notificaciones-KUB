/**
 * Snapshot caching for the /metrics page.
 *
 * Reads/writes a single JSON blob in `metrics_snapshots` containing everything
 * we need from Kublau ClickHouse to compute insights. The page always reads
 * the latest snapshot — so transient Kublau outages don't break the dashboard.
 *
 * Refresh paths:
 *  - daily Vercel cron at 06:00 UTC
 *  - manual user-triggered POST /api/refresh-metrics
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminEnv } from "@/lib/env";
import { kublauMetricsSource } from "@/lib/adapters/clickhouse-kublau/metrics-source";
import { listTemplatesForAnalysis } from "@/lib/adapters/clickhouse-kublau/notification-source";
import type {
  MetricsSummary,
  PieceMetrics,
  WeeklyByMovementRow,
  WeeklyByProductRow,
} from "@/lib/ports/metrics-source";
import type { TemplateAnalysisRow } from "@/lib/adapters/clickhouse-kublau/notification-source";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  const env = supabaseAdminEnv();
  _client = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/** Shape of the JSON blob stored in `metrics_snapshots.data`. */
export interface MetricsSnapshotData {
  summary: MetricsSummary;
  pieces: PieceMetrics[];
  weeklyByProduct: WeeklyByProductRow[];
  weeklyByMovement: WeeklyByMovementRow[];
  /** Date fields stored as ISO strings; revived on read. */
  templates: Array<
    Omit<TemplateAnalysisRow, "updatedAt" | "lastSentAt"> & {
      updatedAt: string | null;
      lastSentAt: string | null;
    }
  >;
}

export interface MetricsSnapshot {
  id: string;
  snapshottedAt: Date;
  data: {
    summary: MetricsSummary;
    pieces: PieceMetrics[];
    weeklyByProduct: WeeklyByProductRow[];
    weeklyByMovement: WeeklyByMovementRow[];
    templates: TemplateAnalysisRow[];
  };
  rowsCount: number | null;
  msTaken: number | null;
}

/**
 * Reads the latest snapshot from Supabase. Returns null on ANY failure
 * (missing table, network, permissions, malformed payload) — the page treats
 * "no snapshot" identically to "couldn't read snapshot" and falls back
 * gracefully without surfacing an error boundary.
 */
export async function readLatestMetricsSnapshot(): Promise<MetricsSnapshot | null> {
  try {
    const { data, error } = await client()
      .from("metrics_snapshots")
      .select("*")
      .order("snapshotted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const raw = data.data as MetricsSnapshotData;
    return {
      id: data.id,
      snapshottedAt: new Date(data.snapshotted_at),
      rowsCount: data.rows_count,
      msTaken: data.ms_taken,
      data: {
        summary: raw.summary,
        pieces: raw.pieces,
        weeklyByProduct: raw.weeklyByProduct,
        weeklyByMovement: raw.weeklyByMovement,
        templates: (raw.templates ?? []).map((t) => ({
          ...t,
          updatedAt: t.updatedAt ? new Date(t.updatedAt) : null,
          lastSentAt: t.lastSentAt ? new Date(t.lastSentAt) : null,
        })),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Pulls fresh data from Kublau ClickHouse and writes a new snapshot row.
 * Returns the inserted row's metadata; throws on failure so callers can react.
 */
export async function runMetricsSnapshot(): Promise<{
  snapshottedAt: Date;
  rowsCount: number;
  msTaken: number;
}> {
  const startedAt = Date.now();

  const [summary, pieces, weeklyByProduct, weeklyByMovement, templates] = await Promise.all([
    kublauMetricsSource.summary(),
    kublauMetricsSource.listPieceMetrics({ limit: 500 }),
    kublauMetricsSource.weeklyByProduct(),
    kublauMetricsSource.weeklyByMovement(),
    listTemplatesForAnalysis(),
  ]);

  const payload: MetricsSnapshotData = {
    summary,
    pieces,
    weeklyByProduct,
    weeklyByMovement,
    templates: templates.map((t) => ({
      ...t,
      updatedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
      lastSentAt: t.lastSentAt ? t.lastSentAt.toISOString() : null,
    })),
  };

  const rowsCount = pieces.length + templates.length;
  const msTaken = Date.now() - startedAt;

  const { error } = await client()
    .from("metrics_snapshots")
    .insert({ data: payload, rows_count: rowsCount, ms_taken: msTaken });
  if (error) throw new Error(`metrics snapshot insert failed: ${error.message}`);

  return { snapshottedAt: new Date(), rowsCount, msTaken };
}

/**
 * Trims old snapshots, keeping only the most recent N. Called by the cron
 * after a successful snapshot to avoid unbounded growth.
 */
export async function pruneOldSnapshots(keep = 30): Promise<void> {
  const { data } = await client()
    .from("metrics_snapshots")
    .select("id")
    .order("snapshotted_at", { ascending: false })
    .range(keep, keep + 999);
  if (!data || data.length === 0) return;
  const ids = data.map((r) => r.id);
  await client().from("metrics_snapshots").delete().in("id", ids);
}
