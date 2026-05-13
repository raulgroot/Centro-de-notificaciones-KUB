ALTER TABLE "campaign_definitions" ADD COLUMN "asana_tag_gid" varchar(64);--> statement-breakpoint
ALTER TABLE "campaign_loads" ADD COLUMN "asana_gid" varchar(64);--> statement-breakpoint
ALTER TABLE "campaign_loads" ADD CONSTRAINT "campaign_loads_asana_gid_unique" UNIQUE("asana_gid");