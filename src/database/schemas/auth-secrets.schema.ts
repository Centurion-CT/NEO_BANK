import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * Auth Secret Type Enum
 * Types of authentication credentials
 */
export const authSecretTypeEnum = pgEnum('auth_secret_type', [
  'pin',             // Login PIN (4-6 digits)
  'transaction_pin', // Transaction authorization PIN
  'password',        // Traditional password (optional)
  'totp',           // Time-based OTP secret for MFA
]);

/**
 * Auth Secrets Table
 * Stores authentication credentials for identities
 *
 * Each identity can have multiple secrets (e.g., login PIN + transaction PIN + TOTP).
 * All secrets are stored hashed (Argon2) or encrypted (AES-256-GCM for TOTP).
 *
 * SECURITY NOTES:
 * - PIN/password hashes use Argon2id
 * - TOTP secrets are AES-256-GCM encrypted
 * - Failed attempts tracked for lockout
 *
 * Compliance Reference: 2.2 - Credentials
 */
export const authSecrets = pgTable(
  'auth_secrets',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Foreign key to identity
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // Secret details
    secretType: authSecretTypeEnum('secret_type').notNull(),
    secretHash: text('secret_hash').notNull(), // Argon2 hash or encrypted value

    // Security tracking
    failedAttempts: integer('failed_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until'),
    lastUsedAt: timestamp('last_used_at'),

    // Password/PIN policy
    expiresAt: timestamp('expires_at'), // For password rotation policies
    mustChangeOnLogin: integer('must_change_on_login').default(0), // Boolean as int for safety

    // Metadata
    version: integer('version').notNull().default(1), // For credential rotation tracking

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for finding all secrets for an identity
    identityIdIdx: index('auth_secrets_identity_id_idx').on(table.identityId),
    // Index for type-specific lookups
    identityTypeIdx: index('auth_secrets_identity_type_idx').on(
      table.identityId,
      table.secretType,
    ),
    // Index for lockout queries
    lockedUntilIdx: index('auth_secrets_locked_until_idx').on(table.lockedUntil),
    // Index for expiration checks
    expiresAtIdx: index('auth_secrets_expires_at_idx').on(table.expiresAt),
  }),
);

/**
 * Auth Secrets Relations
 */
export const authSecretsRelations = relations(authSecrets, ({ one }) => ({
  identity: one(identities, {
    fields: [authSecrets.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type AuthSecret = typeof authSecrets.$inferSelect;
export type NewAuthSecret = typeof authSecrets.$inferInsert;
