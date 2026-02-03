import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
  index,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * Device Type Enum
 */
export const deviceTypeEnum = pgEnum('device_type', [
  'web',
  'ios',
  'android',
  'desktop',
  'unknown',
]);

/**
 * Biometric Type Enum
 * Types of biometric authentication supported
 */
export const biometricTypeEnum = pgEnum('biometric_type', [
  'fingerprint',
  'face_id',
  'touch_id',
]);

/**
 * Sessions Table
 * Active user sessions for security tracking
 *
 * SECURITY NOTES:
 * - Refresh tokens are hashed before storage
 * - Sessions expire and can be revoked
 * - Device fingerprinting for fraud detection
 * - Biometric tokens are hashed for security
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').notNull().references(() => identities.id),

    // Token (hashed)
    refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),

    // Device Info
    deviceId: varchar('device_id', { length: 100 }),
    deviceType: deviceTypeEnum('device_type').notNull().default('unknown'),
    deviceName: varchar('device_name', { length: 255 }),
    userAgent: text('user_agent'),

    // Location
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    location: varchar('location', { length: 255 }),

    // Status
    isActive: boolean('is_active').notNull().default(true),
    isTrusted: boolean('is_trusted').notNull().default(false),

    // Biometric Authentication
    biometricEnabled: boolean('biometric_enabled').notNull().default(false),
    biometricType: biometricTypeEnum('biometric_type'),
    biometricTokenHash: varchar('biometric_token_hash', { length: 255 }),
    biometricRegisteredAt: timestamp('biometric_registered_at'),
    biometricLastUsedAt: timestamp('biometric_last_used_at'),
    biometricFailedAttempts: integer('biometric_failed_attempts').notNull().default(0),
    biometricLockedUntil: timestamp('biometric_locked_until'),

    // Timestamps
    lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    identityIdIdx: index('sessions_identity_id_idx').on(table.identityId),
    deviceIdIdx: index('sessions_device_id_idx').on(table.deviceId),
    isActiveIdx: index('sessions_is_active_idx').on(table.isActive),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
    biometricEnabledIdx: index('sessions_biometric_enabled_idx').on(table.biometricEnabled),
  }),
);

// Relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
  identity: one(identities, {
    fields: [sessions.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
