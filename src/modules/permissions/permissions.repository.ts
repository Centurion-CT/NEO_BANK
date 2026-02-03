import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, inArray, isNull, or, gte, desc } from 'drizzle-orm';
import { DRIZZLE } from '@database/database.module';
import * as schema from '@database/schemas';
import {
  roles,
  permissions,
  rolePermissions,
  userRoles,
  identityRoles,
  Role,
  NewRole,
  Permission,
  NewPermission,
  NewRolePermission,
  NewUserRole,
  IdentityRole,
  NewIdentityRole,
  Scope,
} from '@database/schemas/permissions.schema';

@Injectable()
export class PermissionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>) {}

  // =====================
  // ROLES
  // =====================

  async createRole(data: Omit<NewRole, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const [role] = await this.db.insert(roles).values(data).returning();
    return role;
  }

  async findRoleById(id: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);
    return role || null;
  }

  async findRoleByName(name: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);
    return role || null;
  }

  async findRoleByType(type: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.type, type as any))
      .limit(1);
    return role || null;
  }

  async findAllRoles(): Promise<Role[]> {
    return this.db.select().from(roles).orderBy(roles.createdAt);
  }

  async findActiveRoles(): Promise<Role[]> {
    return this.db
      .select()
      .from(roles)
      .where(eq(roles.isActive, true))
      .orderBy(roles.createdAt);
  }

  async updateRole(id: string, data: Partial<Role>): Promise<Role> {
    const [role] = await this.db
      .update(roles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(roles.id, id))
      .returning();
    return role;
  }

  async deleteRole(id: string): Promise<void> {
    await this.db.delete(roles).where(eq(roles.id, id));
  }

  // =====================
  // PERMISSIONS
  // =====================

  async createPermission(data: Omit<NewPermission, 'id' | 'createdAt' | 'updatedAt'>): Promise<Permission> {
    const [permission] = await this.db.insert(permissions).values(data).returning();
    return permission;
  }

  async findPermissionById(id: string): Promise<Permission | null> {
    const [permission] = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.id, id))
      .limit(1);
    return permission || null;
  }

  async findPermissionByCode(code: string): Promise<Permission | null> {
    const [permission] = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.code, code))
      .limit(1);
    return permission || null;
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.db.select().from(permissions).orderBy(permissions.category, permissions.code);
  }

  async findPermissionsByCategory(category: string): Promise<Permission[]> {
    return this.db
      .select()
      .from(permissions)
      .where(eq(permissions.category, category as any))
      .orderBy(permissions.code);
  }

  // =====================
  // ROLE PERMISSIONS
  // =====================

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await this.db.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await this.db
      .delete(rolePermissions)
      .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
  }

  async findRolePermissions(roleId: string): Promise<Permission[]> {
    const results = await this.db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    return results.map((r) => r.permission);
  }

  async findRolesWithPermission(permissionId: string): Promise<Role[]> {
    const results = await this.db
      .select({ role: roles })
      .from(rolePermissions)
      .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
      .where(eq(rolePermissions.permissionId, permissionId));
    return results.map((r) => r.role);
  }

  // =====================
  // USER ROLES
  // =====================

  async assignRoleToUser(data: Omit<NewUserRole, 'id' | 'createdAt'>): Promise<void> {
    await this.db
      .insert(userRoles)
      .values(data)
      .onConflictDoNothing();
  }

  async removeRoleFromIdentity(identityId: string, roleId: string): Promise<void> {
    await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.identityId, identityId), eq(userRoles.roleId, roleId)));
  }

  async findIdentityRoles(identityId: string): Promise<Role[]> {
    const now = new Date();
    const results = await this.db
      .select({ role: roles })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.identityId, identityId),
          eq(roles.isActive, true),
          or(isNull(userRoles.expiresAt), gte(userRoles.expiresAt, now)),
        ),
      );
    return results.map((r) => r.role);
  }

  async findIdentitiesWithRole(roleId: string): Promise<{ identityId: string; assignedAt: Date; expiresAt: Date | null }[]> {
    const results = await this.db
      .select({
        identityId: userRoles.identityId,
        assignedAt: userRoles.assignedAt,
        expiresAt: userRoles.expiresAt,
      })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));
    return results;
  }

  async getIdentityPermissions(identityId: string): Promise<Permission[]> {
    const now = new Date();

    // Get all active roles for the identity
    const identityRoleIds = await this.db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.identityId, identityId),
          eq(roles.isActive, true),
          or(isNull(userRoles.expiresAt), gte(userRoles.expiresAt, now)),
        ),
      );

    if (identityRoleIds.length === 0) {
      return [];
    }

    const roleIds = identityRoleIds.map((r) => r.roleId);

    // Get all permissions for those roles
    const results = await this.db
      .selectDistinct({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, roleIds));

    return results.map((r) => r.permission);
  }

  async hasPermission(identityId: string, permissionCode: string): Promise<boolean> {
    const identityPermissions = await this.getIdentityPermissions(identityId);
    return identityPermissions.some((p) => p.code === permissionCode);
  }

  async hasRole(identityId: string, roleType: string): Promise<boolean> {
    const identityRolesList = await this.findIdentityRoles(identityId);
    return identityRolesList.some((r) => r.type === roleType);
  }

  async hasAnyRole(identityId: string, roleTypes: string[]): Promise<boolean> {
    const identityRolesList = await this.findIdentityRoles(identityId);
    return identityRolesList.some((r) => r.type && roleTypes.includes(r.type));
  }

  // =====================
  // ROLE BY CODE (NEW)
  // =====================

  async findRoleByCode(code: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.roleCode, code))
      .limit(1);
    return role || null;
  }

  // =====================
  // IDENTITY ROLES (NEW - SCOPED)
  // =====================

  /**
   * Assign a scoped role to an identity
   */
  async assignScopedRoleToIdentity(
    data: Omit<NewIdentityRole, 'id' | 'createdAt'>,
  ): Promise<IdentityRole> {
    const [result] = await this.db
      .insert(identityRoles)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Find identity role by ID
   */
  async findIdentityRoleById(id: string): Promise<IdentityRole | null> {
    const [result] = await this.db
      .select()
      .from(identityRoles)
      .where(eq(identityRoles.id, id))
      .limit(1);
    return result || null;
  }

  /**
   * Find all active scoped roles for an identity
   */
  async findActiveIdentityRoles(identityId: string): Promise<(IdentityRole & { role: Role })[]> {
    const now = new Date();
    const results = await this.db
      .select({
        identityRole: identityRoles,
        role: roles,
      })
      .from(identityRoles)
      .innerJoin(roles, eq(identityRoles.roleId, roles.id))
      .where(
        and(
          eq(identityRoles.identityId, identityId),
          eq(identityRoles.status, 'ACTIVE'),
          eq(roles.isActive, true),
          or(isNull(identityRoles.expiresAt), gte(identityRoles.expiresAt, now)),
        ),
      )
      .orderBy(desc(identityRoles.assignedAt));

    return results.map((r) => ({
      ...r.identityRole,
      role: r.role,
    }));
  }

  /**
   * Find scoped roles for an identity within a specific scope
   */
  async findIdentityRolesInScope(
    identityId: string,
    scope: Scope,
    scopeRefId?: string | null,
  ): Promise<(IdentityRole & { role: Role })[]> {
    const now = new Date();
    const conditions = [
      eq(identityRoles.identityId, identityId),
      eq(identityRoles.scope, scope),
      eq(identityRoles.status, 'ACTIVE'),
      or(isNull(identityRoles.expiresAt), gte(identityRoles.expiresAt, now)),
    ];

    if (scopeRefId) {
      conditions.push(eq(identityRoles.scopeRefId, scopeRefId));
    } else if (scope === 'GLOBAL') {
      conditions.push(isNull(identityRoles.scopeRefId));
    }

    const results = await this.db
      .select({
        identityRole: identityRoles,
        role: roles,
      })
      .from(identityRoles)
      .innerJoin(roles, eq(identityRoles.roleId, roles.id))
      .where(and(...conditions))
      .orderBy(desc(identityRoles.assignedAt));

    return results.map((r) => ({
      ...r.identityRole,
      role: r.role,
    }));
  }

  /**
   * Find a specific scoped role assignment
   */
  async findIdentityRoleAssignment(
    identityId: string,
    roleId: string,
    scope: Scope,
    scopeRefId?: string | null,
  ): Promise<IdentityRole | null> {
    const conditions = [
      eq(identityRoles.identityId, identityId),
      eq(identityRoles.roleId, roleId),
      eq(identityRoles.scope, scope),
    ];

    if (scopeRefId) {
      conditions.push(eq(identityRoles.scopeRefId, scopeRefId));
    } else {
      conditions.push(isNull(identityRoles.scopeRefId));
    }

    const [result] = await this.db
      .select()
      .from(identityRoles)
      .where(and(...conditions))
      .limit(1);

    return result || null;
  }

  /**
   * Revoke a scoped role from an identity (soft delete)
   */
  async revokeIdentityRole(id: string): Promise<IdentityRole> {
    const [result] = await this.db
      .update(identityRoles)
      .set({
        status: 'REVOKED',
        revokedAt: new Date(),
      })
      .where(eq(identityRoles.id, id))
      .returning();
    return result;
  }

  /**
   * Hard delete an identity role (use with caution)
   */
  async deleteIdentityRole(id: string): Promise<void> {
    await this.db.delete(identityRoles).where(eq(identityRoles.id, id));
  }

  /**
   * Get all permissions for an identity considering scope
   * Returns permissions from all active roles (both legacy and scoped)
   */
  async getIdentityPermissionsWithScope(
    identityId: string,
    scope?: Scope,
    scopeRefId?: string | null,
  ): Promise<Permission[]> {
    const now = new Date();

    // Get role IDs from scoped identity_roles
    const scopeConditions = [
      eq(identityRoles.identityId, identityId),
      eq(identityRoles.status, 'ACTIVE'),
      or(isNull(identityRoles.expiresAt), gte(identityRoles.expiresAt, now)),
    ];

    // If scope is provided, filter by it
    if (scope) {
      scopeConditions.push(eq(identityRoles.scope, scope));
      if (scopeRefId) {
        scopeConditions.push(eq(identityRoles.scopeRefId, scopeRefId));
      } else if (scope === 'GLOBAL') {
        scopeConditions.push(isNull(identityRoles.scopeRefId));
      }
    }

    const scopedRoleIds = await this.db
      .select({ roleId: identityRoles.roleId })
      .from(identityRoles)
      .innerJoin(roles, eq(identityRoles.roleId, roles.id))
      .where(and(...scopeConditions, eq(roles.isActive, true)));

    // Also get role IDs from legacy user_roles (for backward compatibility)
    const legacyRoleIds = await this.db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.identityId, identityId),
          eq(roles.isActive, true),
          or(isNull(userRoles.expiresAt), gte(userRoles.expiresAt, now)),
        ),
      );

    // Combine all role IDs
    const allRoleIds = [
      ...scopedRoleIds.map((r) => r.roleId),
      ...legacyRoleIds.map((r) => r.roleId),
    ];

    if (allRoleIds.length === 0) {
      return [];
    }

    // Get unique role IDs
    const uniqueRoleIds = [...new Set(allRoleIds)];

    // Get all permissions for those roles
    const results = await this.db
      .selectDistinct({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(inArray(rolePermissions.roleId, uniqueRoleIds));

    return results.map((r) => r.permission);
  }

  /**
   * Check if identity has permission in a specific scope
   */
  async hasPermissionInScope(
    identityId: string,
    permissionCode: string,
    scope: Scope,
    scopeRefId?: string | null,
  ): Promise<boolean> {
    const perms = await this.getIdentityPermissionsWithScope(identityId, scope, scopeRefId);
    return perms.some((p) => p.code === permissionCode);
  }

  /**
   * Check if identity has a specific role in any scope
   */
  async hasRoleInAnyScope(identityId: string, roleCode: string): Promise<boolean> {
    const now = new Date();
    const [result] = await this.db
      .select({ id: identityRoles.id })
      .from(identityRoles)
      .innerJoin(roles, eq(identityRoles.roleId, roles.id))
      .where(
        and(
          eq(identityRoles.identityId, identityId),
          eq(roles.roleCode, roleCode),
          eq(identityRoles.status, 'ACTIVE'),
          eq(roles.isActive, true),
          or(isNull(identityRoles.expiresAt), gte(identityRoles.expiresAt, now)),
        ),
      )
      .limit(1);

    return !!result;
  }

  /**
   * Check if identity has a specific role in a specific scope
   */
  async hasRoleInScope(
    identityId: string,
    roleCode: string,
    scope: Scope,
    scopeRefId?: string | null,
  ): Promise<boolean> {
    const now = new Date();
    const conditions = [
      eq(identityRoles.identityId, identityId),
      eq(roles.roleCode, roleCode),
      eq(identityRoles.scope, scope),
      eq(identityRoles.status, 'ACTIVE'),
      eq(roles.isActive, true),
      or(isNull(identityRoles.expiresAt), gte(identityRoles.expiresAt, now)),
    ];

    if (scopeRefId) {
      conditions.push(eq(identityRoles.scopeRefId, scopeRefId));
    } else if (scope === 'GLOBAL') {
      conditions.push(isNull(identityRoles.scopeRefId));
    }

    const [result] = await this.db
      .select({ id: identityRoles.id })
      .from(identityRoles)
      .innerJoin(roles, eq(identityRoles.roleId, roles.id))
      .where(and(...conditions))
      .limit(1);

    return !!result;
  }

  /**
   * Get all identities with a specific role in a scope
   */
  async findIdentitiesWithRoleInScope(
    roleId: string,
    scope?: Scope,
    scopeRefId?: string | null,
  ): Promise<IdentityRole[]> {
    const conditions = [
      eq(identityRoles.roleId, roleId),
      eq(identityRoles.status, 'ACTIVE'),
    ];

    if (scope) {
      conditions.push(eq(identityRoles.scope, scope));
      if (scopeRefId) {
        conditions.push(eq(identityRoles.scopeRefId, scopeRefId));
      }
    }

    return this.db
      .select()
      .from(identityRoles)
      .where(and(...conditions))
      .orderBy(desc(identityRoles.assignedAt));
  }
}
