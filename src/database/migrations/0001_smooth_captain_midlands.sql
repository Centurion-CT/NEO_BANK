ALTER TABLE "devices" ADD COLUMN "is_bound" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "bound_at" timestamp;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "bound_by_identity_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_bound_idx" ON "devices" ("identity_id","is_bound");