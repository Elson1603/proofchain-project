import { NextFunction, Response } from 'express'
import { AuthenticatedRequest } from '../auth/types'
import { pinataService } from '../submissions/pinata.service'
import { AppError } from '../../utils/errors'
import { messagingService } from './service'

function getUser(req: AuthenticatedRequest) {
  if (!req.user) {
    throw new AppError(401, 'Authentication is required', 'AUTH_REQUIRED')
  }

  return req.user
}

export const messagingController = {
  async send(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      const message = await messagingService.sendMessage(
        {
          conversationId: req.body.conversationId,
          projectId: req.body.projectId,
          content: req.body.content,
          messageType: req.body.messageType,
          senderId: user.userId,
        },
        user,
      )

      res.status(201).json(message)
    } catch (error) {
      next(error)
    }
  },

  async listMessages(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      const page = await messagingService.listMessages({
        conversationId: String(req.params.conversationId),
        user,
        cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
        limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
      })

      res.json(page)
    } catch (error) {
      next(error)
    }
  },

  async edit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      res.json(await messagingService.editMessage(String(req.params.id), String(req.body.content), user))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      res.json(await messagingService.deleteMessage(String(req.params.id), user))
    } catch (error) {
      next(error)
    }
  },

  async react(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      res.json(await messagingService.toggleReaction(String(req.params.id), String(req.body.emoji), user))
    } catch (error) {
      next(error)
    }
  },

  async read(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      res.json(await messagingService.markMessageRead(String(req.params.id), user))
    } catch (error) {
      next(error)
    }
  },

  async proof(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      res.json(await messagingService.createMessageProof(String(req.params.id), user))
    } catch (error) {
      next(error)
    }
  },

  async getConversationByProject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      res.json(await messagingService.getOrCreateConversationByProject(String(req.params.projectId), user))
    } catch (error) {
      next(error)
    }
  },

  async getConversation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      res.json(await messagingService.getConversation(String(req.params.id), user))
    } catch (error) {
      next(error)
    }
  },

  async listConversations(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      res.json(await messagingService.listConversations(user))
    } catch (error) {
      next(error)
    }
  },

  async markConversationSeen(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      res.json(await messagingService.markConversationSeen(String(req.params.id), user))
    } catch (error) {
      next(error)
    }
  },

  async smartReplies(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      res.json({
        suggestions: await messagingService.getSmartReplies(String(req.params.id), user),
      })
    } catch (error) {
      next(error)
    }
  },

  async upload(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = getUser(req)
      const file = (req as AuthenticatedRequest & { file?: Express.Multer.File }).file

      if (!file) {
        throw new AppError(400, 'File is required', 'FILE_REQUIRED')
      }

      let uploadResult: { cid: string; size?: number }

      try {
        uploadResult = await pinataService.uploadFile(file)
      } catch (_error) {
        throw new AppError(502, 'File upload to IPFS failed', 'IPFS_UPLOAD_FAILED')
      }

      const gatewayUrl = pinataService.buildGatewayUrl(uploadResult.cid)
      const message = await messagingService.uploadAttachmentMessage(
        {
          conversationId: req.body.conversationId,
          projectId: req.body.projectId,
          senderId: user.userId,
          content: req.body.content,
          attachment: {
            fileName: file.originalname || 'upload',
            fileUrl: gatewayUrl,
            previewUrl: file.mimetype.startsWith('image/') ? gatewayUrl : undefined,
            downloadUrl: gatewayUrl,
            fileType: file.mimetype,
            fileSize: file.size,
            ipfsCid: uploadResult.cid,
          },
        },
        user,
      )

      res.status(201).json(message)
    } catch (error) {
      next(error)
    }
  },
}

export const chatController = messagingController
