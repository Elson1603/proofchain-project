import { NextFunction, Response } from 'express'
import type { AuthenticatedRequest } from '../auth/types'
import { notificationsService } from './service'

export const notificationsController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication is required' })
      }

      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
      const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined
      const unreadOnly = typeof req.query.unreadOnly === 'string' ? req.query.unreadOnly === 'true' : undefined

      res.json(
        await notificationsService.list({
          userId,
          limit,
          offset,
          unreadOnly,
        }),
      )
    } catch (error) {
      next(error)
    }
  },

  async unreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication is required' })
      }

      res.json({ count: await notificationsService.unreadCount(userId) })
    } catch (error) {
      next(error)
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication is required' })
      }

      res.json(await notificationsService.getById(userId, String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = typeof req.body.userId === 'string' ? req.body.userId : req.user?.userId
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' })
      }

      res.status(201).json(
        await notificationsService.create({
          userId,
          title: String(req.body.title ?? ''),
          message: String(req.body.message ?? ''),
          type: typeof req.body.type === 'string' ? req.body.type : undefined,
          actionUrl: typeof req.body.actionUrl === 'string' ? req.body.actionUrl : undefined,
          metadata: req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : undefined,
        }),
      )
    } catch (error) {
      next(error)
    }
  },

  async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication is required' })
      }

      res.json(await notificationsService.markRead(userId, String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication is required' })
      }

      res.json(await notificationsService.markAllRead(userId))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication is required' })
      }

      res.json(await notificationsService.remove(userId, String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },
}
