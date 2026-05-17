import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import morgan from 'morgan'

dotenv.config()

const app = express()

// Security middleware
app.use(helmet())

// Logging middleware
app.use(morgan('dev'))

// CORS
app.use(cors())

// Parse JSON
app.use(express.json())

// Health check route
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ProofChain Backend Running'
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
})