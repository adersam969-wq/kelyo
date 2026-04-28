import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../modules/users/entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to specific roles.
 * Usage: @Roles(UserRole.ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
