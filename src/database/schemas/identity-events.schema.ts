import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * Identity Event Type Enum
 * Types of identity lifecycle events
 */
export const identityEventTypeEnum = pgEnum('identity_event_type', [
  // Creation events
  'created',              // Identity created
  'profile_created',      // Profile attached to identity

  // Update events
  'profile_updated',      // Profile information changed
  'contact_updated',      // Contact information changed
  'address_updated',      // Address information changed
  'preferences_updated',  // Preferences changed

  // Status events
  'status_changed',       // Identity status changed
  'risk_level_changed',   // Risk level changed
  'tier_upgraded',        // Account tier upgraded
  'tier_downgraded',      // Account tier downgraded

  // Verification events
  'verification_started', // Verification process initiated
  'verification_passed',  // Verification successful
  'verification_failed',  // Verification failed
  'document_submitted',   // Document submitted for verification
  'document_approved',    // Document approved
  'document_rejected',    // Document rejected

  // Security events
  'security_alert',       // Security concern flagged
  'fraud_suspected',      // Fraud suspicion raised
  'account_locked',       // Account locked
  'account_unlocked',     // Account unlocked

  // Administrative events
  'admin_note_added',     // Admin added a note
  'admin_action',         // Admin performed an action
  'support_escalation',   // Issue escalated to support

  // Business relationship events
  'relationship_added',   // Business relationship added
  'relationship_removed', // Business relationship removed

  // Deletion events
  'closed',               // Identity closed
  'deletion_requested',   // Deletion requested
  'data_exported',        // Data export completed
]);

/**
 * Identity Events Table
 * Complete lifecycle audit trail for identities
 *
 * This table captures all significant events in an identity's lifecycle,
 * providing a comprehensive audit trail for compliance and support.
 *
 * Compliance Reference: 6.2 - Identity Lifecycle
 */
export const identityEvents = pgTable(
  'identity_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identity this event relates to
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // Event details
    eventType: identityEventTypeEnum('event_type').notNull(),

    // Who triggered the event (null for system events)
    actorIdentityId: uuid('actor_identity_id').references(() => identities.id, {
      onDelete: 'set null',
    }),

    // Actor role (for context when actor is deleted)
    actorRole: varchar('actor_role', { length: 50 }),

    // Description
    description: text('description'),

    // Old/new values for change tracking
    oldValue: text('old_value'), // JSON string
    newValue: text('new_value'), // JSON string

    // Context
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    // Additional metadata
    metadata: text('metadata'), // JSON string

    // Timestamp (immutable)
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for finding all events for an identity
    identityIdIdx: index('identity_events_identity_id_idx').on(table.identityId),
    // Index for event type filtering
    eventTypeIdx: index('identity_events_event_type_idx').on(table.eventType),
    // Index for actor queries
    actorIdentityIdIdx: index('identity_events_actor_identity_id_idx').on(table.actorIdentityId),
    // Index for time-based queries
    createdAtIdx: index('identity_events_created_at_idx').on(table.createdAt),
    // Composite for identity + time range
    identityTimeIdx: index('identity_events_identity_time_idx').on(
      table.identityId,
      table.createdAt,
    ),
  }),
);

/**
 * Identity Events Relations
 */
export const identityEventsRelations = relations(identityEvents, ({ one }) => ({
  identity: one(identities, {
    fields: [identityEvents.identityId],
    references: [identities.id],
  }),
  actorIdentity: one(identities, {
    fields: [identityEvents.actorIdentityId],
    references: [identities.id],
  }),
}));

// Type inference
export type IdentityEvent = typeof identityEvents.$inferSelect;
export type NewIdentityEvent = typeof identityEvents.$inferInsert;
