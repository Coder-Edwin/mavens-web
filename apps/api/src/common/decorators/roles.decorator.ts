import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/// Usage: @Roles('ADMIN', 'COACH') above a controller method.
/// Read back by RolesGuard to decide whether the current user may proceed.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
