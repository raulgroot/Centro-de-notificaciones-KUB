import { revalidatePath } from "next/cache";
import { runMetricsSnapshot, pruneOldSnapshots } from "@/lib/snapshot/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Refresh endpoint for the metrics snapshot.
 *
 * - GET:  invoked by Vercel Cron. Authenticated by `CRON_SECRET` Bearer header.
 * - POST: invoked by the manual "Refrescar" button. Session-gated by middleware.
 *
 * Pulls fresh data from Kublau ClickHouse, writes a snapshot row to Supabase,
 * trims old snapshots, and revalidates the /metrics route so the next render
 * shows the fresh data.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return runAndReturn();
}

export async function POST() {
  return runAndReturn();
}

async function runAndReturn() {
  try {
    const result = await runMetricsSnapshot();
    await pruneOldSnapshots().catch(() => undefined); // best effort
    revalidatePath("/metrics");
    return Response.json({
      ok: true,
      snapshottedAt: result.snapshottedAt.toISOString(),
      rowsCount: result.rowsCount,
      msTaken: result.msTaken,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 },
    );
  }
}
