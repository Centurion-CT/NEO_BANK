import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentUser() Decorator
 * Extracts the authenticated user from the request
 *
 * Usage:
 * @Get('profile')
 * getProfile(@CurrentUser() user: UserPayload) { ... }
 *
 * @Get('profile')
 * getUserId(@CurrentUser('id') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
