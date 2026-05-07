import { pgTable, text, timestamp, integer, jsonb, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * App-owned schema. Lives in our Supabase Postgres (NOT Kublau).
 * Stores everything the source-of-truth Kublau warehouse can't hold for us:
 * versioning, flows, integration links, QA notes.
 */

/**
 * Append-only versioning. Every save creates a new row.
 * The "current" version of a Kublau notification is the row with the highest
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
