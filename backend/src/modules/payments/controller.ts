import { NextFunction, Request, Response } from 'express'
import { paymentsService } from './service'

export const paymentsController = {
  async execute(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await paymentsService.execute(req.body))
    } catch (error) {
      next(error)
    }
  },

  async retry(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await paymentsService.retry(String(req.params.id), req.body))
    } catch (error) {
      next(error)
    }
  },

  async recover(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await paymentsService.recover(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async poll(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined
      res.json(await paymentsService.pollPendingTransactions(limit))
    } catch (error) {
      next(error)
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
        payerId: typeof req.query.payerId === 'string' ? req.query.payerId : undefined,
        payeeId: typeof req.query.payeeId === 'string' ? req.query.payeeId : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
      }

      res.json(await paymentsService.list(filters))
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
