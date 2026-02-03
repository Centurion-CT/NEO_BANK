import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * PermissionsGuard
 * Checks if the user has all the required permission codes
 *
 * Note: This guard requires the PermissionsService to be available.
 * It will check permissions dynamically from the database.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequirePermissions('users.read')
 * @Get('users')
 * getUsers() { ... }
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject('PERMISSIONS_SERVICE') private permissionsService: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no permissions are specified, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
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

    // Get user's permissions from the service
    const userPermissions = await this.permissionsService.getUserPermissions(user.id);
    const permissionCodes = userPermissions.map((p: any) => p.code);

    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every((permission) =>
      permissionCodes.includes(permission),
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        (p) => !permissionCodes.includes(p),
      );
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
      });
    }

    return true;
  }
}
