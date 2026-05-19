import prisma from '../../config/db'
import { NotFoundError, PublicProfile, UpdateMyProfileInput, UserProfile } from './types'

const trimOrNull = (value?: string | null) => {
  if (value === null) {
    return null
  }
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const normalizeSkills = (skills?: string[] | null) => {
  if (skills === undefined) {
    return undefined
  }

  if (skills === null) {
    return []
  }

  const normalized = skills
    .map((skill) => skill.trim())
    .filter(Boolean)
    .map((skill) => skill.replace(/\s+/g, ' '))

  return Array.from(new Set(normalized))
}

const userProfileSelect = {
  id: true,
  username: true,
  bio: true,
  avatarUrl: true,
  githubUrl: true,
  linkedinUrl: true,
  portfolioUrl: true,
  skills: true,
  reputationScore: true,
  role: true,
  createdAt: true,
  updatedAt: true,
}

export const profileService = {
  async getMyProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userProfileSelect,
    })

    if (!user) {
      throw new NotFoundError('User not found')
    }

    return user
  },

  async updateMyProfile(userId: string, input: UpdateMyProfileInput): Promise<UserProfile> {
    const data = {
      username: trimOrNull(input.username),
      bio: trimOrNull(input.bio),
      avatarUrl: trimOrNull(input.avatarUrl),
      githubUrl: trimOrNull(input.githubUrl),
      linkedinUrl: trimOrNull(input.linkedinUrl),
      portfolioUrl: trimOrNull(input.portfolioUrl),
      skills: normalizeSkills(input.skills),
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: userProfileSelect,
    })

    return updated
  },

  async getPublicProfile(userId: string): Promise<PublicProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userProfileSelect,
    })

    if (!user) {
      throw new NotFoundError('User not found')
    }

    if (user.role !== 'FREELANCER') {
      throw new NotFoundError('Freelancer profile not found')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { role: _role, ...publicProfile } = user
    return publicProfile
  },
}
