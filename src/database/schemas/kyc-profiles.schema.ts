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
 * KYC Tier Enum
 * Customer verification tiers with associated limits and capabilities
 */
export const kycTierEnum = pgEnum('kyc_tier', [
  'tier_0', // Unverified - minimal functionality
  'tier_1', // Basic verification - phone/email verified
  'tier_2', // Standard verification - ID verified
  'tier_3', // Enhanced verification - full due diligence
]);

/**
 * KYC Status Enum
 * Overall KYC verification status
 */
export const kycProfileStatusEnum = pgEnum('kyc_profile_status', [
  'not_started',     // No verification attempted
  'in_progress',     // Verification in progress
  'pending_review',  // Awaiting manual review
  'approved',        // Verification approved
  'rejected',        // Verification rejected
  'expired',         // Verification expired, needs renewal
  'suspended',       // KYC suspended pending investigation
]);

/**
 * KYC Profiles Table
 * Stores KYC verification status and tier for identities
 *
 * This table centralizes KYC status tracking separate from identity status.
 * It supports tiered verification common in financial services.
 *
 * Compliance Reference: 4.1 - KYC Tier/Status
 */
export const kycProfiles = pgTable(
  'kyc_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Foreign key to identity
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // KYC tier and status
    kycTier: kycTierEnum('kyc_tier').notNull().default('tier_0'),
    status: kycProfileStatusEnum('status').notNull().default('not_started'),

    // Verification identifiers (encrypted)
    bvnEncrypted: text('bvn_encrypted'), // Bank Verification Number
    ninEncrypted: text('nin_encrypted'), // National Identification Number

    // Verification tracking
    verificationStartedAt: timestamp('verification_started_at'),
    verificationCompletedAt: timestamp('verification_completed_at'),
    lastReviewedAt: timestamp('last_reviewed_at'),
    nextReviewDue: timestamp('next_review_due'),

    // Reviewer information
    reviewedBy: uuid('reviewed_by').references(() => identities.id, { onDelete: 'set null' }),
    reviewNotes: text('review_notes'),

    // Rejection handling
    rejectionReason: varchar('rejection_reason', { length: 255 }),
    rejectionCount: varchar('rejection_count', { length: 10 }).default('0'),

    // Risk assessment
    riskScore: varchar('risk_score', { length: 10 }), // Numeric score as string
    riskFactors: text('risk_factors'), // JSON array of risk factors

    // Expiration
    expiresAt: timestamp('expires_at'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint - one KYC profile per identity
    identityIdIdx: index('kyc_profiles_identity_id_idx').on(table.identityId),
    // Status filtering
    statusIdx: index('kyc_profiles_status_idx').on(table.status),
    // Tier filtering
    tierIdx: index('kyc_profiles_tier_idx').on(table.kycTier),
    // Review queue
    lastReviewedIdx: index('kyc_profiles_last_reviewed_idx').on(table.lastReviewedAt),
    // Pending review queries
    pendingReviewIdx: index('kyc_profiles_pending_review_idx').on(table.status, table.createdAt),
    // Expiration checks
    expiresAtIdx: index('kyc_profiles_expires_at_idx').on(table.expiresAt),
  }),
);

/**
 * KYC Profiles Relations
 */
export const kycProfilesRelations = relations(kycProfiles, ({ one }) => ({
  identity: one(identities, {
    fields: [kycProfiles.identityId],
    references: [identities.id],
  }),
  reviewer: one(identities, {
    fields: [kycProfiles.reviewedBy],
    references: [identities.id],
  }),
}));

// Type inference
export type KycProfile = typeof kycProfiles.$inferSelect;
export type NewKycProfile = typeof kycProfiles.$inferInsert;
