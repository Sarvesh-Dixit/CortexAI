/**
 * Role-Based Access Control (RBAC) middleware.
 * 
 * Roles:
 * - admin: Full access to all resources
 * - developer: Standard user, can compress, upload, view own data
 * - researcher: Similar to developer, elevated for research operations
 * - guest: Read-only, limited access
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';

export type UserRole = 'admin' | 'developer' | 'researcher' | 'guest';

export const ROLES: Record<UserRole, UserRole> = {
  admin: 'admin',
  developer: 'developer',
  researcher: 'researcher',
  guest: 'guest',
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  guest: 0,
  developer: 1,
  researcher: 2,
  admin: 3,
};

/**
 * Middleware factory that restricts access to users with specific roles.
 * Usage: router.get('/admin', authenticate, requireRole('admin'), handler)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const userRole = req.user.role as UserRole;
    if (!allowedRoles.includes(userRole)) {
      return next(new AppError(
        `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`,
        403
      ));
    }

    next();
  };
}

/**
 * Middleware factory that allows access to users with roles at or above the specified level.
 * Usage: router.get('/dev-only', authenticate, requireMinRole('developer'), handler)
 */
export function requireMinRole(minRole: UserRole) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const userRole = req.user.role as UserRole;
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole];

    if (userLevel < requiredLevel) {
      return next(new AppError(
        `Requires minimum role: ${minRole}`,
        403
      ));
    }

    next();
  };
}

export function isRoleValid(role: string): role is UserRole {
  return Object.keys(ROLE_HIERARCHY).includes(role);
}
