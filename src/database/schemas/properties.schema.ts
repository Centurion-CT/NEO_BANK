import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';
import { tenants } from './tenants.schema';

/**
 * Property Type Enum
 * Distinguishes between physical and virtual operating points
 */
export const propertyTypeEnum = pgEnum('property_type', [
  'PHYSICAL',  // Physical location (branch, agent location, outlet)
  'VIRTUAL',   // Digital channel (mobile, web, USSD, partner)
]);

/**
 * Property Subtype Enum
 * Specific classification of property
 */
export const propertySubtypeEnum = pgEnum('property_subtype', [
  // Physical subtypes
  'BRANCH',           // Bank branch
  'AGENT_LOCATION',   // Agent banking location
  'OUTLET',           // Retail outlet

  // Virtual subtypes
  'MOBILE_APP',       // Mobile application
  'WEB_APP',          // Web application
  'USSD_CHANNEL',     // USSD banking channel
  'PARTNER_CHANNEL',  // Partner integration channel
  'INTERNAL_SYSTEM',  // Internal system/API
]);

/**
 * Property Status Enum
 * Represents the operational state of a property
 */
export const propertyStatusEnum = pgEnum('property_status', [
  'ACTIVE',     // Property is operational
  'INACTIVE',   // Property is not operational
  'SUSPENDED',  // Property is temporarily disabled
]);

/**
 * Identity-Property Relationship Type Enum
 * Defines how an identity relates to a property
 */
export const identityPropertyRelationshipEnum = pgEnum('identity_property_relationship', [
  'ONBOARDED_AT',     // Where the identity was onboarded
  'PRIMARY_PROPERTY', // Primary property for the identity
  'SERVICED_BY',      // Property that services this identity
]);

/**
 * Properties Table
 * Defines an operational or channel boundary (physical or virtual)
 *
 * Used for:
 * - PROPERTY scope in IdentityRole assignments
 * - Agent scoping to specific locations
 * - Channel-based access control
 *
 * Compliance Reference: Phase 1A - Role & Permission Model
 */
export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Property classification
    propertyType: propertyTypeEnum('property_type').notNull(),
    propertySubtype: propertySubtypeEnum('property_subtype').notNull(),

    // Unique code for the property (e.g., BRANCH_IKEJA, MOBILE_ANDROID, USSD_737)
    propertyCode: varchar('property_code', { length: 50 }).notNull().unique(),

    // Display name
    name: text('name').notNull(),

    // Tenant association (for partner-owned channels)
    // NULL for bank-owned properties
    tenantId: uuid('tenant_id').references(() => tenants.id, {
      onDelete: 'set null',
    }),

    // Lifecycle status
    status: propertyStatusEnum('status').notNull().default('ACTIVE'),

    // Configuration flags
    isAssignable: boolean('is_assignable').notNull().default(true), // Can users be onboarded here?
    allowsAgentAccess: boolean('allows_agent_access').notNull().default(false), // Prevents agent access to digital channels

    // Flexible metadata (location coordinates, contact info, etc.)
    metadata: jsonb('metadata'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Unique property code
    propertyCodeIdx: uniqueIndex('properties_property_code_idx').on(table.propertyCode),
    // Index for tenant queries
    tenantIdIdx: index('properties_tenant_id_idx').on(table.tenantId),
    // Index for status filtering
    statusIdx: index('properties_status_idx').on(table.status),
    // Index for type filtering
    propertyTypeIdx: index('properties_property_type_idx').on(table.propertyType),
    // Index for subtype filtering
    propertySubtypeIdx: index('properties_property_subtype_idx').on(table.propertySubtype),
    // Index for assignable properties
    isAssignableIdx: index('properties_is_assignable_idx').on(table.isAssignable),
  }),
);

/**
 * Identity Properties Table
 * Tracks where a user was onboarded or serviced
 *
 * IMPORTANT: This table is for METADATA, NOT AUTHORIZATION
 * - NEVER used to grant permissions to USER role
 * - Used for: Agent scoping, Reporting, Support routing, Audit traceability
 *
 * Compliance Reference: Phase 1A - Role & Permission Model
 */
export const identityProperties = pgTable(
  'identity_properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // The identity
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // The property
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),

    // Type of relationship
    relationshipType: identityPropertyRelationshipEnum('relationship_type').notNull(),

    // Whether this relationship is currently active
    active: boolean('active').notNull().default(true),

    // When this relationship was established
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for identity queries
    identityIdIdx: index('identity_properties_identity_id_idx').on(table.identityId),
    // Index for property queries
    propertyIdIdx: index('identity_properties_property_id_idx').on(table.propertyId),
    // Index for relationship type
    relationshipTypeIdx: index('identity_properties_relationship_type_idx').on(table.relationshipType),
    // Index for active relationships
    activeIdx: index('identity_properties_active_idx').on(table.active),
    // Unique constraint: one relationship type per identity-property pair
    uniqueIdentityPropertyRelationship: uniqueIndex('identity_properties_unique_idx').on(
      table.identityId,
      table.propertyId,
      table.relationshipType,
    ),
  }),
);

// Relations
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [properties.tenantId],
    references: [tenants.id],
  }),
  identityProperties: many(identityProperties),
}));

export const identityPropertiesRelations = relations(identityProperties, ({ one }) => ({
  identity: one(identities, {
    fields: [identityProperties.identityId],
    references: [identities.id],
  }),
  property: one(properties, {
    fields: [identityProperties.propertyId],
    references: [properties.id],
  }),
}));

// Type inference
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type IdentityProperty = typeof identityProperties.$inferSelect;
export type NewIdentityProperty = typeof identityProperties.$inferInsert;
