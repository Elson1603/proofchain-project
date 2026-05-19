import type { MessageType, Prisma } from '@prisma/client'
import prisma from '../../config/db'
import type { AttachmentInput } from './interfaces/messaging.types'

const projectMembershipSelect = {
  id: true,
  ownerId: true,
  freelancerId: true,
  invitedFreelancerId: true,
} satisfies Prisma.ProjectSelect

const userSummarySelect = {
  id: true,
  fullName: true,
  username: true,
  avatarUrl: true,
  walletAddress: true,
  role: true,
} satisfies Prisma.UserSelect

const conversationListInclude = {
  project: {
    select: {
      id: true,
      title: true,
      status: true,
      ownerId: true,
      freelancerId: true,
      invitedFreelancerId: true,
      owner: { select: userSummarySelect },
      freelancer: { select: userSummarySelect },
      invitedFreelancer: { select: userSummarySelect },
    },
  },
} satisfies Prisma.ConversationInclude

const messageInclude = {
  sender: {
    select: {
      id: true,
      fullName: true,
      username: true,
      avatarUrl: true,
      walletAddress: true,
      role: true,
    },
  },
  reactions: {
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  reads: {
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { readAt: 'asc' },
  },
  attachments: {
    orderBy: { createdAt: 'asc' },
  },
  conversation: {
    select: {
      id: true,
      projectId: true,
      project: {
        select: projectMembershipSelect,
      },
    },
  },
} satisfies Prisma.MessageInclude

const conversationInclude = {
  project: {
    select: projectMembershipSelect,
  },
} satisfies Prisma.ConversationInclude

export type MessageWithDetails = Prisma.MessageGetPayload<{ include: typeof messageInclude }>
export type ConversationWithProjectDetails = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>
export type ConversationListItem = Prisma.ConversationGetPayload<{ include: typeof conversationListInclude }>

export const messagingRepository = {
  findProjectMembership(projectId: string) {
    return prisma.project.findUnique({
      where: { id: projectId },
      select: projectMembershipSelect,
    })
  },

  findConversation(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: conversationInclude,
    })
  },

  findConversationByProject(projectId: string) {
    return prisma.conversation.findUnique({
      where: { projectId },
      include: conversationInclude,
    })
  },

  upsertConversationByProject(projectId: string) {
    return prisma.conversation.upsert({
      where: { projectId },
      update: {},
      create: { projectId },
      include: conversationInclude,
    })
  },

  listConversationsForUser(userId: string) {
    return prisma.conversation.findMany({
      where: {
        project: {
          OR: [
            { ownerId: userId },
            { freelancerId: userId },
            { invitedFreelancerId: userId },
          ],
        },
      },
      include: conversationListInclude,
      orderBy: { updatedAt: 'desc' },
    })
  },

  listMessages(conversationId: string, limit: number, cursor?: string) {
    return prisma.message.findMany({
      where: { conversationId },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
  },

  findMessage(id: string) {
    return prisma.message.findUnique({
      where: { id },
      include: messageInclude,
    })
  },

  async createMessage(input: {
    conversationId: string
    senderId: string
    content: string
    messageType: MessageType
    attachmentUrl?: string
    attachmentType?: string
  }) {
    const message = await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        content: input.content,
        messageType: input.messageType,
        attachmentUrl: input.attachmentUrl,
        attachmentType: input.attachmentType,
      },
      include: messageInclude,
    })

    await prisma.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    })

    return message
  },

  async createFileMessage(input: {
    conversationId: string
    senderId: string
    content: string
    attachment: AttachmentInput
  }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const message = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          senderId: input.senderId,
          content: input.content,
          messageType: 'FILE',
          attachmentUrl: input.attachment.fileUrl,
          attachmentType: input.attachment.fileType,
          attachments: {
            create: {
              fileName: input.attachment.fileName,
              fileUrl: input.attachment.fileUrl,
              previewUrl: input.attachment.previewUrl,
              downloadUrl: input.attachment.downloadUrl,
              fileType: input.attachment.fileType,
              fileSize: input.attachment.fileSize,
              ipfsCid: input.attachment.ipfsCid,
            },
          },
        },
        include: messageInclude,
      })

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      })

      return message
    })
  },

  updateMessage(id: string, data: { content?: string; isEdited?: boolean; isDeleted?: boolean }) {
    return prisma.message.update({
      where: { id },
      data,
      include: messageInclude,
    })
  },

  markMessageRead(messageId: string, userId: string, readAt = new Date()) {
    return prisma.messageRead.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      update: { readAt },
      create: {
        messageId,
        userId,
        readAt,
      },
      include: {
        message: {
          select: {
            id: true,
            conversation: {
              select: {
                id: true,
                projectId: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    })
  },

  async markConversationRead(conversationId: string, userId: string, readAt = new Date()) {
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isDeleted: false,
        reads: {
          none: { userId },
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!unreadMessages.length) {
      return { count: 0, messageIds: [] as string[], readAt }
    }

    await prisma.messageRead.createMany({
      data: unreadMessages.map((message) => ({
        messageId: message.id,
        userId,
        readAt,
      })),
      skipDuplicates: true,
    })

    return {
      count: unreadMessages.length,
      messageIds: unreadMessages.map((message) => message.id),
      readAt,
    }
  },

  findReaction(messageId: string, userId: string, emoji: string) {
    return prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    })
  },

  createReaction(messageId: string, userId: string, emoji: string) {
    return prisma.messageReaction.create({
      data: { messageId, userId, emoji },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
        message: {
          select: {
            id: true,
            conversation: {
              select: {
                id: true,
                projectId: true,
              },
            },
          },
        },
      },
    })
  },

  deleteReaction(id: string) {
    return prisma.messageReaction.delete({
      where: { id },
    })
  },

  unreadCount(conversationId: string, userId: string) {
    return prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        isDeleted: false,
        reads: {
          none: { userId },
        },
      },
    })
  },

  latestMessage(conversationId: string) {
    return prisma.message.findFirst({
      where: { conversationId },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
    })
  },

  async projectParticipantIds(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        freelancerId: true,
        invitedFreelancerId: true,
      },
    })

    if (!project) {
      return []
    }

    return Array.from(
      new Set([project.ownerId, project.freelancerId, project.invitedFreelancerId].filter(Boolean) as string[]),
    )
  },

  createNotifications(notifications: Array<{ userId: string; title: string; message: string }>) {
    if (!notifications.length) {
      return Promise.resolve({ count: 0 })
    }

    return prisma.notification.createMany({
      data: notifications,
    })
  },

  updateMessageProof(id: string, data: { messageHash: string; blockchainTxHash?: string | null; blockchainProofedAt?: Date }) {
    return prisma.message.update({
      where: { id },
      data,
    })
  },
}
