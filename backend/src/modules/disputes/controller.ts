import { NextFunction, Request, Response } from 'express'
import { disputesService } from './service'

export const disputesController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await disputesService.list())
    } catch (error) {
      next(error)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await disputesService.getById(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await disputesService.create(req.body))
    } catch (error) {
      next(error)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await disputesService.update(String(req.params.id), req.body))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await disputesService.remove(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },
}
