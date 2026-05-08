import type {
  NotificationFacets,
  NotificationFilter,
  NotificationRecord,
  NotificationSource,
} from "@/lib/ports/notification-source";
import { getClickhouseClient } from "./client";

/**
 * NotificationSource adapter backed by Kublau's ClickHouse warehouse.
 * Source table: `blazer_query_401`. See `docs/kublau-schema.md`.
 */

const TABLE = "blazer_query_401";

/** SELECT clause that aliases every Kublau column to a clean camelCase name. */
const SELECT_COLUMNS = `
  id,
  \`NOMBRE DE THEME/TRIGGER\`           AS themeName,
  \`ASUNTO DEL CORREO\`                 AS subject,
  \`TEXTO DE SMS\`                      AS smsText,
  \`PRODUCTO\`                          AS productsRaw,
  \`MOVIMIENTO\`                        AS movementsRaw,
  \`TIPO DE CLIENTE\`                   AS clientTypesRaw,
  \`DEBITO\`                            AS debitFlag,
  \`EMPLEADO\`                          AS employeeFlag,
  \`CON THEME\`                         AS hasThemeFlag,
  \`ULTIMA ACTUALIZACIÓN\`              AS updatedAt,
  \`LINK AL THEME O TRIGGER\`           AS themeLink,
  \`LINK AL THEME/TEMPLATE\`            AS templateLink,
  \`ULTIMO MAIL DEST\`                  AS lastMailTo,
  \`CUERPO DEL ULTIMO MAIL\`            AS htmlBody,
  \`FECHA DE ENVIO\`                    AS lastSentAt,
  \`POSTMARK_URL\`                      AS postmarkUrl
`;

interface RawRow {
  id: string;
  themeName: string;
  subject: string;
  smsText: string;
  productsRaw: string;
  movementsRaw: string;
  clientTypesRaw: string;
  debitFlag: string;
  employeeFlag: string;
  hasThemeFlag: string;
  updatedAt: string | null;
  themeLink: string;
  templateLink: string;
  lastMailTo: string | null;
  htmlBody: string | null;
  lastSentAt: string | null;
  postmarkUrl: string | null;
}

