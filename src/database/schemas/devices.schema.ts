import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';
import { deviceTypeEnum } from './sessions.schema';

/**
 * Devices Table
 * Tracks trusted devices for each identity
 *
 * Device trust is essential for:
 * - Risk-based authentication
 * - Suspicious activity detection
 * - Session management
 *
 * Compliance Reference: 3.1 - Device Trust Management
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Foreign key to identity
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // Device identification
    deviceFingerprint: varchar('device_fingerprint', { length: 255 }).notNull(),
    deviceType: deviceTypeEnum('device_type').notNull().default('unknown'),

    // Device metadata
    deviceName: varchar('device_name', { length: 255 }),
    deviceModel: varchar('device_model', { length: 100 }),
    osName: varchar('os_name', { length: 50 }),
    osVersion: varchar('os_version', { length: 50 }),
    appVersion: varchar('app_version', { length: 50 }),
    userAgent: text('user_agent'),

    // Trust status
    isTrusted: boolean('is_trusted').notNull().default(false),
    trustedAt: timestamp('trusted_at'),
    trustExpiresAt: timestamp('trust_expires_at'),

    // Device binding (mobile-only feature)
    // When bound, user can ONLY login from this device
    isBound: boolean('is_bound').notNull().default(false),
    boundAt: timestamp('bound_at'),
    boundByIdentityId: uuid('bound_by_identity_id'), // Admin who approved binding, if applicable

    // Revocation
    isRevoked: boolean('is_revoked').notNull().default(false),
    revokedAt: timestamp('revoked_at'),
    revokedReason: varchar('revoked_reason', { length: 255 }),

    // Activity tracking
    lastActiveAt: timestamp('last_active_at'),
    lastIpAddress: varchar('last_ip_address', { length: 45 }),

    // Push notification token
    pushToken: text('push_token'),
    pushTokenUpdatedAt: timestamp('push_token_updated_at'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique device per identity
    identityFingerprintIdx: uniqueIndex('devices_identity_fingerprint_idx').on(
      table.identityId,
      table.deviceFingerprint,
    ),
    // Index for finding all devices for an identity
    identityIdIdx: index('devices_identity_id_idx').on(table.identityId),
    // Index for trusted device lookups
    trustedIdx: index('devices_trusted_idx').on(table.identityId, table.isTrusted),
    // Index for active device queries
    lastActiveIdx: index('devices_last_active_idx').on(table.lastActiveAt),
    // Index for revoked status
    revokedIdx: index('devices_revoked_idx').on(table.isRevoked),
    // Index for bound device lookups
    boundIdx: index('devices_bound_idx').on(table.identityId, table.isBound),
  }),
);

/**
 * Devices Relations
 */
export const devicesRelations = relations(devices, ({ one }) => ({
  identity: one(identities, {
    fields: [devices.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
