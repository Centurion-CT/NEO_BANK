CREATE TABLE IF NOT EXISTS "addon_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"addon_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"monthly_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"yearly_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(10) DEFAULT 'NGN' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"limits" jsonb DEFAULT '{}'::jsonb,
	"is_popular" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "addon_subscription_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
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
CREATE TABLE IF NOT EXISTS "addons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"short_description" varchar(255),
	"icon" varchar(50) DEFAULT 'package' NOT NULL,
	"color" varchar(50) DEFAULT 'blue' NOT NULL,
	"category" varchar(50) DEFAULT 'business' NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_coming_soon" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "addons_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_addon_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
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
CREATE INDEX IF NOT EXISTS "addon_plans_addon_id_idx" ON "addon_plans" ("addon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addon_plans_is_active_idx" ON "addon_plans" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addon_plans_sort_order_idx" ON "addon_plans" ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addon_subscription_history_identity_id_idx" ON "addon_subscription_history" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addon_subscription_history_addon_id_idx" ON "addon_subscription_history" ("addon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addon_subscription_history_subscription_id_idx" ON "addon_subscription_history" ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addon_subscription_history_action_idx" ON "addon_subscription_history" ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addon_subscription_history_created_at_idx" ON "addon_subscription_history" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "addons_slug_idx" ON "addons" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addons_is_active_idx" ON "addons" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addons_category_idx" ON "addons" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addons_sort_order_idx" ON "addons" ("sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_addon_subscriptions_identity_id_idx" ON "user_addon_subscriptions" ("identity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_addon_subscriptions_addon_id_idx" ON "user_addon_subscriptions" ("addon_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_addon_subscriptions_plan_id_idx" ON "user_addon_subscriptions" ("plan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_addon_subscriptions_status_idx" ON "user_addon_subscriptions" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_addon_subscriptions_end_date_idx" ON "user_addon_subscriptions" ("end_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_addon_subscriptions_unique_active_idx" ON "user_addon_subscriptions" ("identity_id","addon_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "addon_plans" ADD CONSTRAINT "addon_plans_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "addons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "addon_subscription_history" ADD CONSTRAINT "addon_subscription_history_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "addon_subscription_history" ADD CONSTRAINT "addon_subscription_history_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "addons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "addon_subscription_history" ADD CONSTRAINT "addon_subscription_history_subscription_id_user_addon_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "user_addon_subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "addon_subscription_history" ADD CONSTRAINT "addon_subscription_history_from_plan_id_addon_plans_id_fk" FOREIGN KEY ("from_plan_id") REFERENCES "addon_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "addon_subscription_history" ADD CONSTRAINT "addon_subscription_history_to_plan_id_addon_plans_id_fk" FOREIGN KEY ("to_plan_id") REFERENCES "addon_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_addon_subscriptions" ADD CONSTRAINT "user_addon_subscriptions_identity_id_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_addon_subscriptions" ADD CONSTRAINT "user_addon_subscriptions_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "addons"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_addon_subscriptions" ADD CONSTRAINT "user_addon_subscriptions_plan_id_addon_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "addon_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_addon_subscriptions" ADD CONSTRAINT "user_addon_subscriptions_previous_plan_id_addon_plans_id_fk" FOREIGN KEY ("previous_plan_id") REFERENCES "addon_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
