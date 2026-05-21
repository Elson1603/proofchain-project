import { Request } from 'express'

export const USER_ROLES = ['FREELANCER', 'CLIENT', 'ADMIN'] as const

export type UserRole = (typeof USER_ROLES)[number]

export interface JwtAuthPayload {
  userId: string
  walletAddress: string
  role: UserRole
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtAuthPayload
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: JwtAuthPayload
}

export interface DeviceContext {
  ipAddress?: string
  deviceInfo?: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}
