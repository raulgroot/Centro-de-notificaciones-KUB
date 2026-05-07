import { kublauMetricsSource } from "@/lib/adapters/clickhouse-kublau/metrics-source";
import { MetricCards } from "@/components/feature/metric-cards";
import { PiecesTable } from "@/components/feature/pieces-table";
import { WeeklyTrendChart } from "@/components/feature/weekly-trend-chart";
import { PageHeader } from "@/components/feature/page-header";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const [summary, pieces, weeklyByProduct, weeklyByMovement] = await Promise.all([
    kublauMetricsSource.summary(),
    kublauMetricsSource.listPieceMetrics({ limit: 200 }),
    kublauMetricsSource.weeklyByProduct(),
    kublauMetricsSource.weeklyByMovement(),
  ]);

  return (
    <div>
      <PageHeader
        title="Métricas"
        description="Performance de envíos · datos en vivo desde Kublau"
      />

      <div className="space-y-6">
        <MetricCards summary={summary} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <WeeklyTrendChart title="Envíos semanales por tipo de tarjeta" rows={weeklyByProduct} />
          <WeeklyTrendChart
            title="Envíos semanales por tipo de movimiento"
            rows={weeklyByMovement}
          />
        </div>

        <section>
          <h2 className="mb-2 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Performance por pieza
          </h2>
          <PiecesTable pieces={pieces} />
        </section>
      </div>
    </div>
  );
}
