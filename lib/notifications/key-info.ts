/**
 * Serialización de los chips "información clave" a texto natural para el AI.
 *
 * El wizard captura datos estructurados (terminación de tarjeta, monto,
 * fecha límite, rango de fechas, URL/código). Antes de mandar al modelo
 * los convertimos a una oración en español que Claude puede leer y
 * embeber en la copy SIN inventar nada.
 *
 * Pura función, sin IO. Testeable en aislamiento.
 */

import type { DraftKeyInfo } from "@/lib/db/schema";

/**
 * Nombres "vendibles" de cada producto HSBC, en el formato exacto que el
 * AI debe usar en la copy ("Tarjeta de Crédito HSBC X"). El wizard solo
 * captura un id corto ("viva", "vivaplus"); aquí lo expandimos al naming
 * oficial que HSBC quiere ver en sus piezas.
 */
const PRODUCT_DISPLAY_NAMES: Record<string, string> = {
  viva: "Tarjeta de Crédito HSBC Viva",
  vivaplus: "Tarjeta de Crédito HSBC Viva Plus",
  "2now": "Tarjeta de Crédito HSBC 2Now",
  advance: "Tarjeta de Crédito HSBC Advance",
  air: "Tarjeta de Crédito HSBC Air",
  premier: "Tarjeta de Crédito HSBC Premier",
  clasica: "Tarjeta de Crédito HSBC Clásica",
  zero: "Tarjeta de Crédito HSBC Zero",
};

/**
 * Devuelve el nombre vendible del producto si está en el catálogo, o el
 * id tal cual si no lo conocemos (drafts viejos / productos custom).
 */
export function productDisplayName(productId: string | undefined): string {
  if (!productId) return "";
  return PRODUCT_DISPLAY_NAMES[productId.toLowerCase()] ?? productId;
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) a texto en español, ej.
 * "15 de junio de 2026". Si la fecha es inválida o no hay valor, devuelve
 * el string original (mejor mostrar algo que romper).
 */
export function formatDateEs(iso: string | undefined): string {
  if (!iso) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  // Ancla a mediodía UTC para evitar shifts de timezone que cambien el día.
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Convierte un `DraftKeyInfo` a oración en español lista para inyectar en
 * el prompt del AI. Devuelve string vacío si no hay nada que decir (el
 * caller decide si omite el bloque entero).
 */
export function serializeKeyInfoTags(tags: DraftKeyInfo | undefined): string {
  if (!tags) return "";
  const parts: string[] = [];

  if (tags.cardEnding && tags.cardEnding.trim()) {
    parts.push(`Tarjeta con terminación ${tags.cardEnding.trim()}`);
  }
  if (tags.amount && tags.amount.trim()) {
    // Pasamos el valor tal cual lo escribió el usuario; el AI lo normalizará
    // al formato HSBC oficial ("$X,XXX M.N.") según las reglas del system
    // prompt. Indicarlo explícitamente aquí evita ambigüedad.
    parts.push(`Monto / premio (formatéalo como "$X,XXX M.N." en la copy): ${tags.amount.trim()}`);
  }
  if (tags.deadline) {
    parts.push(`Fecha límite: ${formatDateEs(tags.deadline)}`);
  }
  if (tags.dateRange?.from || tags.dateRange?.to) {
    const from = formatDateEs(tags.dateRange.from);
    const to = formatDateEs(tags.dateRange.to);
    if (from && to) parts.push(`Vigencia: del ${from} al ${to}`);
    else if (from) parts.push(`Vigencia desde el ${from}`);
    else if (to) parts.push(`Vigencia hasta el ${to}`);
  }
  if (tags.promoUrl && tags.promoUrl.trim()) {
    parts.push(`URL / código promocional: ${tags.promoUrl.trim()}`);
  }

  return parts.join(". ");
}

/**
 * Determina si un `DraftKeyInfo` tiene al menos un campo poblado.
 * Útil para decidir si renderizar el bloque "Información clave" en el UI
 * y en el prompt.
 */
export function hasAnyKeyInfo(tags: DraftKeyInfo | undefined): boolean {
  if (!tags) return false;
  return Boolean(
    (tags.cardEnding && tags.cardEnding.trim()) ||
    (tags.amount && tags.amount.trim()) ||
    tags.deadline ||
    tags.dateRange?.from ||
    tags.dateRange?.to ||
    (tags.promoUrl && tags.promoUrl.trim()),
  );
}
