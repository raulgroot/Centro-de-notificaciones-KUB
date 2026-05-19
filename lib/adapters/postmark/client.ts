/**
 * Postmark REST adapter.
 *
 * Implementa el port `PostmarkSource` (lib/ports/postmark.ts) usando
 * fetch — sin SDK, sin extras. Postmark expone una API JSON sencilla, no
 * vale la pena el peso de su SDK oficial.
 *
 * Auth: `X-Postmark-Server-Token` header. La key viene de
 * `postmarkEnv().serverToken`.
 *
 * Docs:
 *   - https://postmarkapp.com/developer/api/messages-api
 *   - https://postmarkapp.com/developer/api/stats-api
 *   - https://postmarkapp.com/developer/api/server-api
 */

import { postmarkEnv } from "@/lib/env";
import type {
  PostmarkMessage,
  PostmarkServerInfo,
  PostmarkSource,
  PostmarkStats,
} from "@/lib/ports/postmark";

const POSTMARK_API = "https://api.postmarkapp.com";

/**
 * Small wrapper around `fetch` that injects the server token and surfaces
 * errors with the response body included (Postmark returns useful messages
 * in their JSON 422 payloads).
 */
async function pmFetch<T>(
  path: string,
  init?: { method?: "GET"; query?: Record<string, string | number | undefined> },
): Promise<T> {
  const { serverToken } = postmarkEnv();
  const qs = init?.query
    ? "?" +
      Object.entries(init.query)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const url = `${POSTMARK_API}${path}${qs}`;
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Accept: "application/json",
      "X-Postmark-Server-Token": serverToken,
    },
    // Postmark is fast; if it's slower than 15s something's wrong.
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Postmark GET ${path} → ${res.status} ${res.statusText}: ${body.slice(0, 400)}`,
    );
  }
  return (await res.json()) as T;
}

// ──────────────────────── Raw response shapes ────────────────────────

interface RawServer {
  ID: number;
  Name: string;
  Color?: string;
  ServerLink?: string;
}

interface RawMessage {
  MessageID: string;
  To: { Email: string; Name?: string }[];
  From: string;
  Subject: string;
  Tag?: string;
  MessageStream?: string;
  Status: string;
  ReceivedAt: string;
  TrackOpens: boolean;
  TrackLinks: string;
}

interface RawMessageList {
  TotalCount: number;
  Messages: RawMessage[];
}

interface RawOutboundStats {
  Sent: number;
  Bounced: number;
  SMTPApiErrors: number;
  SpamComplaints: number;
}

interface RawOpenStats {
  Unique?: number;
  /** Total appears at top-level of the response. */
  [day: string]: unknown;
}

interface RawClickStats {
  Unique?: number;
  [day: string]: unknown;
}

// ──────────────────────── Mappers ────────────────────────

function mapMessage(raw: RawMessage): PostmarkMessage {
  return {
    messageId: raw.MessageID,
    to: (raw.To ?? []).map((r) => ({ email: r.Email, name: r.Name })),
    subject: raw.Subject,
    from: raw.From,
    tag: raw.Tag?.trim() ? raw.Tag : null,
    messageStream: raw.MessageStream?.trim() ? raw.MessageStream : null,
    status: raw.Status,
    receivedAt: new Date(raw.ReceivedAt),
    trackOpens: Boolean(raw.TrackOpens),
    trackLinks: raw.TrackLinks,
  };
}

// ──────────────────────── Public adapter ────────────────────────

export async function getServerInfo(): Promise<PostmarkServerInfo> {
  const raw = await pmFetch<RawServer>("/server");
  return {
    id: raw.ID,
    name: raw.Name,
    color: raw.Color?.trim() ? raw.Color : null,
    serverLink: raw.ServerLink ?? "",
  };
}

export async function listOutboundMessages(query: {
  subject?: string;
  tag?: string;
  recipient?: string;
  fromDate?: string;
  toDate?: string;
  count?: number;
  offset?: number;
}): Promise<{ messages: PostmarkMessage[]; totalCount: number }> {
  const data = await pmFetch<RawMessageList>("/messages/outbound", {
    query: {
      // Postmark caps count at 500.
      count: Math.min(query.count ?? 50, 500),
      offset: query.offset ?? 0,
      subject: query.subject,
      tag: query.tag,
      recipient: query.recipient,
      fromdate: query.fromDate,
      todate: query.toDate,
    },
  });
  return {
    messages: (data.Messages ?? []).map(mapMessage),
    totalCount: data.TotalCount,
  };
}

/**
 * Stats por rango de fechas (opcionalmente filtrado por tag). Postmark
 * separa "sent / bounced / spam" (un endpoint) de "opens" y "clicks"
 * (endpoints distintos), así que aquí los unimos en un solo objeto.
 */
export async function getOutboundStats(query: {
  tag?: string;
  fromDate?: string;
  toDate?: string;
}): Promise<PostmarkStats> {
  const params = {
    tag: query.tag,
    fromdate: query.fromDate,
    todate: query.toDate,
  };

  // Run the three endpoints in parallel — they're independent.
  const [sendsRaw, opensRaw, clicksRaw] = await Promise.all([
    pmFetch<RawOutboundStats>("/stats/outbound", { query: params }),
    // Opens/clicks fallan con 404 cuando no hay tracking activo en el
    // server. Lo capturamos como null en vez de tirar.
    pmFetch<RawOpenStats>("/stats/outbound/opens", { query: params }).catch(() => null),
    pmFetch<RawClickStats>("/stats/outbound/clicks", { query: params }).catch(() => null),
  ]);

  // Postmark devuelve "Unique" + total como sum implícita; el total real
  // viene como el campo numérico de nivel superior `Sum`. Si en el futuro
  // Postmark cambia esto, tipamos como número en bruto.
  const totalOpens =
    opensRaw && typeof (opensRaw as Record<string, unknown>).Sum === "number"
      ? Number((opensRaw as Record<string, unknown>).Sum)
      : null;
  const totalClicks =
    clicksRaw && typeof (clicksRaw as Record<string, unknown>).Sum === "number"
      ? Number((clicksRaw as Record<string, unknown>).Sum)
      : null;

  return {
    sent: sendsRaw.Sent ?? 0,
    bounced: sendsRaw.Bounced ?? 0,
    smtpApiErrors: sendsRaw.SMTPApiErrors ?? 0,
    spamComplaints: sendsRaw.SpamComplaints ?? 0,
    uniqueOpens: opensRaw?.Unique ?? null,
    totalOpens,
    uniqueClicks: clicksRaw?.Unique ?? null,
    totalClicks,
  };
}

/**
 * Bound the module's exports as a `PostmarkSource` so it slots straight
 * into anywhere that expects the port (e.g. server actions, route handlers).
 */
export const postmarkClient: PostmarkSource = {
  getServerInfo,
  listOutboundMessages,
  getOutboundStats,
};
