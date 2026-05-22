import { Request } from 'express'

export const USER_ROLES = [
  'FREELANCER',
  'CLIENT',
  'ADMIN',
  'SUPER_ADMIN',
  'MODERATOR',
  'SUPPORT_ADMIN',
  'BLOCKCHAIN_ADMIN',
] as const

export const PUBLIC_AUTH_ROLES = ['FREELANCER', 'CLIENT'] as const
export const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_ADMIN', 'BLOCKCHAIN_ADMIN'] as const

export type UserRole = (typeof USER_ROLES)[number]
export type PublicAuthRole = (typeof PUBLIC_AUTH_ROLES)[number]
export type AdminRole = (typeof ADMIN_ROLES)[number]

export function isAdminRole(role: unknown): role is AdminRole {
  return typeof role === 'string' && (ADMIN_ROLES as readonly string[]).includes(role)
}

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
