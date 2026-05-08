ALTER TABLE "notifications_cache" ADD COLUMN "template_preview_link" text;--> statement-breakpoint
ALTER TABLE "notifications_cache" ADD COLUMN "send_time" varchar(8);--> statement-breakpoint
ALTER TABLE "notifications_cache" ADD COLUMN "rsr" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications_cache" ADD COLUMN "acr" boolean DEFAULT false NOT NULL;