import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import morgan from 'morgan'
import authRoutes from './modules/auth/routes'
import milestonesRoutes from './modules/milestones/routes'
import projectsRoutes from './modules/projects/routes'
import profileRoutes from './modules/profile/routes'
import submissionsRoutes from './modules/submissions/routes'
import paymentsRoutes from './modules/payments/routes'
import nftRoutes from './modules/nft/routes'
import notificationsRoutes from './modules/notifications/routes'
import { attachmentsRouter, conversationsRouter, messagesRouter } from './modules/chat/routes'
import { isAppError } from './utils/errors'

dotenv.config()

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

  app.use(helmet())
  app.use(morgan('dev'))
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.use('/api/auth', authRoutes)
  app.use('/api/profile', profileRoutes)
  app.use('/api/projects', projectsRoutes)
  app.use('/api/milestones', milestonesRoutes)
  app.use('/api/submissions', submissionsRoutes)
  app.use('/api/payments', paymentsRoutes)
  app.use('/api/nft', nftRoutes)
  app.use('/api/notifications', notificationsRoutes)
  app.use('/api/messages', messagesRouter)
  app.use('/api/conversations', conversationsRouter)
  app.use('/api/attachments', attachmentsRouter)

  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'ProofChain Backend Running',
    })
  })

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    })
  })

  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (isAppError(error)) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      })
    }

    console.error(error)

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    })
  })

  return app
}
