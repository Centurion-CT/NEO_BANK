import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  integer,
  decimal,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { identities } from './identities.schema';
import { billingCycleEnum, subscriptionStatusEnum } from './subscriptions.schema';

/**
 * Addons Table
 * Defines available addon products (e.g., ERP, Analytics, Payroll)
 */
export const addons = pgTable(
  'addons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    shortDescription: varchar('short_description', { length: 255 }),

    // Display
    icon: varchar('icon', { length: 50 }).notNull().default('package'),
    color: varchar('color', { length: 50 }).notNull().default('blue'),
    category: varchar('category', { length: 50 }).notNull().default('business'),

    // Features (JSON array of feature strings for display)
    features: jsonb('features').$type<string[]>().default([]),

    // Status
    isActive: boolean('is_active').notNull().default(true),
    isComingSoon: boolean('is_coming_soon').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('addons_slug_idx').on(table.slug),
    isActiveIdx: index('addons_is_active_idx').on(table.isActive),
    categoryIdx: index('addons_category_idx').on(table.category),
    sortOrderIdx: index('addons_sort_order_idx').on(table.sortOrder),
  }),
);

/**
 * Addon Plans Table
 * Pricing tiers for each addon
 */
export const addonPlans = pgTable(
  'addon_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    addonId: uuid('addon_id').notNull().references(() => addons.id, { onDelete: 'cascade' }),

    // Plan details
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),

    // Pricing
    monthlyPrice: decimal('monthly_price', { precision: 12, scale: 2 }).notNull().default('0'),
    yearlyPrice: decimal('yearly_price', { precision: 12, scale: 2 }).notNull().default('0'),
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),

    // Features specific to this plan
    features: jsonb('features').$type<string[]>().default([]),

    // Limits (addon-specific)
    limits: jsonb('limits').$type<Record<string, number>>().default({}),

    // Display
    isPopular: boolean('is_popular').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),

    // Trial
    trialDays: integer('trial_days').notNull().default(0),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    addonIdIdx: index('addon_plans_addon_id_idx').on(table.addonId),
    isActiveIdx: index('addon_plans_is_active_idx').on(table.isActive),
    sortOrderIdx: index('addon_plans_sort_order_idx').on(table.sortOrder),
  }),
);

/**
 * User Addon Subscriptions Table
 * Tracks user's addon subscriptions (multiple allowed per user)
 */
export const userAddonSubscriptions = pgTable(
  'user_addon_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').notNull().references(() => identities.id, { onDelete: 'cascade' }),
    addonId: uuid('addon_id').notNull().references(() => addons.id),
    planId: uuid('plan_id').notNull().references(() => addonPlans.id),

    // Status
    status: subscriptionStatusEnum('status').notNull().default('pending'),
    billingCycle: billingCycleEnum('billing_cycle').notNull().default('monthly'),

    // Pricing at time of subscription (for historical accuracy)
    priceAtSubscription: decimal('price_at_subscription', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),

    // Dates
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    trialEndDate: timestamp('trial_end_date'),

    // Auto-renewal
    autoRenewal: boolean('auto_renewal').notNull().default(true),
    renewalFailedAt: timestamp('renewal_failed_at'),
    renewalAttempts: integer('renewal_attempts').notNull().default(0),

    // Upgrade/downgrade tracking
    previousPlanId: uuid('previous_plan_id').references(() => addonPlans.id),
    upgradedAt: timestamp('upgraded_at'),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    identityIdIdx: index('user_addon_subscriptions_identity_id_idx').on(table.identityId),
    addonIdIdx: index('user_addon_subscriptions_addon_id_idx').on(table.addonId),
    planIdIdx: index('user_addon_subscriptions_plan_id_idx').on(table.planId),
    statusIdx: index('user_addon_subscriptions_status_idx').on(table.status),
    endDateIdx: index('user_addon_subscriptions_end_date_idx').on(table.endDate),
    // Only one active subscription per addon per identity
    uniqueActiveAddonSubscription: uniqueIndex('user_addon_subscriptions_unique_active_idx')
      .on(table.identityId, table.addonId)
      .where(sql`${table.status} = 'active' OR ${table.status} = 'trial'`),
  }),
);

