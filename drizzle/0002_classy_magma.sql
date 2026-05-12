CREATE TABLE "metrics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshotted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb NOT NULL,
	"rows_count" integer,
	"ms_taken" integer
);
--> statement-breakpoint
CREATE INDEX "metrics_snapshots_at_idx" ON "metrics_snapshots" USING btree ("snapshotted_at");