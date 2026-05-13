CREATE TABLE "campaign_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"accent_color" varchar(16) DEFAULT '#026FFF' NOT NULL,
	"default_duration_days" integer DEFAULT 90 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_loads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar(64) NOT NULL,
	"load_date" timestamp with time zone NOT NULL,
	"deadline" timestamp with time zone,
	"asana_url" text,
	"notes" text,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campaign_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" varchar(64) NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"day_offset" integer,
	"trigger_type" varchar(16) DEFAULT 'time' NOT NULL,
	"flag" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_loads" ADD CONSTRAINT "campaign_loads_campaign_id_campaign_definitions_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_milestones" ADD CONSTRAINT "campaign_milestones_campaign_id_campaign_definitions_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_loads_status_idx" ON "campaign_loads" USING btree ("status","load_date");--> statement-breakpoint
CREATE INDEX "campaign_loads_campaign_idx" ON "campaign_loads" USING btree ("campaign_id","load_date");--> statement-breakpoint
CREATE INDEX "campaign_milestones_campaign_idx" ON "campaign_milestones" USING btree ("campaign_id","position");