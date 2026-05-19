/**
 * Helpers para amarrar una notificación del catálogo Kublau con sus mensajes
 * reales en Postmark.
 *
 * El discriminador confiable es el SUBJECT (post-discovery 2026-05-16: el
 * `Tag` está hardcoded a `rastreo.external.notification` para todo el server,
 * y `MessageStream` siempre es `outbound`). Postmark soporta filtrar
 * `/messages/outbound` por subject con match-substring, así que pasamos el
 * subject de Kublau verbatim y Postmark hace el matching.
 *
 * Para el check de "verificado" comparamos `lastSentAt` (de Kublau) contra el
 * `receivedAt` del mensaje Postmark más reciente. Si ambos caen en una
 * ventana de 24h se considera coincidente — el clock de Kublau a veces va
 * en horario CDMX y Postmark en UTC, 24h da margen de sobra.
 */

export type VerificationStatus =
  | "verified" // Postmark coincide con la fecha de Kublau
  | "kublau_outdated" // Postmark tiene envíos recientes que Kublau no refleja
  | "no_match" // Kublau dice que salió pero Postmark no encuentra mensajes
  | "no_data"; // ninguno de los dos tiene info

/** Diferencia absoluta en horas entre dos fechas (null-safe). */
function diffHours(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.abs(a.getTime() - b.getTime()) / 3_600_000;
}

/** Window beyond which Postmark vs Kublau are considered out of sync. */
const SYNC_WINDOW_HOURS = 24;

/** Window beyond which we say "Kublau outdated" if Postmark is fresh. */
const OUTDATED_WINDOW_HOURS = 48;

export function classifyVerification(args: {
  kublauLastSentAt: Date | null;
  postmarkLastSentAt: Date | null;
}): VerificationStatus {
  const { kublauLastSentAt, postmarkLastSentAt } = args;
  if (!kublauLastSentAt && !postmarkLastSentAt) return "no_data";
  if (kublauLastSentAt && !postmarkLastSentAt) return "no_match";
  if (!kublauLastSentAt && postmarkLastSentAt) return "kublau_outdated";

  // Both present.
  const delta = diffHours(kublauLastSentAt, postmarkLastSentAt);
  if (delta == null) return "no_data";
  if (delta <= SYNC_WINDOW_HOURS) return "verified";

  // Postmark is fresher → Kublau is lagging.
  if (postmarkLastSentAt! > kublauLastSentAt!) {
    if (delta >= OUTDATED_WINDOW_HOURS) return "kublau_outdated";
  }

  // Postmark older than Kublau by a lot, or other weirdness → assume mismatch.
  return "no_match";
}

/** Human label + visual tone for each status. */
export const VERIFICATION_LABELS: Record<
  VerificationStatus,
  { label: string; tone: "ok" | "warn" | "bad" | "muted"; hint: string }
> = {
  verified: {
    label: "Verificado",
    tone: "ok",
    hint: "La fecha de envío de Kublau coincide con la última recepción en Postmark (±24 h).",
  },
  kublau_outdated: {
    label: "Kublau desactualizado",
    tone: "warn",
    hint: "Postmark vio envíos recientes que Kublau todavía no refleja. Es probable que el sync esté en mora.",
  },
  no_match: {
    label: "Sin coincidencia",
    tone: "bad",
    hint: "Kublau dice que salió pero Postmark no encuentra mensajes con este subject en la ventana revisada.",
  },
  no_data: {
    label: "Sin datos",
    tone: "muted",
    hint: "Ni Kublau ni Postmark tienen registro de envíos recientes para esta pieza.",
  },
};
