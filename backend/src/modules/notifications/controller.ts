import { NextFunction, Request, Response } from 'express'
import { notificationsService } from './service'

export const notificationsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await notificationsService.list())
    } catch (error) {
      next(error)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await notificationsService.getById(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await notificationsService.create(req.body))
    } catch (error) {
      next(error)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await notificationsService.update(String(req.params.id), req.body))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await notificationsService.remove(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },
}
