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
 * instead of fragile regex.
 *
 * Swap points + product-aware tweaks (per Raúl's notes May 14):
 *   - Top brand bar (header_viva_todo.png):
 *       · Viva / Viva Plus → keep the HSBC+VIVA branded header
 *       · Anything else    → swap for the HSBC-only logo (so the email
 *                           doesn't claim to be a Viva piece when it
 *                           isn't)
 *   - Hero image (emitted_header-container.png) → SVG with hexagonal
 *     clipPath wrapping the Freepik image. Same HSBC-style red hex
 *     framing the imagery; the actual photo is the one we picked.
 *   - Tracking visual (viva_generica_tracking.png) → REMOVED. It was
 *     leftover from the Viva-specific piece and doesn't belong on a
 *     generic notification.
 *   - <h2> first occurrence → headline
 *   - <div> wrapping "Tu Tarjeta de Crédito…" → body paragraphs
 *   - "Actualizar domicilio de entrega" anchor → CTA label
 *   - <head><title> → subject (added if missing)
 *   - "Tip de Seguridad", social bar, legal footer, Kublau footer:
 *     untouched (Raúl asked to keep these on every notification).
 *
 * If a swap target isn't found the original content stays — emails
 * still render, MKT can review the structure even with partial copy.
 */

import { load, type CheerioAPI } from "cheerio";
import type { DraftCopy, DraftHeroImage } from "@/lib/db/schema";
import { HSBC_BASE_HTML } from "./templates/hsbc-base";

/** Products that should keep the HSBC+VIVA top header art. */
const VIVA_PRODUCTS = new Set(["viva", "vivaplus", "hsbc viva", "hsbc viva plus"]);

/** Public URL of the HSBC-only logo (no product overlay). */
const HSBC_ONLY_LOGO_URL = "https://centro-de-notificaciones-kub.vercel.app/hsbc-logo.svg";

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

/**
 * Build the inline SVG block that renders the hero photo clipped to a
 * pointy-edge hexagon. Inline SVG is supported by Gmail, Apple Mail,
 * Yahoo, Outlook web, and modern Outlook desktop; older Outlook gracefully
 * degrades to an unclipped rectangle of the image (still readable).
 *
 * The hexagon proportions mirror HSBC's hex-banner style: full width 600,
 * height 360, with vertices at the top-left, top-right, mid-right edges,
 * and mirrored on the bottom — same visual cadence as the "Tip de
 * Seguridad" cutout further down.
 */
function hexagonImageSvg(imageUrl: string, alt: string): string {
  const safeUrl = escapeAttr(imageUrl);
  const safeAlt = escapeAttr(alt || "Imagen");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;max-width:600px;" role="img" aria-label="${safeAlt}">
  <defs>
    <clipPath id="hsbc-hero-hex" clipPathUnits="userSpaceOnUse">
      <polygon points="120,0 480,0 600,180 480,360 120,360 0,180" />
    </clipPath>
  </defs>
  <rect x="0" y="0" width="600" height="360" fill="#FFFFFF" />
  <image href="${safeUrl}" x="0" y="0" width="600" height="360" preserveAspectRatio="xMidYMid slice" clip-path="url(#hsbc-hero-hex)" />
</svg>`;
}

/** Render copy + hero into the real HSBC HTML via cheerio. */
export function renderEmailHtml(args: {
  copy: DraftCopy;
  heroImage: DraftHeroImage | null | undefined;
  /** Lowercase product id from the brief (e.g. "viva", "advance"). Determines the top logo header. */
  product?: string;
}): string {
  const { copy, heroImage, product } = args;
  const $ = load(HSBC_BASE_HTML, {
    xml: false,
    xmlMode: false,
  });

  // 0a. Drop the "tracking visual" image (viva_generica_tracking.png).
  //     It's a Viva-specific tracking-code illustration that doesn't belong
  //     on a generic notification. We remove the image AND its row so the
  //     spacing stays clean.
  $("img").each((_i, el) => {
    const src = $(el).attr("src") ?? "";
    if (/generica[_-]?tracking|public_assets-viva_generica_tracking/i.test(src)) {
      // Walk up to the wrapping <table> or <div> that holds just this image
      // and remove it. The real template wraps each image in its own
      // .spaced-section block.
      const wrap = $(el).closest("div.spaced-section");
      (wrap.length > 0 ? wrap : $(el)).remove();
    }
  });

  // 0b. Top brand header: only show the HSBC+VIVA art for Viva-family
  //     products; otherwise swap for the plain HSBC logo.
  const productKey = (product ?? "").trim().toLowerCase();
  const isViva = productKey ? VIVA_PRODUCTS.has(productKey) : false;
  if (!isViva) {
    const topHeader = $("img")
      .filter((_i, el) => {
        const src = $(el).attr("src") ?? "";
        return /header[_-]?viva[_-]?todo|public_assets-header_viva/i.test(src);
      })
      .first();
    if (topHeader.length > 0) {
      topHeader.attr("src", HSBC_ONLY_LOGO_URL);
      topHeader.attr("alt", "HSBC");
      // Preserve a sensible inline width for the plain logo (smaller than
      // the Viva-branded banner art).
      topHeader.attr("width", "180");
      topHeader.removeAttr("height");
      topHeader.attr(
        "style",
        "box-sizing:inherit;display:block;width:180px;max-width:100%;height:auto;margin:8px 0;",
      );
    }
  }

  // 1. Headline → first <h2>
  if (copy.headline) {
    const h2 = $("h2").first();
    if (h2.length > 0) {
      h2.text(copy.headline);
    }
  }

  // 2. Body → the div that wraps the "Tu Tarjeta de Crédito..." paragraph.
  if (copy.body) {
    const bodyTarget = $('strong:contains("Tarjeta de Crédito")').first().closest("div");
    if (bodyTarget.length > 0) {
      bodyTarget.html(bodyToInlineHtml($, copy.body));
    }
  }

  // 3. Hero image: replace the "emitted_header" banner with an SVG block
  //    that clips the Freepik image to a hexagon. If no heroImage was
  //    picked we keep the original placeholder so the layout doesn't
  //    collapse.
  if (heroImage?.url) {
    const heroImg = $("img")
      .filter((_i, el) => {
        const src = $(el).attr("src") ?? "";
        return /emitted[_-]?header|header[_-]?container|public_assets-emitted/i.test(src);
      })
      .first();
    if (heroImg.length > 0) {
      heroImg.replaceWith(hexagonImageSvg(heroImage.url, heroImage.alt ?? ""));
    }
  }

  // 4. CTA label
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

  // 5. Subject in <head><title>
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
