import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

/**
 * Tenant Type Enum
 * Defines the type of organizational boundary
 */
export const tenantTypeEnum = pgEnum('tenant_type', [
  'BUSINESS_BANKING',        // Business banking workspace
  'SUBSCRIPTION_WORKSPACE',  // ERP/SaaS subscription workspace
  'PARTNER',                 // Partner organization
]);

/**
 * Tenant Status Enum
 * Represents the lifecycle state of a tenant
 *
 * Onboarding flow: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → ACTIVE
 * Branches: UNDER_REVIEW → REQUEST_UPDATE → DRAFT (back to editing)
 *           UNDER_REVIEW → REJECTED (terminal)
 */
export const tenantStatusEnum = pgEnum('tenant_status', [
  'DRAFT',        // Initial state - business details being prepared
  'SUBMITTED',    // KYC submitted for review
  'UNDER_REVIEW', // Compliance team reviewing
  'APPROVED',     // KYC approved, pending activation
  'REJECTED',     // KYC rejected (can resubmit)
  'ACTIVE',       // Tenant is fully operational
  'SUSPENDED',    // Tenant is temporarily disabled
]);

/**
 * Tenants Table
 * Defines an organizational boundary for scoped authorization
 *
 * Notes:
 * - Personal banking users do NOT require tenants
 * - Tenants may exist purely for subscriptions (ERP)
 * - Used for TENANT scope in IdentityRole assignments
 *
 * Compliance Reference: Phase 1A - Role & Permission Model
 */
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Tenant classification
    tenantType: tenantTypeEnum('tenant_type').notNull(),

    // Organization details
    legalName: text('legal_name').notNull(),

    // Owner identity (the primary owner of this tenant)
    // NULL for system-created tenants (e.g., partner channels)
    ownerIdentityId: uuid('owner_identity_id').references(() => identities.id, {
      onDelete: 'set null',
    }),

    // Lifecycle status (starts in DRAFT for onboarding workflow)
    status: tenantStatusEnum('status').notNull().default('DRAFT'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Index for owner queries
    ownerIdentityIdIdx: index('tenants_owner_identity_id_idx').on(table.ownerIdentityId),
    // Index for status filtering
    statusIdx: index('tenants_status_idx').on(table.status),
    // Index for type filtering
    tenantTypeIdx: index('tenants_tenant_type_idx').on(table.tenantType),
    // Index for created date range queries
    createdAtIdx: index('tenants_created_at_idx').on(table.createdAt),
  }),
);

// Relations
export const tenantsRelations = relations(tenants, ({ one }) => ({
  ownerIdentity: one(identities, {
    fields: [tenants.ownerIdentityId],
    references: [identities.id],
  }),
}));

// Type inference
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
