import express, { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import { messagesRouter, attachmentsRouter } from '../routes'
import { messagingService } from '../service'
import { pinataService } from '../../submissions/pinata.service'
import { isAppError } from '../../../utils/errors'

const userId = '33333333-3333-4333-8333-333333333333'
const projectId = '11111111-1111-4111-8111-111111111111'

jest.mock('../../../middleware/auth.middleware', () => ({
  authenticate: () => (req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
    req.user = {
      userId,
      walletAddress: '0x0000000000000000000000000000000000000001',
      role: 'CLIENT',
    }
    next()
  },
}))

jest.mock('../service', () => ({
  messagingService: {
    sendMessage: jest.fn(),
    uploadAttachmentMessage: jest.fn(),
  },
  chatService: {
    sendMessage: jest.fn(),
    uploadAttachmentMessage: jest.fn(),
  },
}))

jest.mock('../../submissions/pinata.service', () => ({
  pinataService: {
    uploadFile: jest.fn(),
    buildGatewayUrl: jest.fn(),
  },
}))

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/messages', messagesRouter)
  app.use('/attachments', attachmentsRouter)
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (isAppError(error)) {
      return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code })
    }

    return res.status(500).json({ success: false, message: error.message })
  })

  return app
}

const service = messagingService as jest.Mocked<typeof messagingService>
const pinata = pinataService as jest.Mocked<typeof pinataService>

describe('messaging routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sends messages through the authenticated REST endpoint', async () => {
    const message = { id: 'message-1', content: 'Hello' }
    service.sendMessage.mockResolvedValue(message as never)

    await request(buildApp())
      .post('/messages/send')
      .set('Authorization', 'Bearer token')
      .send({ projectId, content: 'Hello' })
      .expect(201)
      .expect(message)

    expect(service.sendMessage).toHaveBeenCalledWith(
      {
        conversationId: undefined,
        projectId,
        content: 'Hello',
        messageType: undefined,
        senderId: userId,
      },
      expect.objectContaining({ userId }),
    )
  })

  it('uploads attachments to IPFS and creates a file message', async () => {
    const message = { id: 'file-message-1', messageType: 'FILE' }
    pinata.uploadFile.mockResolvedValue({ cid: 'cid123', size: 12 })
    pinata.buildGatewayUrl.mockReturnValue('https://gateway.pinata.cloud/ipfs/cid123')
    service.uploadAttachmentMessage.mockResolvedValue(message as never)

    await request(buildApp())
      .post('/attachments/upload')
      .field('projectId', projectId)
      .field('content', 'Please review')
      .attach('file', Buffer.from('%PDF-1.4'), {
        filename: 'brief.pdf',
        contentType: 'application/pdf',
      })
      .expect(201)
      .expect(message)

    expect(pinata.uploadFile).toHaveBeenCalled()
    expect(service.uploadAttachmentMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        senderId: userId,
        content: 'Please review',
        attachment: expect.objectContaining({
          fileName: 'brief.pdf',
          fileType: 'application/pdf',
          fileUrl: 'https://gateway.pinata.cloud/ipfs/cid123',
          downloadUrl: 'https://gateway.pinata.cloud/ipfs/cid123',
          ipfsCid: 'cid123',
        }),
      }),
      expect.objectContaining({ userId }),
    )
  })
})
