import type { Prisma } from '@prisma/client'
import prisma from '../../config/db'

const safeUserSelect = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  walletAddress: true,
  avatarUrl: true,
  bio: true,
  isVerified: true,
  role: true,
  githubUrl: true,
  linkedinUrl: true,
  portfolioUrl: true,
  skills: true,
  reputationScore: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

export const usersService = {
  async list() {
    return prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: safeUserSelect,
    })
  },

  async getById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    })
  },

  async create(data: Record<string, unknown>) {
    return prisma.user.create({
      data: data as Parameters<typeof prisma.user.create>[0]['data'],
      select: safeUserSelect,
    })
  },

  async update(id: string, data: Record<string, unknown>) {
    return prisma.user.update({
      where: { id },
      data: data as Parameters<typeof prisma.user.update>[0]['data'],
      select: safeUserSelect,
    })
  },

  async remove(id: string) {
    return prisma.user.delete({
      where: { id },
      select: safeUserSelect,
    })
  },
}
