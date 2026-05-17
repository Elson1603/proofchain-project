import prisma from '../../config/db'
import { MILESTONE_STATUS_TRANSITIONS, MILESTONE_STATUSES, MilestoneStatus } from './types'

type MilestoneListFilters = {
  projectId?: string
  status?: string
}

type CreateMilestoneInput = {
  projectId: string
  title: string
  description?: string
  amount: number
}

type UpdateMilestoneInput = {
  title?: string
  description?: string
  amount?: number
  status?: MilestoneStatus
}

const ensureValidStatus = (status?: string): status is MilestoneStatus => {
  if (!status) {
    return false
  }

  return MILESTONE_STATUSES.includes(status as MilestoneStatus)
}

const assertTransition = (from: MilestoneStatus, to: MilestoneStatus) => {
  if (from === to) {
    return
  }

  const allowed = MILESTONE_STATUS_TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new Error(`Invalid milestone status transition from ${from} to ${to}`)
  }
}

export const milestonesService = {
  async list(filters: MilestoneListFilters = {}) {
    const where: Record<string, unknown> = {}

    if (filters.projectId) {
      where.projectId = filters.projectId
    }

    if (filters.status) {
      where.status = filters.status
    }

    return prisma.milestone.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { submissions: true },
    })
  },

  async getById(id: string) {
    return prisma.milestone.findUnique({
      where: { id },
      include: { submissions: true },
    })
  },

  async create(data: CreateMilestoneInput) {
    return prisma.milestone.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        amount: data.amount,
      },
    })
  },

  async update(id: string, data: UpdateMilestoneInput) {
    const existing = await prisma.milestone.findUnique({ where: { id } })

    if (!existing) {
      throw new Error('Milestone not found')
    }

    if (data.status && ensureValidStatus(data.status)) {
      assertTransition(existing.status as MilestoneStatus, data.status)
    }

    return prisma.milestone.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        amount: data.amount,
        status: data.status,
      },
    })
  },

  async remove(id: string) {
    return prisma.milestone.delete({ where: { id } })
  },
}