const parseJsonArray = (raw: string | null | undefined): string[] => {
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

const yesNo = (v: string | null | undefined): boolean => v?.toUpperCase() === "SI";

const toDate = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const nullIfEmpty = (v: string | null | undefined): string | null =>
  !v || v.trim() === "" ? null : v;

const mapRow = (row: RawRow): NotificationRecord => ({
  id: row.id,
  themeName: row.themeName,
  subject: row.subject,
  smsText: nullIfEmpty(row.smsText),
  products: parseJsonArray(row.productsRaw),
  movements: parseJsonArray(row.movementsRaw),
  clientTypes: parseJsonArray(row.clientTypesRaw),
  isDebit: yesNo(row.debitFlag),
  isEmployee: yesNo(row.employeeFlag),
  hasTheme: yesNo(row.hasThemeFlag),
  updatedAt: toDate(row.updatedAt),
  themeLink: nullIfEmpty(row.themeLink),
  templateLink: nullIfEmpty(row.templateLink),
  templatePreviewLink: null,
  sendTime: null,
  lastMailTo: nullIfEmpty(row.lastMailTo),
  htmlBody: nullIfEmpty(row.htmlBody),
  lastSentAt: toDate(row.lastSentAt),
  postmarkUrl: nullIfEmpty(row.postmarkUrl),
});

/**
 * Builds a parameterized WHERE clause from a filter. Returns the SQL fragment
 * (without the leading WHERE) and a `query_params` object compatible with the
 * @clickhouse/client driver. Empty filter → empty string.
 */
function buildWhere(filter: NotificationFilter): {
  sql: string;
  params: Record<string, unknown>;
} {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.search) {
    clauses.push(
      "(positionCaseInsensitive(`NOMBRE DE THEME/TRIGGER`, {search:String}) > 0 " +
        "OR positionCaseInsensitive(`ASUNTO DEL CORREO`, {search:String}) > 0)",
    );
    params.search = filter.search;
  }
  if (filter.product) {
    clauses.push("positionCaseInsensitive(`PRODUCTO`, {product:String}) > 0");
    params.product = filter.product;
  }
  if (filter.movement) {
    clauses.push("positionCaseInsensitive(`MOVIMIENTO`, {movement:String}) > 0");
    params.movement = filter.movement;
  }
  if (filter.clientType) {
    clauses.push("positionCaseInsensitive(`TIPO DE CLIENTE`, {clientType:String}) > 0");
    params.clientType = filter.clientType;
  }
  if (typeof filter.isDebit === "boolean") {
    clauses.push("`DEBITO` = {debit:String}");
    params.debit = filter.isDebit ? "SI" : "NO";
  }
  if (typeof filter.isEmployee === "boolean") {
    clauses.push("`EMPLEADO` = {employee:String}");
    params.employee = filter.isEmployee ? "SI" : "NO";
  }
  if (typeof filter.hasTheme === "boolean") {
    clauses.push("`CON THEME` = {hasTheme:String}");
    params.hasTheme = filter.hasTheme ? "SI" : "NO";
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export const kublauNotificationSource: NotificationSource = {
  async list(filter: NotificationFilter = {}): Promise<NotificationRecord[]> {
    const { sql: where, params } = buildWhere(filter);
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
    const offset = Math.max(filter.offset ?? 0, 0);

    const client = getClickhouseClient();
    const result = await client.query({
      query: `
        SELECT ${SELECT_COLUMNS}
        FROM ${TABLE}
        ${where}
        ORDER BY \`ULTIMA ACTUALIZACIÓN\` DESC NULLS LAST, id ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      query_params: params,
      format: "JSON",
    });
    const data = (await result.json()) as { data: RawRow[] };
    return data.data.map(mapRow);
  },

  async getById(id: string): Promise<NotificationRecord | null> {
    const client = getClickhouseClient();
    const result = await client.query({
      query: `SELECT ${SELECT_COLUMNS} FROM ${TABLE} WHERE id = {id:String} LIMIT 1`,
      query_params: { id },
      format: "JSON",
    });
    const data = (await result.json()) as { data: RawRow[] };
    const row = data.data[0];
    return row ? mapRow(row) : null;
  },

  async count(filter: NotificationFilter = {}): Promise<number> {
    const { sql: where, params } = buildWhere(filter);
    const client = getClickhouseClient();
    const result = await client.query({
      query: `SELECT count() AS n FROM ${TABLE} ${where}`,
      query_params: params,
      format: "JSON",
    });
    const data = (await result.json()) as { data: Array<{ n: string }> };
    return Number(data.data[0]?.n ?? 0);
  },

  async facets(): Promise<NotificationFacets> {
    const client = getClickhouseClient();
    const collect = async (column: string): Promise<string[]> => {
      const result = await client.query({
        query: `SELECT DISTINCT \`${column}\` AS v FROM ${TABLE} WHERE \`${column}\` != '' AND \`${column}\` != '[]'`,
        format: "JSON",
      });
      const data = (await result.json()) as { data: Array<{ v: string }> };
      const values = new Set<string>();
      for (const row of data.data) {
        for (const v of parseJsonArray(row.v)) values.add(v);
      }
      return [...values].sort();
    };

    const [products, movements, clientTypes] = await Promise.all([
      collect("PRODUCTO"),
      collect("MOVIMIENTO"),
      collect("TIPO DE CLIENTE"),
    ]);
    return { products, movements, clientTypes };
  },

  async listTables(): Promise<string[]> {
    const client = getClickhouseClient();
    const result = await client.query({ query: "SHOW TABLES", format: "JSON" });
    const data = (await result.json()) as { data: Array<{ name: string }> };
    return data.data.map((row) => row.name);
  },
};
