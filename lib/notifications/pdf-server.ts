/**
 * Server-side rendering for notification drafts (PNG + presentation PDF).
 *
 * Uses puppeteer-core + headless Chromium (locally via the system Chrome,
 * on Vercel via @sparticuz/chromium-min) so we get pixel-perfect output
 * without CORS issues for HSBC / Freepik image CDNs.
 *
 * Two entry points:
 *   - renderPiecePng(emailHtml) — screenshot del email al tamaño nativo
 *     del template (600px), DPR 2x para retina. Output PNG. Esto es lo
 *     que la mayoría de la gente quiere para compartir / pegar en slides
 *     o mandar en Slack.
 *   - renderPresentationPdf({ draft, emailHtml }) — deck multi-página para
 *     handoff a HSBC. Internamente primero hace el PNG de la pieza y
 *     después lo embebe como imagen dentro de un marco con sombra (no
 *     embedded HTML reflow, que se veía mal en formato letter).
 */

import puppeteer, { type Browser } from "puppeteer-core";
import type { NotificationDraft } from "@/lib/adapters/supabase/notification-drafts";
import { buildPresentationHtml } from "./presentation-template";

/**
 * URL of the chromium tarball that @sparticuz/chromium-min downloads at
 * cold-start on Vercel. We pin the version to match our installed
 * `@sparticuz/chromium-min` so we never end up with a binary that's
 * incompatible with the puppeteer protocol it expects.
 *
 * Why a remote tarball: @sparticuz/chromium v124+ no longer bundles the
 * binary in the npm package (it busted Vercel's 50MB function size cap).
 * The `-min` variant ships just the wrapper code; the binary lives on a
 * GitHub release and Vercel caches it across cold starts.
 */
const CHROMIUM_TARBALL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

/**
 * Decide which Chromium binary to use based on the runtime environment.
 *
 *   - Vercel (any env): @sparticuz/chromium-min downloads the tarball
 *     above into /tmp on cold start and extracts a Lambda-tuned binary.
 *   - Local mac dev: fall back to the system Chrome.app. The
 *     PUPPETEER_EXECUTABLE_PATH env var lets devs override (e.g., Brave,
 *     Chromium, Edge).
 */
async function launchBrowser(): Promise<Browser> {
  const isVercel = Boolean(process.env.VERCEL);

  if (isVercel) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_TARBALL),
      headless: true,
    });
  }

  const localChrome =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return puppeteer.launch({
    executablePath: localChrome,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

/**
 * Set up request interception to skip tracking pixels — they sometimes hang
 * the page load and add nothing to the screenshot.
 */
async function setupInterception(page: import("puppeteer-core").Page) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = req.url();
    if (
      /open\.gif|tracking|pixel|google-analytics|doubleclick/i.test(url) &&
      req.resourceType() === "image"
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

/**
 * Render the HSBC email HTML to a PNG screenshot at native template width.
 * 2× DPR so the image stays crisp in Slack / Notion / PowerPoint.
 */
export async function renderPiecePng(emailHtml: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const png = await renderPiecePngWith(browser, emailHtml);
    return png;
  } finally {
    await browser.close();
  }
}

/**
 * Internal: take a screenshot reusing a passed-in browser. The
 * presentation flow uses this to avoid launching Chromium twice.
 */
async function renderPiecePngWith(browser: Browser, emailHtml: string): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    // Email is designed for 600px wide; leave a bit of breathing room and
    // crop with fullPage afterwards. DPR 2 = retina-quality PNG.
    await page.setViewport({ width: 640, height: 900, deviceScaleFactor: 2 });
    await setupInterception(page);
    await page.setContent(emailHtml, { waitUntil: "load", timeout: 30_000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 10_000 }).catch(() => {});
    const buf = await page.screenshot({
      fullPage: true,
      type: "png",
      omitBackground: false,
    });
    return Buffer.from(buf);
  } finally {
    await page.close();
  }
}

/**
 * Render the full presentation deck for HSBC review.
 *
 * Flow:
 *   1. Take a PNG of the email render (real pixels, no PDF reflow).
 *   2. Build the presentation HTML with that PNG embedded as a data URI.
 *   3. Render the HTML to PDF.
 *
 * Pages:
 *   1 — Cover            (proyecto, producto, fecha)
 *   2 — Brief            (objetivo, audiencia, urgencia, tono, tema, datos)
 *   3 — Asunto+preheader (inbox mockup + textos completos)
 *   4 — Pieza            (PNG del email dentro de un marco con sombra)
 *   5 — SMS              (iPhone mockup + texto completo)
 */
export async function renderPresentationPdf(args: {
  draft: NotificationDraft;
  emailHtml: string;
}): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    // Step 1: PNG of the piece.
    const emailPng = await renderPiecePngWith(browser, args.emailHtml);
    const emailPngDataUrl = `data:image/png;base64,${emailPng.toString("base64")}`;

    // Step 2 + 3: Render presentation HTML to PDF using the PNG inline.
    const page = await browser.newPage();
    try {
      // Match the viewport to letter @ 96dpi so Chrome doesn't draw a
      // viewport scrollbar that gets baked into the PDF output (this was
      // showing up as a vertical line next to the phone mockup).
      await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });
      await setupInterception(page);
      const html = buildPresentationHtml({ ...args, emailPngDataUrl });
      await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 10_000 }).catch(() => {});
      const pdfBuffer = await page.pdf({
        format: "letter",
        printBackground: true,
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}
