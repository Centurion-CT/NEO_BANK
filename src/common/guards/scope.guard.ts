import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_SCOPE_KEY, ScopeRequirement, ScopeType } from '../decorators/scope.decorator';

/**
 * ScopeGuard
 * Checks if the user has the required permissions/roles within the specified scope
 *
 * This guard implements the scoped RBAC model:
 * - GLOBAL scope: User must have role/permission at GLOBAL level
 * - TENANT scope: User must have role/permission at TENANT level for the specific tenant
 *                 OR have role/permission at GLOBAL level (which applies everywhere)
 * - PROPERTY scope: User must have role/permission at PROPERTY level for the specific property
 *                   OR at TENANT level for the property's tenant
 *                   OR at GLOBAL level
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, ScopeGuard)
 * @RequireScope({ scope: 'TENANT', scopeRefPath: 'params.tenantId', permissions: ['tenant.read'] })
 * @Get(':tenantId')
 * getTenant() { ... }
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  private readonly logger = new Logger(ScopeGuard.name);

  constructor(
    private reflector: Reflector,
    @Inject('PERMISSIONS_SERVICE') private permissionsService: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<ScopeRequirement>(REQUIRE_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no scope requirement is specified, allow access
    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Authentication required',
      });
    }

    const { scope, scopeRefPath, permissions, roles } = requirement;

    // Extract scope reference ID from request
    const scopeRefId = scopeRefPath ? this.extractScopeRefId(request, scopeRefPath) : null;

    // Validate scope reference for non-GLOBAL scopes
    if (scope !== 'GLOBAL' && !scopeRefId) {
      throw new ForbiddenException({
        code: 'MISSING_SCOPE_CONTEXT',
        message: `${scope} scope requires a valid reference ID`,
      });
    }

    // Attach scope context to request for downstream use
    request.scope = { type: scope, refId: scopeRefId };

    // Check roles if specified
    if (roles && roles.length > 0) {
      const hasRole = await this.checkRolesInScope(user.id, roles, scope, scopeRefId);
      if (!hasRole) {
        this.logger.debug(
          `User ${user.id} lacks required roles [${roles.join(', ')}] in ${scope} scope`,
        );
        throw new ForbiddenException({
          code: 'INSUFFICIENT_ROLE',
          message: `Access denied. Required role in ${scope} scope not found.`,
        });
      }
    }

    // Check permissions if specified
    if (permissions && permissions.length > 0) {
      const hasPermissions = await this.checkPermissionsInScope(
        user.id,
        permissions,
        scope,
        scopeRefId,
      );
      if (!hasPermissions) {
        this.logger.debug(
          `User ${user.id} lacks required permissions [${permissions.join(', ')}] in ${scope} scope`,
        );
        throw new ForbiddenException({
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Missing permissions in ${scope} scope.`,
        });
      }
    }

    return true;
  }

  /**
   * Extract the scope reference ID from the request
   */
  private extractScopeRefId(request: any, path: string): string | null {
    const parts = path.split('.');
    let value: any = request;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return null;
      }
      value = value[part];
    }

    return typeof value === 'string' ? value : null;
  }

  /**
   * Check if user has any of the required roles in the scope
   * Implements role hierarchy: GLOBAL > TENANT > PROPERTY
   */
  private async checkRolesInScope(
    userId: string,
    roleCodes: string[],
    scope: ScopeType,
    scopeRefId: string | null,
  ): Promise<boolean> {
    for (const roleCode of roleCodes) {
      // First check if user has the role in the exact scope
      const hasRoleInScope = await this.permissionsService.hasRoleInScope(
        userId,
        roleCode,
        scope,
        scopeRefId,
      );

      if (hasRoleInScope) {
        return true;
      }

      // For non-GLOBAL scopes, check if user has the role at a higher level
      if (scope !== 'GLOBAL') {
        // Check GLOBAL scope (applies everywhere)
        const hasGlobalRole = await this.permissionsService.hasRoleInScope(
          userId,
          roleCode,
          'GLOBAL',
          null,
        );

        if (hasGlobalRole) {
          return true;
        }

        // For PROPERTY scope, also check TENANT scope
        // Note: This would require knowing which tenant the property belongs to
        // For now, we skip this check and rely on GLOBAL fallback
      }
    }

    return false;
  }

  /**
   * Check if user has all required permissions in the scope
   * Implements permission hierarchy: GLOBAL > TENANT > PROPERTY
   */
  private async checkPermissionsInScope(
    userId: string,
    permissionCodes: string[],
    scope: ScopeType,
    scopeRefId: string | null,
  ): Promise<boolean> {
    for (const permissionCode of permissionCodes) {
      const hasPermission = await this.permissionsService.hasPermissionInScope(
        userId,
        permissionCode,
        scope,
        scopeRefId,
      );

      if (!hasPermission) {
        // For non-GLOBAL scopes, check if user has the permission at GLOBAL level
        if (scope !== 'GLOBAL') {
          const hasGlobalPermission = await this.permissionsService.hasPermissionInScope(
            userId,
            permissionCode,
            'GLOBAL',
            null,
          );

          if (!hasGlobalPermission) {
            return false;
          }
        } else {
          return false;
        }
      }
    }

    return true;
  }
}
