import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import authRoutes from './modules/auth/routes'
import milestonesRoutes from './modules/milestones/routes'
import projectsRoutes from './modules/projects/routes'
import profileRoutes from './modules/profile/routes'
import submissionsRoutes from './modules/submissions/routes'
import paymentsRoutes from './modules/payments/routes'
import nftRoutes from './modules/nft/routes'
import notificationsRoutes from './modules/notifications/routes'
import blockchainIndexerRoutes from './modules/blockchain-indexer/routes'
import { attachmentsRouter, conversationsRouter, messagesRouter } from './modules/chat/routes'
import { setupSwaggerDocs } from './docs/swagger'
import { errorHandler, notFoundHandler } from './middleware/error.middleware'
import { setupRouteSecurity, setupSecurityMiddleware } from './middleware/security.middleware'

dotenv.config()

export function createApp() {
  const app = express()

  setupSecurityMiddleware(app)
  setupRouteSecurity(app)
  setupSwaggerDocs(app)

  app.use('/api/auth', authRoutes)
  app.use('/api/profile', profileRoutes)
  app.use('/api/projects', projectsRoutes)
  app.use('/api/milestones', milestonesRoutes)
  app.use('/api/submissions', submissionsRoutes)
  app.use('/api/payments', paymentsRoutes)
  app.use('/api/nft', nftRoutes)
  app.use('/api/notifications', notificationsRoutes)
  app.use('/api/indexer', blockchainIndexerRoutes)
  app.use('/api/messages', messagesRouter)
  app.use('/api/conversations', conversationsRouter)
  app.use('/api/attachments', attachmentsRouter)

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'ProofChain Backend Running',
    })
  })

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
