/**
 * Render HTML email-safe de los banners de marca HSBC.
 *
 * Cuatro estilos (catálogo cerrado, ver `DraftBanner` en lib/db/schema):
 *   - promo:    banda roja sólida con el beneficio principal
 *   - deadline: tarjeta blanca con barra roja izquierda y la fecha en grande
 *   - benefits: lista con palomitas rojas
 *   - stat:     número grande destacado + descripción
 *
 * Reglas de construcción (mismas que heroBlockHtml en template.ts):
 *   - Solo <table role="presentation"> + estilos inline. Nada de flexbox,
 *     webfonts de iconos ni clases CSS — los clientes de correo los ignoran.
 *   - La palomita es el carácter "✓" (renderiza en todos lados); la barra
 *     roja es un <td> de 4px con bgcolor (truco bulletproof para Outlook).
 *   - Tipografía y rojo idénticos al resto del template.
 *
 * Función pura: DraftBanner adentro, string de HTML afuera. Sin IO.
 */

import type { DraftBanner } from "@/lib/db/schema";

const HSBC_RED = "#DB0011";
const FONT = "'Univers Next',Arial,sans-serif";
/** Mismo ancho máximo que los demás bloques del template. */
const TABLE_OPEN = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="width:100%;max-width:600px;border-collapse:collapse;margin:0 auto 24px auto;">`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** ¿El banner tiene suficiente contenido como para renderearse? */
export function bannerHasContent(banner: DraftBanner | null | undefined): banner is DraftBanner {
  if (!banner) return false;
  switch (banner.style) {
    case "promo":
    case "deadline":
      return Boolean(banner.title?.trim());
    case "benefits":
      return Boolean(banner.items?.some((i) => i.trim()));
    case "stat":
      return Boolean(banner.stat?.trim() || banner.title?.trim());
    default:
      return false;
  }
}

function promoHtml(b: DraftBanner): string {
  const eyebrow = b.eyebrow?.trim()
    ? `<p style="margin:0 0 4px 0;font-family:${FONT};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#F4B8BE;font-weight:700;">${escapeHtml(b.eyebrow)}</p>`
    : "";
  const subtitle = b.subtitle?.trim()
    ? `<p style="margin:6px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.4;color:#FBE4E6;">${escapeHtml(b.subtitle)}</p>`
    : "";
  return `${TABLE_OPEN}
<tr><td style="background:${HSBC_RED};border-radius:6px;padding:20px 24px;">
${eyebrow}<p style="margin:0;font-family:${FONT};font-size:24px;line-height:1.2;font-weight:700;color:#FFFFFF;">${escapeHtml(b.title ?? "")}</p>${subtitle}
</td></tr>
</table>`;
}

function deadlineHtml(b: DraftBanner): string {
  const eyebrow = b.eyebrow?.trim() || "Tienes hasta el";
  return `${TABLE_OPEN}
<tr>
<td width="4" bgcolor="${HSBC_RED}" style="background:${HSBC_RED};font-size:0;line-height:0;">&nbsp;</td>
<td style="background:#FFFFFF;border:1px solid #E8E8E8;border-left:none;padding:16px 20px;">
<p style="margin:0;font-family:${FONT};font-size:13px;color:#5F5E5A;">${escapeHtml(eyebrow)}</p>
<p style="margin:2px 0 0 0;font-family:${FONT};font-size:19px;font-weight:700;color:#1A1A1A;">${escapeHtml(b.title ?? "")}</p>
</td>
</tr>
</table>`;
}

function benefitsHtml(b: DraftBanner): string {
  const title = b.title?.trim()
    ? `<p style="margin:0 0 12px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${HSBC_RED};">${escapeHtml(b.title)}</p>`
    : "";
  const rows = (b.items ?? [])
    .map((i) => i.trim())
    .filter(Boolean)
    .map(
      (item) =>
        `<tr><td valign="top" width="18" style="font-family:${FONT};font-size:14px;font-weight:700;color:${HSBC_RED};padding:0 0 8px 0;">&#10003;</td><td style="font-family:${FONT};font-size:14px;line-height:1.4;color:#333333;padding:0 0 8px 0;">${escapeHtml(item)}</td></tr>`,
    )
    .join("\n");
  return `${TABLE_OPEN}
<tr><td style="background:#FAFAFA;border:1px solid #E8E8E8;border-radius:6px;padding:18px 20px;">
${title}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
${rows}
</table>
</td></tr>
</table>`;
}

function statHtml(b: DraftBanner): string {
  const subtitle = b.subtitle?.trim()
    ? `<p style="margin:2px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.4;color:#5F5E5A;">${escapeHtml(b.subtitle)}</p>`
    : "";
  return `${TABLE_OPEN}
<tr><td style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:6px;padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
<tr>
<td valign="middle" style="font-family:${FONT};font-size:34px;font-weight:700;color:${HSBC_RED};white-space:nowrap;padding:0 20px 0 0;">${escapeHtml(b.stat ?? "")}</td>
<td valign="middle" style="border-left:1px solid #E8E8E8;padding:0 0 0 20px;">
<p style="margin:0;font-family:${FONT};font-size:14px;font-weight:700;color:#1A1A1A;">${escapeHtml(b.title ?? "")}</p>${subtitle}
</td>
</tr>
</table>
</td></tr>
</table>`;
}

/** HTML del banner según su estilo. Devuelve "" si no hay contenido. */
export function bannerBlockHtml(banner: DraftBanner | null | undefined): string {
  if (!bannerHasContent(banner)) return "";
  switch (banner.style) {
    case "promo":
      return promoHtml(banner);
    case "deadline":
      return deadlineHtml(banner);
    case "benefits":
      return benefitsHtml(banner);
    case "stat":
      return statHtml(banner);
  }
}
