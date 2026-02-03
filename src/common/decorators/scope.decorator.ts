import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Scope types for RBAC authorization
 */
export type ScopeType = 'GLOBAL' | 'TENANT' | 'PROPERTY';

/**
 * Scope requirement configuration
 */
export interface ScopeRequirement {
  scope: ScopeType;
  /** For TENANT/PROPERTY scope, where to find the scopeRefId (e.g., 'params.tenantId', 'body.propertyId') */
  scopeRefPath?: string;
  /** Permission codes required within this scope */
  permissions?: string[];
  /** Role codes required within this scope (user must have at least one) */
  roles?: string[];
}

// =====================
// METADATA KEYS
// =====================

export const SCOPE_KEY = 'scope';
export const REQUIRE_SCOPE_KEY = 'requireScope';
export const REQUIRE_TENANT_KEY = 'requireTenant';
export const REQUIRE_PROPERTY_KEY = 'requireProperty';

// =====================
// DECORATORS
// =====================

/**
 * @RequireScope() Decorator
 * Restricts access based on scoped permissions
 *
 * Usage:
 * @RequireScope({ scope: 'GLOBAL', permissions: ['users.read'] })
 * @RequireScope({ scope: 'TENANT', scopeRefPath: 'params.tenantId', permissions: ['tenant.manage'] })
 * @RequireScope({ scope: 'PROPERTY', scopeRefPath: 'body.propertyId', roles: ['BRANCH_MANAGER'] })
 */
export const RequireScope = (requirement: ScopeRequirement) =>
  SetMetadata(REQUIRE_SCOPE_KEY, requirement);

/**
 * @RequireTenant() Decorator
 * Shorthand for requiring TENANT scope with automatic tenant ID extraction
 *
 * Usage:
 * @RequireTenant('params.tenantId', ['tenant.read'])
 * @RequireTenant('body.tenantId', ['tenant.manage'])
 */
export const RequireTenant = (scopeRefPath: string, permissions?: string[]) =>
  SetMetadata(REQUIRE_SCOPE_KEY, {
    scope: 'TENANT' as ScopeType,
    scopeRefPath,
    permissions,
  });

/**
 * @RequireProperty() Decorator
 * Shorthand for requiring PROPERTY scope with automatic property ID extraction
 *
 * Usage:
 * @RequireProperty('params.propertyId', ['property.read'])
 * @RequireProperty('body.propertyId', ['property.manage'])
 */
export const RequireProperty = (scopeRefPath: string, permissions?: string[]) =>
  SetMetadata(REQUIRE_SCOPE_KEY, {
    scope: 'PROPERTY' as ScopeType,
    scopeRefPath,
    permissions,
  });

/**
 * @RequireGlobalRole() Decorator
 * Shorthand for requiring a role at GLOBAL scope
 *
 * Usage:
 * @RequireGlobalRole('SUPER_ADMIN')
 * @RequireGlobalRole('ADMIN', 'SUPPORT_AGENT')
 */
export const RequireGlobalRole = (...roleCodes: string[]) =>
  SetMetadata(REQUIRE_SCOPE_KEY, {
    scope: 'GLOBAL' as ScopeType,
    roles: roleCodes,
  });

/**
 * @RequireTenantRole() Decorator
 * Shorthand for requiring a role at TENANT scope
 *
 * Usage:
 * @RequireTenantRole('params.tenantId', 'BUSINESS_OWNER', 'BUSINESS_ADMIN')
 */
export const RequireTenantRole = (scopeRefPath: string, ...roleCodes: string[]) =>
  SetMetadata(REQUIRE_SCOPE_KEY, {
    scope: 'TENANT' as ScopeType,
    scopeRefPath,
    roles: roleCodes,
  });

/**
 * @RequirePropertyRole() Decorator
 * Shorthand for requiring a role at PROPERTY scope
 *
 * Usage:
 * @RequirePropertyRole('params.propertyId', 'BRANCH_MANAGER', 'AGENT')
 */
export const RequirePropertyRole = (scopeRefPath: string, ...roleCodes: string[]) =>
  SetMetadata(REQUIRE_SCOPE_KEY, {
    scope: 'PROPERTY' as ScopeType,
    scopeRefPath,
    roles: roleCodes,
  });

// =====================
// PARAMETER DECORATORS
// =====================

/**
 * @CurrentScope() Parameter Decorator
 * Extracts the current scope context from the request
 *
 * Usage:
 * @Get(':tenantId/users')
 * getUsers(@CurrentScope() scope: { type: ScopeType; refId?: string }) { ... }
 */
export const CurrentScope = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): { type: ScopeType; refId?: string } | null => {
    const request = ctx.switchToHttp().getRequest();
    return request.scope || null;
  },
);

/**
 * @TenantId() Parameter Decorator
 * Extracts the tenant ID from the request
 *
 * Usage:
 * @Get(':tenantId/users')
 * getUsers(@TenantId() tenantId: string) { ... }
 */
export const TenantId = createParamDecorator(
  (data: string = 'tenantId', ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.params?.[data] || request.body?.[data] || request.query?.[data];
  },
);

/**
 * @PropertyId() Parameter Decorator
 * Extracts the property ID from the request
 *
 * Usage:
 * @Get(':propertyId/details')
 * getProperty(@PropertyId() propertyId: string) { ... }
 */
export const PropertyId = createParamDecorator(
  (data: string = 'propertyId', ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.params?.[data] || request.body?.[data] || request.query?.[data];
  },
);
