import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { identities } from './identities.schema';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Role Type Enum (DEPRECATED - kept for backward compatibility)
 * Use roleCategoryEnum for new implementations
 */
export const roleTypeEnum = pgEnum('role_type', [
  'super_admin',    // Full system access
  'admin',          // Administrative access
  'support_agent',  // Customer support access
  'user',           // Standard user role
]);

/**
 * Role Category Enum (NEW)
 * Categorizes roles for governance and UI filtering
 *
 * Compliance Reference: Phase 1A - Role & Permission Model
 */
export const roleCategoryEnum = pgEnum('role_category', [
  'PERSONAL',     // Personal banking users (e.g., USER)
  'BUSINESS',     // Business users (e.g., BUSINESS_OWNER, BUSINESS_STAFF)
  'OPERATIONAL',  // Operational staff (e.g., AGENT, SUPPORT_AGENT)
  'SYSTEM',       // System roles (e.g., ADMIN, SUPER_ADMIN, COMPLIANCE)
]);

/**
 * Permission Category Enum
 * Groups permissions by feature area
 */
export const permissionCategoryEnum = pgEnum('permission_category', [
  'users',
  'kyc',
  'transactions',
  'sessions',
  'audit',
  'settings',
  'subscriptions',
  'permissions',
  'tenants',     // NEW: Tenant management
  'properties',  // NEW: Property/Branch management
]);

/**
 * Scope Enum (NEW)
 * Defines where a role assignment applies
 *
 * Compliance Reference: Phase 1A - Role & Permission Model
 */
export const scopeEnum = pgEnum('scope', [
  'GLOBAL',    // System-wide scope (scope_ref_id MUST be NULL)
  'TENANT',    // Tenant-specific scope (scope_ref_id references tenants.id)
  'PROPERTY',  // Property-specific scope (scope_ref_id references properties.id)
]);

/**
 * Identity Role Status Enum (NEW)
 * Status of an identity's role assignment
 *
 * Compliance Reference: Phase 1A - Role & Permission Model
 */
export const identityRoleStatusEnum = pgEnum('identity_role_status', [
  'ACTIVE',   // Role assignment is active
  'REVOKED',  // Role assignment has been revoked (soft delete for audit)
]);

/**
 * Permission Constraint Type Enum (NEW - Optional/Phase 2)
 * Allows fine-grained restriction without role explosion
 */
export const constraintTypeEnum = pgEnum('constraint_type', [
  'SELF_ONLY',               // Permission applies only to own resources
  'REQUIRES_PROPERTY_MATCH', // Permission requires property context match
  'REQUIRES_TENANT_MATCH',   // Permission requires tenant context match
]);

// ============================================================================
// TABLES
// ============================================================================

/**
 * Roles Table
 * Defines what a user can do
 *
 * Notes:
 * - Roles are predefined
 * - Not tenant- or property-specific by themselves
 * - Category helps governance & UI filtering
 *
 * Compliance Reference: Phase 1A - Role & Permission Model
 */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // NEW: Unique role code (e.g., USER, BUSINESS_OWNER, ADMIN)
    roleCode: varchar('role_code', { length: 50 }).notNull().unique(),

    // Display name
    name: varchar('name', { length: 100 }).notNull(),

    // NEW: Role category for governance
    roleCategory: roleCategoryEnum('role_category').notNull(),

    // DEPRECATED: Kept for backward compatibility - use roleCategory instead
    type: roleTypeEnum('type'),

    // Description
    description: text('description'),

    // System roles cannot be deleted
    isSystemRole: boolean('is_system_role').notNull().default(true),

    // Whether the role is active
    isActive: boolean('is_active').notNull().default(true),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    roleCodeIdx: uniqueIndex('roles_role_code_idx').on(table.roleCode),
    nameIdx: uniqueIndex('roles_name_idx').on(table.name),
    roleCategoryIdx: index('roles_role_category_idx').on(table.roleCategory),
    typeIdx: index('roles_type_idx').on(table.type),
    isActiveIdx: index('roles_is_active_idx').on(table.isActive),
  }),
);

/**
 * Permissions Table
 * Defines a single atomic action
 *
 * Notes:
 * - Permissions are never granted directly to identities
 * - Only roles carry permissions
 *
 * Compliance Reference: Phase 1A - Role & Permission Model
 */
export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Unique permission code (e.g., VIEW_PROFILE, ASSIST_KYC, INVITE_STAFF)
    code: varchar('code', { length: 100 }).notNull(),

    // Display name
    name: varchar('name', { length: 255 }).notNull(),

    // Description
    description: text('description'),

    // Category for grouping
    category: permissionCategoryEnum('category').notNull(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: uniqueIndex('permissions_code_idx').on(table.code),
    categoryIdx: index('permissions_category_idx').on(table.category),
  }),
);

/**
 * Role Permissions Table
 * Maps roles to permissions
 *
 * Compliance Reference: Phase 1A - Role & Permission Model
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    roleIdIdx: index('role_permissions_role_id_idx').on(table.roleId),
    permissionIdIdx: index('role_permissions_permission_id_idx').on(table.permissionId),
    uniqueRolePermission: uniqueIndex('role_permissions_unique_idx').on(table.roleId, table.permissionId),
  }),
);

/**
 * User Roles Table (DEPRECATED - kept for backward compatibility)
 * Use identityRoles for new implementations
 */
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identityId: uuid('identity_id').notNull().references(() => identities.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),

    // Assignment metadata
    assignedBy: uuid('assigned_by').references(() => identities.id),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    identityIdIdx: index('user_roles_identity_id_idx').on(table.identityId),
    roleIdIdx: index('user_roles_role_id_idx').on(table.roleId),
    uniqueIdentityRole: uniqueIndex('user_roles_unique_idx').on(table.identityId, table.roleId),
    expiresAtIdx: index('user_roles_expires_at_idx').on(table.expiresAt),
  }),
);

