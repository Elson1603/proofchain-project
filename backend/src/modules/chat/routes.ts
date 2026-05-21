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

/**
 * @openapi
 * /api/messages/send:
 *   post:
 *     tags: [Chat]
 *     summary: Send a message
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             anyOf:
 *               - required: [conversationId]
 *               - required: [projectId]
 *             properties:
 *               conversationId:
 *                 type: string
 *                 format: uuid
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *                 maxLength: 8000
 *               messageType:
 *                 type: string
 *                 enum: [TEXT, FILE, SYSTEM]
 *           example:
 *             projectId: "17696acb-df61-41f0-a08d-6f024bf9acda"
 *             content: "I uploaded the milestone deliverables."
 *             messageType: "TEXT"
 *     responses:
 *       200:
 *         description: Message sent.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *
 * /api/messages/{conversationId}:
 *   get:
 *     tags: [Chat]
 *     summary: List messages in a conversation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Conversation messages.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/messages/{id}/edit:
 *   patch:
 *     tags: [Chat]
 *     summary: Edit a message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 8000
 *           example:
 *             content: "Updated message content."
 *     responses:
 *       200:
 *         description: Message edited.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/messages/{id}/react:
 *   post:
 *     tags: [Chat]
 *     summary: React to a message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emoji]
 *             properties:
 *               emoji:
 *                 type: string
 *                 maxLength: 16
 *           example:
 *             emoji: "+1"
 *     responses:
 *       200:
 *         description: Reaction toggled.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/messages/{id}/read:
 *   post:
 *     tags: [Chat]
 *     summary: Mark a message as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Message marked read.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/messages/{id}/proof:
 *   post:
 *     tags: [Chat]
 *     summary: Generate message proof
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Message proof generated.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/messages/{id}:
 *   delete:
 *     tags: [Chat]
 *     summary: Delete a message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Message deleted.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
messagesRouter.post('/send', authenticate(), messageRateLimiter, validateSendMessage, messagingController.send)
messagesRouter.patch('/:id/edit', authenticate(), validateEditMessage, messagingController.edit)
messagesRouter.delete('/:id', authenticate(), validateMessageId, messagingController.remove)
messagesRouter.post('/:id/react', authenticate(), validateReact, messagingController.react)
messagesRouter.post('/:id/read', authenticate(), validateMessageId, messagingController.read)
messagesRouter.post('/:id/proof', authenticate(), validateMessageId, messagingController.proof)
messagesRouter.get('/:conversationId', authenticate(), validateListMessages, messagingController.listMessages)

/**
 * @openapi
 * /api/conversations:
 *   get:
 *     tags: [Chat]
 *     summary: List conversations for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversation collection.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/conversations/project/{projectId}:
 *   get:
 *     tags: [Chat]
 *     summary: Get conversation for a project
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Project conversation.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/conversations/{id}:
 *   get:
 *     tags: [Chat]
 *     summary: Get conversation by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conversation details.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/conversations/{id}/read:
 *   post:
 *     tags: [Chat]
 *     summary: Mark conversation as seen
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Conversation marked seen.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/conversations/{id}/smart-replies:
 *   get:
 *     tags: [Chat]
 *     summary: Generate smart reply suggestions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Smart reply suggestions.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
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

/**
 * @openapi
 * /api/attachments/upload:
 *   post:
 *     tags: [Chat]
 *     summary: Upload a chat attachment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             anyOf:
 *               - required: [file, conversationId]
 *               - required: [file, projectId]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF, PNG, JPG/JPEG, or ZIP file. Maximum size is 20MB.
 *               conversationId:
 *                 type: string
 *                 format: uuid
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               content:
 *                 type: string
 *                 maxLength: 8000
 *           encoding:
 *             file:
 *               contentType: application/pdf, image/png, image/jpeg, application/zip
 *     responses:
 *       201:
 *         description: Attachment uploaded and message created.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       413:
 *         description: Uploaded file exceeds the configured size limit.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "File size must not exceed 20MB"
 *               code: "UPLOAD_FILE_TOO_LARGE"
 */
attachmentsRouter.post(
  '/upload',
  authenticate(),
  ...uploadSingle,
  validateUploadAttachment,
  messagingController.upload,
)

export default messagesRouter
