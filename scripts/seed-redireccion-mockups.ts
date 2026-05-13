/**
 * Seeds mockup_html for the Redirección flow steps in Supabase.
 *
 * Run:
 *   pnpm exec tsx --env-file=.env.local scripts/seed-redireccion-mockups.ts
 *
 * Updates the 8 interactive steps (1, 3-9) with the HTML mockups defined in
 * `app/(dashboard)/flows/[slug]/redireccion-mockups.ts`, and NULLs out their
 * mockup_image_url so the HTML takes over in both the listing and the
 * presentation mode. Steps 2 and 10 (email captures) stay as static images.
 *
 * Idempotent — safe to re-run.
 */

import { REDIRECCION_MOCKUPS_HTML } from "../app/(dashboard)/flows/[slug]/redireccion-mockups";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function main() {
  // Resolve the flow id by slug.
  const flowRes = await fetch(`${SUPABASE_URL}/rest/v1/flows?slug=eq.redireccion&select=id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!flowRes.ok) throw new Error(`flows fetch: ${flowRes.status}`);
  const flows = (await flowRes.json()) as { id: string }[];
  const flow = flows[0];
  if (!flow) throw new Error("flow 'redireccion' not found");
  const flowId = flow.id;
  console.log("flow_id:", flowId);

  // For each interactive step, PATCH the row with mockup_html and clear image url.
  for (const [pos, html] of Object.entries(REDIRECCION_MOCKUPS_HTML)) {
    const position = Number(pos);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/flow_steps?flow_id=eq.${flowId}&position=eq.${position}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ mockup_html: html, mockup_image_url: null }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`step ${position} PATCH failed: ${res.status} ${body}`);
    }
    console.log(`✓ step ${position} (${html.length} chars HTML)`);
  }

  console.log("\nDone — refresh /flows/redireccion and try Modo Presentación.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
