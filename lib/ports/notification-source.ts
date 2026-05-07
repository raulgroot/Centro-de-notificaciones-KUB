/**
 * Port: NotificationSource
 *
 * Read-only access to the canonical notification data.
 * Today implemented by `lib/adapters/clickhouse-kublau/`. If Kublau is ever replaced,
 * we swap the adapter — the rest of the app is untouched.
 */

export type NotificationType = "email" | "sms" | "push" | "in_app";

export interface NotificationRecord {
  id: string;
  title: string;
  type: NotificationType;
  client: string;
  subject: string | null;
  smsCopy: string | null;
  pushCopy: string | null;
  htmlPreview: string | null;
  /** Original row from the source, kept for fields the UI may surface ad hoc. */
  raw: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationFilter {
  client?: string;
  type?: NotificationType;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface NotificationSource {
  list(filter: NotificationFilter): Promise<NotificationRecord[]>;
  getById(id: string): Promise<NotificationRecord | null>;
  count(filter: NotificationFilter): Promise<number>;
  /** Discovery helper used during bootstrap to map Kublau's schema. */
  listTables(): Promise<string[]>;
}
