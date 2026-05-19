import type { Message, MessageType } from '@prisma/client'
import type { JwtAuthPayload } from '../../auth/types'

export type MessagingUser = JwtAuthPayload

export type ProjectMembership = {
  id: string
  ownerId: string
  freelancerId: string | null
  invitedFreelancerId: string | null
}

export type ConversationWithProject = {
  id: string
  projectId: string
  createdAt: Date
  updatedAt: Date
  project: ProjectMembership
}

export type SendMessageInput = {
  conversationId?: string
  projectId?: string
  senderId: string
  content?: string
  messageType?: MessageType
}

export type CreateSystemMessageInput = {
  projectId: string
  senderId: string
  content: string
}

export type AttachmentInput = {
  fileName: string
  fileUrl: string
  previewUrl?: string
  downloadUrl?: string
  fileType: string
  fileSize: number
  ipfsCid?: string
}

export type UploadAttachmentInput = {
  conversationId?: string
  projectId?: string
  senderId: string
  content?: string
  attachment: AttachmentInput
}

export type MessageListOptions = {
  conversationId: string
  user: MessagingUser
  limit?: number
  cursor?: string
}

export type MessagePage = {
  messages: unknown[]
  nextCursor: string | null
  hasMore: boolean
}

export type MessageProofResult = {
  message: Message
  messageHash: string
  txHash: string | null
  submittedOnchain: boolean
}
