import { kublauMetricsSource } from "@/lib/adapters/clickhouse-kublau/metrics-source";
import { MetricCards } from "@/components/feature/metric-cards";
import { PiecesTable } from "@/components/feature/pieces-table";
import { WeeklyTrendChart } from "@/components/feature/weekly-trend-chart";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const [summary, pieces, weeklyByProduct, weeklyByMovement] = await Promise.all([
    kublauMetricsSource.summary(),
    kublauMetricsSource.listPieceMetrics({ limit: 200 }),
    kublauMetricsSource.weeklyByProduct(),
    kublauMetricsSource.weeklyByMovement(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Métricas</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Performance de envíos · datos en vivo desde Kublau.
        </p>
      </header>

      <MetricCards summary={summary} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WeeklyTrendChart title="Envíos semanales por tipo de tarjeta" rows={weeklyByProduct} />
        <WeeklyTrendChart title="Envíos semanales por tipo de movimiento" rows={weeklyByMovement} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
          Performance por pieza
        </h2>
        <PiecesTable pieces={pieces} />
      </section>
    </div>
  );
}
