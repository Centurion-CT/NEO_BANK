import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Contact Type Enum
 * Type of contact identifier used for business registration
 */
export const contactTypeEnum = pgEnum('contact_type', ['email', 'phone']);

/**
 * Business Registration Step Enum
 * Current step in the multi-step business registration flow
 */
export const businessRegistrationStepEnum = pgEnum('business_registration_step', [
  'business_info',
  'relationship',
  'password',
]);

/**
 * Pending Business Registrations Table
 * Temporary holding table for staged business registration data
 *
 * This table stores partially completed business registrations
 * allowing users to complete the process in multiple steps.
 * Records expire after 24 hours.
 */
export const pendingBusinessRegistrations = pgTable(
  'pending_business_registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Contact information (verified via OTP)
    contactIdentifier: varchar('contact_identifier', { length: 255 }).notNull(),
    contactType: contactTypeEnum('contact_type').notNull(),

    // Staged form data (JSONB for flexibility)
    data: jsonb('data').notNull().default({}),

    // Current step in the registration flow
    currentStep: businessRegistrationStepEnum('current_step')
      .notNull()
      .default('business_info'),

    // Expiration (24 hours from creation)
    expiresAt: timestamp('expires_at').notNull(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint on contact identifier to prevent duplicates
    contactIdentifierIdx: uniqueIndex('pending_business_registrations_contact_idx').on(
      table.contactIdentifier,
    ),
    // Index for cleanup of expired records
    expiresAtIdx: index('pending_business_registrations_expires_at_idx').on(table.expiresAt),
  }),
);

/**
 * Type for the staged data JSONB field
 */
export interface PendingBusinessRegistrationData {
  // Business Info Step
  legalName?: string;
  businessType?: string;
  businessEmail?: string;
  businessPhone?: string;
  rcNumber?: string;
  registrationNumber?: string;

  // Relationship Step
  firstName?: string;
  lastName?: string;
  phone?: string;
  relationship?: string;
}

// Type inference
export type PendingBusinessRegistration = typeof pendingBusinessRegistrations.$inferSelect;
export type NewPendingBusinessRegistration = typeof pendingBusinessRegistrations.$inferInsert;
