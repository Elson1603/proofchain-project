import { NextFunction, Request, Response } from 'express'
import { submissionsService } from './service'

export const submissionsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await submissionsService.list())
    } catch (error) {
      next(error)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await submissionsService.getById(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await submissionsService.create(req.body))
    } catch (error) {
      next(error)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await submissionsService.update(String(req.params.id), req.body))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await submissionsService.remove(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },
}
