/**
 * Port: PostmarkSource
 *
 * Read-only access to HSBC's Postmark server. Used to cross-reference the
 * Kublau catalog against the actual sending logs:
 *   1. Verify real envíos     — "esta notificación dice que salió ayer,
 *                                ¿Postmark confirma?"
 *   2. Métricas reales        — opens / clicks por tag o por template.
 *
 * Adapter today: `lib/adapters/postmark/client.ts`.
 *
 * NOTE: the link between a row in `notifications_cache` and a Postmark
 * message is still TBD — depende de cómo HSBC etiquete sus sends (Tag,
 * MessageStream, Subject, custom header). El script
 * `pnpm postmark:discover` muestra una muestra cruda para que aterricemos
 * la regla antes de cablear UI.
 */

/** One outbound message as Postmark returns it from /messages/outbound. */
export interface PostmarkMessage {
  messageId: string;
  /** Email + (optional) display name of each recipient. */
  to: { email: string; name?: string }[];
  /** Subject of the email. Postmark keeps the original verbatim. */
  subject: string;
  /** Sender — usually a no-reply alias on HSBC's domain. */
  from: string;
  /** Free-form tag set at send time. Esto es lo que probablemente nos sirva para amarrar a la notificación. */
  tag: string | null;
  /** "Broadcast" o el stream que HSBC use; relevante si separan transaccional vs marketing. */
  messageStream: string | null;
  /** Postmark's delivery status: "Sent", "Bounced", "Queued", etc. */
  status: string;
  /** When Postmark accepted the message. */
  receivedAt: Date;
  trackOpens: boolean;
  trackLinks: string;
}

/** Aggregate counters for a date range (opcionalmente filtrado por tag). */
export interface PostmarkStats {
  /** Total messages sent. */
  sent: number;
  bounced: number;
  smtpApiErrors: number;
  spamComplaints: number;
  /** Open tracking (puede venir null si no se rastrea para algunos sends). */
  uniqueOpens: number | null;
  totalOpens: number | null;
  /** Click tracking. */
  uniqueClicks: number | null;
  totalClicks: number | null;
}

/** Resumen del server al que le estamos pegando (sanity check). */
export interface PostmarkServerInfo {
  id: number;
  name: string;
  /** Hex color que HSBC haya asignado al server en su consola. */
  color: string | null;
  /** Helpful for debugging — qué tipo de mensajes maneja este server. */
  serverLink: string;
}

export interface PostmarkSource {
  /** Sanity check — confirma que la key es válida y devuelve el nombre del server. */
  getServerInfo(): Promise<PostmarkServerInfo>;

  listOutboundMessages(query: {
    subject?: string;
    tag?: string;
    recipient?: string;
    /** ISO date or YYYY-MM-DD. */
    fromDate?: string;
    toDate?: string;
    /** Postmark caps count at 500 per request. */
    count?: number;
    offset?: number;
  }): Promise<{ messages: PostmarkMessage[]; totalCount: number }>;

  getOutboundStats(query: {
    tag?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<PostmarkStats>;
}
