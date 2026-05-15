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
    templatePreviewLink: text("template_preview_link"),
    sendTime: varchar("send_time", { length: 8 }),
    rsr: boolean("rsr").notNull().default(false),
    acr: boolean("acr").notNull().default(false),
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

/**
 * Documentation flows — step-by-step educational walkthroughs of the HSBC
 * customer experience (e.g. "Redirección"). Each row has a slug-based URL,
 * a list of rules/restrictions, and a sequence of steps with mockups.
 *
 * Originally this table was for "notification journeys" (sequence of
 * Kublau notifications). The shape now supports both: link to a specific
 * notification via `flow_steps.kublau_notification_id` when relevant, leave
 * it null for pure documentation steps.
 */
export const flows = pgTable("flows", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** URL slug — used in `/flows/<slug>`. */
  slug: varchar("slug", { length: 64 }).unique(),
  name: text("name").notNull(),
  subtitle: text("subtitle"),
  client: text("client"),
  description: text("description"),
  /** Hex accent color for the flow card / detail header. */
  accentColor: varchar("accent_color", { length: 16 }).default("#DB0011"),
  /**
   * Categorical rules / restrictions shown at the top of the detail page.
   * Each entry: `{ category: string; items: string[] }` (items may contain HTML).
   */
  rules: jsonb("rules").$type<Array<{ category: string; items: string[] }>>().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const flowSteps = pgTable("flow_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  flowId: uuid("flow_id")
    .notNull()
    .references(() => flows.id, { onDelete: "cascade" }),
  /** Optional: link to a Kublau notification this step represents. */
  kublauNotificationId: varchar("kublau_notification_id", { length: 255 }),
  position: integer("position").notNull(),
  title: text("title").notNull().default(""),
  description: text("description"),
  /** Bullet points shown beside the description. */
  keyPoints: jsonb("key_points").$type<string[]>().default([]),
  /** "El cliente da clic en…" — the user's next action. */
  userAction: text("user_action"),
  /** Optional URL of a mockup image (PNG / JPG) shown next to the step copy. */
  mockupImageUrl: text("mockup_image_url"),
  /** Inline HTML mockup (used for SMS bubbles / web mockups). */
  mockupHtml: text("mockup_html"),
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

/**
 * Snapshots of the metrics dataset (everything we pull from Kublau ClickHouse
 * to compute insights). The /metrics page reads the latest row instead of
 * hitting ClickHouse directly — so a Kublau outage doesn't take the page down.
 *
 * Refreshed by:
 *  - the daily Vercel cron at 06:00 UTC
 *  - a manual "Refrescar" button in the UI (POST /api/refresh-metrics)
 *
 * `data` holds the raw ClickHouse responses as JSON; the app re-runs insight
 * computation on read. This way bug-fixes in the insight rules apply immediately
 * to historic snapshots without re-pulling Kublau.
 */
export const metricsSnapshots = pgTable(
  "metrics_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshottedAt: timestamp("snapshotted_at", { withTimezone: true }).defaultNow().notNull(),
    data: jsonb("data").notNull(),
    rowsCount: integer("rows_count"),
    msTaken: integer("ms_taken"),
  },
  (table) => ({
    atIdx: index("metrics_snapshots_at_idx").on(table.snapshottedAt),
  }),
);

/**
 * Campaign catalog. Each row is a distinct campaign or sub-campaign
 * (e.g. `bb` = Bono de Bienvenida, `rp-viva` = Retención Proactiva VIVA).
 *
 * Lives in Supabase rather than hardcoded in TS so HSBC cadence changes
 * (which DO happen — the legacy platform had to ship code edits) become
 * a 30-second admin edit instead of a developer task.
 */
export const campaignDefinitions = pgTable("campaign_definitions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name").notNull(),
  /** Hex color for the campaign pill / accents. */
  accentColor: varchar("accent_color", { length: 16 }).notNull().default("#026FFF"),
  /** Total span in days from carga to last milestone (used for progress bar). */
  defaultDurationDays: integer("default_duration_days").notNull().default(90),
  /** Whether the campaign is currently in use; hidden when false. */
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  /**
   * Asana tag GID that signals new cargas. Tasks in this tag get pulled into
   * `campaign_loads` on sync. NULL means this campaign isn't auto-synced.
   */
  asanaTagGid: varchar("asana_tag_gid", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Each row is one milestone in a campaign's cadence (e.g. "10 días después
 * de envío sin registro"). `dayOffset` null = event-based or HSBC-triggered
 * (rendered separately, not on the timeline).
 *
 * Triggered types:
 *   - 'time'   → time-based with `dayOffset` (renders on timeline)
 *   - 'event'  → user action (Al registrarse) — out of timeline
 *   - 'manual' → external trigger (Cuando avise HSBC) — out of timeline
 */
export const campaignMilestones = pgTable(
  "campaign_milestones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: varchar("campaign_id", { length: 64 })
      .notNull()
      .references(() => campaignDefinitions.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    dayOffset: integer("day_offset"),
    triggerType: varchar("trigger_type", { length: 16 }).notNull().default("time"),
    /** Optional HSBC flag classification (F1, F2, F4...) from the spec. */
    flag: integer("flag"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    campaignIdx: index("campaign_milestones_campaign_idx").on(table.campaignId, table.position),
  }),
);

/**
 * Active cohorts. A new row appears each time a "carga" happens (file uploaded
 * to HSBC, batch processed, etc.). `loadDate` is day-zero for the timeline.
 *
 * Status:
 *   - 'active'    → currently in flight, shown on /campanas
 *   - 'completed' → finished (past the last milestone)
 *   - 'paused'    → put on hold; hidden by default
 */
export const campaignLoads = pgTable(
  "campaign_loads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: varchar("campaign_id", { length: 64 })
      .notNull()
      .references(() => campaignDefinitions.id),
    loadDate: timestamp("load_date", { withTimezone: true }).notNull(),
    /** Optional cut-off (e.g. "Fecha límite: 30 abr" for Retención). */
    deadline: timestamp("deadline", { withTimezone: true }),
    /**
     * Human-readable title — usually the Asana task name (e.g.
     * "RET_PRO_260311_sin_one"). Lets us distinguish multiple cargas on the
     * same date by their variant/segment.
     */
    title: text("title"),
    asanaUrl: text("asana_url"),
    /** Asana task GID. Unique so we don't double-import the same task. */
    asanaGid: varchar("asana_gid", { length: 64 }).unique(),
    notes: text("notes"),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => ({
    statusIdx: index("campaign_loads_status_idx").on(table.status, table.loadDate),
    campaignIdx: index("campaign_loads_campaign_idx").on(table.campaignId, table.loadDate),
  }),
);

/**
 * Drafts of new notifications created via the /creation wizard.
 *
 * Status:
 *   - 'draft'    → still being edited
 *   - 'shared'   → has a public link / was handed off to HSBC
 *   - 'archived' → no longer in use (kept for history)
 *
 * Most of the state is stashed as jsonb (`brief`, `copy`, `heroImage`) so
 * the schema doesn't need to migrate every time the wizard adds a field.
 */
export interface DraftBrief {
  /** HSBC card id: "viva", "vivaplus", "2now", "advance", "air", "premier", "clasica", "zero". */
  product?: string;
  /**
   * What action do we want the user to take after reading this?
   * One of: "activar" | "verificar" | "agradecer" | "informar" | "recordar" | "bienvenida".
   * Anchors the headline + CTA voice.
   */
  objective?: string;
  /** Free-form: "what is this notification about?". The meat of the prompt. */
  topic?: string;
  /**
   * Hard facts that MUST appear in the copy (dates, amounts, deadlines,
   * last-4 of the card, tracking IDs). Optional but encouraged.
   */
  keyInfo?: string;
  /**
   * Audience segment id. Pre-defined options:
   *   "nuevos" | "recurrentes" | "vip" | "morosos" | "todos"
   * Free-text legacy briefs may have arbitrary values.
   */
  audience?: string;
  /** Urgency level: "baja" | "media" | "alta". Influences language emphasis. */
  urgency?: string;
  /** Tone id: "informativo" | "celebratorio" | "urgente" | "formal" | "cercano". */
  tone?: string;
  // Legacy fields, kept as-is so drafts created before the simplification
  // still de-serialize without runtime errors. New briefs ignore these.
  lifecycle?: string;
  movement?: string;
  context?: string;
}

export interface DraftCopy {
  subject?: string;
  preheader?: string;
  headline?: string;
  body?: string; // 1-2 paragraphs
  cta_label?: string;
  sms?: string;
}

export interface DraftHeroImage {
  url: string;
  alt?: string;
  source: "freepik" | "upload" | "url";
  freepikId?: string;
  query?: string;
}

export const notificationDrafts = pgTable(
  "notification_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull().default(""),
    baseTemplateId: varchar("base_template_id", { length: 255 }),
    brief: jsonb("brief").$type<DraftBrief>().notNull().default({}),
    copy: jsonb("copy").$type<DraftCopy>().notNull().default({}),
    heroImage: jsonb("hero_image").$type<DraftHeroImage | null>(),
    renderedHtml: text("rendered_html"),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    updatedIdx: index("notification_drafts_updated_idx").on(table.updatedAt),
  }),
);
