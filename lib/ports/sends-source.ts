/**
 * Port: SendsSource
 *
 * Read-only access to the most recent send of each notification template.
 * Kublau's ClickHouse stores only the LAST send per template (no historical
 * events table). Adapter today: `lib/adapters/clickhouse-kublau/sends-source.ts`.
 *
 * Used by the QA workflow: given a list of theme names from an uploaded sheet,
 * fetch the latest send for each so the user can verify whether the change
 * they made on a given date has been delivered.
 */

export interface LastSend {
  themeName: string;
  /** UTC timestamp of the last delivered email. */
  sentAt: Date | null;
  /** Recipient email — comes masked from ClickHouse (e.g. "ri****@hotmail.com"). */
  recipient: string | null;
  /** Subject line of the last email. */
  subject: string | null;
  /** Full HTML body of the last email. May be large (10–25 KB). */
  htmlBody: string | null;
  /** Deep link to the Postmark event for this send. */
  postmarkUrl: string | null;
  /** Public link to the Kublau theme (so the user can jump to the editor). */
  themeLink: string | null;
}

export interface SendsSource {
  /**
   * Batch lookup: returns a Map keyed by theme name. Missing keys = no send found.
   * Names are matched case-sensitively against `NOMBRE DE THEME/TRIGGER`.
   */
  getLastSendsByThemeNames(themeNames: string[]): Promise<Map<string, LastSend>>;
}
