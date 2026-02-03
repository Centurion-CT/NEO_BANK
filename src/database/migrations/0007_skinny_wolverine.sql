DO $$ BEGIN
 CREATE TYPE "mfa_method" AS ENUM('email', 'sms', 'totp');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "person_profiles" ADD COLUMN "mfa_method" "mfa_method";