import prisma from '../../config/db'
import { PROJECT_STATUS_TRANSITIONS, PROJECT_STATUSES, ProjectStatus } from './types'

type ProjectListFilters = {
  status?: string
  ownerId?: string
  freelancerId?: string
  invitedFreelancerId?: string
  search?: string
}

type CreateProjectInput = {
  title: string
  description?: string
  budget: number
  deadline?: string
  ownerId: string
  invitedFreelancerId?: string
  milestones?: Array<{ title: string; description?: string; amount: number }>
  status?: ProjectStatus
}

type UpdateProjectInput = {
  title?: string
  description?: string
  budget?: number
  deadline?: string
  status?: ProjectStatus
  invitedFreelancerId?: string | null
  freelancerId?: string | null
}

const parseDeadline = (deadline?: string) => (deadline ? new Date(deadline) : undefined)

const assertTransition = (from: ProjectStatus, to: ProjectStatus) => {
  if (from === to) {
    return
  }

  const allowed = PROJECT_STATUS_TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new Error(`Invalid status transition from ${from} to ${to}`)
  }
}

const ensureValidStatus = (status?: string): status is ProjectStatus => {
  if (!status) {
    return false
  }

  return PROJECT_STATUSES.includes(status as ProjectStatus)
}

export const projectsService = {
  async list(filters: ProjectListFilters = {}) {
    const where: Record<string, unknown> = {}

    if (filters.status) {
      where.status = filters.status
    }

    if (filters.ownerId) {
      where.ownerId = filters.ownerId
    }

    if (filters.freelancerId) {
      where.freelancerId = filters.freelancerId
    }

    if (filters.invitedFreelancerId) {
      where.invitedFreelancerId = filters.invitedFreelancerId
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    return prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        milestones: { orderBy: { createdAt: 'asc' } },
      },
    })
  },

  async getById(id: string) {
    return prisma.project.findUnique({
      where: { id },
      include: {
        milestones: {
          orderBy: { createdAt: 'asc' },
          include: { submissions: true },
        },
      },
    })
  },

  async create(data: CreateProjectInput) {
    const status = data.status ?? 'draft'

    if (!ensureValidStatus(status)) {
      throw new Error('Invalid project status')
    }

    return prisma.project.create({
      data: {
        title: data.title,
        description: data.description,
        status,
        budget: data.budget,
        deadline: parseDeadline(data.deadline),
        ownerId: data.ownerId,
        invitedFreelancerId: data.invitedFreelancerId,
        milestones: data.milestones
          ? {
              create: data.milestones.map((milestone) => ({
                title: milestone.title,
                description: milestone.description,
                amount: milestone.amount,
              })),
            }
          : undefined,
      },
      include: {
        milestones: true,
      },
    })
  },

  async update(id: string, data: UpdateProjectInput) {
    const existing = await prisma.project.findUnique({ where: { id } })

    if (!existing) {
      throw new Error('Project not found')
    }

    if (data.status && ensureValidStatus(data.status)) {
      assertTransition(existing.status as ProjectStatus, data.status)
    }

    if (data.status === 'completed') {
      const remaining = await prisma.milestone.count({
        where: { projectId: id, status: { not: 'completed' } },
      })

      if (remaining > 0) {
        throw new Error('All milestones must be completed before closing the project')
      }
    }

    return prisma.project.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        budget: data.budget,
        deadline: parseDeadline(data.deadline),
        status: data.status,
        invitedFreelancerId: data.invitedFreelancerId,
        freelancerId: data.freelancerId,
      },
    })
  },

  async invite(id: string, invitedFreelancerId: string) {
    const project = await prisma.project.findUnique({ where: { id } })

    if (!project) {
      throw new Error('Project not found')
    }

    if (project.status === 'completed') {
      throw new Error('Completed projects cannot be updated')
    }

    const nextStatus = project.status === 'draft' ? 'open' : (project.status as ProjectStatus)

    if (project.status === 'draft') {
      assertTransition('draft', 'open')
    }

    return prisma.project.update({
      where: { id },
      data: {
        invitedFreelancerId,
        status: nextStatus,
      },
    })
  },

  async accept(id: string, freelancerId: string) {
    const project = await prisma.project.findUnique({ where: { id } })

    if (!project) {
      throw new Error('Project not found')
    }

    if (project.invitedFreelancerId && project.invitedFreelancerId !== freelancerId) {
      throw new Error('Project invitation does not match the freelancer')
    }

    assertTransition(project.status as ProjectStatus, 'in_progress')

    const [updated] = await prisma.$transaction([
      prisma.project.update({
        where: { id },
        data: {
          freelancerId,
          status: 'in_progress',
        },
      }),
      prisma.conversation.upsert({
        where: { projectId: id },
        update: {},
        create: { projectId: id },
      }),
    ])

    return updated
  },

  async submit(id: string) {
    const project = await prisma.project.findUnique({ where: { id } })

    if (!project) {
      throw new Error('Project not found')
    }

    assertTransition(project.status as ProjectStatus, 'submitted')

    return prisma.project.update({
      where: { id },
      data: { status: 'submitted' },
    })
  },

  async approve(id: string) {
    const project = await prisma.project.findUnique({ where: { id } })

    if (!project) {
      throw new Error('Project not found')
    }

    assertTransition(project.status as ProjectStatus, 'approved')

    return prisma.project.update({
      where: { id },
      data: { status: 'approved' },
    })
  },

  async reject(id: string) {
    const project = await prisma.project.findUnique({ where: { id } })

    if (!project) {
      throw new Error('Project not found')
    }

    assertTransition(project.status as ProjectStatus, 'rejected')

    return prisma.project.update({
      where: { id },
      data: { status: 'rejected' },
    })
  },

  async complete(id: string) {
    const project = await prisma.project.findUnique({ where: { id } })

    if (!project) {
      throw new Error('Project not found')
    }

    assertTransition(project.status as ProjectStatus, 'completed')

    const remaining = await prisma.milestone.count({
      where: { projectId: id, status: { not: 'completed' } },
    })

    if (remaining > 0) {
      throw new Error('All milestones must be completed before closing the project')
    }

    return prisma.project.update({
      where: { id },
      data: { status: 'completed' },
    })
  },

  async dispute(id: string) {
    const project = await prisma.project.findUnique({ where: { id } })

    if (!project) {
      throw new Error('Project not found')
    }

    assertTransition(project.status as ProjectStatus, 'disputed')

    return prisma.project.update({
      where: { id },
      data: { status: 'disputed' },
    })
  },

  async remove(id: string) {
    return prisma.project.delete({ where: { id } })
  },
}
