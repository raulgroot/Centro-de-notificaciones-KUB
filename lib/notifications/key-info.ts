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
    parts.push(`Monto / premio: ${tags.amount.trim()}`);
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
