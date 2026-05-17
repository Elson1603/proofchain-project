import { NextFunction, Response } from 'express'
import { AuthenticatedRequest, UserRole } from '../modules/auth/types'

export function authorizeRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication is required',
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource',
      })
    }

    return next()
  }
}
