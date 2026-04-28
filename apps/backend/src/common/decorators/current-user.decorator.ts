import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  phone: string;
  role: 'USER' | 'MERCHANT' | 'ADMIN';
  kycTier: 'TIER_0' | 'TIER_1' | 'TIER_2';
}

/**
 * Inject the authenticated user (from JWT payload) into a route handler.
 * Usage: foo(@CurrentUser() user: AuthenticatedUser)
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
