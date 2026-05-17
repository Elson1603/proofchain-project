import { NextFunction, Response } from 'express'
import { AuthenticatedRequest } from '../modules/auth/types'
import { verifyAccessToken } from '../modules/auth/utils'

export function authenticate() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token is required',
      })
    }

    try {
      req.user = verifyAccessToken(token)
      return next()
    } catch (_error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token',
      })
    }
  }
}
