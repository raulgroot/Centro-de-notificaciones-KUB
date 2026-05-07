import type {
  MetricsSource,
  MetricsSummary,
  PieceMetrics,
  WeeklyByMovementRow,
  WeeklyByProductRow,
} from "@/lib/ports/metrics-source";
import { getClickhouseClient } from "./client";

/**
 * Metrics adapter — pulls from Kublau aux tables:
 *  - blazer_query_425/426: piece × product send metrics (UNIONed; appear to be cohorts)
 *  - blazer_query_291: weekly send count by product (card type)
 *  - blazer_query_294: weekly send count by movement type
 *
 * See `docs/kublau-schema.md`.
 */

const PIECE_TABLES = ["blazer_query_425", "blazer_query_426"] as const;

const safe = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

interface RawPieceRow {
  Pieza: string | null;
  name: string | null;
  Enviado: string;
  Abierto: string;
  Click: string;
  RSR: string;
  OutOfTime: string;
}

const PIECE_SELECT = `
  \`Pieza\` AS Pieza,
  \`name\` AS name,
  \`Enviado\` AS Enviado,
  \`Abierto\` AS Abierto,
  \`Clic en algun link\` AS Click,
  \`RSR\` AS RSR,
  \`Clic fuera de tiempo\` AS OutOfTime
`;

const mapPieceRow = (r: RawPieceRow): PieceMetrics => {
  const sent = safe(r.Enviado);
  const opened = safe(r.Abierto);
  const clicked = safe(r.Click);
  return {
    piece: r.Pieza ?? "(sin nombre)",
    product: r.name ?? "(sin producto)",
    sent,
    opened,
    clicked,
    rsr: safe(r.RSR),
    outOfTimeClicks: safe(r.OutOfTime),
    openRate: ratio(opened, sent),
    clickRate: ratio(clicked, sent),
    clickToOpenRate: ratio(clicked, opened),
  };
};

const mapWeeklyRow = (
  raw: Record<string, string>,
  metaCols: string[],
): { week: string; weekLabel: string; counts: Record<string, number>; total: number } => {
  const counts: Record<string, number> = {};
  for (const col of metaCols) {
    counts[col] = safe(raw[col]);
  }
  return {
    week: raw.semana ?? "",
    weekLabel: raw.semana_n ?? "",
    counts,
    total: safe(raw.total),
  };
};

export const kublauMetricsSource: MetricsSource = {
  async summary(): Promise<MetricsSummary> {
    const unionSql = PIECE_TABLES.map(
      (t) =>
        `SELECT \`Enviado\` AS sent, \`Abierto\` AS opened, \`Clic en algun link\` AS clicked, \`RSR\` AS rsr FROM ${t}`,
    ).join(" UNION ALL ");

    const client = getClickhouseClient();
    const result = await client.query({
      query: `
        SELECT
          sum(sent) AS totalSent,
          sum(opened) AS totalOpened,
          sum(clicked) AS totalClicked,
          sum(rsr) AS totalRsr,
          count() AS pieceCount
        FROM (${unionSql}) t
      `,
      format: "JSON",
    });
    const data = (await result.json()) as {
      data: Array<{
        totalSent: string;
        totalOpened: string;
        totalClicked: string;
        totalRsr: string;
        pieceCount: string;
      }>;
    };
    const r = data.data[0];
    const totalSent = safe(r?.totalSent);
    const totalOpened = safe(r?.totalOpened);
    const totalClicked = safe(r?.totalClicked);
    return {
      totalSent,
      totalOpened,
      totalClicked,
      totalRsr: safe(r?.totalRsr),
      avgOpenRate: ratio(totalOpened, totalSent),
      avgClickRate: ratio(totalClicked, totalSent),
      pieceCount: safe(r?.pieceCount),
    };
  },

  async listPieceMetrics({ limit = 200 } = {}): Promise<PieceMetrics[]> {
    const unionSql = PIECE_TABLES.map((t) => `SELECT ${PIECE_SELECT} FROM ${t}`).join(
      " UNION ALL ",
    );

    const client = getClickhouseClient();
    const result = await client.query({
      query: `
        SELECT * FROM (${unionSql}) t
        ORDER BY toUInt64OrZero(toString(Enviado)) DESC
        LIMIT ${Math.min(Math.max(limit, 1), 1000)}
      `,
      format: "JSON",
    });
    const data = (await result.json()) as { data: RawPieceRow[] };
    return data.data.map(mapPieceRow);
  },

  async weeklyByProduct(): Promise<WeeklyByProductRow[]> {
    const client = getClickhouseClient();
    const result = await client.query({
      query: `SELECT * FROM blazer_query_291 ORDER BY semana ASC`,
      format: "JSON",
    });
    const data = (await result.json()) as {
      meta: Array<{ name: string; type: string }>;
      data: Array<Record<string, string>>;
    };
    const productCols = data.meta
      .map((m) => m.name)
      .filter((n) => n !== "semana" && n !== "semana_n" && n !== "total");
    return data.data.map((row) => mapWeeklyRow(row, productCols));
  },

  async weeklyByMovement(): Promise<WeeklyByMovementRow[]> {
    const client = getClickhouseClient();
    const result = await client.query({
      query: `SELECT * FROM blazer_query_294 ORDER BY semana ASC`,
      format: "JSON",
    });
    const data = (await result.json()) as {
      meta: Array<{ name: string; type: string }>;
      data: Array<Record<string, string>>;
    };
    const movementCols = data.meta
      .map((m) => m.name)
      .filter((n) => n !== "semana" && n !== "semana_n" && n !== "total");
    return data.data.map((row) => mapWeeklyRow(row, movementCols));
  },
};
