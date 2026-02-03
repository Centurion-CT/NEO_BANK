import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { identities } from './identities.schema';

/**
 * Notifications Table Schema
 *
 * Stores all user notifications across channels.
 * Supports push, email, SMS, and in-app notifications.
 */
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  identityId: uuid('identity_id').notNull().references(() => identities.id, { onDelete: 'cascade' }),

  // Notification classification
  type: varchar('type', { length: 50 }).notNull(), // transaction, security, promotion, system
  category: varchar('category', { length: 50 }).notNull(), // transactions, security, marketing, updates

  // Content
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  data: jsonb('data'), // Additional payload data

  // Status
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),

  // Delivery
  channel: varchar('channel', { length: 20 }).notNull(), // push, email, sms, in_app
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  failedAt: timestamp('failed_at'),
  failureReason: text('failure_reason'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  identityIdIdx: index('notifications_identity_id_idx').on(table.identityId),
  identityIdReadIdx: index('notifications_identity_read_idx').on(table.identityId, table.isRead),
  createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
}));

// TypeScript types
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
