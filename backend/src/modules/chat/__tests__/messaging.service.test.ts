import { messagingService } from '../service'
import { messagingRepository } from '../repository'
import { messagingEvents } from '../sockets/events'

jest.mock('../repository', () => ({
  messagingRepository: {
    findProjectMembership: jest.fn(),
    findConversation: jest.fn(),
    findConversationByProject: jest.fn(),
    upsertConversationByProject: jest.fn(),
    listMessages: jest.fn(),
    findMessage: jest.fn(),
    createMessage: jest.fn(),
    createFileMessage: jest.fn(),
    updateMessage: jest.fn(),
    markMessageRead: jest.fn(),
    markConversationRead: jest.fn(),
    findReaction: jest.fn(),
    createReaction: jest.fn(),
    deleteReaction: jest.fn(),
    unreadCount: jest.fn(),
    latestMessage: jest.fn(),
    projectParticipantIds: jest.fn(),
    createNotifications: jest.fn(),
    updateMessageProof: jest.fn(),
  },
}))

jest.mock('../sockets/events', () => ({
  messagingEvents: {
    publish: jest.fn(),
  },
}))

jest.mock('../utils/proof', () => ({
  buildMessageHash: jest.fn(() => '0xmessagehash'),
  submitMessageProof: jest.fn(async () => '0xtxhash'),
}))

const projectId = '11111111-1111-4111-8111-111111111111'
const conversationId = '22222222-2222-4222-8222-222222222222'
const clientId = '33333333-3333-4333-8333-333333333333'
const freelancerId = '44444444-4444-4444-8444-444444444444'
const outsiderId = '55555555-5555-4555-8555-555555555555'

const clientUser = {
  userId: clientId,
  walletAddress: '0x0000000000000000000000000000000000000001',
  role: 'CLIENT' as const,
}

const freelancerUser = {
  userId: freelancerId,
  walletAddress: '0x0000000000000000000000000000000000000002',
  role: 'FREELANCER' as const,
}

const project = {
  id: projectId,
  ownerId: clientId,
  freelancerId,
  invitedFreelancerId: null,
}

const conversation = {
  id: conversationId,
  projectId,
  createdAt: new Date('2026-05-19T00:00:00.000Z'),
  updatedAt: new Date('2026-05-19T00:00:00.000Z'),
  project,
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: '66666666-6666-4666-8666-666666666666',
    conversationId,
    senderId: clientId,
    content: 'Hello',
    messageType: 'TEXT',
    attachmentUrl: null,
    attachmentType: null,
    isEdited: false,
    isDeleted: false,
    deliveredAt: new Date('2026-05-19T00:00:00.000Z'),
    messageHash: null,
    blockchainTxHash: null,
    blockchainProofedAt: null,
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    sender: { id: clientId },
    reactions: [],
    reads: [],
    attachments: [],
    conversation: {
      id: conversationId,
      projectId,
      project,
    },
    ...overrides,
  } as any
}

const repository = messagingRepository as jest.Mocked<typeof messagingRepository>
const events = messagingEvents as jest.Mocked<typeof messagingEvents>

