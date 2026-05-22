import { NextFunction, Request, Response } from 'express'
import { adminService } from './service'
import type { AdminRequestContext } from './types'

function context(req: Request): AdminRequestContext {
  return {
    adminId: req.user?.userId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  }
}

function send(res: Response, data: unknown, status = 200) {
  return res.status(status).json({
    success: true,
    data,
  })
}

export const adminController = {
  async users(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.listUsers(req.query as any))
    } catch (error) {
      return next(error)
    }
  },

  async userActivity(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.getUserActivity(String(req.params.id)))
    } catch (error) {
      return next(error)
    }
  },

  async suspendUser(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.suspendUser(String(req.params.id), req.body, context(req)))
    } catch (error) {
      return next(error)
    }
  },

  async verifyUser(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.verifyUser(String(req.params.id), req.body, context(req)))
    } catch (error) {
      return next(error)
    }
  },

  async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.updateUserRole(String(req.params.id), req.body, context(req)))
    } catch (error) {
      return next(error)
    }
  },

  async resetReputation(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.resetReputation(String(req.params.id), req.body, context(req)))
    } catch (error) {
      return next(error)
    }
  },

  async flagUser(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.flagUser(String(req.params.id), req.body, context(req)), 201)
    } catch (error) {
      return next(error)
    }
  },

  async projects(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.listProjects(req.query as any))
    } catch (error) {
      return next(error)
    }
  },

  async project(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.getProject(String(req.params.id)))
    } catch (error) {
      return next(error)
    }
  },

  async closeProject(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.forceCloseProject(String(req.params.id), req.body, context(req)))
    } catch (error) {
      return next(error)
    }
  },

  async disputes(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.listDisputes(req.query as any))
    } catch (error) {
      return next(error)
    }
  },

  async dispute(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.getDispute(String(req.params.id)))
    } catch (error) {
      return next(error)
    }
  },

  async createDispute(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.createDispute(req.body, context(req)), 201)
    } catch (error) {
      return next(error)
    }
  },

  async resolveDispute(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.resolveDispute(String(req.params.id), req.body, context(req)))
    } catch (error) {
      return next(error)
    }
  },

  async transactions(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.listTransactions(req.query as any))
    } catch (error) {
      return next(error)
    }
  },

  async transaction(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.getTransaction(String(req.params.txHash)))
    } catch (error) {
      return next(error)
    }
  },

  async retryTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.retryTransaction(String(req.params.txHash), req.body, context(req)))
    } catch (error) {
      return next(error)
    }
  },

  async syncTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.syncTransactions(context(req)))
    } catch (error) {
      return next(error)
    }
  },

  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const days = typeof req.query.days === 'string' ? Number(req.query.days) : undefined
      return send(res, await adminService.overview(days))
    } catch (error) {
      return next(error)
    }
  },

  async paymentAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const days = typeof req.query.days === 'string' ? Number(req.query.days) : undefined
      return send(res, await adminService.paymentAnalytics(days))
    } catch (error) {
      return next(error)
    }
  },

  async nftAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const days = typeof req.query.days === 'string' ? Number(req.query.days) : undefined
      return send(res, await adminService.nftAnalytics(days))
    } catch (error) {
      return next(error)
    }
  },

  async fraudAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.listFraudAlerts(req.query as any))
    } catch (error) {
      return next(error)
    }
  },

  async runFraudScan(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.runFraudScan(context(req)))
    } catch (error) {
      return next(error)
    }
  },

  async auditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      return send(res, await adminService.listAuditLogs(req.query as any))
    } catch (error) {
      return next(error)
    }
  },
}
