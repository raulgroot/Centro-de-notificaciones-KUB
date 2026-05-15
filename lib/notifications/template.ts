/**
 * HSBC email template engine for /creation drafts.
 *
 * We DON'T try to parse / mutate arbitrary HSBC HTML from the catalog —
 * those templates are 19KB tables-of-tables with inline styles and zero
 * semantic markup. Trying to find "the headline" or "the CTA" in there
 * by regex is a footgun.
 *
 * Instead we own a small, clean HSBC-flavored shell here and render copy +
 * hero image into it via `{{token}}` substitution. The output is a single
 * self-contained HTML document with inline styles (email-client safe) and
 * the HSBC look-and-feel: red header bar with logo, hero image, headline,
 * body, red CTA button, simple footer.
 *
 * Pure function. The wizard calls renderEmailHtml() whenever copy or image
 * changes, and the result gets persisted in `notification_drafts.rendered_html`.
 */

import type { DraftCopy, DraftHeroImage } from "@/lib/db/schema";

const RED = "#DB0011";
const TEXT_DARK = "#1A1A1A";
const TEXT_MUTED = "#666666";
const BG = "#F4F6F8";
const BORDER = "#E1E3E5";

/**
 * Minimal HSBC-flavored email shell. Inline styles only (Gmail / Outlook).
 * Tokens are double-curly-brace; everything else is fixed shell HTML.
 */
const TEMPLATE = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es-MX">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>{{SUBJECT}}</title>
<style>
  @media (max-width: 600px) {
    .container { width: 100% !important; }
    .px { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Helvetica,Arial,sans-serif;color:${TEXT_DARK};-webkit-font-smoothing:antialiased;">
<!-- Hidden preheader (shown next to subject in inbox previews) -->
<div style="display:none;font-size:1px;color:${BG};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
  {{PREHEADER}}
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${BG};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="container" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
        <!-- Header bar -->
        <tr>
          <td style="background:${RED};padding:18px 28px;" class="px">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">
                  <span style="display:inline-block;font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;">HSBC</span>
                </td>
                <td style="vertical-align:middle;text-align:right;font-size:11px;color:#FFFFFF;opacity:0.85;letter-spacing:1px;text-transform:uppercase;">
                  Tarjeta de cr&eacute;dito
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero image -->
        {{HERO_BLOCK}}

        <!-- Headline + body -->
        <tr>
          <td style="padding:32px 36px 8px 36px;" class="px">
            <h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.25;font-weight:700;color:${TEXT_DARK};">
              {{HEADLINE}}
            </h1>
            <div style="font-size:15px;line-height:1.6;color:${TEXT_DARK};">
              {{BODY_HTML}}
            </div>
          </td>
        </tr>

        <!-- CTA button -->
        {{CTA_BLOCK}}

        <!-- Soft divider -->
        <tr>
          <td style="padding:0 36px;">
            <div style="height:1px;background:${BORDER};margin-top:32px;"></div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px 28px 36px;" class="px">
            <p style="margin:0;font-size:12px;line-height:1.6;color:${TEXT_MUTED};">
              Este correo es operado por un tercero a solicitud de HSBC M&eacute;xico.
              Si tienes dudas comun&iacute;cate al
              <a href="tel:5557211168" style="color:${RED};text-decoration:none;">55 5721 1168 opc 2</a>.
            </p>
            <p style="margin:12px 0 0 0;font-size:11px;color:#999999;">
              HSBC M&eacute;xico, S.A., Instituci&oacute;n de Banca M&uacute;ltiple, Grupo Financiero HSBC.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:14px 0 0 0;font-size:11px;color:#999999;">
        &copy; HSBC M&eacute;xico &middot; Notificaci&oacute;n generada por Centro de Notificaciones Kublau
      </p>
    </td>
  </tr>
</table>
</body>
</html>`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Body usually arrives with line breaks; convert them to <p>. */
function bodyToHtml(body: string): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  return paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:${TEXT_DARK};">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n              ");
}

function heroBlock(hero: DraftHeroImage | null | undefined): string {
  if (!hero?.url) return "";
  const alt = escapeHtml(hero.alt ?? "");
  return `<tr>
          <td style="padding:0;">
            <img src="${escapeHtml(hero.url)}" alt="${alt}" width="600" style="display:block;width:100%;height:auto;max-height:300px;object-fit:cover;border:0;" />
          </td>
        </tr>`;
}

function ctaBlock(label: string | undefined): string {
  if (!label) return "";
  return `<tr>
          <td style="padding:8px 36px 0 36px;" class="px">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="background:${RED};border-radius:8px;">
                  <a href="#" style="display:inline-block;padding:13px 28px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.3px;">
                    ${escapeHtml(label)}
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

/** Render a copy bundle + hero into a complete HTML email document. */
export function renderEmailHtml(args: {
  copy: DraftCopy;
  heroImage: DraftHeroImage | null | undefined;
}): string {
  const { copy, heroImage } = args;
  return TEMPLATE.replace("{{SUBJECT}}", escapeHtml(copy.subject ?? ""))
    .replace("{{PREHEADER}}", escapeHtml(copy.preheader ?? ""))
    .replace("{{HERO_BLOCK}}", heroBlock(heroImage))
    .replace("{{HEADLINE}}", escapeHtml(copy.headline ?? "(sin titular)"))
    .replace("{{BODY_HTML}}", bodyToHtml(copy.body ?? ""))
    .replace("{{CTA_BLOCK}}", ctaBlock(copy.cta_label));
}
