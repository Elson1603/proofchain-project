import { NextFunction, Request, RequestHandler, Response } from 'express'
import { USER_ROLES, UserRole } from '../modules/auth/types'
import { AppError } from '../utils/errors'

function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (USER_ROLES as readonly string[]).includes(role)
}

function validateAllowedRoles(allowedRoles: UserRole[]) {
  if (allowedRoles.length === 0) {
    throw new AppError(500, 'At least one role is required for authorization', 'AUTHZ_ROLES_REQUIRED')
  }

  const invalidRoles = allowedRoles.filter((role) => !isUserRole(role))

  if (invalidRoles.length > 0) {
    throw new AppError(500, 'Invalid authorization role configured', 'AUTHZ_ROLE_INVALID', invalidRoles)
  }
}

export function authorizeRoles(...allowedRoles: UserRole[]): RequestHandler {
  validateAllowedRoles(allowedRoles)

  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication is required', 'AUTH_REQUIRED'))
    }

    if (!isUserRole(req.user.role)) {
      return next(new AppError(403, 'Invalid authenticated user role', 'FORBIDDEN_INVALID_ROLE'))
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'You do not have permission to access this resource', 'FORBIDDEN'))
    }

    return next()
  }
}

export const requireClient = authorizeRoles('CLIENT')
export const requireFreelancer = authorizeRoles('FREELANCER')
export const requireAdmin = authorizeRoles('ADMIN')
export const requireClientOrAdmin = authorizeRoles('CLIENT', 'ADMIN')
export const requireFreelancerOrAdmin = authorizeRoles('FREELANCER', 'ADMIN')
