import type { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import { emitSubmissionUploaded } from '../../socket/events'
import { AppError } from '../../utils/errors'
import { notificationsService } from '../notifications/service'

type SubmissionListFilters = {
  milestoneId?: string
  submittedById?: string
}

type CreateSubmissionInput = {
  milestoneId: string
  submittedById: string
  githubLink?: string
  demoLink?: string
  remarks?: string
}

type CreateFileSubmissionInput = {
  milestoneId: string
  submittedById: string
  remarks?: string
  ipfsCid: string
  fileName: string
  fileSize: number
  mimeType: string
}

type UpdateSubmissionInput = {
  githubLink?: string
  demoLink?: string
  remarks?: string
}

async function assertFreelancerCanSubmit(milestoneId: string, submittedById: string) {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      project: {
        select: {
          id: true,
          freelancerId: true,
          ownerId: true,
        },
      },
    },
  })

  if (!milestone) {
    throw new AppError(404, 'Milestone not found', 'MILESTONE_NOT_FOUND')
  }

  if (milestone.project.ownerId === submittedById) {
    throw new AppError(403, 'Clients cannot submit freelancer deliverables', 'CLIENT_SUBMISSION_FORBIDDEN')
  }

  if (!milestone.project.freelancerId) {
    throw new AppError(403, 'Accept the project before submitting work', 'PROJECT_ACCEPTANCE_REQUIRED')
  }

  if (milestone.project.freelancerId !== submittedById) {
    throw new AppError(403, 'Only the assigned freelancer can submit work for this milestone', 'FREELANCER_SUBMISSION_FORBIDDEN')
  }

  return milestone
}

export const submissionsService = {
  async list(filters: SubmissionListFilters = {}) {
    const where: Record<string, unknown> = {}

    if (filters.milestoneId) {
      where.milestoneId = filters.milestoneId
    }

    if (filters.submittedById) {
      where.submittedById = filters.submittedById
    }

    return prisma.submission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        submittedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
            walletAddress: true,
            avatarUrl: true,
            role: true,
          },
        },
        milestone: {
          include: {
            project: {
              include: {
                owner: {
                  select: {
                    id: true,
                    fullName: true,
                    username: true,
                    walletAddress: true,
                    avatarUrl: true,
                    role: true,
                  },
                },
                freelancer: {
                  select: {
                    id: true,
                    fullName: true,
                    username: true,
                    walletAddress: true,
                    avatarUrl: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    })
  },

  async getById(id: string) {
    return prisma.submission.findUnique({
      where: { id },
      include: {
        submittedBy: {
          select: {
            id: true,
            fullName: true,
            username: true,
            walletAddress: true,
            avatarUrl: true,
            role: true,
          },
        },
        milestone: {
          include: {
            project: true,
          },
        },
      },
    })
  },

  async create(data: CreateSubmissionInput) {
    await assertFreelancerCanSubmit(data.milestoneId, data.submittedById)

    const submission = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const submission = await tx.submission.create({
        data: {
          milestoneId: data.milestoneId,
          submittedById: data.submittedById,
          githubLink: data.githubLink,
          demoLink: data.demoLink,
          remarks: data.remarks,
        },
      })

      await tx.milestone.update({
        where: { id: data.milestoneId },
        data: { status: 'submitted' },
      })

      return submission
    })

    try {
      const enriched = await prisma.submission.findUnique({
        where: { id: submission.id },
        include: {
          milestone: {
            include: {
              project: true,
            },
          },
        },
      })

      const project = enriched?.milestone?.project
      if (project) {
        await notificationsService.sendWorkSubmittedNotification({
          userId: project.ownerId,
          projectTitle: project.title,
          milestoneTitle: enriched?.milestone?.title,
          projectId: project.id,
          milestoneId: enriched?.milestoneId,
          submissionId: submission.id,
        })

        emitSubmissionUploaded({
          submissionId: submission.id,
          projectId: project.id,
          uploaderId: data.submittedById,
          ipfsCid: submission.ipfsCid ?? undefined,
          uploadedAt: submission.createdAt.toISOString(),
        })
      }
    } catch (error) {
      console.error('Failed to emit submission notification', error)
    }

    return submission
  },

  async createFileSubmission(data: CreateFileSubmissionInput) {
    await assertFreelancerCanSubmit(data.milestoneId, data.submittedById)

    const submission = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const latestVersion = await tx.submission.findFirst({
        where: {
          milestoneId: data.milestoneId,
          submittedById: data.submittedById,
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      })

      const nextVersion = (latestVersion?.version ?? 0) + 1

      const submission = await tx.submission.create({
        data: {
          milestoneId: data.milestoneId,
          submittedById: data.submittedById,
          remarks: data.remarks,
          ipfsCid: data.ipfsCid,
          fileName: data.fileName,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
          version: nextVersion,
        },
      })

      await tx.milestone.update({
        where: { id: data.milestoneId },
        data: { status: 'submitted' },
      })

      return submission
    })

    try {
      const enriched = await prisma.submission.findUnique({
        where: { id: submission.id },
        include: {
          milestone: {
            include: {
              project: true,
            },
          },
        },
      })

      const project = enriched?.milestone?.project
      if (project) {
        await notificationsService.sendWorkSubmittedNotification({
          userId: project.ownerId,
          projectTitle: project.title,
          milestoneTitle: enriched?.milestone?.title,
          projectId: project.id,
          milestoneId: enriched?.milestoneId,
          submissionId: submission.id,
        })

        emitSubmissionUploaded({
          submissionId: submission.id,
          projectId: project.id,
          uploaderId: data.submittedById,
          ipfsCid: submission.ipfsCid ?? undefined,
          uploadedAt: submission.createdAt.toISOString(),
        })
      }
    } catch (error) {
      console.error('Failed to emit submission notification', error)
    }

    return submission
  },

  async update(id: string, data: UpdateSubmissionInput) {
    return prisma.submission.update({
      where: { id },
      data: {
        githubLink: data.githubLink,
        demoLink: data.demoLink,
        remarks: data.remarks,
      },
    })
  },

  async remove(id: string) {
    return prisma.submission.delete({ where: { id } })
  },
}
