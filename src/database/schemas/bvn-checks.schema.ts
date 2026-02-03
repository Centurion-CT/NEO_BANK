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
 * BVN Check Status Enum
 * Status of BVN verification check
 */
export const bvnCheckStatusEnum = pgEnum('bvn_check_status', [
  'pending',   // Check initiated, awaiting response
  'verified',  // BVN verified successfully
  'failed',    // Verification failed (technical error)
  'mismatch',  // BVN data doesn't match user data
  'not_found', // BVN not found in registry
  'expired',   // Verification expired, needs refresh
]);

/**
 * BVN Checks Table
 * Tracks Bank Verification Number verification history
 *
 * Nigeria-specific: BVN is a mandatory identity number for banking.
 * This table maintains a history of all BVN verification attempts
 * and their outcomes.
 *
 * SECURITY NOTES:
 * - BVN is stored as a one-way hash (not reversible)
 * - Raw BVN never stored after verification
 * - Provider responses may be encrypted
 *
 * Compliance Reference: 4.3 - BVN Verification History
 */
export const bvnChecks = pgTable(
  'bvn_checks',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Foreign key to identity
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // BVN identification (hashed, not raw)
    bvnHash: varchar('bvn_hash', { length: 255 }).notNull(),

    // Verification status
    status: bvnCheckStatusEnum('status').notNull().default('pending'),

    // Provider information
    providerName: varchar('provider_name', { length: 100 }).notNull(),
    providerReference: varchar('provider_reference', { length: 255 }),

    // Match scoring
    matchScore: integer('match_score'), // 0-100 percentage match
    matchDetails: text('match_details'), // JSON with field-by-field match results

    // Mismatched fields (for review)
    mismatchedFields: text('mismatched_fields'), // JSON array of field names

    // Provider response (encrypted)
    providerResponseEncrypted: text('provider_response_encrypted'),

    // Verification timing
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    respondedAt: timestamp('responded_at'),

    // Error handling
    errorCode: varchar('error_code', { length: 50 }),
    errorMessage: text('error_message'),

    // Request context
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for finding all checks for an identity
    identityIdIdx: index('bvn_checks_identity_id_idx').on(table.identityId),
    // Index for BVN hash lookups (fraud detection)
    bvnHashIdx: index('bvn_checks_bvn_hash_idx').on(table.bvnHash),
    // Index for status filtering
    statusIdx: index('bvn_checks_status_idx').on(table.status),
    // Index for provider analysis
    providerIdx: index('bvn_checks_provider_idx').on(table.providerName),
    // Index for time-based queries
    requestedAtIdx: index('bvn_checks_requested_at_idx').on(table.requestedAt),
    // Composite for identity + status queries
    identityStatusIdx: index('bvn_checks_identity_status_idx').on(table.identityId, table.status),
  }),
);

/**
 * BVN Checks Relations
 */
export const bvnChecksRelations = relations(bvnChecks, ({ one }) => ({
  identity: one(identities, {
    fields: [bvnChecks.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type BvnCheck = typeof bvnChecks.$inferSelect;
export type NewBvnCheck = typeof bvnChecks.$inferInsert;
