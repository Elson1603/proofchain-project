import rateLimit, { Options } from 'express-rate-limit'
import { Request, Response } from 'express'

function numberFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

type RateLimiterOptions = {
  windowMs: number
  max: number
  message: string
  code: string
  standardHeaders?: Options['standardHeaders']
  legacyHeaders?: boolean
  skipSuccessfulRequests?: boolean
}

function requestId(req: Request) {
  const header = req.headers['x-request-id']
  return typeof header === 'string' ? header : undefined
}

export function createRateLimiter(options: RateLimiterOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: options.standardHeaders ?? 'draft-8',
    legacyHeaders: options.legacyHeaders ?? false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    handler: (req: Request, res: Response) => {
      return res.status(429).json({
        success: false,
        message: options.message,
        code: options.code,
        requestId: requestId(req),
        retryAfter: res.getHeader('Retry-After'),
      })
    },
  })
}

export const globalRateLimiter = createRateLimiter({
  windowMs: numberFromEnv('GLOBAL_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  max: numberFromEnv('GLOBAL_RATE_LIMIT_MAX', 100),
  message: 'Too many requests. Please try again later.',
  code: 'RATE_LIMIT_EXCEEDED',
})

export const authRateLimiter = createRateLimiter({
  windowMs: numberFromEnv('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  max: numberFromEnv('AUTH_RATE_LIMIT_MAX', 100),
  message: 'Too many authentication requests. Please wait before trying again.',
  code: 'AUTH_RATE_LIMIT_EXCEEDED',
})

export const uploadRateLimiter = createRateLimiter({
  windowMs: numberFromEnv('UPLOAD_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  max: numberFromEnv('UPLOAD_RATE_LIMIT_MAX', 30),
  message: 'Too many upload requests. Please try again later.',
  code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
})

export const paymentRateLimiter = createRateLimiter({
  windowMs: numberFromEnv('PAYMENT_RATE_LIMIT_WINDOW_MS', 60 * 1000),
  max: numberFromEnv('PAYMENT_RATE_LIMIT_MAX', 30),
  message: 'Too many payment requests. Please try again later.',
  code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
})

export const adminRateLimiter = createRateLimiter({
  windowMs: numberFromEnv('ADMIN_RATE_LIMIT_WINDOW_MS', 60 * 1000),
  max: numberFromEnv('ADMIN_RATE_LIMIT_MAX', 120),
  message: 'Too many admin requests. Please slow down before continuing.',
  code: 'ADMIN_RATE_LIMIT_EXCEEDED',
})

export const messageRateLimiter = createRateLimiter({
  windowMs: numberFromEnv('MESSAGE_RATE_LIMIT_WINDOW_MS', 10 * 1000),
  max: numberFromEnv('MESSAGE_SEND_RATE_LIMIT', 20),
  message: 'Too many messages. Please slow down.',
  code: 'MESSAGE_RATE_LIMIT_EXCEEDED',
})
