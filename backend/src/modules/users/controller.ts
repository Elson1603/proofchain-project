import { NextFunction, Request, Response } from 'express'
import { usersService } from './service'

export const usersController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.list())
    } catch (error) {
      next(error)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.getById(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await usersService.create(req.body))
    } catch (error) {
      next(error)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.update(String(req.params.id), req.body))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await usersService.remove(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },
}
