import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard
 * Checks if the user has one of the required role types
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('admin', 'super_admin')
 * @Get('admin-only')
 * adminEndpoint() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are specified, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
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

    // Check if user has any of the required roles
    // The user's roles are populated from userRoles in JWT strategy
    const userRoles: string[] = user.roles || [];

    // Also check the legacy 'role' field for backwards compatibility
    if (user.role && !userRoles.includes(user.role)) {
      userRoles.push(user.role);
    }

    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      });
    }

    return true;
  }
}
