/**
 * SendsSource adapter backed by Kublau's ClickHouse (`blazer_query_401`).
 *
 * The table stores ONE row per template with columns for the latest send:
 *   - `FECHA DE ENVIO`           (string, "YYYY-MM-DD HH:MM:SS UTC")
 *   - `ULTIMO MAIL DEST`         (masked email, e.g. "ri****@hotmail.com")
 *   - `CUERPO DEL ULTIMO MAIL`   (full HTML body)
 *   - `POSTMARK_URL`             (deep link to the Postmark event)
 *
 * There is no per-event history table; if Kublau adds one in the future,
 * extend this port with `listSendsByThemeName(after: Date)`.
 */

import type { LastSend, SendsSource } from "@/lib/ports/sends-source";
import { getClickhouseClient } from "./client";

const TABLE = "blazer_query_401";

interface RawSendRow {
  themeName: string;
  sentAt: string | null;
  recipient: string | null;
  subject: string | null;
  htmlBody: string | null;
  postmarkUrl: string | null;
  themeLink: string | null;
}

const nullIfEmpty = (v: string | null | undefined): string | null =>
  !v || v.trim() === "" ? null : v;

const parseSentAt = (raw: string | null): Date | null => {
  if (!raw) return null;
  // "2026-05-11 19:33:12 UTC" — replace space with 'T' and 'UTC' with 'Z' for ISO parse.
  const iso = raw.replace(" UTC", "Z").replace(" ", "T");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const mapRow = (row: RawSendRow): LastSend => ({
  themeName: row.themeName,
  sentAt: parseSentAt(row.sentAt),
  recipient: nullIfEmpty(row.recipient),
  subject: nullIfEmpty(row.subject),
  htmlBody: nullIfEmpty(row.htmlBody),
  postmarkUrl: nullIfEmpty(row.postmarkUrl),
  themeLink: nullIfEmpty(row.themeLink),
});

/**
 * Tamaño máximo de cada chunk de theme names enviado a ClickHouse.
 *
 * El cliente @clickhouse/client serializa `query_params` en la URL con prefix
 * `param_*`. Para un Array(String) eso significa que TODOS los nombres viajan
 * concatenados en el URL. Con nombres HSBC típicos (~50-80 chars cada uno),
 * 100 nombres ≈ 6-8 KB de URL, que cabe holgadamente en el default de
 * ClickHouse (max_http_get_redirect_hops + buffer de nginx ~16KB). Más allá
 * de eso el server devuelve "414 Request-URI Too Large".
 *
 * Usuario reportó 414 en QA con lookup del catálogo completo (767 nombres).
 * Antes era una sola query → ~23KB URL → 414. Ahora chunkeamos a 100 → ~7KB
 * por request × 8 requests en paralelo. Latencia similar (las 8 corren
 * concurrentemente), pero ninguna individualmente excede el límite.
 */
const CHUNK_SIZE = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const kublauSendsSource: SendsSource = {
  async getLastSendsByThemeNames(themeNames: string[]): Promise<Map<string, LastSend>> {
    const result = new Map<string, LastSend>();
    if (themeNames.length === 0) return result;

    // Dedupe input to avoid sending repeated values to ClickHouse.
    const unique = [...new Set(themeNames.map((n) => n.trim()).filter(Boolean))];
    if (unique.length === 0) return result;

    const client = getClickhouseClient();
    const chunks = chunk(unique, CHUNK_SIZE);

    // Run all chunks in parallel — ClickHouse handles many concurrent
    // SELECTs fine, and on a healthy connection this is faster than serial.
    const responses = await Promise.all(
      chunks.map(async (names) => {
        const queryResult = await client.query({
          query: `
            SELECT
              \`NOMBRE DE THEME/TRIGGER\`     AS themeName,
              \`FECHA DE ENVIO\`              AS sentAt,
              \`ULTIMO MAIL DEST\`            AS recipient,
              \`ASUNTO DEL CORREO\`           AS subject,
              \`CUERPO DEL ULTIMO MAIL\`      AS htmlBody,
              \`POSTMARK_URL\`                AS postmarkUrl,
              \`LINK AL THEME O TRIGGER\`     AS themeLink
            FROM ${TABLE}
            WHERE \`NOMBRE DE THEME/TRIGGER\` IN ({names:Array(String)})
          `,
          query_params: { names },
          format: "JSON",
        });
        const data = (await queryResult.json()) as { data: RawSendRow[] };
        return data.data;
      }),
    );

    // Merge all chunks. Same dedupe-by-freshest logic as before in case the
    // chunk boundaries produce duplicates (they won't unless input had dups,
    // which we already filter above — but cheap to keep).
    for (const rows of responses) {
      for (const raw of rows) {
        const mapped = mapRow(raw);
        const existing = result.get(mapped.themeName);
        if (!existing || (mapped.sentAt && (!existing.sentAt || mapped.sentAt > existing.sentAt))) {
          result.set(mapped.themeName, mapped);
        }
      }
    }

    return result;
  },
};
