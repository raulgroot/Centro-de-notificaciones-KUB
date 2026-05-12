/**
 * Smoke test: compute insights and print them to confirm the numbers look sane
 * before opening the browser.
 */
import { kublauMetricsSource } from "../lib/adapters/clickhouse-kublau/metrics-source";
import { listTemplatesForAnalysis } from "../lib/adapters/clickhouse-kublau/notification-source";
import {
  getLastSyncedAt,
  countRecentlyUpdated,
  listTemplateSendTimes,
} from "../lib/adapters/supabase/notification-source";
import { computeInsights } from "../lib/core/metrics/insights";

async function main() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    summary,
    pieces,
    weeklyByProduct,
    weeklyByMovement,
    lastSyncedAt,
    recentlyUpdated,
    templates,
    sendTimes,
  ] = await Promise.all([
    kublauMetricsSource.summary(),
    kublauMetricsSource.listPieceMetrics({ limit: 500 }),
    kublauMetricsSource.weeklyByProduct(),
    kublauMetricsSource.weeklyByMovement(),
    getLastSyncedAt().catch(() => null),
    countRecentlyUpdated(sevenDaysAgo).catch(() => 0),
    listTemplatesForAnalysis().catch(() => []),
    listTemplateSendTimes().catch(() => []),
  ]);

  const insights = computeInsights({
    summary,
    pieces,
    weeklyByProduct,
    weeklyByMovement,
    lastSyncedAt,
    templatesUpdatedLast7Days: recentlyUpdated,
    templates,
    sendTimes,
  });

  console.log("\n=== EXECUTIVE ===");
  console.log(insights.executive);

  console.log("\n=== WEEKLY ===");
  console.log(JSON.stringify(insights.weekly, null, 2));

  console.log("\n=== WINNERS ===");
  console.log(`Best by open rate: ${insights.winners.bestByOpenRate?.piece}`);
  console.log(`  open: ${insights.winners.bestByOpenRate?.openRate}`);
  console.log(`Best product: ${insights.winners.bestProductByOpenRate?.product}`);
  console.log(`  open: ${insights.winners.bestProductByOpenRate?.openRate}`);
  console.log("Top click rate:");
  for (const p of insights.winners.topByClickRate)
    console.log(`  - ${p.piece} (${(p.clickRate * 100).toFixed(1)}%)`);

  console.log("\n=== ATTENTION ===");
  console.log(`Low open rate (< 10%): ${insights.attention.lowOpenRate.length}`);
  for (const p of insights.attention.lowOpenRate.slice(0, 3))
    console.log(`  - ${p.piece} (${(p.openRate * 100).toFixed(1)}%)`);
  console.log(`Zero opens: ${insights.attention.zeroOpens.length}`);
  console.log(`Out of time rate: ${(insights.attention.outOfTimeRate * 100).toFixed(2)}%`);
  console.log(`Offenders: ${insights.attention.outOfTimeOffenders.length}`);

  console.log("\n=== COMPARISONS ===");
  for (const c of insights.comparisons) {
    console.log(`  ${c.label}:`);
    console.log(
      `    ${c.groupA.label}: ${c.groupA.sent} envíos, ${(c.groupA.openRate * 100).toFixed(1)}% open`,
    );
    console.log(
      `    ${c.groupB.label}: ${c.groupB.sent} envíos, ${(c.groupB.openRate * 100).toFixed(1)}% open`,
    );
    console.log(`    diff: ${(c.diff * 100).toFixed(1)}pp`);
  }

  console.log("\n=== HEALTH ===");
  console.log(`Last synced: ${insights.health.lastSyncedLabel}`);
  console.log(`Templates updated last 7 days: ${insights.health.templatesUpdatedLast7Days}`);

  console.log("\n=== ZOMBIES ===");
  console.log(
    `Total: ${insights.zombies.totalZombies} (umbral ${insights.zombies.thresholdDays}d) · nunca enviados: ${insights.zombies.neverSent}`,
  );
  for (const z of insights.zombies.samples.slice(0, 5))
    console.log(`  - ${z.themeName}: ${z.daysSinceLastSent}d`);

  console.log("\n=== QA QUEUE ===");
  console.log(
    `Pending: ${insights.qaQueue.pending.length} · Ready: ${insights.qaQueue.readyForReview.length} (ventana ${insights.qaQueue.windowDays}d)`,
  );
  for (const q of insights.qaQueue.pending.slice(0, 3)) console.log(`  pending: ${q.themeName}`);
  for (const q of insights.qaQueue.readyForReview.slice(0, 3))
    console.log(`  ready: ${q.themeName}`);

  console.log("\n=== SEND TIME ===");
  console.log(
    `Con hora: ${insights.sendTime.templatesWithSendTime} · sin hora: ${insights.sendTime.templatesWithoutSendTime}`,
  );
  for (const b of insights.sendTime.buckets) console.log(`  ${b.label}: ${b.count}`);

  console.log("\n=== SUBJECTS ===");
  console.log(`Total: ${insights.subjects.total}, empty: ${insights.subjects.emptyCount}`);
  console.log(
    `avg len: ${insights.subjects.avgLength.toFixed(1)}, median: ${insights.subjects.medianLength}`,
  );
  console.log(
    `emoji: ${insights.subjects.withEmojiCount}, ! : ${insights.subjects.withExclamationCount}`,
  );
  console.log(
    `? : ${insights.subjects.withQuestionCount}, ALL CAPS: ${insights.subjects.allCapsCount}`,
  );
  console.log("Longest samples:");
  for (const s of insights.subjects.longestSamples)
    console.log(`  ${s.length} chars: ${s.subject.slice(0, 80)}`);

  console.log("\n=== VOLUME ANOMALIES ===");
  console.log(`Drops: ${insights.volumeAnomalies.drops.length}`);
  for (const a of insights.volumeAnomalies.drops)
    console.log(
      `  - ${a.key}: ${a.current} (baseline ~${Math.round(a.baseline)}) → ${(a.pct * 100).toFixed(0)}%`,
    );
  console.log(`Spikes: ${insights.volumeAnomalies.spikes.length}`);
  for (const a of insights.volumeAnomalies.spikes)
    console.log(
      `  - ${a.key}: ${a.current} (baseline ~${Math.round(a.baseline)}) → +${(a.pct * 100).toFixed(0)}%`,
    );

  console.log("\n=== TOP 10 MOST-OPENED ===");
  console.log(`Global avg open rate: ${(insights.topOpens.globalAvgOpenRate * 100).toFixed(1)}%`);
  for (let i = 0; i < insights.topOpens.entries.length; i++) {
    const e = insights.topOpens.entries[i]!;
    console.log(
      `\n${i + 1}. ${e.piece} [${e.product}]\n   ${e.opened.toLocaleString()} opens · ${(e.openRate * 100).toFixed(1)}% (${e.vsAverage.toFixed(1)}× avg)`,
    );
    for (const r of e.reasons) console.log(`   → ${r}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
