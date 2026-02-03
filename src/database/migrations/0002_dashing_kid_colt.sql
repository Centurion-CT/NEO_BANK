DO $$ BEGIN
 CREATE TYPE "login_mode" AS ENUM('pin', 'password');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "person_profiles" ADD COLUMN "preferred_login_mode" "login_mode" DEFAULT 'pin';