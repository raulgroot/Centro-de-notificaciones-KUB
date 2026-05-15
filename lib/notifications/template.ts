/**
 * HSBC-compliant email template for /creation drafts.
 *
 * This is the structure that MKT validates before letting a notification go
 * out: HSBC hexagon logo at the top, hero image, white card with headline +
 * body + CTA in red, social bar, full legal footer with the registered
 * trade-mark notice and the contact phone (55 5721 1168 Opc 2). Everything
 * uses inline styles for max email-client compatibility (Gmail, Outlook,
 * Apple Mail, Postmark broadcast streams).
 *
 * Why we don't parse arbitrary Kublau HTML:
 *   The 19KB production templates are tables-inside-tables with inline
 *   styles on every node — there's no semantic anchor to "the headline".
 *   Instead we own a clean shell here that mirrors HSBC's approved
 *   structure and inject copy + hero via `{{token}}` substitution.
 *
 * Logo: served as an absolute URL from /public so the email renders the
 * same in our preview iframe and when HSBC actually sends it.
 *
 * Pure function. The wizard calls renderEmailHtml() whenever copy or image
 * changes and persists the result in `notification_drafts.rendered_html`.
 */

import type { DraftCopy, DraftHeroImage } from "@/lib/db/schema";

const RED = "#DB0011"; // HSBC corporate red
const RED_DARK = "#A00010";
const TEXT_DARK = "#0F1419";
const TEXT_BODY = "#2A2A2A";
const TEXT_MUTED = "#5C5C5C";
const TEXT_LIGHT = "#868686";
const BG_PAGE = "#F4F6F8";
const BG_CARD = "#FFFFFF";
const BORDER = "#E5E7EB";

/**
 * Where the email loads HSBC's hexagon from. Same Vercel deploy, so the
 * preview and the production send hit the same URL.
 */
const LOGO_URL = "https://centro-de-notificaciones-kub.vercel.app/hsbc-logo.svg";

const TEMPLATE = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es-MX">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>{{SUBJECT}}</title>
<style>
  /* Reset Outlook bleeds */
  body, table, td, p, a, li, blockquote { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  @media only screen and (max-width: 620px) {
    .container { width:100% !important; max-width:100% !important; }
    .px { padding-left:24px !important; padding-right:24px !important; }
    .hero-img { max-height:220px !important; }
    .h1 { font-size:22px !important; line-height:1.3 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BG_PAGE};font-family:Arial,Helvetica,sans-serif;color:${TEXT_DARK};">
<!-- Hidden preheader -->
<div style="display:none;font-size:1px;color:${BG_PAGE};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
  {{PREHEADER}}
</div>

<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${BG_PAGE};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <!--[if mso]><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"><tr><td><![endif]-->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="container" style="width:600px;max-width:600px;background:${BG_CARD};">
        <!-- Top white bar with HSBC hexagon (logo). 24px padding to match HSBC brand. -->
        <tr>
          <td class="px" style="padding:20px 28px;background:${BG_CARD};border-bottom:1px solid ${BORDER};">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${LOGO_URL}" alt="HSBC" width="120" height="32" style="display:block;width:120px;height:auto;border:0;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Hero image (full width, no padding). -->
        {{HERO_BLOCK}}

        <!-- Main content card -->
        <tr>
          <td class="px" style="padding:32px 36px 8px 36px;background:${BG_CARD};">
            <h1 class="h1" style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.3;font-weight:700;color:${TEXT_DARK};">
              {{HEADLINE}}
            </h1>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${TEXT_BODY};">
              {{BODY_HTML}}
            </div>
          </td>
        </tr>

        <!-- CTA (red HSBC button). -->
        {{CTA_BLOCK}}

        <!-- Spacer -->
        <tr><td style="padding:16px 0;">&nbsp;</td></tr>

        <!-- Footer: redes + legal + contacto -->
        <tr>
          <td class="px" style="padding:24px 36px;background:${BG_CARD};border-top:1px solid ${BORDER};">
            <!-- Redes -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXT_MUTED};">
                  Con&eacute;ctate a nuestras redes sociales
                </td>
                <td style="vertical-align:middle;text-align:right;">
                  <a href="https://www.facebook.com/HSBCMX/" style="display:inline-block;margin-left:6px;width:28px;height:28px;background:${TEXT_DARK};border-radius:50%;line-height:28px;text-align:center;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">f</a>
                  <a href="https://twitter.com/HSBC_MX" style="display:inline-block;margin-left:6px;width:28px;height:28px;background:${TEXT_DARK};border-radius:50%;line-height:28px;text-align:center;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">x</a>
                  <a href="https://www.youtube.com/user/HSBCMexico" style="display:inline-block;margin-left:6px;width:28px;height:28px;background:${TEXT_DARK};border-radius:50%;line-height:28px;text-align:center;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">▶</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- HSBC México · Contacto bar -->
        <tr>
          <td class="px" style="padding:18px 36px;background:#F8F8F8;border-top:1px solid ${BORDER};">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${TEXT_DARK};">
                  HSBC M&eacute;xico
                </td>
                <td style="vertical-align:middle;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${TEXT_MUTED};">
                  Contacto <a href="tel:5557211168" style="color:${RED};text-decoration:none;font-weight:700;">55 5721 1168 &ndash; Opc 2</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Legal -->
        <tr>
          <td class="px" style="padding:20px 36px 28px 36px;background:#F8F8F8;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.55;color:${TEXT_LIGHT};">
              Emisora de la Tarjeta de Cr&eacute;dito: HSBC M&eacute;xico, S.A., Instituci&oacute;n de Banca M&uacute;ltiple, Grupo Financiero HSBC. Consulta requisitos,
              t&eacute;rminos, condiciones de contrataci&oacute;n y comisiones en
              <a href="https://www.hsbc.com.mx" style="color:${TEXT_MUTED};text-decoration:underline;">www.hsbc.com.mx</a>.
              HSBC y sus logotipos son marcas registradas en M&eacute;xico.
            </p>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
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
        `<p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${TEXT_BODY};">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("\n              ");
}

function heroBlock(hero: DraftHeroImage | null | undefined): string {
  if (!hero?.url) return "";
  const alt = escapeHtml(hero.alt ?? "");
  return `<tr>
          <td style="padding:0;line-height:0;font-size:0;">
            <img src="${escapeHtml(hero.url)}" alt="${alt}" width="600" class="hero-img" style="display:block;width:100%;max-width:600px;height:auto;max-height:280px;object-fit:cover;border:0;" />
          </td>
        </tr>`;
}

function ctaBlock(label: string | undefined): string {
  if (!label) return "";
  return `<tr>
          <td class="px" style="padding:12px 36px 0 36px;background:${BG_CARD};">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="background:${RED};border-radius:6px;mso-padding-alt:14px 30px;">
                  <a href="#" style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.3px;border:1px solid ${RED_DARK};border-radius:6px;">
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
