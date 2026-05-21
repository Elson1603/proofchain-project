import type { MessageType } from '@prisma/client'
import { AppError } from '../../utils/errors'
import { messagingRepository, MessageWithDetails } from './repository'
import {
  CreateSystemMessageInput,
  MessageListOptions,
  MessagingUser,
  ProjectMembership,
  SendMessageInput,
  UploadAttachmentInput,
} from './interfaces/messaging.types'
import { sanitizeMessageContent } from './utils/content'
import { buildMessageHash, submitMessageProof } from './utils/proof'
import { messagingEvents } from './sockets/events'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function clampPageSize(limit?: number) {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_PAGE_SIZE
  }

  return Math.min(Math.max(limit, 1), MAX_PAGE_SIZE)
}

function isProjectMember(project: ProjectMembership, user: MessagingUser) {
  if (user.role === 'ADMIN') {
    return true
  }

  return [project.ownerId, project.freelancerId, project.invitedFreelancerId].filter(Boolean).includes(user.userId)
}

function assertOwner(message: MessageWithDetails, user: MessagingUser) {
  if (user.role === 'ADMIN') {
    return
  }

  if (message.senderId !== user.userId) {
    throw new AppError(403, 'Only the message sender can modify this message', 'MESSAGE_OWNER_REQUIRED')
  }
}

function ensureContent(content: string, messageType: MessageType) {
  if (messageType !== 'FILE' && !content.trim()) {
    throw new AppError(400, 'Message content is required', 'MESSAGE_CONTENT_REQUIRED')
  }
}

function getProjectId(message: MessageWithDetails) {
  return message.conversation.projectId
}

async function notifyProjectParticipants(projectId: string, senderId: string, title: string, message: string) {
  const recipients = (await messagingRepository.projectParticipantIds(projectId)).filter((userId) => userId !== senderId)

  const created = await messagingRepository.createNotifications(
    recipients.map((userId) => ({
      userId,
      title,
      message,
      type: 'chat',
    })),
  )

  for (const notification of created) {
    messagingEvents.publish('notification_created', {
      projectId,
      userId: notification.userId,
      type: notification.type,
      notification,
      title: notification.title,
      message: notification.message,
    })
  }
}

