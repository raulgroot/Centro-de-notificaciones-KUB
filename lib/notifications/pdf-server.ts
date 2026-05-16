/**
 * Server-side PDF rendering for notification drafts.
 *
 * Uses puppeteer-core + headless Chromium (locally via the system Chrome,
 * on Vercel via @sparticuz/chromium) to render HTML → PDF. We do this
 * server-side (not client-side with jsPDF/html2canvas) because:
 *   - MKT and HSBC review the piece, so pixel-perfect typography matters.
 *   - The email HTML pulls images from email-mkt.hsbc and freepik CDNs;
 *     client-side canvas hits CORS, server-side fetches are unrestricted.
 *   - Selectable text in the output (so HSBC reviewers can copy/paste).
 *
 * Two entry points:
 *   - renderPiecePdf(emailHtml) — just the email, letter portrait, paginates
 *     if the email is taller than one page.
 *   - renderPresentationPdf({ draft, emailHtml }) — multi-page deck with
 *     cover, brief summary, asunto+preheader, the piece, and SMS mockup.
 *     This is what we hand off to HSBC for review.
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
 * Render the bare HSBC email HTML to a single-stream PDF. Auto-paginates if
 * the email exceeds page height (long bodies happen on multi-paragraph
 * pieces).
 */
export async function renderPiecePdf(emailHtml: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // Block requests we know will time out (no impact on visual output).
    // Email pixel trackers etc. — letting them through stalls networkidle0.
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
    await page.setContent(emailHtml, { waitUntil: "load", timeout: 30_000 });
    // puppeteer-core 25+ dropped `networkidle0` from setContent; wait for
    // network idle separately so external images (HSBC assets, Freepik)
    // have a chance to finish loading before we snap the PDF.
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 10_000 }).catch(() => {});
    const pdfBuffer = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "0.5in", bottom: "0.5in", left: "0.5in", right: "0.5in" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Render the full presentation deck for HSBC review.
 *   Page 1 — Cover (project / fecha / producto)
 *   Page 2 — Brief summary (objetivo, audiencia, urgencia, tono, tema)
 *   Page 3 — Asunto + preheader (inbox mockup)
 *   Page 4 — Pieza de email (full render)
 *   Page 5 — SMS (iPhone-style mockup + texto completo)
 */
export async function renderPresentationPdf(args: {
  draft: NotificationDraft;
  emailHtml: string;
}): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
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
    const html = buildPresentationHtml(args);
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 10_000 }).catch(() => {});
    const pdfBuffer = await page.pdf({
      format: "letter",
      printBackground: true,
      // The presentation template draws its own borders/footers per page,
      // so we use zero margins and let the HTML control padding.
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
