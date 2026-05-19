import type { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import {
  DeviceContext,
  UserRole,
} from './types'
import {
  NONCE_TTL_MS,
  createTokenPair,
  generateNonce,
  getRefreshExpiry,
  hashToken,
  normalizeWalletAddress,
  recoverSignedWallet,
  signAccessToken,
  toJwtPayload,
  verifyRefreshToken,
} from './utils'

function sanitizeUser(user: {
  id: string
  walletAddress: string
  username: string | null
  fullName: string | null
  email: string | null
  profileImage: string | null
  bio: string | null
  profileMetadata: unknown
  reputationScore: number
  role: string
  isVerified: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: user.id,
    walletAddress: user.walletAddress,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    profileImage: user.profileImage,
    bio: user.bio,
    profileMetadata: user.profileMetadata,
    reputationScore: user.reputationScore,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

async function findUserByAnyWallet(walletAddress: string) {
  const primaryWalletUser = await prisma.user.findUnique({
    where: { walletAddress },
  })

  if (primaryWalletUser) {
    return primaryWalletUser
  }

  const linkedWallet = await prisma.userWallet.findUnique({
    where: { walletAddress },
    include: {
      user: true,
    },
  })

  return linkedWallet?.user ?? null
}

export const authService = {
  async requestNonce(walletAddressInput: string) {
    const walletAddress = normalizeWalletAddress(walletAddressInput)
    const nonce = generateNonce()
    const nonceExpiresAt = new Date(Date.now() + NONCE_TTL_MS)
    const linkedUser = await findUserByAnyWallet(walletAddress)

    if (linkedUser) {
      await prisma.user.update({
        where: { id: linkedUser.id },
        data: {
          nonce,
          nonceExpiresAt,
        },
      })

      return {
        walletAddress,
        nonce,
        message: `ProofChain Authentication Nonce: ${nonce}`,
        expiresAt: nonceExpiresAt,
      }
    }

    await prisma.user.upsert({
      where: { walletAddress },
      update: {
        nonce,
        nonceExpiresAt,
      },
      create: {
        walletAddress,
        nonce,
        nonceExpiresAt,
        role: 'FREELANCER',
      },
    })

    return {
      walletAddress,
      nonce,
      message: `ProofChain Authentication Nonce: ${nonce}`,
      expiresAt: nonceExpiresAt,
    }
  },

  async verifySignature(
    walletAddressInput: string,
    signature: string,
    role: UserRole,
    deviceContext: DeviceContext,
  ) {
    const walletAddress = normalizeWalletAddress(walletAddressInput)
    const now = new Date()

    const user = await findUserByAnyWallet(walletAddress)

    if (!user?.nonce || !user.nonceExpiresAt) {
      throw new Error('Nonce was not requested or has already been used')
    }

    if (user.nonceExpiresAt <= now) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          nonce: null,
          nonceExpiresAt: null,
        },
      })

      throw new Error('Nonce has expired')
    }

    const recoveredAddress = recoverSignedWallet(user.nonce, signature)

    if (recoveredAddress !== walletAddress) {
      throw new Error('Signature verification failed')
    }

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const nonceInvalidation = await tx.user.updateMany({
        where: {
          id: user.id,
          nonce: user.nonce,
          nonceExpiresAt: {
            gt: now,
          },
        },
        data: {
          nonce: null,
          nonceExpiresAt: null,
          isVerified: true,
          role: user.isVerified ? user.role : role,
        },
      })

      if (nonceInvalidation.count !== 1) {
        throw new Error('Nonce has already been used')
      }

      const verifiedUser = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      })

      await tx.userWallet.upsert({
        where: { walletAddress },
        update: {
          userId: verifiedUser.id,
          isPrimary: walletAddress === verifiedUser.walletAddress,
        },
        create: {
          userId: verifiedUser.id,
          walletAddress,
          isPrimary: walletAddress === verifiedUser.walletAddress,
        },
      })

      const session = await tx.session.create({
        data: {
          userId: verifiedUser.id,
          refreshToken: hashToken(generateNonce()),
          deviceInfo: deviceContext.deviceInfo,
          ipAddress: deviceContext.ipAddress,
          expiresAt: getRefreshExpiry(),
        },
      })

      const payload = toJwtPayload(verifiedUser)
      const tokens = createTokenPair(payload, session.id)

      const persistedSession = await tx.session.update({
        where: { id: session.id },
        data: {
          refreshToken: hashToken(tokens.refreshToken),
        },
      })

      return {
        user: verifiedUser,
        session: persistedSession,
        tokens,
      }
    })

    return {
      user: sanitizeUser(result.user),
      session: result.session,
      ...result.tokens,
    }
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken)
    const tokenHash = hashToken(refreshToken)

    const session = await prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.userId,
        refreshToken: tokenHash,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    })

    if (!session) {
      throw new Error('Invalid or expired refresh token')
    }

    return {
      accessToken: signAccessToken(toJwtPayload(session.user)),
      user: sanitizeUser(session.user),
    }
  },

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new Error('User not found')
    }

    return sanitizeUser(user)
  },

  async listSessions(userId: string) {
    return prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  },

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken)

    await prisma.session.deleteMany({
      where: {
        refreshToken: tokenHash,
      },
    })

    return { success: true }
  },

  async revokeSession(userId: string, sessionId: string) {
    await prisma.session.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    })

    return { success: true }
  },

  async requestLinkWalletNonce(userId: string) {
    const nonce = generateNonce()
    const nonceExpiresAt = new Date(Date.now() + NONCE_TTL_MS)

    await prisma.user.update({
      where: { id: userId },
      data: {
        nonce,
        nonceExpiresAt,
      },
    })

    return {
      nonce,
      message: `ProofChain Authentication Nonce: ${nonce}`,
      expiresAt: nonceExpiresAt,
    }
  },

  async linkWallet(userId: string, walletAddressInput: string, nonce: string, signature: string) {
    const walletAddress = normalizeWalletAddress(walletAddressInput)
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user?.nonce || !user.nonceExpiresAt || user.nonce !== nonce) {
      throw new Error('Wallet linking nonce was not requested or has already been used')
    }

    if (user.nonceExpiresAt <= new Date()) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          nonce: null,
          nonceExpiresAt: null,
        },
      })

      throw new Error('Wallet linking nonce has expired')
    }

    const recoveredAddress = recoverSignedWallet(nonce, signature)

    if (recoveredAddress !== walletAddress) {
      throw new Error('Signature verification failed')
    }

    const existingWallet = await prisma.userWallet.findUnique({
      where: { walletAddress },
    })

    if (existingWallet && existingWallet.userId !== userId) {
      throw new Error('Wallet is already linked to another user')
    }

    const existingPrimaryWalletUser = await prisma.user.findUnique({
      where: { walletAddress },
    })

    if (existingPrimaryWalletUser && existingPrimaryWalletUser.id !== userId) {
      throw new Error('Wallet is already linked to another user')
    }

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const nonceInvalidation = await tx.user.updateMany({
        where: {
          id: userId,
          nonce,
          nonceExpiresAt: {
            gt: new Date(),
          },
        },
        data: {
          nonce: null,
          nonceExpiresAt: null,
        },
      })

      if (nonceInvalidation.count !== 1) {
        throw new Error('Wallet linking nonce has already been used')
      }

      const linkedWallet = await tx.userWallet.upsert({
        where: { walletAddress },
        update: {
          userId,
        },
        create: {
          userId,
          walletAddress,
          isPrimary: false,
        },
        select: {
          id: true,
          walletAddress: true,
          isPrimary: true,
          linkedAt: true,
        },
      })

      return linkedWallet
    })
  },
}
