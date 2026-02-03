import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  integer,
  decimal,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * Plan Type Enum
 * Defines the subscription plan tiers
 */
export const planTypeEnum = pgEnum('plan_type', [
  'basic',
  'verified',
  'premium',
  'business',
]);

/**
 * Billing Cycle Enum
 * Defines how often billing occurs
 */
export const billingCycleEnum = pgEnum('billing_cycle', [
  'monthly',
  'yearly',
]);

/**
 * Subscription Status Enum
 * Tracks the state of a user's subscription
 */
export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'active',      // Currently active subscription
  'expired',     // Subscription period has ended
  'cancelled',   // User cancelled the subscription
  'past_due',    // Payment failed, in grace period
  'pending',     // Awaiting payment confirmation
  'trial',       // In trial period
]);

/**
 * Subscription Plans Table
 * Available plans with pricing and features
 */
export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    type: planTypeEnum('type').notNull(),
    description: text('description'),

    // Pricing
    monthlyPrice: decimal('monthly_price', { precision: 12, scale: 2 }).notNull().default('0'),
    yearlyPrice: decimal('yearly_price', { precision: 12, scale: 2 }).notNull().default('0'),
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),

    // Features (JSON array of feature strings)
    features: jsonb('features').$type<string[]>().default([]),

    // Limits
    dailyTransactionLimit: decimal('daily_transaction_limit', { precision: 18, scale: 2 }),
    monthlyTransactionLimit: decimal('monthly_transaction_limit', { precision: 18, scale: 2 }),
    maxTransfersPerDay: integer('max_transfers_per_day'),
    maxAccountsAllowed: integer('max_accounts_allowed').notNull().default(1),

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
    typeIdx: uniqueIndex('subscription_plans_type_idx').on(table.type),
    isActiveIdx: index('subscription_plans_is_active_idx').on(table.isActive),
    sortOrderIdx: index('subscription_plans_sort_order_idx').on(table.sortOrder),
  }),
);

/**
 * User Subscriptions Table
 * Tracks user's current subscription
 */
export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').notNull().references(() => identities.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id').notNull().references(() => subscriptionPlans.id),

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
    previousPlanId: uuid('previous_plan_id').references(() => subscriptionPlans.id),
    upgradedAt: timestamp('upgraded_at'),
    cancelledAt: timestamp('cancelled_at'),
    cancellationReason: text('cancellation_reason'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    identityIdIdx: index('user_subscriptions_identity_id_idx').on(table.identityId),
    planIdIdx: index('user_subscriptions_plan_id_idx').on(table.planId),
    statusIdx: index('user_subscriptions_status_idx').on(table.status),
    endDateIdx: index('user_subscriptions_end_date_idx').on(table.endDate),
    // Only one active subscription per identity
    uniqueActiveSubscription: uniqueIndex('user_subscriptions_unique_active_idx')
      .on(table.identityId)
      .where(sql`${table.status} = 'active' OR ${table.status} = 'trial'`),
  }),
);

/**
 * Subscription History Table
 * Audit trail of subscription changes
 */
export const subscriptionHistory = pgTable(
  'subscription_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').notNull().references(() => identities.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').references(() => userSubscriptions.id),

    // Change details
    action: varchar('action', { length: 50 }).notNull(), // 'subscribed', 'upgraded', 'downgraded', 'cancelled', 'renewed', 'expired'
    fromPlanId: uuid('from_plan_id').references(() => subscriptionPlans.id),
    toPlanId: uuid('to_plan_id').references(() => subscriptionPlans.id),

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
    identityIdIdx: index('subscription_history_identity_id_idx').on(table.identityId),
    subscriptionIdIdx: index('subscription_history_subscription_id_idx').on(table.subscriptionId),
    actionIdx: index('subscription_history_action_idx').on(table.action),
    createdAtIdx: index('subscription_history_created_at_idx').on(table.createdAt),
  }),
);

// Relations
export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  userSubscriptions: many(userSubscriptions),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one, many }) => ({
  identity: one(identities, {
    fields: [userSubscriptions.identityId],
    references: [identities.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [userSubscriptions.planId],
    references: [subscriptionPlans.id],
  }),
  previousPlan: one(subscriptionPlans, {
    fields: [userSubscriptions.previousPlanId],
    references: [subscriptionPlans.id],
  }),
  history: many(subscriptionHistory),
}));

export const subscriptionHistoryRelations = relations(subscriptionHistory, ({ one }) => ({
  identity: one(identities, {
    fields: [subscriptionHistory.identityId],
    references: [identities.id],
  }),
  subscription: one(userSubscriptions, {
    fields: [subscriptionHistory.subscriptionId],
    references: [userSubscriptions.id],
  }),
  fromPlan: one(subscriptionPlans, {
    fields: [subscriptionHistory.fromPlanId],
    references: [subscriptionPlans.id],
  }),
  toPlan: one(subscriptionPlans, {
    fields: [subscriptionHistory.toPlanId],
    references: [subscriptionPlans.id],
  }),
}));

// Type inference
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type NewUserSubscription = typeof userSubscriptions.$inferInsert;
export type SubscriptionHistoryEntry = typeof subscriptionHistory.$inferSelect;
export type NewSubscriptionHistoryEntry = typeof subscriptionHistory.$inferInsert;
