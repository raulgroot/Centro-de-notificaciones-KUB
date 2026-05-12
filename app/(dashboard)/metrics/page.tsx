import { readLatestMetricsSnapshot, runMetricsSnapshot } from "@/lib/snapshot/metrics";
import {
  getLastSyncedAt,
  countRecentlyUpdated,
  listTemplateSendTimes,
} from "@/lib/adapters/supabase/notification-source";
import { computeInsights } from "@/lib/core/metrics/insights";
import { InsightFeed } from "@/components/feature/insight-cards";
import { PiecesTable } from "@/components/feature/pieces-table";
import { WeeklyTrendChart } from "@/components/feature/weekly-trend-chart";
import { RawDataSection } from "@/components/feature/raw-data-section";
import { PageHeader } from "@/components/feature/page-header";
import { MetricsRefreshButton } from "@/components/feature/metrics-refresh-button";

export const dynamic = "force-dynamic";

/** Helper kept outside the component so `Date.now()` isn't called during render. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function nowMillis(): number {
  return Date.now();
}

export default async function MetricsPage() {
  const sevenDaysAgo = daysAgo(7);
  const now = nowMillis();

  // The page reads from the snapshot cache (Supabase). If the table is empty
  // — e.g. first deploy, or right after running the migration — fall back to
  // a fresh Kublau pull so the user isn't stuck on an empty state.
  let snapshot = await readLatestMetricsSnapshot();
  if (!snapshot) {
    try {
      await runMetricsSnapshot();
      snapshot = await readLatestMetricsSnapshot();
    } catch {
      // ClickHouse unreachable AND no snapshot yet — render the empty state below.
    }
  }

  if (!snapshot) {
    return (
      <div>
        <PageHeader title="Métricas" description="Insights pre-masticados sobre tus envíos" />
        <div className="mx-auto mt-8 max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <h2 className="text-base font-semibold text-amber-900">Sin datos todavía</h2>
          <p className="mt-1 text-sm text-amber-800">
            No hay snapshot guardado y Kublau no respondió. Cuando Kublau vuelva, presiona
            “Refrescar” en la parte superior para guardar el primer snapshot.
          </p>
          <div className="mt-4 flex justify-center">
            <MetricsRefreshButton snapshottedAt={null} now={now} />
          </div>
        </div>
      </div>
    );
  }

  // Supabase-only data (always fast & live; doesn't need caching).
  const [lastSyncedAt, recentlyUpdated, sendTimes] = await Promise.all([
    getLastSyncedAt().catch(() => null),
    countRecentlyUpdated(sevenDaysAgo).catch(() => 0),
    listTemplateSendTimes().catch(() => []),
  ]);

  const insights = computeInsights({
    summary: snapshot.data.summary,
    pieces: snapshot.data.pieces,
    weeklyByProduct: snapshot.data.weeklyByProduct,
    weeklyByMovement: snapshot.data.weeklyByMovement,
    lastSyncedAt,
    templatesUpdatedLast7Days: recentlyUpdated,
    templates: snapshot.data.templates,
    sendTimes,
  });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader title="Métricas" description="Insights pre-masticados sobre tus envíos" />
        <MetricsRefreshButton snapshottedAt={snapshot.snapshottedAt} now={now} />
      </div>

      <div className="space-y-8">
        <InsightFeed insights={insights} />

        <RawDataSection>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <WeeklyTrendChart
              title="Envíos semanales por tipo de tarjeta"
              rows={snapshot.data.weeklyByProduct}
            />
            <WeeklyTrendChart
              title="Envíos semanales por tipo de movimiento"
              rows={snapshot.data.weeklyByMovement}
            />
          </div>
          <section>
            <h2 className="mb-2 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              Performance por pieza
            </h2>
            <PiecesTable pieces={snapshot.data.pieces} />
          </section>
        </RawDataSection>
      </div>
    </div>
  );
}
