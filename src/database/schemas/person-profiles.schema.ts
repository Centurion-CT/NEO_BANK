import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * Gender Enum
 * Standard gender classifications for KYC compliance
 */
export const genderEnum = pgEnum('gender', [
  'male',
  'female',
  'other',
  'prefer_not_to_say',
]);

/**
 * Login Mode Enum
 * User preference for authentication method
 */
export const loginModeEnum = pgEnum('login_mode', ['pin', 'password']);

/**
 * MFA Method Enum
 * User preference for multi-factor authentication method
 */
export const mfaMethodEnum = pgEnum('mfa_method', ['email', 'sms', 'totp']);

/**
 * Person Profiles Table
 * Stores natural person data (individual human being details)
 *
 * This table contains personal identifying information (PII) for individuals.
 * Sensitive fields should be encrypted at rest.
 *
 * Compliance Reference: 1.2 - Natural Person Data
 */
export const personProfiles = pgTable(
  'person_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Foreign key to identity
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // Personal information
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    middleName: varchar('middle_name', { length: 100 }),

    // Demographics
    gender: genderEnum('gender'),
    dateOfBirth: timestamp('date_of_birth'),
    nationality: varchar('nationality', { length: 100 }).default('NG'),

    // Profile image
    profilePictureUrl: text('profile_picture_url'),

    // Address information
    address: text('address'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),
    country: varchar('country', { length: 100 }).default('NG'),
    postalCode: varchar('postal_code', { length: 20 }),

    // Preferences
    preferredLanguage: varchar('preferred_language', { length: 10 }).default('en'),
    preferredCurrency: varchar('preferred_currency', { length: 10 }).default('NGN'),
    preferredTheme: varchar('preferred_theme', { length: 20 }).default('system'),
    preferredLoginMode: loginModeEnum('preferred_login_mode').default('password'),

    // Login channel preferences (which channels can be used to login)
    allowWebLogin: boolean('allow_web_login').default(true).notNull(),
    allowMobileLogin: boolean('allow_mobile_login').default(true).notNull(),
    allowUssdLogin: boolean('allow_ussd_login').default(true).notNull(),

    // Security preferences
    geoTaggingEnabled: boolean('geo_tagging_enabled').default(false).notNull(),

    // MFA preference (null means disabled)
    mfaMethod: mfaMethodEnum('mfa_method'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique constraint - one person profile per identity
    identityIdIdx: index('person_profiles_identity_id_idx').on(table.identityId),
    // Name search index
    nameIdx: index('person_profiles_name_idx').on(table.firstName, table.lastName),
    // Nationality for compliance reporting
    nationalityIdx: index('person_profiles_nationality_idx').on(table.nationality),
  }),
);

/**
 * Person Profiles Relations
 */
export const personProfilesRelations = relations(personProfiles, ({ one }) => ({
  identity: one(identities, {
    fields: [personProfiles.identityId],
    references: [identities.id],
  }),
}));

// Type inference
export type PersonProfile = typeof personProfiles.$inferSelect;
export type NewPersonProfile = typeof personProfiles.$inferInsert;
