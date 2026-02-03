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
import { devices } from './devices.schema';

/**
 * Auth Event Type Enum
 * Types of authentication events for audit logging
 */
export const authEventTypeEnum = pgEnum('auth_event_type', [
  'login_success',      // Successful login
  'login_failure',      // Failed login attempt
  'logout',            // User initiated logout
  'otp_sent',          // OTP sent for verification
  'otp_verified',      // OTP successfully verified
  'otp_failed',        // OTP verification failed
  'pin_changed',       // PIN was changed
  'pin_reset_initiated', // PIN reset process started
  'pin_reset_completed', // PIN reset completed
  'device_trusted',    // Device marked as trusted
  'device_revoked',    // Device trust revoked
  'mfa_enabled',       // MFA was enabled
  'mfa_disabled',      // MFA was disabled
  'principal_added',   // New login identifier added
  'principal_verified', // Login identifier verified
  'principal_blocked', // Login identifier blocked
  'session_created',   // New session created
  'session_terminated', // Session terminated
  'suspicious_activity', // Suspicious activity detected
]);

/**
 * Auth Events Table
 * Immutable authentication event log for compliance and security
 *
 * This table provides a complete audit trail of all authentication-related
 * events. It's essential for:
 * - Security incident investigation
 * - Compliance reporting
 * - Suspicious activity detection
 *
 * Compliance Reference: 3.3 - Authentication Proof Events
 */
export const authEvents = pgTable(
  'auth_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identity involved (nullable for failed lookups)
    identityId: uuid('identity_id').references(() => identities.id, { onDelete: 'set null' }),

    // Event details
    eventType: authEventTypeEnum('event_type').notNull(),

    // Device context
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'set null' }),

    // Network context
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    // Event outcome
    success: varchar('success', { length: 10 }), // 'true', 'false', or null
    failureReason: varchar('failure_reason', { length: 255 }),

    // Additional context
    metadata: text('metadata'), // JSON string for additional event data

    // Principal involved (for principal-specific events)
    principalType: varchar('principal_type', { length: 50 }),
    principalValue: varchar('principal_value', { length: 255 }), // Masked for security

    // Timestamp (immutable)
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for finding all events for an identity
    identityIdIdx: index('auth_events_identity_id_idx').on(table.identityId),
    // Index for event type filtering
    eventTypeIdx: index('auth_events_event_type_idx').on(table.eventType),
    // Index for time-based queries
    createdAtIdx: index('auth_events_created_at_idx').on(table.createdAt),
    // Index for device-specific queries
    deviceIdIdx: index('auth_events_device_id_idx').on(table.deviceId),
    // Index for IP-based investigation
    ipAddressIdx: index('auth_events_ip_address_idx').on(table.ipAddress),
    // Composite for identity + time range queries
    identityTimeIdx: index('auth_events_identity_time_idx').on(table.identityId, table.createdAt),
  }),
);

/**
 * Auth Events Relations
 */
export const authEventsRelations = relations(authEvents, ({ one }) => ({
  identity: one(identities, {
    fields: [authEvents.identityId],
    references: [identities.id],
  }),
  device: one(devices, {
    fields: [authEvents.deviceId],
    references: [devices.id],
  }),
}));

// Type inference
export type AuthEvent = typeof authEvents.$inferSelect;
export type NewAuthEvent = typeof authEvents.$inferInsert;
