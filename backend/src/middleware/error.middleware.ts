import { NextFunction, Request, Response } from 'express'
import { MulterError } from 'multer'
import { Prisma } from '@prisma/client'
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken'
import { AppError, isAppError } from '../utils/errors'

function isProduction() {
  return process.env.NODE_ENV === 'production'
}

function requestId(req: Request) {
  const header = req.headers['x-request-id']
  return typeof header === 'string' ? header : undefined
}

function logError(error: unknown, req: Request, statusCode: number) {
  const level = statusCode >= 500 ? 'error' : 'warn'
  const payload = {
    requestId: requestId(req),
    method: req.method,
    path: req.originalUrl,
    statusCode,
    error: error instanceof Error ? error.message : String(error),
  }

  if (level === 'error') {
    console.error('[error]', payload, error)
  } else {
    console.warn('[request-warning]', payload)
  }
}

function toAppError(error: unknown) {
  if (isAppError(error)) {
    return error
  }

  if (error && typeof error === 'object' && 'type' in error) {
    const bodyParserError = error as { type?: string; status?: number; statusCode?: number }

    if (bodyParserError.type === 'entity.too.large') {
      return new AppError(413, 'Request body is too large', 'REQUEST_BODY_TOO_LARGE')
    }

    if (bodyParserError.type === 'entity.parse.failed') {
      return new AppError(400, 'Malformed request body', 'REQUEST_BODY_INVALID')
    }

    if (bodyParserError.status === 413 || bodyParserError.statusCode === 413) {
      return new AppError(413, 'Request body is too large', 'REQUEST_BODY_TOO_LARGE')
    }
  }

  if (error instanceof MulterError) {
    return new AppError(400, 'File upload failed', 'UPLOAD_ERROR')
  }

  if (error instanceof TokenExpiredError) {
    return new AppError(401, 'Authentication token expired', 'AUTH_TOKEN_EXPIRED')
  }

  if (error instanceof JsonWebTokenError) {
    return new AppError(401, 'Invalid authentication token', 'AUTH_TOKEN_INVALID')
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new AppError(409, 'Resource already exists', 'UNIQUE_CONSTRAINT')
    }

    if (error.code === 'P2025') {
      return new AppError(404, 'Resource not found', 'RESOURCE_NOT_FOUND')
    }
  }

  return new AppError(500, 'Internal server error', 'INTERNAL_SERVER_ERROR')
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `Route not found: ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND'))
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  const appError = toAppError(error)
  logError(error, req, appError.statusCode)

  return res.status(appError.statusCode).json({
    success: false,
    message: appError.statusCode >= 500 && isProduction() ? 'Internal server error' : appError.message,
    code: appError.code,
    requestId: requestId(req),
    ...(appError.details && !isProduction() ? { errors: appError.details } : {}),
  })
}
