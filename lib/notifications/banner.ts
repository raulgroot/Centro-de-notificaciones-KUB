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

import type { DraftBanner, DraftCopy } from "@/lib/db/schema";

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

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/** Solo URLs http(s) o data:image — igual que el hero. Evita javascript: y
 * cualquier otro esquema raro dentro del src del banner. */
function safeImageUrl(url: string | undefined): string {
  const u = (url ?? "").trim();
  if (/^https?:\/\//i.test(u) || /^data:image\//i.test(u)) return escapeAttr(u);
  return "";
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
    case "image":
      return Boolean(safeImageUrl(banner.imageUrl) || banner.title?.trim());
    case "coupon":
      return Boolean(banner.stat?.trim());
    case "steps":
      return Boolean(banner.items?.some((i) => i.trim()));
    case "notice":
      return Boolean(banner.title?.trim() || banner.subtitle?.trim());
    case "contact":
      return Boolean(banner.items?.some((i) => i.trim()));
    default:
      return false;
  }
}

/**
 * Lista efectiva de banners de una copy: prefiere `banners` (nuevo) y cae
 * al legacy `banner` único si la lista no existe. Filtra los vacíos.
 */
export function effectiveBanners(copy: Pick<DraftCopy, "banner" | "banners">): DraftBanner[] {
  const list = copy.banners?.length ? copy.banners : copy.banner ? [copy.banner] : [];
  return list.filter((b) => bannerHasContent(b));
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

function imageHtml(b: DraftBanner): string {
  const url = safeImageUrl(b.imageUrl);
  const alt = escapeAttr(b.imageAlt ?? b.title ?? "Imagen");
  if (b.imageFull) return imageFullHtml(b, url, alt);
  const subtitle = b.subtitle?.trim()
    ? `<p style="margin:4px 0 0 0;font-family:${FONT};font-size:13px;line-height:1.45;color:#5F5E5A;">${escapeHtml(b.subtitle)}</p>`
    : "";
  const imgCell = url
    ? `<td valign="top" width="180" style="padding:0 16px 0 0;"><img src="${url}" alt="${alt}" width="164" style="display:block;width:164px;max-width:100%;height:auto;border-radius:6px;" /></td>`
    : "";
  return `${TABLE_OPEN}
<tr><td style="background:#FAFAFA;border:1px solid #E8E8E8;border-radius:6px;padding:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
<tr>
${imgCell}<td valign="middle">
<p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.3;font-weight:700;color:${HSBC_RED};">${escapeHtml(b.title ?? "")}</p>${subtitle}
</td>
</tr>
</table>
</td></tr>
</table>`;
}

/**
 * Variante full-bleed del banner de imagen: la foto pegada al borde
 * izquierdo ocupando TODO el alto, texto centrado a la derecha sobre
 * blanco, esquinas redondeadas grandes (estilo card de promociones).
 *
 * Nota email-safe: `height:100%` + `object-fit:cover` cubren el alto en
 * clientes modernos (Gmail, Apple Mail). En clientes viejos (Outlook
 * desktop) la imagen degrada a su proporción natural a 220px de ancho —
 * legible, solo sin el efecto full-bleed.
 */
function imageFullHtml(b: DraftBanner, url: string, alt: string): string {
  const subtitle = b.subtitle?.trim()
    ? `<p style="margin:6px 0 0 0;font-family:${FONT};font-size:14px;line-height:1.45;color:#5F5E5A;">${escapeHtml(b.subtitle)}</p>`
    : "";
  const imgCell = url
    ? `<td valign="middle" width="220" style="padding:0;font-size:0;line-height:0;"><img src="${url}" alt="${alt}" width="220" style="display:block;width:220px;height:100%;min-height:150px;object-fit:cover;border-radius:12px 0 0 12px;" /></td>`
    : "";
  return `${TABLE_OPEN}
<tr><td style="padding:0;background:#FFFFFF;border:1px solid #E8E8E8;border-radius:12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
<tr>
${imgCell}<td valign="middle" style="padding:24px 28px;">
<p style="margin:0;font-family:${FONT};font-size:19px;line-height:1.3;font-weight:700;color:#1A1A1A;">${escapeHtml(b.title ?? "")}</p>${subtitle}
</td>
</tr>
</table>
</td></tr>
</table>`;
}

function couponHtml(b: DraftBanner): string {
  const eyebrow = b.eyebrow?.trim() || "Usa el código";
  const subtitle = b.subtitle?.trim()
    ? `<p style="margin:6px 0 0 0;font-family:${FONT};font-size:12px;line-height:1.4;color:#5F5E5A;">${escapeHtml(b.subtitle)}</p>`
    : "";
  return `${TABLE_OPEN}
<tr><td align="center" style="background:#FFFFFF;border:2px dashed ${HSBC_RED};border-radius:6px;padding:18px 24px;text-align:center;">
<p style="margin:0;font-family:${FONT};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#5F5E5A;">${escapeHtml(eyebrow)}</p>
<p style="margin:4px 0 0 0;font-family:${FONT};font-size:28px;letter-spacing:3px;font-weight:700;color:${HSBC_RED};">${escapeHtml(b.stat ?? "")}</p>${subtitle}
</td></tr>
</table>`;
}

function stepsHtml(b: DraftBanner): string {
  const title = b.title?.trim()
    ? `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${HSBC_RED};">${escapeHtml(b.title)}</p>`
    : "";
  const rows = (b.items ?? [])
    .map((i) => i.trim())
    .filter(Boolean)
    .map(
      (item, idx) =>
        `<tr><td valign="top" width="32" style="padding:0 0 12px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" valign="middle" width="22" height="22" bgcolor="${HSBC_RED}" style="background:${HSBC_RED};border-radius:50%;font-family:${FONT};font-size:12px;font-weight:700;color:#FFFFFF;line-height:22px;">${idx + 1}</td></tr></table></td><td valign="top" style="font-family:${FONT};font-size:14px;line-height:1.5;color:#333333;padding:1px 0 12px 0;">${escapeHtml(item)}</td></tr>`,
    )
    .join("\n");
  return `${TABLE_OPEN}
<tr><td style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:6px;padding:18px 20px;">
${title}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
${rows}
</table>
</td></tr>
</table>`;
}

function noticeHtml(b: DraftBanner): string {
  const title = b.title?.trim()
    ? `<p style="margin:0;font-family:${FONT};font-size:14px;font-weight:700;color:#1A1A1A;">${escapeHtml(b.title)}</p>`
    : "";
  const subtitle = b.subtitle?.trim()
    ? `<p style="margin:${title ? "4px" : "0"} 0 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:#5F5E5A;">${escapeHtml(b.subtitle)}</p>`
    : "";
  return `${TABLE_OPEN}
<tr>
<td style="background:#F5F5F5;border-top:3px solid ${HSBC_RED};padding:14px 20px;">
${title}${subtitle}
</td>
</tr>
</table>`;
}

function contactHtml(b: DraftBanner): string {
  const title = b.title?.trim() || "¿Necesitas ayuda?";
  const rows = (b.items ?? [])
    .map((i) => i.trim())
    .filter(Boolean)
    .map(
      (item) =>
        `<p style="margin:0 0 4px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:#333333;">${escapeHtml(item)}</p>`,
    )
    .join("\n");
  return `${TABLE_OPEN}
<tr><td align="center" style="background:#FFFFFF;border:1px solid #E8E8E8;border-radius:6px;padding:18px 24px;text-align:center;">
<p style="margin:0 0 8px 0;font-family:${FONT};font-size:15px;font-weight:700;color:${HSBC_RED};">${escapeHtml(title)}</p>
${rows}
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
    case "image":
      return imageHtml(banner);
    case "coupon":
      return couponHtml(banner);
    case "steps":
      return stepsHtml(banner);
    case "notice":
      return noticeHtml(banner);
    case "contact":
      return contactHtml(banner);
  }
}
