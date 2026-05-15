import { revalidateTag } from "next/cache";
import { runSync } from "@/lib/sync/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * After a successful sync we invalidate the `notifications-light` and
 * `facets` cache tags so the dashboard reflects the new data immediately
 * — instead of waiting for the 60s TTL to expire.
 */
// Next.js 16 requires a cache profile as the 2nd arg to revalidateTag.
// "default" lines up with the standard cacheLife profile (5 min stale,
// 15 min revalidate). For our 60s unstable_cache TTL it's essentially a
// hard purge.
function bustCaches(): void {
  revalidateTag("notifications-light", "default");
  revalidateTag("facets", "default");
}

/**
 * Sync endpoint.
 *
 * - GET: invoked by Vercel Cron (`vercel.json`/`vercel.ts`). Authenticated by
 *   the `CRON_SECRET` Bearer header injected automatically by Vercel.
 * - POST: invoked by the manual "Refrescar ahora" button in the dashboard.
 *   Requires an authenticated session (handled by middleware before reaching
 *   this handler).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await runSync("cron");
    bustCaches();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const result = await runSync("manual");
    bustCaches();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
