DO $$ BEGIN
 CREATE TYPE "identity_status" AS ENUM('shell', 'pending_verification', 'active', 'suspended', 'closed', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "identity_type" AS ENUM('natural_person', 'legal_entity');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "risk_level" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "business_role" AS ENUM('owner', 'director', 'signatory', 'admin', 'operator');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "business_type" AS ENUM('sole_proprietorship', 'partnership', 'private_limited', 'public_limited', 'nonprofit', 'cooperative', 'government', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth_principal_type" AS ENUM('phone', 'email', 'username');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth_secret_type" AS ENUM('pin', 'transaction_pin', 'password', 'totp');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "auth_event_type" AS ENUM('login_success', 'login_failure', 'logout', 'otp_sent', 'otp_verified', 'otp_failed', 'pin_changed', 'pin_reset_initiated', 'pin_reset_completed', 'device_trusted', 'device_revoked', 'mfa_enabled', 'mfa_disabled', 'principal_added', 'principal_verified', 'principal_blocked', 'session_created', 'session_terminated', 'suspicious_activity');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "session_event_type" AS ENUM('created', 'refreshed', 'activity', 'idle_timeout', 'absolute_timeout', 'user_logout', 'forced_logout', 'device_changed', 'suspicious', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "identity_event_type" AS ENUM('created', 'profile_created', 'profile_updated', 'contact_updated', 'address_updated', 'preferences_updated', 'status_changed', 'risk_level_changed', 'tier_upgraded', 'tier_downgraded', 'verification_started', 'verification_passed', 'verification_failed', 'document_submitted', 'document_approved', 'document_rejected', 'security_alert', 'fraud_suspected', 'account_locked', 'account_unlocked', 'admin_note_added', 'admin_action', 'support_escalation', 'closed', 'deletion_requested', 'data_exported');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "kyc_profile_status" AS ENUM('not_started', 'in_progress', 'pending_review', 'approved', 'rejected', 'expired', 'suspended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "kyc_tier" AS ENUM('tier_0', 'tier_1', 'tier_2', 'tier_3');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "bvn_check_status" AS ENUM('pending', 'verified', 'failed', 'mismatch', 'not_found', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "account_status" AS ENUM('active', 'dormant', 'frozen', 'closed', 'pending_activation');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "account_type" AS ENUM('savings', 'current', 'fixed_deposit', 'loan', 'investment');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "currency" AS ENUM('NGN', 'USD', 'GBP', 'EUR');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "document_status" AS ENUM('pending', 'processing', 'verified', 'rejected', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "document_type" AS ENUM('bvn', 'national_id', 'government_id', 'passport', 'drivers_license', 'voters_card', 'address_proof', 'utility_bill', 'bank_statement', 'selfie', 'signature');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "kyc_status" AS ENUM('not_started', 'pending', 'processing', 'verified', 'rejected', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "biometric_type" AS ENUM('fingerprint', 'face_id', 'touch_id');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "device_type" AS ENUM('web', 'ios', 'android', 'desktop', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "audit_action" AS ENUM('login_success', 'login_failure', 'logout', 'password_change', 'pin_change', 'mfa_enroll', 'mfa_verify', 'user_create', 'user_update', 'user_delete', 'profile_update', 'account_create', 'account_update', 'account_close', 'transaction_initiate', 'transaction_complete', 'transaction_fail', 'transaction_reverse', 'kyc_submit', 'kyc_approve', 'kyc_reject', 'session_create', 'session_revoke', 'device_trust', 'device_revoke', 'admin_action', 'config_change');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "otp_purpose" AS ENUM('email_verification', 'phone_verification', 'pin_reset', 'transaction_confirmation', 'login_mfa', 'sensitive_action');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "permission_category" AS ENUM('users', 'kyc', 'transactions', 'sessions', 'audit', 'settings', 'subscriptions', 'permissions');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "role_type" AS ENUM('super_admin', 'admin', 'support_agent', 'user');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "billing_cycle" AS ENUM('monthly', 'yearly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "plan_type" AS ENUM('basic', 'verified', 'premium', 'business');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "subscription_status" AS ENUM('active', 'expired', 'cancelled', 'past_due', 'pending', 'trial');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_type" "identity_type" DEFAULT 'natural_person' NOT NULL,
	"status" "identity_status" DEFAULT 'shell' NOT NULL,
	"risk_level" "risk_level" DEFAULT 'low' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "person_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"middle_name" varchar(100),
	"gender" "gender",
	"date_of_birth" timestamp,
	"nationality" varchar(100) DEFAULT 'NG',
	"profile_picture_url" text,
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100) DEFAULT 'NG',
	"postal_code" varchar(20),
	"preferred_language" varchar(10) DEFAULT 'en',
	"preferred_currency" varchar(10) DEFAULT 'NGN',
	"preferred_theme" varchar(20) DEFAULT 'system',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"legal_name" varchar(255) NOT NULL,
	"trading_name" varchar(255),
	"business_type" "business_type" NOT NULL,
	"registration_number" varchar(100),
	"tax_identification_number" varchar(100),
	"registration_date" timestamp,
	"registration_country" varchar(100) DEFAULT 'NG',
	"registered_address" text,
	"operating_address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100) DEFAULT 'NG',
	"postal_code" varchar(20),
	"business_email" varchar(255),
	"business_phone" varchar(20),
	"website" varchar(255),
	"industry_code" varchar(20),
	"industry_description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_identity_id" uuid NOT NULL,
	"person_identity_id" uuid NOT NULL,
	"role" "business_role" NOT NULL,
	"ownership_percentage" integer,
	"position_title" varchar(100),
	"start_date" timestamp DEFAULT now() NOT NULL,
	"end_date" timestamp,
	"is_verified" timestamp,
	"verified_at" timestamp,
	"verified_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"old_status" "identity_status",
	"new_status" "identity_status" NOT NULL,
	"changed_by" uuid,
	"reason" text,
	"metadata" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_principals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"principal_type" "auth_principal_type" NOT NULL,
	"principal_value" varchar(255) NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"secret_type" "auth_secret_type" NOT NULL,
	"secret_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"must_change_on_login" integer DEFAULT 0,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"device_fingerprint" varchar(255) NOT NULL,
	"device_type" "device_type" DEFAULT 'unknown' NOT NULL,
	"device_name" varchar(255),
	"device_model" varchar(100),
	"os_name" varchar(50),
	"os_version" varchar(50),
	"app_version" varchar(50),
	"user_agent" text,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"trusted_at" timestamp,
	"trust_expires_at" timestamp,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" varchar(255),
	"last_active_at" timestamp,
	"last_ip_address" varchar(45),
	"push_token" text,
	"push_token_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid,
	"event_type" "auth_event_type" NOT NULL,
	"device_id" uuid,
	"ip_address" varchar(45),
	"user_agent" text,
	"success" varchar(10),
	"failure_reason" varchar(255),
	"metadata" text,
	"principal_type" varchar(50),
	"principal_value" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"identity_id" uuid,
	"event_type" "session_event_type" NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"event_type" "identity_event_type" NOT NULL,
	"actor_identity_id" uuid,
	"actor_role" varchar(50),
	"description" text,
	"old_value" text,
	"new_value" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"kyc_tier" "kyc_tier" DEFAULT 'tier_0' NOT NULL,
	"status" "kyc_profile_status" DEFAULT 'not_started' NOT NULL,
	"bvn_encrypted" text,
	"nin_encrypted" text,
	"verification_started_at" timestamp,
	"verification_completed_at" timestamp,
	"last_reviewed_at" timestamp,
	"next_review_due" timestamp,
	"reviewed_by" uuid,
	"review_notes" text,
	"rejection_reason" varchar(255),
	"rejection_count" varchar(10) DEFAULT '0',
	"risk_score" varchar(10),
	"risk_factors" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bvn_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"bvn_hash" varchar(255) NOT NULL,
	"status" "bvn_check_status" DEFAULT 'pending' NOT NULL,
	"provider_name" varchar(100) NOT NULL,
	"provider_reference" varchar(255),
	"match_score" integer,
	"match_details" text,
	"mismatched_fields" text,
	"provider_response_encrypted" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp,
	"error_code" varchar(50),
	"error_message" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"account_id" varchar(100) NOT NULL,
	"account_number" varchar(20) NOT NULL,
	"account_type" "account_type" NOT NULL,
	"currency" "currency" DEFAULT 'NGN' NOT NULL,
	"nickname" varchar(100),
	"balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"available_balance" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"hold_amount" numeric(18, 2) DEFAULT '0.00' NOT NULL,
	"status" "account_status" DEFAULT 'pending_activation' NOT NULL,
	"interest_rate" numeric(5, 2),
	"is_primary" boolean DEFAULT false NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"last_transaction_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"source_account_id" uuid,
	"destination_account_id" uuid,
	"reference" varchar(50) NOT NULL,
	"idempotency_key" varchar(100),
	"type" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"fee" numeric(18, 2) DEFAULT '0.00',
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"balance_before" numeric(18, 2),
	"balance_after" numeric(18, 2),
	"description" text,
	"narration" text,
	"counterparty_name" varchar(255),
	"counterparty_account" varchar(20),
	"counterparty_bank" varchar(100),
	"failure_reason" text,
	"metadata" jsonb,
	"channel" varchar(50),
	"ip_address" varchar(45),
	"device_id" varchar(100),
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kyc_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"document_type" varchar(50) NOT NULL,
	"document_number" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"file_url" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"verified_at" timestamp,
	"reviewed_by" uuid,
	"review_notes" text,
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"refresh_token_hash" varchar(255) NOT NULL,
	"device_id" varchar(100),
	"device_type" "device_type" DEFAULT 'unknown' NOT NULL,
	"device_name" varchar(255),
	"user_agent" text,
	"ip_address" varchar(45) NOT NULL,
	"location" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"biometric_enabled" boolean DEFAULT false NOT NULL,
	"biometric_type" "biometric_type",
	"biometric_token_hash" varchar(255),
	"biometric_registered_at" timestamp,
	"biometric_last_used_at" timestamp,
	"biometric_failed_attempts" integer DEFAULT 0 NOT NULL,
	"biometric_locked_until" timestamp,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_email" varchar(255),
	"admin_id" uuid,
	"action" "audit_action" NOT NULL,
	"resource_type" varchar(50),
	"resource_id" uuid,
	"description" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"request_id" varchar(100),
	"session_id" uuid,
	"status" varchar(20) DEFAULT 'success' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"channel" varchar(20) NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid,
	"code_hash" varchar(255) NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"target" varchar(255) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"verified_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"subject" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium' NOT NULL,
	"admin_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" "permission_category" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "role_type" NOT NULL,
	"description" text,
	"is_system_role" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"subscription_id" uuid,
	"action" varchar(50) NOT NULL,
	"from_plan_id" uuid,
	"to_plan_id" uuid,
	"amount" numeric(12, 2),
	"currency" varchar(10) DEFAULT 'NGN',
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "plan_type" NOT NULL,
	"description" text,
	"monthly_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"yearly_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"daily_transaction_limit" numeric(18, 2),
	"monthly_transaction_limit" numeric(18, 2),
	"max_transfers_per_day" integer,
	"max_accounts_allowed" integer DEFAULT 1 NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"billing_cycle" "billing_cycle" DEFAULT 'monthly' NOT NULL,
	"price_at_subscription" numeric(12, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"trial_end_date" timestamp,
	"auto_renewal" boolean DEFAULT true NOT NULL,
	"renewal_failed_at" timestamp,
	"renewal_attempts" integer DEFAULT 0 NOT NULL,
	"previous_plan_id" uuid,
	"upgraded_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "biometric_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"challenge_hash" varchar(255) NOT NULL,
	"is_used" boolean DEFAULT false NOT NULL,
	"is_expired" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identities_status_idx" ON "identities" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identities_risk_level_idx" ON "identities" ("risk_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identities_identity_type_idx" ON "identities" ("identity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identities_created_at_idx" ON "identities" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_profiles_identity_id_idx" ON "person_profiles" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_profiles_name_idx" ON "person_profiles" ("first_name","last_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_profiles_nationality_idx" ON "person_profiles" ("nationality");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_profiles_identity_id_idx" ON "business_profiles" ("identity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "business_profiles_registration_number_idx" ON "business_profiles" ("registration_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_profiles_tax_id_idx" ON "business_profiles" ("tax_identification_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_profiles_business_type_idx" ON "business_profiles" ("business_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_profiles_legal_name_idx" ON "business_profiles" ("legal_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_relationships_business_identity_idx" ON "business_relationships" ("business_identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_relationships_person_identity_idx" ON "business_relationships" ("person_identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_relationships_role_idx" ON "business_relationships" ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "business_relationships_ownership_idx" ON "business_relationships" ("ownership_percentage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_status_history_identity_id_idx" ON "identity_status_history" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_status_history_changed_by_idx" ON "identity_status_history" ("changed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_status_history_created_at_idx" ON "identity_status_history" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_status_history_new_status_idx" ON "identity_status_history" ("new_status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_principals_value_idx" ON "auth_principals" ("principal_type","principal_value");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_principals_identity_id_idx" ON "auth_principals" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_principals_verified_idx" ON "auth_principals" ("is_verified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_principals_primary_idx" ON "auth_principals" ("identity_id","is_primary");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_secrets_identity_id_idx" ON "auth_secrets" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_secrets_identity_type_idx" ON "auth_secrets" ("identity_id","secret_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_secrets_locked_until_idx" ON "auth_secrets" ("locked_until");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_secrets_expires_at_idx" ON "auth_secrets" ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "devices_identity_fingerprint_idx" ON "devices" ("identity_id","device_fingerprint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_identity_id_idx" ON "devices" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_trusted_idx" ON "devices" ("identity_id","is_trusted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_last_active_idx" ON "devices" ("last_active_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devices_revoked_idx" ON "devices" ("is_revoked");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_events_identity_id_idx" ON "auth_events" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_events_event_type_idx" ON "auth_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_events_created_at_idx" ON "auth_events" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_events_device_id_idx" ON "auth_events" ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_events_ip_address_idx" ON "auth_events" ("ip_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_events_identity_time_idx" ON "auth_events" ("identity_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_events_session_id_idx" ON "session_events" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_events_identity_id_idx" ON "session_events" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_events_event_type_idx" ON "session_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_events_created_at_idx" ON "session_events" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_events_identity_id_idx" ON "identity_events" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_events_event_type_idx" ON "identity_events" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_events_actor_identity_id_idx" ON "identity_events" ("actor_identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_events_created_at_idx" ON "identity_events" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_events_identity_time_idx" ON "identity_events" ("identity_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_profiles_identity_id_idx" ON "kyc_profiles" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_profiles_status_idx" ON "kyc_profiles" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_profiles_tier_idx" ON "kyc_profiles" ("kyc_tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_profiles_last_reviewed_idx" ON "kyc_profiles" ("last_reviewed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_profiles_pending_review_idx" ON "kyc_profiles" ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_profiles_expires_at_idx" ON "kyc_profiles" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bvn_checks_identity_id_idx" ON "bvn_checks" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bvn_checks_bvn_hash_idx" ON "bvn_checks" ("bvn_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bvn_checks_status_idx" ON "bvn_checks" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bvn_checks_provider_idx" ON "bvn_checks" ("provider_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bvn_checks_requested_at_idx" ON "bvn_checks" ("requested_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bvn_checks_identity_status_idx" ON "bvn_checks" ("identity_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_account_id_idx" ON "accounts" ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_account_number_idx" ON "accounts" ("account_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_identity_id_idx" ON "accounts" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_status_idx" ON "accounts" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_type_idx" ON "accounts" ("account_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_reference_idx" ON "transactions" ("reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_idempotency_idx" ON "transactions" ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_identity_id_idx" ON "transactions" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_source_account_idx" ON "transactions" ("source_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_dest_account_idx" ON "transactions" ("destination_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_status_idx" ON "transactions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_type_idx" ON "transactions" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_created_at_idx" ON "transactions" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_documents_identity_id_idx" ON "kyc_documents" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_documents_status_idx" ON "kyc_documents" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_documents_type_idx" ON "kyc_documents" ("document_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_identity_id_idx" ON "sessions" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_device_id_idx" ON "sessions" ("device_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_is_active_idx" ON "sessions" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_biometric_enabled_idx" ON "sessions" ("biometric_enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "audit_logs" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_request_id_idx" ON "audit_logs" ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_identity_id_idx" ON "notifications" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_identity_read_idx" ON "notifications" ("identity_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otps_identity_id_idx" ON "otps" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otps_target_idx" ON "otps" ("target");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otps_purpose_idx" ON "otps" ("purpose");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "otps_expires_at_idx" ON "otps" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_requests_identity_id_idx" ON "support_requests" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_requests_status_idx" ON "support_requests" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_requests_created_at_idx" ON "support_requests" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "permissions_code_idx" ON "permissions" ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "permissions_category_idx" ON "permissions" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_role_id_idx" ON "role_permissions" ("role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx" ON "role_permissions" ("permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_unique_idx" ON "role_permissions" ("role_id","permission_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_idx" ON "roles" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_type_idx" ON "roles" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roles_is_active_idx" ON "roles" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_identity_id_idx" ON "user_roles" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_role_id_idx" ON "user_roles" ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_unique_idx" ON "user_roles" ("identity_id","role_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_expires_at_idx" ON "user_roles" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_history_identity_id_idx" ON "subscription_history" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_history_subscription_id_idx" ON "subscription_history" ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_history_action_idx" ON "subscription_history" ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_history_created_at_idx" ON "subscription_history" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_type_idx" ON "subscription_plans" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_plans_is_active_idx" ON "subscription_plans" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_plans_sort_order_idx" ON "subscription_plans" ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_subscriptions_identity_id_idx" ON "user_subscriptions" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_subscriptions_plan_id_idx" ON "user_subscriptions" ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_subscriptions_status_idx" ON "user_subscriptions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_subscriptions_end_date_idx" ON "user_subscriptions" ("end_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_subscriptions_unique_active_idx" ON "user_subscriptions" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "biometric_challenges_identity_id_idx" ON "biometric_challenges" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "biometric_challenges_session_id_idx" ON "biometric_challenges" ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "biometric_challenges_challenge_hash_idx" ON "biometric_challenges" ("challenge_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "biometric_challenges_expires_at_idx" ON "biometric_challenges" ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "biometric_challenges_is_used_idx" ON "biometric_challenges" ("is_used");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_relationships" ADD CONSTRAINT "business_relationships_business_identity_id_identities_id_fk" FOREIGN KEY ("business_identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "business_relationships" ADD CONSTRAINT "business_relationships_person_identity_id_identities_id_fk" FOREIGN KEY ("person_identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_status_history" ADD CONSTRAINT "identity_status_history_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_status_history" ADD CONSTRAINT "identity_status_history_changed_by_identities_id_fk" FOREIGN KEY ("changed_by") REFERENCES "identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_principals" ADD CONSTRAINT "auth_principals_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_secrets" ADD CONSTRAINT "auth_secrets_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "devices" ADD CONSTRAINT "devices_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_events" ADD CONSTRAINT "session_events_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_events" ADD CONSTRAINT "identity_events_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_events" ADD CONSTRAINT "identity_events_actor_identity_id_identities_id_fk" FOREIGN KEY ("actor_identity_id") REFERENCES "identities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_profiles" ADD CONSTRAINT "kyc_profiles_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_profiles" ADD CONSTRAINT "kyc_profiles_reviewed_by_identities_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "identities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bvn_checks" ADD CONSTRAINT "bvn_checks_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_account_id_accounts_id_fk" FOREIGN KEY ("source_account_id") REFERENCES "accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_destination_account_id_accounts_id_fk" FOREIGN KEY ("destination_account_id") REFERENCES "accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "otps" ADD CONSTRAINT "otps_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_identities_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "identities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_subscription_id_user_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "user_subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_from_plan_id_subscription_plans_id_fk" FOREIGN KEY ("from_plan_id") REFERENCES "subscription_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_to_plan_id_subscription_plans_id_fk" FOREIGN KEY ("to_plan_id") REFERENCES "subscription_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_previous_plan_id_subscription_plans_id_fk" FOREIGN KEY ("previous_plan_id") REFERENCES "subscription_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "biometric_challenges" ADD CONSTRAINT "biometric_challenges_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "biometric_challenges" ADD CONSTRAINT "biometric_challenges_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
