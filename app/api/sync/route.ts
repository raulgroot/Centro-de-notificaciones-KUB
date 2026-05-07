import { runSync } from "@/lib/sync/notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
