import { NextFunction, Request, Response } from 'express'
import { blockchainIndexerService } from './service'

export const blockchainIndexerController = {
  async status(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await blockchainIndexerService.status())
    } catch (error) {
      next(error)
    }
  },

  async run(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await blockchainIndexerService.runOnce())
    } catch (error) {
      next(error)
    }
  },

  async events(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(
        await blockchainIndexerService.listEvents({
          category: typeof req.query.category === 'string' ? (req.query.category as never) : undefined,
          eventName: typeof req.query.eventName === 'string' ? req.query.eventName : undefined,
          txHash: typeof req.query.txHash === 'string' ? req.query.txHash : undefined,
          limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
        }),
      )
    } catch (error) {
      next(error)
    }
  },
}
