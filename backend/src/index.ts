import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import morgan from 'morgan'
import authRoutes from './modules/auth/routes'

dotenv.config()

const app = express()

app.set('trust proxy', 1)

// Security middleware
app.use(helmet())

// Logging middleware
app.use(morgan('dev'))

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  }),
)

// Parse JSON
app.use(express.json({ limit: '1mb' }))

app.use('/api/auth', authRoutes)

// Health check route
app.get('/', (req: Request, res: Response) => {
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
  console.error(error)

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
})
