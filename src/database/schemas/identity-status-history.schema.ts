import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities, identityStatusEnum } from './identities.schema';

/**
 * Identity Status History Table
 * Immutable audit trail for identity status changes
 *
 * This table provides a complete history of all status transitions,
 * including who made the change and why. Essential for compliance audit.
 *
 * Compliance Reference: 1.5 - Status Audit Trail
 */
export const identityStatusHistory = pgTable(
  'identity_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // The identity whose status changed
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // Status transition
    oldStatus: identityStatusEnum('old_status'),
    newStatus: identityStatusEnum('new_status').notNull(),

    // Who made the change
    changedBy: uuid('changed_by').references(() => identities.id),

    // Reason for change (required for compliance)
    reason: text('reason'),

    // Additional context
    metadata: text('metadata'), // JSON string for additional data

    // IP address of the actor
    ipAddress: varchar('ip_address', { length: 45 }),

    // User agent string
    userAgent: text('user_agent'),

    // Timestamp (immutable)
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for finding all history for an identity
    identityIdIdx: index('identity_status_history_identity_id_idx').on(table.identityId),
    // Index for finding changes by actor
    changedByIdx: index('identity_status_history_changed_by_idx').on(table.changedBy),
    // Index for time-based queries
    createdAtIdx: index('identity_status_history_created_at_idx').on(table.createdAt),
    // Index for filtering by new status
    newStatusIdx: index('identity_status_history_new_status_idx').on(table.newStatus),
  }),
);

/**
 * Identity Status History Relations
 */
export const identityStatusHistoryRelations = relations(identityStatusHistory, ({ one }) => ({
  identity: one(identities, {
    fields: [identityStatusHistory.identityId],
    references: [identities.id],
  }),
  changedByIdentity: one(identities, {
    fields: [identityStatusHistory.changedBy],
    references: [identities.id],
  }),
}));

// Type inference
export type IdentityStatusHistory = typeof identityStatusHistory.$inferSelect;
export type NewIdentityStatusHistory = typeof identityStatusHistory.$inferInsert;
