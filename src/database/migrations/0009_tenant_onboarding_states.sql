-- Migration: Add onboarding states to tenant_status enum
-- Reference: GAP-004 from onboarding-gap-analysis.md
-- Flow: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → ACTIVE

-- Add new enum values for tenant onboarding workflow
-- Note: PostgreSQL doesn't support inserting enum values at specific positions,
-- so we add them in the order they'll be used

ALTER TYPE "tenant_status" ADD VALUE IF NOT EXISTS 'DRAFT' BEFORE 'ACTIVE';
--> statement-breakpoint
ALTER TYPE "tenant_status" ADD VALUE IF NOT EXISTS 'SUBMITTED' BEFORE 'ACTIVE';
--> statement-breakpoint
ALTER TYPE "tenant_status" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW' BEFORE 'ACTIVE';
--> statement-breakpoint
ALTER TYPE "tenant_status" ADD VALUE IF NOT EXISTS 'APPROVED' BEFORE 'ACTIVE';
--> statement-breakpoint
ALTER TYPE "tenant_status" ADD VALUE IF NOT EXISTS 'REJECTED' BEFORE 'ACTIVE';
--> statement-breakpoint

-- Update default value for new tenants (handled in schema, but ensure column allows DRAFT)
-- No ALTER needed since enum constraint is satisfied

-- Comment for reference:
-- Previous values: ACTIVE, SUSPENDED
-- New values: DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, ACTIVE, SUSPENDED
