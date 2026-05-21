import crypto from 'crypto'
import jwt, { JsonWebTokenError, JwtPayload, SignOptions } from 'jsonwebtoken'
import { getAddress, verifyMessage } from 'ethers'
import { AuthTokens, JwtAuthPayload, UserRole, USER_ROLES } from './types'

const DEFAULT_ACCESS_EXPIRES_IN = '15m'
const DEFAULT_REFRESH_EXPIRES_IN = '30d'

export const NONCE_TTL_MS = 5 * 60 * 1000
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function normalizeWalletAddress(walletAddress: string) {
  return getAddress(walletAddress.trim())
}

export function generateNonce() {
  return crypto.randomBytes(32).toString('hex')
}

export function buildAuthMessage(nonce: string) {
  return `ProofChain Authentication Nonce: ${nonce}`
}

export function recoverSignedWallet(nonce: string, signature: string) {
  return normalizeWalletAddress(verifyMessage(buildAuthMessage(nonce), signature))
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function requireEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

function requireJwtAuthPayload(payload: string | JwtPayload): JwtAuthPayload {
  if (typeof payload === 'string') {
    throw new JsonWebTokenError('Invalid token payload')
  }

  const { userId, walletAddress, role } = payload

  if (typeof userId !== 'string' || typeof walletAddress !== 'string' || !isUserRole(role)) {
    throw new JsonWebTokenError('Invalid token payload')
  }

  return {
    userId,
    walletAddress,
    role,
  }
}

export function signAccessToken(payload: JwtAuthPayload) {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || DEFAULT_ACCESS_EXPIRES_IN) as SignOptions['expiresIn'],
  }

  return jwt.sign(payload, requireEnv('JWT_SECRET'), options)
}

export function signRefreshToken(payload: JwtAuthPayload & { sessionId: string }) {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || DEFAULT_REFRESH_EXPIRES_IN) as SignOptions['expiresIn'],
  }

  return jwt.sign(payload, requireEnv('JWT_REFRESH_SECRET'), options)
}

export function verifyAccessToken(token: string): JwtAuthPayload {
  return requireJwtAuthPayload(jwt.verify(token, requireEnv('JWT_SECRET')))
}

export function verifyRefreshToken(token: string) {
  const payload = jwt.verify(token, requireEnv('JWT_REFRESH_SECRET'))
  const authPayload = requireJwtAuthPayload(payload)

  if (typeof payload === 'string' || typeof payload.sessionId !== 'string') {
    throw new JsonWebTokenError('Invalid token payload')
  }

  return {
    ...authPayload,
    sessionId: payload.sessionId,
  }
}

export function createTokenPair(payload: JwtAuthPayload, sessionId: string): AuthTokens {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({ ...payload, sessionId }),
  }
}

export function getRefreshExpiry() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
}

export function toJwtPayload(user: { id: string; walletAddress: string; role: string }): JwtAuthPayload {
  return {
    userId: user.id,
    walletAddress: user.walletAddress,
    role: user.role as UserRole,
  }
}
