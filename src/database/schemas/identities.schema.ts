import {
  pgTable,
  uuid,
  timestamp,
  pgEnum,
  index,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Identity Type Enum
 * Distinguishes between natural persons and legal entities
 */
export const identityTypeEnum = pgEnum('identity_type', [
  'natural_person', // Individual human being
  'legal_entity',   // Business, company, organization
]);

/**
 * Identity Status Enum
 * Represents the lifecycle state of an identity
 */
export const identityStatusEnum = pgEnum('identity_status', [
  'shell',               // Initial creation, minimal data
  'pending_verification', // Awaiting identity verification
  'active',              // Fully verified and operational
  'suspended',           // Temporarily disabled
  'closed',              // Permanently closed
  'rejected',            // Verification rejected
]);

/**
 * Risk Level Enum
 * Risk classification for compliance and monitoring
 */
export const riskLevelEnum = pgEnum('risk_level', [
  'low',      // Standard risk, normal monitoring
  'medium',   // Elevated risk, enhanced monitoring
  'high',     // High risk, strict monitoring and limits
  'critical', // Critical risk, requires immediate review
]);

/**
 * MFA Method Enum
 * Enabled multi-factor authentication method for the identity
 */
export const identityMfaMethodEnum = pgEnum('identity_mfa_method', [
  'email',
  'sms',
  'totp',
]);

/**
 * Identities Table
 * Root identity object - the central entity for all identity-related data
 *
 * This table serves as the primary identity anchor for the banking system.
 *
 * Compliance Reference: 1.1 - Root Identity Object
 */
export const identities = pgTable(
  'identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identity classification
    identityType: identityTypeEnum('identity_type').notNull().default('natural_person'),

    // Lifecycle status
    status: identityStatusEnum('status').notNull().default('shell'),

    // Risk classification
    riskLevel: riskLevelEnum('risk_level').notNull().default('low'),

    // MFA preference (null means disabled)
    mfaMethod: identityMfaMethodEnum('mfa_method'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for status filtering
    statusIdx: index('identities_status_idx').on(table.status),
    // Index for risk-based queries
    riskLevelIdx: index('identities_risk_level_idx').on(table.riskLevel),
    // Index for type filtering
    identityTypeIdx: index('identities_identity_type_idx').on(table.identityType),
    // Index for created date range queries
    createdAtIdx: index('identities_created_at_idx').on(table.createdAt),
  }),
);

// Type inference
export type Identity = typeof identities.$inferSelect;
export type NewIdentity = typeof identities.$inferInsert;
