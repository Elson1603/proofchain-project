import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { messageRateLimiter } from '../../middleware/rateLimit.middleware'
import { createSecureUploadMiddleware } from '../../middleware/upload.middleware'
import { messagingController } from './controller'
import {
  validateConversationById,
  validateConversationByProject,
  validateConversationSeen,
  validateEditMessage,
  validateListMessages,
  validateMessageId,
  validateReact,
  validateSendMessage,
  validateSmartReplies,
  validateUploadAttachment,
} from './validation'

const uploadSingle = createSecureUploadMiddleware()

export const messagesRouter = Router()
export const conversationsRouter = Router()
export const attachmentsRouter = Router()

messagesRouter.post('/send', authenticate(), messageRateLimiter, validateSendMessage, messagingController.send)
messagesRouter.patch('/:id/edit', authenticate(), validateEditMessage, messagingController.edit)
messagesRouter.delete('/:id', authenticate(), validateMessageId, messagingController.remove)
messagesRouter.post('/:id/react', authenticate(), validateReact, messagingController.react)
messagesRouter.post('/:id/read', authenticate(), validateMessageId, messagingController.read)
messagesRouter.post('/:id/proof', authenticate(), validateMessageId, messagingController.proof)
messagesRouter.get('/:conversationId', authenticate(), validateListMessages, messagingController.listMessages)

conversationsRouter.get('/', authenticate(), messagingController.listConversations)
conversationsRouter.get(
  '/project/:projectId',
  authenticate(),
  validateConversationByProject,
  messagingController.getConversationByProject,
)
conversationsRouter.post(
  '/:id/read',
  authenticate(),
  validateConversationSeen,
  messagingController.markConversationSeen,
)
conversationsRouter.get(
  '/:id/smart-replies',
  authenticate(),
  validateSmartReplies,
  messagingController.smartReplies,
)
conversationsRouter.get('/:id', authenticate(), validateConversationById, messagingController.getConversation)

attachmentsRouter.post(
  '/upload',
  authenticate(),
  ...uploadSingle,
  validateUploadAttachment,
  messagingController.upload,
)

export default messagesRouter
