import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';
import { CreateRoleDto, UpdateRoleDto } from './dto/create-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { Role, Permission } from '@database/schemas/permissions.schema';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  // =====================
  // ROLES
  // =====================

  async createRole(dto: CreateRoleDto): Promise<Role> {
    // Check if role name already exists
    const existingRole = await this.permissionsRepository.findRoleByName(dto.name);
    if (existingRole) {
      throw new ConflictException({
        code: 'ROLE_EXISTS',
        message: 'A role with this name already exists',
      });
    }

    // Check if role code already exists
    const existingCode = await this.permissionsRepository.findRoleByCode(dto.roleCode);
    if (existingCode) {
      throw new ConflictException({
        code: 'ROLE_CODE_EXISTS',
        message: 'A role with this code already exists',
      });
    }

    return this.permissionsRepository.createRole({
      roleCode: dto.roleCode,
      name: dto.name,
      roleCategory: dto.roleCategory,
      type: dto.type,
      description: dto.description,
      isSystemRole: dto.isSystemRole || false,
      isActive: true,
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.permissionsRepository.findRoleById(id);
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    // Prevent updating system roles' critical fields
    if (role.isSystemRole && dto.name) {
      throw new ForbiddenException({
        code: 'SYSTEM_ROLE_PROTECTED',
        message: 'Cannot rename system roles',
      });
    }

    // Check for name conflicts
    if (dto.name && dto.name !== role.name) {
      const existingRole = await this.permissionsRepository.findRoleByName(dto.name);
      if (existingRole) {
        throw new ConflictException({
          code: 'ROLE_EXISTS',
          message: 'A role with this name already exists',
        });
      }
    }

    return this.permissionsRepository.updateRole(id, dto);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.permissionsRepository.findRoleById(id);
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    if (role.isSystemRole) {
      throw new ForbiddenException({
        code: 'SYSTEM_ROLE_PROTECTED',
        message: 'Cannot delete system roles',
      });
    }

    await this.permissionsRepository.deleteRole(id);
  }

  async findRoleById(id: string): Promise<Role> {
    const role = await this.permissionsRepository.findRoleById(id);
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }
    return role;
  }

  async findRoleByType(type: string): Promise<Role | null> {
    return this.permissionsRepository.findRoleByType(type);
  }

  async findAllRoles(): Promise<Role[]> {
    return this.permissionsRepository.findAllRoles();
  }

  async findActiveRoles(): Promise<Role[]> {
    return this.permissionsRepository.findActiveRoles();
  }

  // =====================
  // PERMISSIONS
  // =====================

  async createPermission(dto: CreatePermissionDto): Promise<Permission> {
    // Check if permission code already exists
    const existingPermission = await this.permissionsRepository.findPermissionByCode(dto.code);
    if (existingPermission) {
      throw new ConflictException({
        code: 'PERMISSION_EXISTS',
        message: 'A permission with this code already exists',
      });
    }

    return this.permissionsRepository.createPermission({
      code: dto.code,
      name: dto.name,
      description: dto.description,
      category: dto.category,
    });
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionsRepository.findAllPermissions();
  }

  async findPermissionsByCategory(category: string): Promise<Permission[]> {
    return this.permissionsRepository.findPermissionsByCategory(category);
  }

  // =====================
  // ROLE PERMISSIONS
  // =====================

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    // Verify role exists
    const role = await this.permissionsRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    // Verify permission exists
    const permission = await this.permissionsRepository.findPermissionById(permissionId);
    if (!permission) {
      throw new NotFoundException({
        code: 'PERMISSION_NOT_FOUND',
        message: 'Permission not found',
      });
    }

    await this.permissionsRepository.assignPermissionToRole(roleId, permissionId);
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    // Verify role exists
    const role = await this.permissionsRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    await this.permissionsRepository.removePermissionFromRole(roleId, permissionId);
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const role = await this.permissionsRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    return this.permissionsRepository.findRolePermissions(roleId);
  }

  // =====================
  // IDENTITY ROLES
  // =====================

  async assignRoleToIdentity(
    identityId: string,
    roleId: string,
    assignedBy: string,
    expiresAt?: Date,
  ): Promise<void> {
    // Verify role exists and is active
    const role = await this.permissionsRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    if (!role.isActive) {
      throw new BadRequestException({
        code: 'ROLE_INACTIVE',
        message: 'Cannot assign an inactive role',
      });
    }

    await this.permissionsRepository.assignRoleToUser({
      identityId,
      roleId,
      assignedBy,
      assignedAt: new Date(),
      expiresAt,
    });
  }

  async removeRoleFromIdentity(identityId: string, roleId: string): Promise<void> {
    await this.permissionsRepository.removeRoleFromIdentity(identityId, roleId);
  }

  async getIdentityRoles(identityId: string): Promise<Role[]> {
    return this.permissionsRepository.findIdentityRoles(identityId);
  }

  async getIdentityPermissions(identityId: string): Promise<Permission[]> {
    return this.permissionsRepository.getIdentityPermissions(identityId);
  }

  async hasPermission(identityId: string, permissionCode: string): Promise<boolean> {
    return this.permissionsRepository.hasPermission(identityId, permissionCode);
  }

  async hasRole(identityId: string, roleType: string): Promise<boolean> {
    return this.permissionsRepository.hasRole(identityId, roleType);
  }

  async hasAnyRole(identityId: string, roleTypes: string[]): Promise<boolean> {
    return this.permissionsRepository.hasAnyRole(identityId, roleTypes);
  }

  // =====================
  // ROLE WITH PERMISSIONS (Combined)
  // =====================

  async getRoleWithPermissions(roleId: string): Promise<{ role: Role; permissions: Permission[] }> {
    const role = await this.findRoleById(roleId);
    const permissions = await this.getRolePermissions(roleId);
    return { role, permissions };
  }

  async getIdentityRolesWithPermissions(
    identityId: string,
  ): Promise<{ roles: Role[]; permissions: Permission[] }> {
    const roles = await this.getIdentityRoles(identityId);
    const permissions = await this.getIdentityPermissions(identityId);
    return { roles, permissions };
  }

  // =====================
  // SCOPED IDENTITY ROLES (NEW)
  // =====================

  /**
   * Find role by code
   */
  async findRoleByCode(code: string): Promise<Role | null> {
    return this.permissionsRepository.findRoleByCode(code);
  }

  /**
   * Assign a scoped role to an identity
   *
   * Hard Enforcement Rules:
   * - GLOBAL → scopeRefId MUST be null
   * - TENANT → scopeRefId MUST reference a valid tenant
   * - PROPERTY → scopeRefId MUST reference a valid property
   */
  async assignScopedRoleToIdentity(
    identityId: string,
    roleId: string,
    scope: 'GLOBAL' | 'TENANT' | 'PROPERTY',
    scopeRefId: string | null,
    assignedBy: string,
    expiresAt?: Date,
  ): Promise<void> {
    // Verify role exists and is active
    const role = await this.permissionsRepository.findRoleById(roleId);
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Role not found',
      });
    }

    if (!role.isActive) {
      throw new BadRequestException({
        code: 'ROLE_INACTIVE',
        message: 'Cannot assign an inactive role',
      });
    }

    // Validate scope rules
    await this.validateScopeRules(scope, scopeRefId);

    // Check if assignment already exists
    const existing = await this.permissionsRepository.findIdentityRoleAssignment(
      identityId,
      roleId,
      scope,
      scopeRefId,
    );

    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new BadRequestException({
          code: 'ROLE_ALREADY_ASSIGNED',
          message: 'This role is already assigned to the identity in this scope',
        });
      }
      // If revoked, we could reactivate or create new - for now, throw error
      throw new BadRequestException({
        code: 'ROLE_PREVIOUSLY_REVOKED',
        message: 'This role was previously revoked. Contact admin to reactivate.',
      });
    }

    await this.permissionsRepository.assignScopedRoleToIdentity({
      identityId,
      roleId,
      scope,
      scopeRefId,
      status: 'ACTIVE',
      assignedBy,
      assignedAt: new Date(),
      expiresAt,
    });
  }

  /**
   * Revoke a scoped role from an identity (soft delete for audit)
   */
  async revokeScopedRoleFromIdentity(
    identityId: string,
    roleId: string,
    scope: 'GLOBAL' | 'TENANT' | 'PROPERTY',
    scopeRefId?: string | null,
  ): Promise<void> {
    const assignment = await this.permissionsRepository.findIdentityRoleAssignment(
      identityId,
      roleId,
      scope,
      scopeRefId,
    );

    if (!assignment) {
      throw new NotFoundException({
        code: 'ROLE_ASSIGNMENT_NOT_FOUND',
        message: 'Role assignment not found',
      });
    }

    if (assignment.status === 'REVOKED') {
      throw new BadRequestException({
        code: 'ROLE_ALREADY_REVOKED',
        message: 'This role assignment is already revoked',
      });
    }

    await this.permissionsRepository.revokeIdentityRole(assignment.id);
  }

  /**
   * Get all active scoped roles for an identity
   */
  async getIdentityScopedRoles(identityId: string): Promise<any[]> {
    return this.permissionsRepository.findActiveIdentityRoles(identityId);
  }

  /**
   * Get scoped roles for an identity within a specific scope
   */
  async getIdentityRolesInScope(
    identityId: string,
    scope: 'GLOBAL' | 'TENANT' | 'PROPERTY',
    scopeRefId?: string | null,
  ): Promise<any[]> {
    return this.permissionsRepository.findIdentityRolesInScope(identityId, scope, scopeRefId);
  }

  /**
   * Get permissions for an identity considering scope
   */
  async getIdentityPermissionsInScope(
    identityId: string,
    scope?: 'GLOBAL' | 'TENANT' | 'PROPERTY',
    scopeRefId?: string | null,
  ): Promise<Permission[]> {
    return this.permissionsRepository.getIdentityPermissionsWithScope(identityId, scope, scopeRefId);
  }

  /**
   * Check if identity has permission in a specific scope
   */
  async hasPermissionInScope(
    identityId: string,
    permissionCode: string,
    scope: 'GLOBAL' | 'TENANT' | 'PROPERTY',
    scopeRefId?: string | null,
  ): Promise<boolean> {
    return this.permissionsRepository.hasPermissionInScope(
      identityId,
      permissionCode,
      scope,
      scopeRefId,
    );
  }

  /**
   * Check if identity has a role in any scope
   */
  async hasRoleInAnyScope(identityId: string, roleCode: string): Promise<boolean> {
    return this.permissionsRepository.hasRoleInAnyScope(identityId, roleCode);
  }

  /**
   * Check if identity has a role in a specific scope
   */
  async hasRoleInScope(
    identityId: string,
    roleCode: string,
    scope: 'GLOBAL' | 'TENANT' | 'PROPERTY',
    scopeRefId?: string | null,
  ): Promise<boolean> {
    return this.permissionsRepository.hasRoleInScope(identityId, roleCode, scope, scopeRefId);
  }

  /**
   * Get all identities with a role in a scope
   */
  async getIdentitiesWithRoleInScope(
    roleId: string,
    scope?: 'GLOBAL' | 'TENANT' | 'PROPERTY',
    scopeRefId?: string | null,
  ): Promise<any[]> {
    return this.permissionsRepository.findIdentitiesWithRoleInScope(roleId, scope, scopeRefId);
  }

  // =====================
  // PRIVATE HELPERS
  // =====================

  /**
   * Validate scope rules
   * - GLOBAL → scopeRefId MUST be null
   * - TENANT → scopeRefId MUST reference a valid tenant
   * - PROPERTY → scopeRefId MUST reference a valid property
   */
  private async validateScopeRules(
    scope: 'GLOBAL' | 'TENANT' | 'PROPERTY',
    scopeRefId: string | null,
  ): Promise<void> {
    if (scope === 'GLOBAL') {
      if (scopeRefId !== null) {
        throw new BadRequestException({
          code: 'INVALID_SCOPE_REF',
          message: 'GLOBAL scope must not have a scope reference ID',
        });
      }
    } else if (scope === 'TENANT') {
      if (!scopeRefId) {
        throw new BadRequestException({
          code: 'MISSING_SCOPE_REF',
          message: 'TENANT scope requires a tenant ID as scope reference',
        });
      }
      // Note: Tenant existence validation should be done by injecting TenantsService
      // For now, we trust the caller to provide valid tenant ID
    } else if (scope === 'PROPERTY') {
      if (!scopeRefId) {
        throw new BadRequestException({
          code: 'MISSING_SCOPE_REF',
          message: 'PROPERTY scope requires a property ID as scope reference',
        });
      }
      // Note: Property existence validation should be done by injecting PropertiesService
      // For now, we trust the caller to provide valid property ID
    }
  }
}
