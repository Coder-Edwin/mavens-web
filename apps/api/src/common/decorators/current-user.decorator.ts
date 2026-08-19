import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  isCoach: boolean;
}

/// Usage: login(@CurrentUser() user: AuthenticatedUser) inside a controller.
/// `request.user` is set by JwtStrategy.validate() once a request passes
/// through JwtAuthGuard.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);
