import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { identities } from './identities.schema';

/**
 * Push Subscriptions Table Schema
 *
 * Stores Web Push API subscriptions for browser push notifications.
 * Each user can have multiple subscriptions (one per browser/device).
 */
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  identityId: uuid('identity_id').notNull().references(() => identities.id, { onDelete: 'cascade' }),

  // Web Push API subscription data
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(), // Public key
  auth: text('auth').notNull(), // Auth secret

  // Device identification
  userAgent: varchar('user_agent', { length: 500 }),
  deviceName: varchar('device_name', { length: 100 }),

  // Subscription metadata
  expirationTime: timestamp('expiration_time'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
}, (table) => ({
  identityIdIdx: index('push_subscriptions_identity_id_idx').on(table.identityId),
  endpointUnique: unique('push_subscriptions_endpoint_unique').on(table.endpoint),
}));

// TypeScript types
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
