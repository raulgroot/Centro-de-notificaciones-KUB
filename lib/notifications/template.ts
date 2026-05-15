/**
 * Renders an HSBC notification draft into a real-looking HSBC email.
 *
 * Strategy: take a REAL HSBC HTML template from the catalog (saved in
 * lib/notifications/templates/hsbc-base.html — "viva emitted titular alta
 * nueva", a 19KB MKT-approved piece) and surgically replace the dynamic
 * bits with the draft's copy + hero image. The output is byte-identical
 * to a real HSBC email except for the copy you generated, which is the
 * only way MKT will sign off without back-and-forth.
 *
 * We use cheerio (server-side jQuery) so we get DOM-level targeting
 * instead of fragile regex. ~5ms per render on a 19KB document — well
 * worth it for the fidelity.
 *
 * Swap points in the real HSBC HTML:
 *   - <h2>      first occurrence    → headline (e.g. "¡Hola, NICOLE…")
 *   - body <div> wrapping "Tu Tarjeta de Crédito…" → body paragraphs
 *   - <img>   src containing "emitted_header" → hero image src
 *   - <a> with text "Actualizar domicilio de entrega" → CTA label
 *
 * If a swap target isn't found the original content stays — emails
 * still render, MKT can review the structure even with partial copy.
 *
 * Pure function. Reads the static HTML once (cached by Node's require
 * once we read it the first time).
 */

import { load, type CheerioAPI } from "cheerio";
import type { DraftCopy, DraftHeroImage } from "@/lib/db/schema";
import { HSBC_BASE_HTML } from "./templates/hsbc-base";

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Convert a free-form body (paragraphs separated by blank lines or single
 * newlines) into HSBC-styled HTML paragraphs.
 *
 * We mimic the spacing / font of the real template: paragraphs separated
 * by `<br><br>` because the real HSBC body uses inline text inside one
 * `<div>` rather than multiple `<p>` tags.
 */
function bodyToInlineHtml($: CheerioAPI, body: string): string {
  const escaped = body
    .split("\n")
    .map((line) => {
      const div = $("<div>").text(line);
      return div.html() ?? "";
    })
    .join("<br/>");
  return escaped;
}

/** Render copy + hero into the real HSBC HTML via cheerio. */
export function renderEmailHtml(args: {
  copy: DraftCopy;
  heroImage: DraftHeroImage | null | undefined;
}): string {
  const { copy, heroImage } = args;
  const $ = load(HSBC_BASE_HTML, {
    xml: false,
    xmlMode: false,
  });

  // 1. Headline → first <h2>
  if (copy.headline) {
    const h2 = $("h2").first();
    if (h2.length > 0) {
      // Preserve the existing tag/styling, replace inner text. We use .text()
      // (not .html()) so any HTML chars in the copy are escaped — safer.
      h2.text(copy.headline);
    }
  }

  // 2. Body → the div that wraps the "Tu Tarjeta de Crédito..." paragraph.
  //    We find it by locating the first <strong> with "Tarjeta de Crédito"
  //    text and replacing the contents of its closest <div>.
  if (copy.body) {
    const bodyTarget = $('strong:contains("Tarjeta de Crédito")').first().closest("div");
    if (bodyTarget.length > 0) {
      bodyTarget.html(bodyToInlineHtml($, copy.body));
    }
  }

  // 3. Hero image: the second img in the document is the "emitted_header"
  //    banner under the top logo. We find it by URL substring.
  if (heroImage?.url) {
    const heroImg = $("img")
      .filter((_i, el) => {
        const src = $(el).attr("src") ?? "";
        return /emitted[_-]?header|header[_-]?container|public_assets-emitted/.test(src);
      })
      .first();
    if (heroImg.length > 0) {
      heroImg.attr("src", heroImage.url);
      if (heroImage.alt) heroImg.attr("alt", heroImage.alt);
    }
  }

  // 4. CTA label: find anchor with text "Actualizar domicilio de entrega"
  //    (the only big content CTA in this template) and swap its text.
  if (copy.cta_label) {
    const cta = $("a")
      .filter((_i, el) => {
        const t = $(el).text().trim();
        return /Actualizar\s+domicilio/i.test(t);
      })
      .first();
    if (cta.length > 0) {
      cta.text(copy.cta_label);
    }
  }

  // 5. Title tag (if any) + preheader for inbox previews.
  //    The real HSBC base has no <title> — add one inside <head>.
  if (copy.subject) {
    const head = $("head");
    if (head.length > 0) {
      const existing = head.find("title");
      if (existing.length > 0) {
        existing.text(copy.subject);
      } else {
        head.append(`<title>${escapeAttr(copy.subject)}</title>`);
      }
    }
  }

  return $.html();
}
