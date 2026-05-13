import { revalidatePath } from "next/cache";
import { syncCampaignLoadsFromAsana } from "@/lib/adapters/asana/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Pulls campaign cargas from Asana and upserts them into Supabase.
 *
 * - GET:  Vercel Cron — authenticated by `CRON_SECRET`.
 * - POST: manual trigger from the /campanas page.
 *
 * Returns a summary so the UI can show "X importadas, Y omitidas por falta de due date".
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
    const result = await syncCampaignLoadsFromAsana();
    revalidatePath("/campanas");
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 },
    );
  }
}
