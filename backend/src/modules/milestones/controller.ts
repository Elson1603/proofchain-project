import { NextFunction, Request, Response } from 'express'
import { milestonesService } from './service'

export const milestonesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
      }

      res.json(await milestonesService.list(filters))
    } catch (error) {
      next(error)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await milestonesService.getById(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await milestonesService.create(req.body))
    } catch (error) {
      next(error)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await milestonesService.update(String(req.params.id), req.body))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await milestonesService.remove(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },
}