/**
 * Identity Roles Table (NEW)
 * Binds Identity + Role + Scope
 *
 * This is the CRITICAL table for scoped authorization
 *
 * Hard Enforcement Rules:
 * - GLOBAL → scope_ref_id MUST be NULL
 * - TENANT → scope_ref_id MUST reference tenants.id
 * - PROPERTY → scope_ref_id MUST reference properties.id
 * - Multiple active roles per identity allowed
 * - Revocation is soft (audit-safe)
 *
 * Compliance Reference: Phase 1A - Role & Permission Model
 */
export const identityRoles = pgTable(
  'identity_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // The identity receiving the role
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),

    // The role being assigned
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),

    // Scope definition
    scope: scopeEnum('scope').notNull().default('GLOBAL'),

    // Scope reference - required for TENANT/PROPERTY, NULL for GLOBAL
    // NOTE: Foreign key enforcement is done at the application layer
    // because this can reference either tenants.id or properties.id
    scopeRefId: uuid('scope_ref_id'),

    // Status for soft revocation (audit-safe)
    status: identityRoleStatusEnum('status').notNull().default('ACTIVE'),

    // Assignment metadata
    assignedBy: uuid('assigned_by')
      .notNull()
      .references(() => identities.id),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),

    // Revocation metadata (set when status changes to REVOKED)
    revokedAt: timestamp('revoked_at'),

    // Optional expiry for temporary roles
    expiresAt: timestamp('expires_at'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // Primary queries
    identityIdIdx: index('identity_roles_identity_id_idx').on(table.identityId),
    roleIdIdx: index('identity_roles_role_id_idx').on(table.roleId),

    // Scope queries
    scopeIdx: index('identity_roles_scope_idx').on(table.scope),
    scopeRefIdIdx: index('identity_roles_scope_ref_id_idx').on(table.scopeRefId),

    // Status filtering
    statusIdx: index('identity_roles_status_idx').on(table.status),

    // Active roles query (common pattern)
    activeRolesIdx: index('identity_roles_active_idx').on(table.identityId, table.status),

    // Unique constraint: one role assignment per identity+role+scope+scopeRef combination
    // This allows same role with different scopes
    uniqueIdentityRoleScope: uniqueIndex('identity_roles_unique_idx').on(
      table.identityId,
      table.roleId,
      table.scope,
      table.scopeRefId,
    ),
  }),
);

/**
 * Permission Constraints Table (OPTIONAL - Phase 2)
 * Allows fine-grained restriction without role explosion
 *
 * Examples:
 * - VIEW_PROFILE → SELF_ONLY
 * - ASSIST_KYC → REQUIRES_PROPERTY_MATCH
 *
 * Compliance Reference: Phase 1A - Role & Permission Model (Section 5.1)
 */
export const permissionConstraints = pgTable(
  'permission_constraints',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // The permission being constrained
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),

    // Type of constraint
    constraintType: constraintTypeEnum('constraint_type').notNull(),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    permissionIdIdx: index('permission_constraints_permission_id_idx').on(table.permissionId),
    uniquePermissionConstraint: uniqueIndex('permission_constraints_unique_idx').on(
      table.permissionId,
      table.constraintType,
    ),
  }),
);

// ============================================================================
// RELATIONS
// ============================================================================

export const rolesRelations = relations(roles, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
  identityRoles: many(identityRoles),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
  permissionConstraints: many(permissionConstraints),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  identity: one(identities, {
    fields: [userRoles.identityId],
    references: [identities.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  assignedByIdentity: one(identities, {
    fields: [userRoles.assignedBy],
    references: [identities.id],
  }),
}));

export const identityRolesRelations = relations(identityRoles, ({ one }) => ({
  identity: one(identities, {
    fields: [identityRoles.identityId],
    references: [identities.id],
  }),
  role: one(roles, {
    fields: [identityRoles.roleId],
    references: [roles.id],
  }),
  assignedByIdentity: one(identities, {
    fields: [identityRoles.assignedBy],
    references: [identities.id],
  }),
}));

export const permissionConstraintsRelations = relations(permissionConstraints, ({ one }) => ({
  permission: one(permissions, {
    fields: [permissionConstraints.permissionId],
    references: [permissions.id],
  }),
}));

// ============================================================================
// TYPE INFERENCE
// ============================================================================

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
export type IdentityRole = typeof identityRoles.$inferSelect;
export type NewIdentityRole = typeof identityRoles.$inferInsert;
export type PermissionConstraint = typeof permissionConstraints.$inferSelect;
export type NewPermissionConstraint = typeof permissionConstraints.$inferInsert;

// Scope type for use in services
export type Scope = 'GLOBAL' | 'TENANT' | 'PROPERTY';
export type IdentityRoleStatus = 'ACTIVE' | 'REVOKED';
export type RoleCategory = 'PERSONAL' | 'BUSINESS' | 'OPERATIONAL' | 'SYSTEM';
