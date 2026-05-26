/**
 * GET /api/drafts/[id]/pdf?mode=image|presentation
 *
 * Returns the draft as a downloadable asset. Two modes:
 *   - `image`        → PNG screenshot of just the email render (native size,
 *                      2× DPR). Lo que la gente quiere para mandar por Slack
 *                      o pegar en slides.
 *   - `presentation` → multi-page PDF deck para handoff a HSBC (cover,
 *                      brief, asunto+preheader, pieza embebida como imagen,
 *                      SMS).
 *
 * Why GET: el browser puede llamarlo directo con un fetch + a.download.
 * La ruta queda detrás de NextAuth como el resto del dashboard.
 *
 * Runtime: nodejs (puppeteer + chromium-min lo requieren). Dinámico porque
 * el output depende de querystring + DB state.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getDraft } from "@/lib/adapters/supabase/notification-drafts";
import { renderEmailHtml } from "@/lib/notifications/template";
import { renderPiecePng, renderPresentationPdf } from "@/lib/notifications/pdf-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Puppeteer cold start + page render can take 8-15s; give it room.
export const maxDuration = 60;

type Mode = "image" | "presentation";

function isMode(s: string | null): s is Mode {
  return s === "image" || s === "presentation";
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
      { error: "Modo inválido. Usa ?mode=image o ?mode=presentation." },
      { status: 400 },
    );
  }

  try {
    // getDraft puede lanzar (ej. id con formato de UUID inválido → PostgREST
    // error, o DB caída). Lo metemos dentro del try para devolver JSON limpio
    // en vez de un 500 sin cuerpo.
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

    const buffer =
      mode === "image"
        ? await renderPiecePng(emailHtml)
        : await renderPresentationPdf({ draft, emailHtml });

    const base = safeFilename(draft.name);
    const isImage = mode === "image";
    const ext = isImage ? "png" : "pdf";
    const suffix = isImage ? "pieza" : "presentacion-hsbc";
    const filename = `${base}-${suffix}.${ext}`;
    const contentType = isImage ? "image/png" : "application/pdf";

    // `Uint8Array` is the type Next 16 wants for binary bodies — Buffer is
    // a subclass so this works at runtime too.
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
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
