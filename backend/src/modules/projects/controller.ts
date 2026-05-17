import { NextFunction, Request, Response } from 'express'
import { projectsService } from './service'

export const projectsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        ownerId: typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined,
        freelancerId: typeof req.query.freelancerId === 'string' ? req.query.freelancerId : undefined,
        invitedFreelancerId:
          typeof req.query.invitedFreelancerId === 'string' ? req.query.invitedFreelancerId : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      }

      res.json(await projectsService.list(filters))
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

  async invite(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.invite(String(req.params.id), String(req.body.invitedFreelancerId)))
    } catch (error) {
      next(error)
    }
  },

  async accept(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.accept(String(req.params.id), String(req.body.freelancerId)))
    } catch (error) {
      next(error)
    }
  },

  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.submit(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.approve(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.reject(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.complete(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async dispute(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await projectsService.dispute(String(req.params.id)))
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
