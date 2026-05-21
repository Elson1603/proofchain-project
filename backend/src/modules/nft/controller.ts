import { NextFunction, Request, Response } from 'express'
import { nftService } from './service'

export const nftController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await nftService.list())
    } catch (error) {
      next(error)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await nftService.getById(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async getByTokenId(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await nftService.getByTokenId(Number(req.params.tokenId)))
    } catch (error) {
      next(error)
    }
  },

  async getByWallet(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await nftService.getByWallet(String(req.params.wallet)))
    } catch (error) {
      next(error)
    }
  },

  async getByProject(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await nftService.getByProject(String(req.params.projectId)))
    } catch (error) {
      next(error)
    }
  },

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await nftService.verifyCertificate(Number(req.params.tokenId)))
    } catch (error) {
      next(error)
    }
  },

  async explorer(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await nftService.getExplorer(Number(req.params.tokenId)))
    } catch (error) {
      next(error)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await nftService.create(req.body))
    } catch (error) {
      next(error)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await nftService.update(String(req.params.id), req.body))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await nftService.remove(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async mint(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await nftService.mintCertificate(req.body))
    } catch (error) {
      next(error)
    }
  },
}
