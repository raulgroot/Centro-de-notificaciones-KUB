/**
 * Port: NotificationSource
 *
 * Read-only access to the canonical notification data.
 * Today implemented by `lib/adapters/clickhouse-kublau/`. If Kublau is ever replaced,
 * we swap the adapter — the rest of the app is untouched.
 *
 * The shape mirrors the real Kublau schema (`blazer_query_401`) — see
 * `docs/kublau-schema.md` for column-by-column mapping.
 */

export interface NotificationRecord {
  id: string;
  themeName: string;
  subject: string;
  smsText: string | null;
  products: string[];
  movements: string[];
  clientTypes: string[];
  isDebit: boolean;
  isEmployee: boolean;
  hasTheme: boolean;
  updatedAt: Date | null;
  themeLink: string | null;
  templateLink: string | null;
  templatePreviewLink: string | null;
  sendTime: string | null;
  lastMailTo: string | null;
  htmlBody: string | null;
  lastSentAt: Date | null;
  postmarkUrl: string | null;
}

export interface NotificationFilter {
  search?: string;
  product?: string;
  movement?: string;
  clientType?: string;
  isDebit?: boolean;
  isEmployee?: boolean;
  hasTheme?: boolean;
  limit?: number;
  offset?: number;
}

/** Sets of distinct values for building filter UIs. */
export interface NotificationFacets {
  products: string[];
  movements: string[];
  clientTypes: string[];
}

export interface NotificationSource {
  list(filter: NotificationFilter): Promise<NotificationRecord[]>;
  getById(id: string): Promise<NotificationRecord | null>;
  count(filter: NotificationFilter): Promise<number>;
  facets(): Promise<NotificationFacets>;
  /** Discovery helper used during bootstrap to map Kublau's schema. */
  listTables(): Promise<string[]>;
}
