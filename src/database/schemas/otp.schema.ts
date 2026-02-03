import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * OTP Purpose Enum
 */
export const otpPurposeEnum = pgEnum('otp_purpose', [
  'email_verification',
  'phone_verification',
  'pin_reset',
  'transaction_confirmation',
  'login_mfa',
  'mfa_setup',
  'sensitive_action',
]);

/**
 * OTP Table
 * Stores one-time passwords for verification purposes
 *
 * SECURITY NOTES:
 * - OTP codes are hashed before storage
 * - OTPs expire after a short period (typically 10 minutes)
 * - Limited verification attempts (max 3)
 * - Old OTPs are invalidated when new one is requested
 */
export const otps = pgTable(
  'otps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').references(() => identities.id),

    // OTP Details
    codeHash: varchar('code_hash', { length: 255 }).notNull(),
    purpose: otpPurposeEnum('purpose').notNull(),

    // Target (email or phone the OTP was sent to)
    target: varchar('target', { length: 255 }).notNull(),

    // Verification
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    verifiedAt: timestamp('verified_at'),

    // Expiry
    expiresAt: timestamp('expires_at').notNull(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    identityIdIdx: index('otps_identity_id_idx').on(table.identityId),
    targetIdx: index('otps_target_idx').on(table.target),
    purposeIdx: index('otps_purpose_idx').on(table.purpose),
    expiresAtIdx: index('otps_expires_at_idx').on(table.expiresAt),
  }),
);

// Relations
export const otpsRelations = relations(otps, ({ one }) => ({
  identity: one(identities, {
    fields: [otps.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type Otp = typeof otps.$inferSelect;
export type NewOtp = typeof otps.$inferInsert;
