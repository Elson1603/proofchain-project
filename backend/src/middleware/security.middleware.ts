import crypto from 'crypto'
import express, { NextFunction, Request, Response } from 'express'
import cors, { CorsOptions } from 'cors'
import helmet from 'helmet'
import type { HelmetOptions } from 'helmet'
import morgan from 'morgan'
import { authRateLimiter, globalRateLimiter, paymentRateLimiter } from './rateLimit.middleware'

const { clean: cleanXss } = require('xss-clean/lib/xss') as { clean: (value: unknown) => unknown }
const hpp = require('hpp') as (options?: { whitelist?: string[] }) => express.RequestHandler

function csvEnv(name: string) {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function isProduction() {
  return process.env.NODE_ENV === 'production'
}

function corsOrigin(): CorsOptions['origin'] {
  const configured = csvEnv('CORS_ORIGIN')

  if (configured.length > 0) {
    return configured
  }

  return isProduction() ? false : true
}

function attachRequestId(req: Request, res: Response, next: NextFunction) {
  const existing = req.headers['x-request-id']
  const requestId = typeof existing === 'string' && existing.trim() ? existing : crypto.randomUUID()
  req.headers['x-request-id'] = requestId
  res.setHeader('X-Request-Id', requestId)
  next()
}

function helmetOptions(): HelmetOptions {
  return {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: process.env.HELMET_CSP_DISABLED === 'true' ? false : undefined,
    hsts: isProduction()
      ? {
          maxAge: 15552000,
          includeSubDomains: true,
          preload: false,
        }
      : false,
  }
}

function corsOptions(): CorsOptions {
  return {
    origin: corsOrigin(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 60 * 60,
  }
}

function bodyParserMiddleware() {
  return [
    express.json({ limit: process.env.JSON_BODY_LIMIT ?? '1mb' }),
    express.urlencoded({ extended: false, limit: process.env.URLENCODED_BODY_LIMIT ?? '250kb' }),
  ]
}

function xssCleanMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.body) {
    req.body = cleanXss(req.body)
  }

  if (req.params) {
    req.params = cleanXss(req.params) as typeof req.params
  }

  if (req.query) {
    Object.defineProperty(req, 'query', {
      value: cleanXss(req.query),
      configurable: true,
      enumerable: true,
      writable: true,
    })
  }

  return next()
}

export function setupSecurityMiddleware(app: express.Express) {
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  // Request IDs and logs make security events traceable without exposing secrets.
  app.use(attachRequestId)
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  app.use(helmet(helmetOptions()))
  app.use(cors(corsOptions()))
  app.options(/.*/, cors(corsOptions()))
  app.use(bodyParserMiddleware())
  app.use(globalRateLimiter)
  app.use(xssCleanMiddleware)
  app.use(hpp({ whitelist: csvEnv('HPP_WHITELIST') }))
}

export function setupRouteSecurity(app: express.Express) {
  app.use('/api/auth', authRateLimiter)
  app.use('/api/payments', paymentRateLimiter)
}
