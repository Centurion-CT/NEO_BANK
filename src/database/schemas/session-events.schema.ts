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
import { sessions } from './sessions.schema';

/**
 * Session Event Type Enum
 * Types of session lifecycle events
 */
export const sessionEventTypeEnum = pgEnum('session_event_type', [
  'created',          // Session created
  'refreshed',        // Session tokens refreshed
  'activity',         // Session activity recorded
  'idle_timeout',     // Session timed out due to inactivity
  'absolute_timeout', // Session reached maximum lifetime
  'user_logout',      // User initiated logout
  'forced_logout',    // Admin/system forced logout
  'device_changed',   // Session moved to different device
  'suspicious',       // Suspicious session activity
  'revoked',          // Session explicitly revoked
]);

/**
 * Session Events Table
 * Tracks session lifecycle for audit and security
 *
 * Provides detailed tracking of:
 * - Session creation and termination
 * - Activity patterns
 * - Security events
 *
 * Compliance Reference: 3.4 - Session Lifecycle
 */
export const sessionEvents = pgTable(
  'session_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Session reference
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),

    // Identity reference
    identityId: uuid('identity_id').references(() => identities.id, { onDelete: 'set null' }),

    // Event details
    eventType: sessionEventTypeEnum('event_type').notNull(),

    // Context
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    // Additional context
    metadata: text('metadata'), // JSON string

    // Timestamp (immutable)
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for session-specific queries
    sessionIdIdx: index('session_events_session_id_idx').on(table.sessionId),
    // Index for identity-specific queries
    identityIdIdx: index('session_events_identity_id_idx').on(table.identityId),
    // Index for event type filtering
    eventTypeIdx: index('session_events_event_type_idx').on(table.eventType),
    // Index for time-based queries
    createdAtIdx: index('session_events_created_at_idx').on(table.createdAt),
  }),
);

/**
 * Session Events Relations
 */
export const sessionEventsRelations = relations(sessionEvents, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionEvents.sessionId],
    references: [sessions.id],
  }),
  identity: one(identities, {
    fields: [sessionEvents.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type SessionEvent = typeof sessionEvents.$inferSelect;
export type NewSessionEvent = typeof sessionEvents.$inferInsert;
