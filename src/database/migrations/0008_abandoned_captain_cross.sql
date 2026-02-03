DO $$ BEGIN
 CREATE TYPE "identity_mfa_method" AS ENUM('email', 'sms', 'totp');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "constraint_type" AS ENUM('SELF_ONLY', 'REQUIRES_PROPERTY_MATCH', 'REQUIRES_TENANT_MATCH');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "identity_role_status" AS ENUM('ACTIVE', 'REVOKED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "role_category" AS ENUM('PERSONAL', 'BUSINESS', 'OPERATIONAL', 'SYSTEM');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "scope" AS ENUM('GLOBAL', 'TENANT', 'PROPERTY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "tenant_status" AS ENUM('ACTIVE', 'SUSPENDED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "tenant_type" AS ENUM('BUSINESS_BANKING', 'SUBSCRIPTION_WORKSPACE', 'PARTNER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "identity_property_relationship" AS ENUM('ONBOARDED_AT', 'PRIMARY_PROPERTY', 'SERVICED_BY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "property_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "property_subtype" AS ENUM('BRANCH', 'AGENT_LOCATION', 'OUTLET', 'MOBILE_APP', 'WEB_APP', 'USSD_CHANNEL', 'PARTNER_CHANNEL', 'INTERNAL_SYSTEM');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "property_type" AS ENUM('PHYSICAL', 'VIRTUAL');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TYPE "otp_purpose" ADD VALUE 'mfa_setup';--> statement-breakpoint
ALTER TYPE "permission_category" ADD VALUE 'tenants';--> statement-breakpoint
ALTER TYPE "permission_category" ADD VALUE 'properties';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"scope" "scope" DEFAULT 'GLOBAL' NOT NULL,
	"scope_ref_id" uuid,
	"status" "identity_role_status" DEFAULT 'ACTIVE' NOT NULL,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permission_constraints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"permission_id" uuid NOT NULL,
	"constraint_type" "constraint_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_type" "tenant_type" NOT NULL,
	"legal_name" text NOT NULL,
	"owner_identity_id" uuid,
	"status" "tenant_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"relationship_type" "identity_property_relationship" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_type" "property_type" NOT NULL,
	"property_subtype" "property_subtype" NOT NULL,
	"property_code" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"tenant_id" uuid,
	"status" "property_status" DEFAULT 'ACTIVE' NOT NULL,
	"is_assignable" boolean DEFAULT true NOT NULL,
	"allows_agent_access" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "properties_property_code_unique" UNIQUE("property_code")
);
--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "is_system_role" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "identities" ADD COLUMN "mfa_method" "identity_mfa_method";--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "role_code" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "role_category" "role_category" NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_roles_identity_id_idx" ON "identity_roles" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_roles_role_id_idx" ON "identity_roles" ("role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_roles_scope_idx" ON "identity_roles" ("scope");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_roles_scope_ref_id_idx" ON "identity_roles" ("scope_ref_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_roles_status_idx" ON "identity_roles" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_roles_active_idx" ON "identity_roles" ("identity_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_roles_unique_idx" ON "identity_roles" ("identity_id","role_id","scope","scope_ref_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permission_constraints_permission_id_idx" ON "permission_constraints" ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permission_constraints_unique_idx" ON "permission_constraints" ("permission_id","constraint_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenants_owner_identity_id_idx" ON "tenants" ("owner_identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenants_status_idx" ON "tenants" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenants_tenant_type_idx" ON "tenants" ("tenant_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenants_created_at_idx" ON "tenants" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_properties_identity_id_idx" ON "identity_properties" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_properties_property_id_idx" ON "identity_properties" ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_properties_relationship_type_idx" ON "identity_properties" ("relationship_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_properties_active_idx" ON "identity_properties" ("active");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_properties_unique_idx" ON "identity_properties" ("identity_id","property_id","relationship_type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "properties_property_code_idx" ON "properties" ("property_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_tenant_id_idx" ON "properties" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_status_idx" ON "properties" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_property_type_idx" ON "properties" ("property_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_property_subtype_idx" ON "properties" ("property_subtype");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_is_assignable_idx" ON "properties" ("is_assignable");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_role_code_idx" ON "roles" ("role_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_role_category_idx" ON "roles" ("role_category");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_roles" ADD CONSTRAINT "identity_roles_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_roles" ADD CONSTRAINT "identity_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_roles" ADD CONSTRAINT "identity_roles_assigned_by_identities_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "permission_constraints" ADD CONSTRAINT "permission_constraints_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_identity_id_identities_id_fk" FOREIGN KEY ("owner_identity_id") REFERENCES "identities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_properties" ADD CONSTRAINT "identity_properties_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_properties" ADD CONSTRAINT "identity_properties_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "properties" ADD CONSTRAINT "properties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_role_code_unique" UNIQUE("role_code");