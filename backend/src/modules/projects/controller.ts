import { NextFunction, Request, Response } from 'express'
import { projectsService } from './service'

export const projectsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.list())
    } catch (error) {
      next(error)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.getById(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await projectsService.create(req.body))
    } catch (error) {
      next(error)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.update(String(req.params.id), req.body))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.remove(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },
}
