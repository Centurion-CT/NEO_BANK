import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * @RequirePermissions() Decorator
 * Restricts access to users with specified permission codes
 *
 * Usage:
 * @RequirePermissions('users.read', 'users.write')
 * @Get('users')
 * getUsers() { ... }
 */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
