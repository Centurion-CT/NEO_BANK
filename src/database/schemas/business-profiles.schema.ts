import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * Business Type Enum
 * Legal structure classification for businesses
 */
export const businessTypeEnum = pgEnum('business_type', [
  'sole_proprietorship',
  'partnership',
  'private_limited',     // Ltd
  'public_limited',      // PLC
  'limited_liability',   // LLC - uses RC number
  'enterprise',          // Enterprise - uses RN number
  'nonprofit',
  'ngo',                 // Non-Governmental Organization
  'cooperative',
  'government',
  'other',
]);

/**
 * Business Role Enum
 * Roles that individuals can hold in relation to a business
 */
export const businessRoleEnum = pgEnum('business_role', [
  'owner',     // Beneficial owner
  'director',  // Board director
  'signatory', // Authorized signatory
  'admin',     // Administrative access
  'operator',  // Day-to-day operations
  'staff',     // General staff member
]);

/**
 * Business Profiles Table
 * Stores legal entity data (companies, organizations)
 *
 * This table contains business identification information.
 * Used for business accounts and corporate KYC.
 *
 * Compliance Reference: 1.3 - Legal Entity Data
 */
export const businessProfiles = pgTable(
  'business_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Foreign key to identity
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // Business identification
    legalName: varchar('legal_name', { length: 255 }).notNull(),
    tradingName: varchar('trading_name', { length: 255 }),
    businessType: businessTypeEnum('business_type').notNull(),

    // Registration details
    registrationNumber: varchar('registration_number', { length: 100 }),
    taxIdentificationNumber: varchar('tax_identification_number', { length: 100 }),
    registrationDate: timestamp('registration_date'),
    registrationCountry: varchar('registration_country', { length: 100 }).default('NG'),

    // Business address
    registeredAddress: text('registered_address'),
    operatingAddress: text('operating_address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    country: varchar('country', { length: 100 }).default('NG'),
    postalCode: varchar('postal_code', { length: 20 }),

    // Contact information
    businessEmail: varchar('business_email', { length: 255 }),
    businessPhone: varchar('business_phone', { length: 20 }),
    website: varchar('website', { length: 255 }),

    // Industry classification
    industryCode: varchar('industry_code', { length: 20 }),
    industryDescription: varchar('industry_description', { length: 255 }),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint - one business profile per identity
    identityIdIdx: index('business_profiles_identity_id_idx').on(table.identityId),
    // Registration number lookup
    registrationNumberIdx: uniqueIndex('business_profiles_registration_number_idx').on(
      table.registrationNumber,
    ),
    // Tax ID lookup
    taxIdIdx: index('business_profiles_tax_id_idx').on(table.taxIdentificationNumber),
    // Business type filtering
    businessTypeIdx: index('business_profiles_business_type_idx').on(table.businessType),
    // Name search
    legalNameIdx: index('business_profiles_legal_name_idx').on(table.legalName),
  }),
);

/**
 * Business Relationships Table
 * Links people (natural persons) to businesses (legal entities)
 *
 * Tracks ownership, directorship, and signing authority.
 * Essential for UBO (Ultimate Beneficial Owner) compliance.
 *
 * Compliance Reference: 1.4 - People ↔ Businesses Relationships
 */
export const businessRelationships = pgTable(
  'business_relationships',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // The business entity
    businessIdentityId: uuid('business_identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // The person related to the business
    personIdentityId: uuid('person_identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // Role in the business
    role: businessRoleEnum('role').notNull(),

    // Ownership percentage (for UBO tracking)
    ownershipPercentage: integer('ownership_percentage'),

    // Position/title description
    positionTitle: varchar('position_title', { length: 100 }),

    // Validity period
    startDate: timestamp('start_date').notNull().defaultNow(),
    endDate: timestamp('end_date'),

    // Verification status
    isVerified: timestamp('is_verified'),
    verifiedAt: timestamp('verified_at'),
    verifiedBy: uuid('verified_by'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for finding all relationships for a business
    businessIdentityIdx: index('business_relationships_business_identity_idx').on(
      table.businessIdentityId,
    ),
    // Index for finding all businesses for a person
    personIdentityIdx: index('business_relationships_person_identity_idx').on(
      table.personIdentityId,
    ),
    // Role-based filtering
    roleIdx: index('business_relationships_role_idx').on(table.role),
    // UBO queries (significant ownership)
    ownershipIdx: index('business_relationships_ownership_idx').on(table.ownershipPercentage),
  }),
);

/**
 * Business Profiles Relations
 */
export const businessProfilesRelations = relations(businessProfiles, ({ one }) => ({
  identity: one(identities, {
    fields: [businessProfiles.identityId],
    references: [identities.id],
  }),
}));

/**
 * Business Relationships Relations
 */
export const businessRelationshipsRelations = relations(businessRelationships, ({ one }) => ({
  businessIdentity: one(identities, {
    fields: [businessRelationships.businessIdentityId],
    references: [identities.id],
  }),
  personIdentity: one(identities, {
    fields: [businessRelationships.personIdentityId],
    references: [identities.id],
  }),
}));

// Type inference
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type NewBusinessProfile = typeof businessProfiles.$inferInsert;
export type BusinessRelationship = typeof businessRelationships.$inferSelect;
export type NewBusinessRelationship = typeof businessRelationships.$inferInsert;
