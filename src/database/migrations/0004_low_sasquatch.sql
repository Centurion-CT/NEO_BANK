ALTER TYPE "document_type" ADD VALUE 'cac_certificate';--> statement-breakpoint
ALTER TYPE "document_type" ADD VALUE 'memart';--> statement-breakpoint
ALTER TYPE "document_type" ADD VALUE 'business_utility_bill';--> statement-breakpoint
ALTER TABLE "person_profiles" ADD COLUMN "allow_web_login" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "person_profiles" ADD COLUMN "allow_mobile_login" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "person_profiles" ADD COLUMN "allow_ussd_login" boolean DEFAULT true NOT NULL;