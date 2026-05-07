import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  uuid,
  varchar,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/**
 * App-owned schema. Lives in our Supabase Postgres (NOT Kublau).
 * Stores: a hot cache of Kublau notifications (synced periodically),
 * versioning, flows, integration links, QA notes, sync history.
 */

/**
 * Hot cache of Kublau's `blazer_query_401`. The app reads from here for speed.
 * A scheduled sync (Vercel Cron) keeps this in step with Kublau every hour.
 * `synced_at` records when each row was last refreshed.
 */
export const notificationsCache = pgTable(
  "notifications_cache",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    themeName: text("theme_name").notNull().default(""),
    subject: text("subject").notNull().default(""),
    smsText: text("sms_text"),
    products: jsonb("products").$type<string[]>().notNull().default([]),
    movements: jsonb("movements").$type<string[]>().notNull().default([]),
    clientTypes: jsonb("client_types").$type<string[]>().notNull().default([]),
    isDebit: boolean("is_debit").notNull().default(false),
    isEmployee: boolean("is_employee").notNull().default(false),
    hasTheme: boolean("has_theme").notNull().default(false),
    updatedAtKublau: timestamp("updated_at_kublau", { withTimezone: true }),
    themeLink: text("theme_link"),
    templateLink: text("template_link"),
    lastMailTo: text("last_mail_to"),
    htmlBody: text("html_body"),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    postmarkUrl: text("postmark_url"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    updatedIdx: index("notifications_cache_updated_idx").on(table.updatedAtKublau),
  }),
);

/** Tracks each sync run (success/failure, count, timing). */
export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: varchar("kind", { length: 32 }).notNull(), // "cron" | "manual"
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  rowsSynced: integer("rows_synced"),
  error: text("error"),
});

/**
 * Append-only versioning. Every save creates a new row.
 * The "current" version of a notification is the row with the highest
 * `version_number` for that `kublau_notification_id`.
 */
export const notificationVersions = pgTable("notification_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  kublauNotificationId: varchar("kublau_notification_id", { length: 255 }).notNull(),
  versionNumber: integer("version_number").notNull(),
  authorId: varchar("author_id", { length: 255 }).notNull(),
  changeSummary: text("change_summary"),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Customer-journey definitions (sequence of notifications). */
export const flows = pgTable("flows", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  client: text("client").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const flowSteps = pgTable("flow_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  flowId: uuid("flow_id")
    .notNull()
    .references(() => flows.id, { onDelete: "cascade" }),
  kublauNotificationId: varchar("kublau_notification_id", { length: 255 }).notNull(),
  position: integer("position").notNull(),
  triggerCondition: text("trigger_condition"),
});

/** Pointers to external systems (Asana tasks, Gmail threads, Freepik assets). */
export const integrationLinks = pgTable("integration_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  kublauNotificationId: varchar("kublau_notification_id", { length: 255 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  externalId: text("external_id").notNull(),
  metadata: jsonb("metadata"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

/** Free-form QA observations attached to a notification. */
export const qaNotes = pgTable("qa_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  kublauNotificationId: varchar("kublau_notification_id", { length: 255 }).notNull(),
  authorId: varchar("author_id", { length: 255 }).notNull(),
  severity: varchar("severity", { length: 16 }).notNull(),
  body: text("body").notNull(),
  resolved: jsonb("resolved").default({ at: null, by: null }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
