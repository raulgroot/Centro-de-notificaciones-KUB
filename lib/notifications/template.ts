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

/** Color rojo HSBC (Masterbrand) — usado para saludos y acentos. */
const HSBC_RED = "#DB0011";

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
 * Build the new HERO block: a two-column row that mirrors HSBC's
 * 621×300 container reference (see /Hexágono/001_Container in the brand
 * guide). Headline lives in the left column (white), the right column
 * holds the hex-clipped Freepik photo.
 *
 *     ┌──────────────────────────────────┐
 *     │                       __________ │
 *     │  Headline grande     /         │ │
 *     │  va aquí a la         /          │ │  ← Freepik image
 *     │  izquierda            \          │ │     clipped to hex
 *     │                       \_________ │ │
 *     └──────────────────────────────────┘
 *
 * Implementation: outer <table> with 2 cells; right cell contains a
 * raw inline SVG using the path from Hexágono_hex.svg. Tables are the
 * only reliable layout primitive across Outlook / Gmail / Apple Mail.
 *
 * Width ratios match the container reference: ~38% text, ~62% hex.
 * Inline SVG works in every modern email client; older Outlook
 * gracefully degrades to an unclipped rectangle (still readable).
 */
function heroBlockHtml(args: { headline: string; imageUrl: string; alt: string }): string {
  const { headline, imageUrl, alt } = args;
  const safeHeadline = escapeHtml(headline || "");
  const safeUrl = escapeAttr(imageUrl);
  const safeAlt = escapeAttr(alt || "Imagen");

  // Path verbatim from /Hexágono/Hexagono_hex.svg — the isolated hex
  // silhouette (no container). 384×278 native; we scale via the
  // wrapping SVG's `width` attribute.
  const HEX_PATH = "M112.5 278 L0 165.5 L165.5 0 L383.5 0 L383.5 278 Z";

  // Each render gets a unique clipPath id so multiple hex blocks in the
  // same email body don't collide.
  const clipId = `hsbc-hero-hex-${Math.random().toString(36).slice(2, 8)}`;

  const heroImage = safeUrl
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 278" width="372" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto;max-width:372px;" role="img" aria-label="${safeAlt}">
  <defs>
    <clipPath id="${clipId}" clipPathUnits="userSpaceOnUse">
      <path d="${HEX_PATH}" />
    </clipPath>
  </defs>
  <image href="${safeUrl}" x="0" y="0" width="384" height="278" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />
</svg>`
    : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:600px;border-collapse:collapse;margin:0 auto 24px auto;background:#FFFFFF;">
  <tr>
    <td valign="middle" align="left" style="width:38%;padding:24px 16px 24px 32px;background:#FFFFFF;">
      <h1 style="margin:0;font-family:'Univers Next',Arial,sans-serif;font-size:24px;line-height:1.2;font-weight:700;color:#1A1A1A;">${safeHeadline}</h1>
    </td>
    <td valign="middle" align="right" style="width:62%;padding:0;background:#FFFFFF;font-size:0;line-height:0;">${heroImage}</td>
  </tr>
</table>`;
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
      // the Viva-branded banner art). Padding lateral para que no toque
      // los bordes del email.
      topHeader.attr("width", "120");
      topHeader.removeAttr("height");
      topHeader.attr(
        "style",
        "box-sizing:inherit;display:block;width:120px;max-width:100%;height:auto;margin:16px 0 16px 24px;",
      );
    }
  }

  // 1. HERO BLOCK: replace the original full-width banner image with our
  //    new two-column block (headline on the left, hex-clipped Freepik
  //    image on the right). Mirrors Raúl's 001_Container design reference.
  //    Triggered when there's either a headline OR a hero image — that way
  //    a brand-new draft with no content yet still shows the structure
  //    placeholder.
  if (copy.headline || heroImage?.url) {
    const heroImg = $("img")
      .filter((_i, el) => {
        const src = $(el).attr("src") ?? "";
        return /emitted[_-]?header|header[_-]?container|public_assets-emitted/i.test(src);
      })
      .first();
    if (heroImg.length > 0) {
      // The original hero image lives inside a `.spaced-section` wrapper —
      // replace the whole wrapper so the new block doesn't inherit the old
      // padding that no longer makes sense in a side-by-side layout.
      const wrap = heroImg.closest("div.spaced-section");
      const newHero = heroBlockHtml({
        headline: copy.headline ?? "",
        imageUrl: heroImage?.url ?? "",
        alt: heroImage?.alt ?? "",
      });
      (wrap.length > 0 ? wrap : heroImg).replaceWith(newHero);
    }
  }

  // 2. With the headline now living inside the hero block, the original
  //    "¡Hola, NICOLE!" H2 below the banner is redundant. Drop it cleanly
  //    (remove the wrapping spaced-section so the layout closes up).
  const standaloneH2 = $("h2").first();
  if (standaloneH2.length > 0) {
    const wrap = standaloneH2.closest("div.spaced-section");
    (wrap.length > 0 ? wrap : standaloneH2).remove();
  }

  // 3. Body → the div that wraps the "Tu Tarjeta de Crédito..." paragraph.
  //    Prependemos un saludo en rojo HSBC + negritas. Usamos un placeholder
  //    `[Nombre]` que MKT/CRM puede reemplazar con la variable real del MTA
  //    (ej. `{{first_name}}` en Postmark / `%%FNAME%%` en Salesforce).
  if (copy.body) {
    const bodyTarget = $('strong:contains("Tarjeta de Crédito")').first().closest("div");
    if (bodyTarget.length > 0) {
      const greeting = `<p style="margin:0 0 16px 0;font-family:'Univers Next',Arial,sans-serif;font-size:18px;line-height:1.3;font-weight:700;color:${HSBC_RED};">¡Hola, [Nombre]!</p>`;
      bodyTarget.html(greeting + bodyToInlineHtml($, copy.body));
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
