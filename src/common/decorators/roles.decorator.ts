import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * @Roles() Decorator
 * Restricts access to users with specified role types
 *
 * Usage:
 * @Roles('admin', 'super_admin')
 * @Get('admin-only')
 * adminEndpoint() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
