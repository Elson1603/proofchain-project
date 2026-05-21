import type { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import { emitSubmissionUploaded } from '../../socket/events'
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
    })
  },

  async getById(id: string) {
    return prisma.submission.findUnique({ where: { id } })
  },

  async create(data: CreateSubmissionInput) {
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