export const messagingService = {
  async assertProjectMembership(projectId: string, user: MessagingUser) {
    const project = await messagingRepository.findProjectMembership(projectId)

    if (!project) {
      throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    if (!isProjectMember(project, user)) {
      throw new AppError(403, 'You do not have access to this project chat', 'PROJECT_CHAT_FORBIDDEN')
    }

    return project
  },

  async assertConversationAccess(conversationId: string, user: MessagingUser) {
    const conversation = await messagingRepository.findConversation(conversationId)

    if (!conversation) {
      throw new AppError(404, 'Conversation not found', 'CONVERSATION_NOT_FOUND')
    }

    if (!isProjectMember(conversation.project, user)) {
      throw new AppError(403, 'You do not have access to this conversation', 'CONVERSATION_FORBIDDEN')
    }

    return conversation
  },

  async getOrCreateConversationByProject(projectId: string, user: MessagingUser) {
    await this.assertProjectMembership(projectId, user)
    const conversation = await messagingRepository.upsertConversationByProject(projectId)
    const [unreadCount, latestMessage] = await Promise.all([
      messagingRepository.unreadCount(conversation.id, user.userId),
      messagingRepository.latestMessage(conversation.id),
    ])

    return {
      ...conversation,
      unreadCount,
      latestMessage,
    }
  },

  async getConversation(id: string, user: MessagingUser) {
    const conversation = await messagingRepository.findConversation(id)

    if (conversation) {
      if (!isProjectMember(conversation.project, user)) {
        throw new AppError(403, 'You do not have access to this conversation', 'CONVERSATION_FORBIDDEN')
      }

      const [unreadCount, latestMessage] = await Promise.all([
        messagingRepository.unreadCount(conversation.id, user.userId),
        messagingRepository.latestMessage(conversation.id),
      ])

      return {
        ...conversation,
        unreadCount,
        latestMessage,
      }
    }

    return this.getOrCreateConversationByProject(id, user)
  },

  async listConversations(user: MessagingUser) {
    const conversations = await messagingRepository.listConversationsForUser(user.userId)

    if (!conversations.length) {
      return []
    }

    const summaries = await Promise.all(
      conversations.map(async (conversation) => {
        const [unreadCount, latestMessage] = await Promise.all([
          messagingRepository.unreadCount(conversation.id, user.userId),
          messagingRepository.latestMessage(conversation.id),
        ])

        return {
          ...conversation,
          unreadCount,
          latestMessage,
        }
      }),
    )

    return summaries
  },

  async listMessages(options: MessageListOptions) {
    await this.assertConversationAccess(options.conversationId, options.user)

    const limit = clampPageSize(options.limit)
    const rows = await messagingRepository.listMessages(options.conversationId, limit + 1, options.cursor)
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)

    return {
      messages: page.reverse(),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      hasMore,
    }
  },

  async sendMessage(input: SendMessageInput, user: MessagingUser) {
    if (input.senderId !== user.userId) {
      throw new AppError(403, 'Cannot send a message as another user', 'SENDER_MISMATCH')
    }

    const messageType = input.messageType ?? 'TEXT'

    if (messageType === 'SYSTEM' && user.role !== 'ADMIN') {
      throw new AppError(403, 'Only trusted system actors can create system messages', 'SYSTEM_MESSAGE_FORBIDDEN')
    }

    let conversationId = input.conversationId
    let projectId = input.projectId

    if (!conversationId && !projectId) {
      throw new AppError(400, 'conversationId or projectId is required', 'CHAT_TARGET_REQUIRED')
    }

    if (conversationId) {
      const conversation = await this.assertConversationAccess(conversationId, user)
      projectId = conversation.projectId
    } else if (projectId) {
      const conversation = await this.getOrCreateConversationByProject(projectId, user)
      conversationId = conversation.id
    }

    const content = sanitizeMessageContent(input.content)
    ensureContent(content, messageType)

    const message = await messagingRepository.createMessage({
      conversationId: conversationId as string,
      senderId: input.senderId,
      content,
      messageType,
    })

    const resolvedProjectId = projectId ?? getProjectId(message)
    messagingEvents.publish('receive_message', {
      projectId: resolvedProjectId,
      message,
    })

    await notifyProjectParticipants(
      resolvedProjectId,
      input.senderId,
      messageType === 'SYSTEM' ? 'Project update' : 'New message',
      messageType === 'SYSTEM' ? content : 'A new message was posted in your project chat.',
    )

    return message
  },

  async createSystemMessage(input: CreateSystemMessageInput) {
    const conversation = await messagingRepository.upsertConversationByProject(input.projectId)
    const content = sanitizeMessageContent(input.content)
    ensureContent(content, 'SYSTEM')

    const message = await messagingRepository.createMessage({
      conversationId: conversation.id,
      senderId: input.senderId,
      content,
      messageType: 'SYSTEM',
    })

    messagingEvents.publish('receive_message', {
      projectId: input.projectId,
      message,
    })

    await notifyProjectParticipants(input.projectId, input.senderId, 'Project update', content)
    return message
  },

  async uploadAttachmentMessage(input: UploadAttachmentInput, user: MessagingUser) {
    if (input.senderId !== user.userId) {
      throw new AppError(403, 'Cannot upload a file as another user', 'SENDER_MISMATCH')
    }

    let conversationId = input.conversationId
    let projectId = input.projectId

    if (!conversationId && !projectId) {
      throw new AppError(400, 'conversationId or projectId is required', 'CHAT_TARGET_REQUIRED')
    }

    if (conversationId) {
      const conversation = await this.assertConversationAccess(conversationId, user)
      projectId = conversation.projectId
    } else if (projectId) {
      const conversation = await this.getOrCreateConversationByProject(projectId, user)
      conversationId = conversation.id
    }

    const content = sanitizeMessageContent(input.content) || `Shared ${input.attachment.fileName}`
    const message = await messagingRepository.createFileMessage({
      conversationId: conversationId as string,
      senderId: input.senderId,
      content,
      attachment: input.attachment,
    })

    const resolvedProjectId = projectId ?? getProjectId(message)
    messagingEvents.publish('receive_message', {
      projectId: resolvedProjectId,
      message,
    })
    messagingEvents.publish('file_uploaded', {
      projectId: resolvedProjectId,
      message,
      attachment: input.attachment,
    })

    await notifyProjectParticipants(
      resolvedProjectId,
      input.senderId,
      'File shared',
      `${input.attachment.fileName} was shared in your project chat.`,
    )

    return message
  },

  async editMessage(messageId: string, contentInput: string, user: MessagingUser) {
    const message = await messagingRepository.findMessage(messageId)

    if (!message) {
      throw new AppError(404, 'Message not found', 'MESSAGE_NOT_FOUND')
    }

    if (!isProjectMember(message.conversation.project, user)) {
      throw new AppError(403, 'You do not have access to this message', 'MESSAGE_FORBIDDEN')
    }

    assertOwner(message, user)

    if (message.isDeleted) {
      throw new AppError(400, 'Deleted messages cannot be edited', 'MESSAGE_DELETED')
    }

    const content = sanitizeMessageContent(contentInput)
    ensureContent(content, message.messageType)

    const updated = await messagingRepository.updateMessage(messageId, {
      content,
      isEdited: true,
    })

    messagingEvents.publish('message_edited', {
      projectId: getProjectId(updated),
      message: updated,
    })

    return updated
  },

  async deleteMessage(messageId: string, user: MessagingUser) {
    const message = await messagingRepository.findMessage(messageId)

    if (!message) {
      throw new AppError(404, 'Message not found', 'MESSAGE_NOT_FOUND')
    }

    if (!isProjectMember(message.conversation.project, user)) {
      throw new AppError(403, 'You do not have access to this message', 'MESSAGE_FORBIDDEN')
    }

    assertOwner(message, user)

    const updated = await messagingRepository.updateMessage(messageId, {
      content: '',
      isDeleted: true,
    })

    messagingEvents.publish('message_deleted', {
      projectId: getProjectId(updated),
      messageId,
      message: updated,
    })

    return updated
  },

  async markMessageRead(messageId: string, user: MessagingUser) {
    const message = await messagingRepository.findMessage(messageId)

    if (!message) {
      throw new AppError(404, 'Message not found', 'MESSAGE_NOT_FOUND')
    }

    if (!isProjectMember(message.conversation.project, user)) {
      throw new AppError(403, 'You do not have access to this message', 'MESSAGE_FORBIDDEN')
    }

    const read = await messagingRepository.markMessageRead(messageId, user.userId)

    messagingEvents.publish('message_seen', {
      projectId: getProjectId(message),
      messageId,
      userId: user.userId,
      readAt: read.readAt,
    })
    messagingEvents.publish('conversation_seen', {
      projectId: getProjectId(message),
      conversationId: message.conversationId,
      userId: user.userId,
      messageIds: [messageId],
      readAt: read.readAt,
    })

    return read
  },

  async markConversationSeen(conversationId: string, user: MessagingUser) {
    const conversation = await this.assertConversationAccess(conversationId, user)
    const result = await messagingRepository.markConversationRead(conversationId, user.userId)

    messagingEvents.publish('conversation_seen', {
      projectId: conversation.projectId,
      conversationId,
      userId: user.userId,
      messageIds: result.messageIds,
      readAt: result.readAt,
    })

    return result
  },

  async toggleReaction(messageId: string, emoji: string, user: MessagingUser) {
    const message = await messagingRepository.findMessage(messageId)

    if (!message) {
      throw new AppError(404, 'Message not found', 'MESSAGE_NOT_FOUND')
    }

    if (!isProjectMember(message.conversation.project, user)) {
      throw new AppError(403, 'You do not have access to this message', 'MESSAGE_FORBIDDEN')
    }

    const existing = await messagingRepository.findReaction(messageId, user.userId, emoji)

    if (existing) {
      await messagingRepository.deleteReaction(existing.id)
      messagingEvents.publish('reaction_removed', {
        projectId: getProjectId(message),
        messageId,
        userId: user.userId,
        emoji,
      })

      return {
        action: 'removed' as const,
        reaction: existing,
      }
    }

    const reaction = await messagingRepository.createReaction(messageId, user.userId, emoji)
    messagingEvents.publish('reaction_added', {
      projectId: getProjectId(message),
      messageId,
      reaction,
    })

    return {
      action: 'added' as const,
      reaction,
    }
  },

  async createMessageProof(messageId: string, user: MessagingUser) {
    const message = await messagingRepository.findMessage(messageId)

    if (!message) {
      throw new AppError(404, 'Message not found', 'MESSAGE_NOT_FOUND')
    }

    if (!isProjectMember(message.conversation.project, user)) {
      throw new AppError(403, 'You do not have access to this message', 'MESSAGE_FORBIDDEN')
    }

    if (message.isDeleted) {
      throw new AppError(400, 'Deleted messages cannot be proofed', 'MESSAGE_DELETED')
    }

    const messageHash =
      message.messageHash ??
      buildMessageHash({
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        createdAt: message.createdAt,
      })

    const txHash = message.blockchainTxHash ?? (await submitMessageProof(messageHash))
    const updated = await messagingRepository.updateMessageProof(message.id, {
      messageHash,
      blockchainTxHash: txHash,
      blockchainProofedAt: txHash ? new Date() : message.blockchainProofedAt ?? undefined,
    })

    return {
      message: updated,
      messageHash,
      txHash,
      submittedOnchain: Boolean(txHash),
    }
  },

  async getSmartReplies(conversationId: string, user: MessagingUser) {
    await this.assertConversationAccess(conversationId, user)
    const page = await this.listMessages({ conversationId, user, limit: 8 })
    const messages = page.messages as MessageWithDetails[]
    const last = messages[messages.length - 1]
    const localAiUrl = process.env.SMART_REPLY_SERVICE_URL

    if (localAiUrl) {
      const response = await fetch(localAiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          messages: messages.map((message) => ({
            role: message.senderId === user.userId ? 'self' : 'other',
            content: message.content,
            messageType: message.messageType,
          })),
        }),
      })

      if (response.ok) {
        const payload = (await response.json()) as { suggestions?: unknown }
        if (Array.isArray(payload.suggestions)) {
          return payload.suggestions.filter((item): item is string => typeof item === 'string').slice(0, 3)
        }
      }
    }

    if (last?.messageType === 'FILE') {
      return ['I will review the file shortly.', 'Thanks, I will check the deliverable.', 'Can you confirm the final version?']
    }

    const text = last?.content.toLowerCase() ?? ''
    if (text.includes('milestone')) {
      return ['I will review this milestone soon.', 'Please upload the final deliverables.', 'This looks ready for approval.']
    }

    if (text.includes('payment') || text.includes('approve')) {
      return ['Approved from my side.', 'I will check the payment status.', 'Thanks, I will confirm once it clears.']
    }

    return ['Sounds good.', 'I will take a look and get back shortly.', 'Can you share a bit more detail?']
  },
}

export const chatService = messagingService
