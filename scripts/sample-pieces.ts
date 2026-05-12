/**
 * One-off sampler: prints a handful of piece names and weekly rows so we can
 * see the actual shape of the data before designing insight heuristics.
 */
import { kublauMetricsSource } from "../lib/adapters/clickhouse-kublau/metrics-source";

async function main() {
  const [pieces, weeklyProduct, weeklyMovement] = await Promise.all([
    kublauMetricsSource.listPieceMetrics({ limit: 20 }),
    kublauMetricsSource.weeklyByProduct(),
    kublauMetricsSource.weeklyByMovement(),
  ]);

  console.log("=== Top 20 pieces by sent ===");
  for (const p of pieces) {
    console.log(
      `  ${p.piece.padEnd(60)} | ${p.product.padEnd(15)} | sent ${p.sent} | open ${(p.openRate * 100).toFixed(1)}% | click ${(p.clickRate * 100).toFixed(1)}%`,
    );
  }

  console.log(`\n=== Weekly by product (${weeklyProduct.length} weeks) ===`);
  const last3 = weeklyProduct.slice(-3);
  for (const w of last3) {
    console.log(`  ${w.weekLabel} (${w.week}) — total ${w.total}`);
    const top = Object.entries(w.counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [k, v] of top) console.log(`    ${k}: ${v}`);
  }

  console.log(`\n=== Weekly by movement (${weeklyMovement.length} weeks) ===`);
  const last3m = weeklyMovement.slice(-3);
  for (const w of last3m) {
    console.log(`  ${w.weekLabel} (${w.week}) — total ${w.total}`);
    const top = Object.entries(w.counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [k, v] of top) console.log(`    ${k}: ${v}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
