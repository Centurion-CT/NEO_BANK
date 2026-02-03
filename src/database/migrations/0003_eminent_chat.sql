ALTER TYPE "business_type" ADD VALUE 'limited_liability';--> statement-breakpoint
ALTER TYPE "business_type" ADD VALUE 'enterprise';--> statement-breakpoint
ALTER TYPE "identity_event_type" ADD VALUE 'relationship_added';--> statement-breakpoint
ALTER TYPE "identity_event_type" ADD VALUE 'relationship_removed';--> statement-breakpoint
ALTER TABLE "person_profiles" ALTER COLUMN "preferred_login_mode" SET DEFAULT 'password';