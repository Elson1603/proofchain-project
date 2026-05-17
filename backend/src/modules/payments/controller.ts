import { NextFunction, Request, Response } from 'express'
import { paymentsService } from './service'

export const paymentsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await paymentsService.list())
    } catch (error) {
      next(error)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await paymentsService.getById(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await paymentsService.create(req.body))
    } catch (error) {
      next(error)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await paymentsService.update(String(req.params.id), req.body))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await paymentsService.remove(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },
}
