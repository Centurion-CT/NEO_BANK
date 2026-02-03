import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * Auth Principal Type Enum
 * Types of login identifiers supported
 */
export const authPrincipalTypeEnum = pgEnum('auth_principal_type', [
  'phone',    // Phone number as login identifier
  'email',    // Email address as login identifier
  'username', // Username/alias as login identifier
]);

/**
 * Auth Principals Table
 * Stores login identifiers (phone, email, username) for identities
 *
 * Each identity can have multiple principals (e.g., both phone and email).
 * This enables flexible authentication while maintaining a single identity.
 *
 * Compliance Reference: 2.1 - Login Identifiers
 */
export const authPrincipals = pgTable(
  'auth_principals',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Foreign key to identity
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // Principal details
    principalType: authPrincipalTypeEnum('principal_type').notNull(),
    principalValue: varchar('principal_value', { length: 255 }).notNull(),

    // Verification status
    isVerified: boolean('is_verified').notNull().default(false),
    verifiedAt: timestamp('verified_at'),

    // Primary flag (main contact for notifications)
    isPrimary: boolean('is_primary').notNull().default(false),

    // Active status (can be disabled without deletion)
    isActive: boolean('is_active').notNull().default(true),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint on type + value (no duplicate principals)
    principalValueIdx: uniqueIndex('auth_principals_value_idx').on(
      table.principalType,
      table.principalValue,
    ),
    // Index for finding all principals for an identity
    identityIdIdx: index('auth_principals_identity_id_idx').on(table.identityId),
    // Index for verified status filtering
    verifiedIdx: index('auth_principals_verified_idx').on(table.isVerified),
    // Index for primary principal lookups
    primaryIdx: index('auth_principals_primary_idx').on(table.identityId, table.isPrimary),
  }),
);

/**
 * Auth Principals Relations
 */
export const authPrincipalsRelations = relations(authPrincipals, ({ one }) => ({
  identity: one(identities, {
    fields: [authPrincipals.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type AuthPrincipal = typeof authPrincipals.$inferSelect;
export type NewAuthPrincipal = typeof authPrincipals.$inferInsert;
