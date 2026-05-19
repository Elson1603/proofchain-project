import { NextFunction, Request, Response, Router } from 'express'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import type { FileFilterCallback } from 'multer'
import { authenticate } from '../../middleware/auth.middleware'
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

const DEFAULT_MAX_FILE_MB = 25
const maxFileMb = Number(process.env.MESSAGE_ATTACHMENT_MAX_FILE_MB ?? DEFAULT_MAX_FILE_MB)
const maxFileBytes = Math.max(1, maxFileMb) * 1024 * 1024

const defaultMimeTypes = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-7z-compressed',
  'application/gzip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
]

const allowedMimeTypes = (process.env.MESSAGE_ATTACHMENT_ALLOWED_MIME_TYPES ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

const effectiveAllowedMimeTypes = allowedMimeTypes.length ? allowedMimeTypes : defaultMimeTypes
const allowedPrefixes = ['image/']
const blockedExtensions = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.cpl',
  '.dll',
  '.exe',
  '.js',
  '.jar',
  '.msi',
  '.ps1',
  '.scr',
  '.sh',
  '.vbs',
])

function getExtension(fileName: string) {
  const normalized = fileName.toLowerCase()
  const dotIndex = normalized.lastIndexOf('.')
  return dotIndex >= 0 ? normalized.slice(dotIndex) : ''
}

function isMimeAllowed(mimeType: string) {
  if (effectiveAllowedMimeTypes.includes(mimeType)) {
    return true
  }

  return allowedPrefixes.some((prefix) => mimeType.startsWith(prefix))
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileBytes },
  fileFilter: (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
    if (blockedExtensions.has(getExtension(file.originalname))) {
      return callback(new Error('Executable attachments are not allowed'))
    }

    if (!isMimeAllowed(file.mimetype)) {
      return callback(new Error('Unsupported file type'))
    }

    return callback(null, true)
  },
})

const uploadSingle = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error) {
      const message = error instanceof Error ? error.message : 'File upload failed'
      return res.status(400).json({
        success: false,
        message,
      })
    }

    return next()
  })
}

const messageRateLimiter = rateLimit({
  windowMs: 10 * 1000,
  limit: Number(process.env.MESSAGE_SEND_RATE_LIMIT ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many messages. Please slow down.',
  },
})

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
  uploadSingle,
  validateUploadAttachment,
  messagingController.upload,
)

export default messagesRouter
