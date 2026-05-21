import { NextFunction, Request, RequestHandler, Response } from 'express'
import prisma from '../config/db'
import { AppError } from '../utils/errors'
import { verifyAccessToken } from '../modules/auth/utils'

function extractBearerToken(req: Request) {
  const authHeader = req.get('authorization')

  if (!authHeader?.trim()) {
    throw new AppError(401, 'Authentication token is required', 'AUTH_TOKEN_REQUIRED')
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim()

  if (!token) {
    throw new AppError(401, 'Authorization header must be in the format: Bearer <token>', 'AUTH_HEADER_INVALID')
  }

  return token
}

async function attachAuthenticatedUser(req: Request) {
  const token = extractBearerToken(req)
  const payload = verifyAccessToken(token)
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, walletAddress: true, role: true },
  })

  if (!user) {
    throw new AppError(401, 'Invalid authentication token', 'AUTH_USER_NOT_FOUND')
  }

  req.user = {
    userId: user.id,
    walletAddress: user.walletAddress,
    role: user.role,
  }
}

export function authenticate(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await attachAuthenticatedUser(req)
      return next()
    } catch (error) {
      return next(error)
    }
  }
}

export function optionalAuthenticate(): RequestHandler {
  const authenticateRequest = authenticate()

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.get('authorization') === undefined) {
      return next()
    }

    return authenticateRequest(req, res, next)
  }
}
