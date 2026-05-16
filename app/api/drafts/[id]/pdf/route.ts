/**
 * GET /api/drafts/[id]/pdf?mode=piece|presentation
 *
 * Returns the draft as a downloadable PDF. Two modes:
 *   - `piece`        → the rendered HSBC email, paginated if long
 *   - `presentation` → multi-page deck for HSBC review (cover, brief,
 *                      asunto+preheader, pieza, SMS)
 *
 * Why GET (not POST): browsers handle `window.location.assign(url)` for
 * downloads natively — no need to wire up a Blob ↔ URL.createObjectURL
 * dance on the client. The route is auth-gated by middleware so this is
 * still safe.
 *
 * Runtime: nodejs (puppeteer + @sparticuz/chromium require it). Marked
 * `dynamic` because the response depends on querystring and DB state.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getDraft } from "@/lib/adapters/supabase/notification-drafts";
import { renderEmailHtml } from "@/lib/notifications/template";
import { renderPiecePdf, renderPresentationPdf } from "@/lib/notifications/pdf-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Puppeteer cold start + page render can take 8-15s; give it room.
export const maxDuration = 60;

type Mode = "piece" | "presentation";

function isMode(s: string | null): s is Mode {
  return s === "piece" || s === "presentation";
}

/**
 * Sanitize a draft name for use as a filename. Keep it ASCII-friendly so
 * the Content-Disposition header doesn't need RFC 5987 encoding.
 */
function safeFilename(name: string): string {
  return (name || "notificacion")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .toLowerCase();
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mode = req.nextUrl.searchParams.get("mode");

  if (!isMode(mode)) {
    return NextResponse.json(
      { error: "Modo inválido. Usa ?mode=piece o ?mode=presentation." },
      { status: 400 },
    );
  }

  const draft = await getDraft(id);
  if (!draft) {
    return NextResponse.json({ error: "Draft no encontrado." }, { status: 404 });
  }

  // Re-render the email HTML from current draft state. We don't trust
  // `draft.renderedHtml` because auto-save may have lagged the latest copy
  // edit on the client (and besides, re-render is ~5ms with cheerio).
  const emailHtml = renderEmailHtml({
    copy: draft.copy,
    heroImage: draft.heroImage,
    product: draft.brief.product,
  });

  try {
    const pdf =
      mode === "piece"
        ? await renderPiecePdf(emailHtml)
        : await renderPresentationPdf({ draft, emailHtml });

    const base = safeFilename(draft.name);
    const suffix = mode === "piece" ? "pieza" : "presentacion";
    const filename = `${base}-${suffix}.pdf`;

    // `Uint8Array` is the type Next 16 wants for binary bodies — Buffer is
    // a subclass so this works at runtime too.
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // Log the full error to Vercel function logs so we can debug puppeteer
    // / chromium startup failures (most common runtime issue with this
    // endpoint on Vercel). The client gets a sanitized message.
    console.error("[pdf-route] failed", {
      draftId: id,
      mode,
      error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
    });
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Falló la generación del PDF: ${message}` }, { status: 500 });
  }
}