/**
 * Addon Subscription History Table
 * Audit trail of addon subscription changes
 */
export const addonSubscriptionHistory = pgTable(
  'addon_subscription_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').notNull().references(() => identities.id, { onDelete: 'cascade' }),
    addonId: uuid('addon_id').notNull().references(() => addons.id),
    subscriptionId: uuid('subscription_id').references(() => userAddonSubscriptions.id),

    // Change details
    action: varchar('action', { length: 50 }).notNull(), // 'subscribed', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'expired'
    fromPlanId: uuid('from_plan_id').references(() => addonPlans.id),
    toPlanId: uuid('to_plan_id').references(() => addonPlans.id),

    // Pricing at time of change
    amount: decimal('amount', { precision: 12, scale: 2 }),
    currency: varchar('currency', { length: 10 }).default('NGN'),

    // Additional context
    reason: text('reason'),
    metadata: jsonb('metadata').$type<Record<string, any>>(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    identityIdIdx: index('addon_subscription_history_identity_id_idx').on(table.identityId),
    addonIdIdx: index('addon_subscription_history_addon_id_idx').on(table.addonId),
    subscriptionIdIdx: index('addon_subscription_history_subscription_id_idx').on(table.subscriptionId),
    actionIdx: index('addon_subscription_history_action_idx').on(table.action),
    createdAtIdx: index('addon_subscription_history_created_at_idx').on(table.createdAt),
  }),
);

// Relations
export const addonsRelations = relations(addons, ({ many }) => ({
  plans: many(addonPlans),
  subscriptions: many(userAddonSubscriptions),
  history: many(addonSubscriptionHistory),
}));

export const addonPlansRelations = relations(addonPlans, ({ one, many }) => ({
  addon: one(addons, {
    fields: [addonPlans.addonId],
    references: [addons.id],
  }),
  subscriptions: many(userAddonSubscriptions),
}));

export const userAddonSubscriptionsRelations = relations(userAddonSubscriptions, ({ one, many }) => ({
  identity: one(identities, {
    fields: [userAddonSubscriptions.identityId],
    references: [identities.id],
  }),
  addon: one(addons, {
    fields: [userAddonSubscriptions.addonId],
    references: [addons.id],
  }),
  plan: one(addonPlans, {
    fields: [userAddonSubscriptions.planId],
    references: [addonPlans.id],
  }),
  previousPlan: one(addonPlans, {
    fields: [userAddonSubscriptions.previousPlanId],
    references: [addonPlans.id],
  }),
  history: many(addonSubscriptionHistory),
}));

export const addonSubscriptionHistoryRelations = relations(addonSubscriptionHistory, ({ one }) => ({
  identity: one(identities, {
    fields: [addonSubscriptionHistory.identityId],
    references: [identities.id],
  }),
  addon: one(addons, {
    fields: [addonSubscriptionHistory.addonId],
    references: [addons.id],
  }),
  subscription: one(userAddonSubscriptions, {
    fields: [addonSubscriptionHistory.subscriptionId],
    references: [userAddonSubscriptions.id],
  }),
  fromPlan: one(addonPlans, {
    fields: [addonSubscriptionHistory.fromPlanId],
    references: [addonPlans.id],
  }),
  toPlan: one(addonPlans, {
    fields: [addonSubscriptionHistory.toPlanId],
    references: [addonPlans.id],
  }),
}));

// Type inference
export type Addon = typeof addons.$inferSelect;
export type NewAddon = typeof addons.$inferInsert;
export type AddonPlan = typeof addonPlans.$inferSelect;
export type NewAddonPlan = typeof addonPlans.$inferInsert;
export type UserAddonSubscription = typeof userAddonSubscriptions.$inferSelect;
export type NewUserAddonSubscription = typeof userAddonSubscriptions.$inferInsert;
export type AddonSubscriptionHistoryEntry = typeof addonSubscriptionHistory.$inferSelect;
export type NewAddonSubscriptionHistoryEntry = typeof addonSubscriptionHistory.$inferInsert;
