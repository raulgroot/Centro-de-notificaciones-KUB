ALTER TABLE "flow_steps" ALTER COLUMN "kublau_notification_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "flows" ALTER COLUMN "client" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_steps" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "flow_steps" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "flow_steps" ADD COLUMN "key_points" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "flow_steps" ADD COLUMN "user_action" text;--> statement-breakpoint
ALTER TABLE "flow_steps" ADD COLUMN "mockup_image_url" text;--> statement-breakpoint
ALTER TABLE "flow_steps" ADD COLUMN "mockup_html" text;--> statement-breakpoint
ALTER TABLE "flows" ADD COLUMN "slug" varchar(64);--> statement-breakpoint
ALTER TABLE "flows" ADD COLUMN "subtitle" text;--> statement-breakpoint
ALTER TABLE "flows" ADD COLUMN "accent_color" varchar(16) DEFAULT '#DB0011';--> statement-breakpoint
ALTER TABLE "flows" ADD COLUMN "rules" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "flows" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "flows" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_slug_unique" UNIQUE("slug");