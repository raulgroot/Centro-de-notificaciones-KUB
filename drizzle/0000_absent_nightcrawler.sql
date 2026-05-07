CREATE TABLE "flow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"kublau_notification_id" varchar(255) NOT NULL,
	"position" integer NOT NULL,
	"trigger_condition" text
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kublau_notification_id" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"external_id" text NOT NULL,
	"metadata" jsonb,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kublau_notification_id" varchar(255) NOT NULL,
	"version_number" integer NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"change_summary" text,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications_cache" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"theme_name" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"sms_text" text,
	"products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"movements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"client_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_debit" boolean DEFAULT false NOT NULL,
	"is_employee" boolean DEFAULT false NOT NULL,
	"has_theme" boolean DEFAULT false NOT NULL,
	"updated_at_kublau" timestamp with time zone,
	"theme_link" text,
	"template_link" text,
	"last_mail_to" text,
	"html_body" text,
	"last_sent_at" timestamp with time zone,
	"postmark_url" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kublau_notification_id" varchar(255) NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"body" text NOT NULL,
	"resolved" jsonb DEFAULT '{"at":null,"by":null}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(32) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"rows_synced" integer,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "flow_steps" ADD CONSTRAINT "flow_steps_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_cache_updated_idx" ON "notifications_cache" USING btree ("updated_at_kublau");