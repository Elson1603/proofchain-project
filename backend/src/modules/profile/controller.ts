import { NextFunction, Response } from 'express'
import { AuthenticatedRequest } from '../auth/types'
import { profileService } from './service'
import { ApiErrorResponse, NotFoundError } from './types'

function sendError(res: Response, status: number, message: string, errors?: unknown) {
  const payload: ApiErrorResponse = {
    success: false,
    message,
    ...(errors ? { errors } : {}),
  }
  return res.status(status).json(payload)
}

export const profileController = {
  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId
      if (!userId) {
        return sendError(res, 401, 'Authentication token is required')
      }

      const profile = await profileService.getMyProfile(userId)
      return res.json({ success: true, data: profile })
    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendError(res, 404, error.message)
      }
      if (error instanceof Error) {
        return sendError(res, 400, error.message)
      }
      return next(error)
    }
  },

  async updateMe(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId
      if (!userId) {
        return sendError(res, 401, 'Authentication token is required')
      }

      const profile = await profileService.updateMyProfile(userId, req.body)
      return res.json({ success: true, data: profile })
    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendError(res, 404, error.message)
      }
      if (error instanceof Error) {
        return sendError(res, 400, error.message)
      }
      return next(error)
    }
  },

  async getPublic(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const profile = await profileService.getPublicProfile(String(req.params.userId))
      return res.json({ success: true, data: profile })
    } catch (error) {
      if (error instanceof NotFoundError) {
        return sendError(res, 404, error.message)
      }
      if (error instanceof Error) {
        return sendError(res, 400, error.message)
      }
      return next(error)
    }
  },
}
