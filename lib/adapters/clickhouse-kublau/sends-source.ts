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

export const kublauSendsSource: SendsSource = {
  async getLastSendsByThemeNames(themeNames: string[]): Promise<Map<string, LastSend>> {
    const result = new Map<string, LastSend>();
    if (themeNames.length === 0) return result;

    // Dedupe input to avoid sending repeated values to ClickHouse.
    const unique = [...new Set(themeNames.map((n) => n.trim()).filter(Boolean))];
    if (unique.length === 0) return result;

    const client = getClickhouseClient();
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
      query_params: { names: unique },
      format: "JSON",
    });
    const data = (await queryResult.json()) as { data: RawSendRow[] };

    for (const raw of data.data) {
      // If duplicates exist in 401 (unlikely but possible), keep the freshest.
      const mapped = mapRow(raw);
      const existing = result.get(mapped.themeName);
      if (!existing || (mapped.sentAt && (!existing.sentAt || mapped.sentAt > existing.sentAt))) {
        result.set(mapped.themeName, mapped);
      }
    }

    return result;
  },
};
