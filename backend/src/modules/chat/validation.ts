import { z } from 'zod'
import { validate } from '../../utils/validation'

const uuid = z.string().uuid('Invalid id')
const messageTypes = ['TEXT', 'FILE', 'SYSTEM'] as const

const targetSchema = z
  .object({
    conversationId: uuid.optional(),
    projectId: uuid.optional(),
  })
  .refine((data) => data.conversationId || data.projectId, {
    message: 'conversationId or projectId is required',
  })

const sendMessageSchema = z.object({
  body: targetSchema.extend({
    content: z.string().max(8000).optional(),
    messageType: z.enum(messageTypes).optional(),
  }),
})

const listMessagesSchema = z.object({
  params: z.object({
    conversationId: uuid,
  }),
  query: z.object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  }),
})

const editMessageSchema = z.object({
  params: z.object({
    id: uuid,
  }),
  body: z.object({
    content: z.string().min(1).max(8000),
  }),
})

const messageIdSchema = z.object({
  params: z.object({
    id: uuid,
  }),
})

const reactSchema = z.object({
  params: z.object({
    id: uuid,
  }),
  body: z.object({
    emoji: z.string().trim().min(1).max(16),
  }),
})

const conversationByProjectSchema = z.object({
  params: z.object({
    projectId: uuid,
  }),
})

const conversationByIdSchema = z.object({
  params: z.object({
    id: uuid,
  }),
})

const conversationSeenSchema = z.object({
  params: z.object({
    id: uuid,
  }),
})

const smartRepliesSchema = conversationByIdSchema

const uploadAttachmentSchema = z.object({
  body: targetSchema.extend({
    content: z.string().max(8000).optional(),
  }),
})

export const validateSendMessage = validate(sendMessageSchema)
export const validateListMessages = validate(listMessagesSchema)
export const validateEditMessage = validate(editMessageSchema)
export const validateMessageId = validate(messageIdSchema)
export const validateReact = validate(reactSchema)
export const validateConversationByProject = validate(conversationByProjectSchema)
export const validateConversationById = validate(conversationByIdSchema)
export const validateConversationSeen = validate(conversationSeenSchema)
export const validateSmartReplies = validate(smartRepliesSchema)
export const validateUploadAttachment = validate(uploadAttachmentSchema)