describe('messagingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    repository.findProjectMembership.mockResolvedValue(project)
    repository.upsertConversationByProject.mockResolvedValue(conversation)
    repository.projectParticipantIds.mockResolvedValue([clientId, freelancerId])
    repository.createNotifications.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        userId: freelancerId,
        title: 'New message',
        message: 'A new message was posted in your project chat.',
        type: 'chat',
        isRead: false,
        createdAt: new Date('2026-05-20T12:00:00.000Z'),
      },
    ])
    repository.unreadCount.mockResolvedValue(0)
    repository.latestMessage.mockResolvedValue(null)
  })

  it('sends sanitized project messages and notifies the project room', async () => {
    const createdMessage = makeMessage({ content: '&lt;b&gt;Hello&lt;/b&gt;' })
    repository.createMessage.mockResolvedValue(createdMessage)

    const result = await messagingService.sendMessage(
      {
        projectId,
        senderId: clientId,
        content: '<b>Hello</b>',
      },
      clientUser,
    )

    expect(result).toBe(createdMessage)
    expect(repository.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId,
        senderId: clientId,
        content: '&lt;b&gt;Hello&lt;/b&gt;',
        messageType: 'TEXT',
      }),
    )
    expect(events.publish).toHaveBeenCalledWith('receive_message', {
      projectId,
      message: createdMessage,
    })
    expect(repository.createNotifications).toHaveBeenCalledWith([
      {
        userId: freelancerId,
        title: 'New message',
        message: 'A new message was posted in your project chat.',
        type: 'chat',
      },
    ])
  })

  it('rejects project room access for non-members', async () => {
    repository.findProjectMembership.mockResolvedValue(project)

    await expect(
      messagingService.assertProjectMembership(projectId, {
        userId: outsiderId,
        walletAddress: '0x0000000000000000000000000000000000000003',
        role: 'FREELANCER',
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PROJECT_CHAT_FORBIDDEN',
    })
  })

  it('prevents regular users from forging system messages', async () => {
    await expect(
      messagingService.sendMessage(
        {
          projectId,
          senderId: clientId,
          content: 'Client approved payment',
          messageType: 'SYSTEM',
        },
        clientUser,
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'SYSTEM_MESSAGE_FORBIDDEN',
    })
  })

  it('records read receipts and emits seen updates', async () => {
    const message = makeMessage()
    const readAt = new Date('2026-05-19T01:00:00.000Z')
    repository.findMessage.mockResolvedValue(message)
    repository.markMessageRead.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      messageId: message.id,
      userId: freelancerId,
      readAt,
      message: {
        id: message.id,
        conversation: { id: conversationId, projectId },
      },
      user: { id: freelancerId, fullName: null, username: null, avatarUrl: null },
    })

    await messagingService.markMessageRead(message.id, freelancerUser)

    expect(repository.markMessageRead).toHaveBeenCalledWith(message.id, freelancerId)
    expect(events.publish).toHaveBeenCalledWith('message_seen', {
      projectId,
      messageId: message.id,
      userId: freelancerId,
      readAt,
    })
  })

  it('toggles emoji reactions in real time', async () => {
    const message = makeMessage()
    const reaction = {
      id: '88888888-8888-4888-8888-888888888888',
      messageId: message.id,
      userId: freelancerId,
      emoji: '+1',
      createdAt: new Date('2026-05-19T00:00:00.000Z'),
      user: { id: freelancerId, fullName: null, username: null, avatarUrl: null },
      message: { id: message.id, conversation: { id: conversationId, projectId } },
    }
    repository.findMessage.mockResolvedValue(message)
    repository.findReaction.mockResolvedValue(null)
    repository.createReaction.mockResolvedValue(reaction)

    const result = await messagingService.toggleReaction(message.id, '+1', freelancerUser)

    expect(result.action).toBe('added')
    expect(repository.createReaction).toHaveBeenCalledWith(message.id, freelancerId, '+1')
    expect(events.publish).toHaveBeenCalledWith('reaction_added', {
      projectId,
      messageId: message.id,
      reaction,
    })
  })

  it('creates attachment messages with file metadata', async () => {
    const fileMessage = makeMessage({
      messageType: 'FILE',
      content: 'Shared brief.pdf',
      attachments: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          messageId: '66666666-6666-4666-8666-666666666666',
          fileName: 'brief.pdf',
          fileUrl: 'https://gateway.pinata.cloud/ipfs/cid',
          previewUrl: null,
          downloadUrl: 'https://gateway.pinata.cloud/ipfs/cid',
          fileType: 'application/pdf',
          fileSize: 123,
          ipfsCid: 'cid',
          createdAt: new Date('2026-05-19T00:00:00.000Z'),
        },
      ],
    })
    repository.createFileMessage.mockResolvedValue(fileMessage)

    const result = await messagingService.uploadAttachmentMessage(
      {
        projectId,
        senderId: clientId,
        attachment: {
          fileName: 'brief.pdf',
          fileUrl: 'https://gateway.pinata.cloud/ipfs/cid',
          downloadUrl: 'https://gateway.pinata.cloud/ipfs/cid',
          fileType: 'application/pdf',
          fileSize: 123,
          ipfsCid: 'cid',
        },
      },
      clientUser,
    )

    expect(result).toBe(fileMessage)
    expect(repository.createFileMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId,
        senderId: clientId,
        content: 'Shared brief.pdf',
        attachment: expect.objectContaining({ fileName: 'brief.pdf' }),
      }),
    )
    expect(events.publish).toHaveBeenCalledWith('file_uploaded', {
      projectId,
      message: fileMessage,
      attachment: expect.objectContaining({ fileName: 'brief.pdf' }),
    })
  })
})
