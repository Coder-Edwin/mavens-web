import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/// Runs AFTER JwtAuthGuard (so request.user already exists).
/// Amwai's dual role — ADMIN with isCoach=true — means an admin with
/// isCoach can pass routes guarded with @Roles('COACH') too, matching the
/// "modeled as role: admin + isCoach flag" decision from the architecture doc.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // route has no @Roles() restriction
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    const effectiveRoles: string[] = [user.role];
    if (user.isCoach) {
      effectiveRoles.push('COACH');
    }

    const authorized = requiredRoles.some((role) => effectiveRoles.includes(role));
    if (!authorized) {
      throw new ForbiddenException('You do not have permission to access this resource');
    }

    return true;
  }
}
