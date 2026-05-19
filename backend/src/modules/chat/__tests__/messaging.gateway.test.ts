import { AddressInfo } from 'net'
import { createServer, Server as HttpServer } from 'http'
import { io as createClient, Socket as ClientSocket } from 'socket.io-client'
import { verifyAccessToken } from '../../auth/utils'
import { AppError } from '../../../utils/errors'
import { closeMessagingGateway, initializeMessagingGateway } from '../gateway'
import { messagingService } from '../service'
import { messagingEvents } from '../sockets/events'

jest.mock('../../auth/utils', () => ({
  verifyAccessToken: jest.fn(),
}))

jest.mock('../service', () => ({
  messagingService: {
    assertProjectMembership: jest.fn(),
    sendMessage: jest.fn(),
    markMessageRead: jest.fn(),
    markConversationSeen: jest.fn(),
    toggleReaction: jest.fn(),
  },
  chatService: {},
}))

const projectId = '11111111-1111-4111-8111-111111111111'
const userId = '33333333-3333-4333-8333-333333333333'

const authPayload = {
  userId,
  walletAddress: '0x0000000000000000000000000000000000000001',
  role: 'CLIENT' as const,
}

const verifyToken = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>
const service = messagingService as jest.Mocked<typeof messagingService>

function emitWithAck<T>(socket: ClientSocket, event: string, payload: unknown) {
  return new Promise<T>((resolve) => {
    socket.emit(event, payload, (response: T) => resolve(response))
  })
}

function waitForEvent<T>(socket: ClientSocket, event: string) {
  return new Promise<T>((resolve) => {
    socket.once(event, (payload: T) => resolve(payload))
  })
}

async function startServer() {
  const httpServer = createServer()
  initializeMessagingGateway(httpServer)

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve)
  })

  const port = (httpServer.address() as AddressInfo).port
  return { httpServer, url: `http://127.0.0.1:${port}` }
}

async function connectClient(url: string) {
  const socket = createClient(url, {
    auth: { token: 'valid-token' },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  })

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve)
    socket.once('connect_error', reject)
  })

  return socket
}

describe('messaging gateway', () => {
  let httpServer: HttpServer | null = null
  let client: ClientSocket | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    verifyToken.mockReturnValue(authPayload)
    service.assertProjectMembership.mockResolvedValue({
      id: projectId,
      ownerId: userId,
      freelancerId: null,
      invitedFreelancerId: null,
    })
  })

  afterEach(async () => {
    client?.close()
    closeMessagingGateway()

    if (httpServer?.listening) {
      await new Promise<void>((resolve) => httpServer?.close(() => resolve()))
    }
  })

  it('authenticates sockets, joins project rooms, and broadcasts messages', async () => {
    const started = await startServer()
    httpServer = started.httpServer
    client = await connectClient(started.url)

    const ack = await emitWithAck<{ success: boolean; room: string }>(client, 'join_project_room', { projectId })
    expect(ack).toMatchObject({ success: true, room: `project_${projectId}` })

    const received = waitForEvent<{ id: string }>(client, 'receive_message')
    messagingEvents.publish('receive_message', {
      projectId,
      message: { id: 'message-1' },
    })

    await expect(received).resolves.toEqual({ id: 'message-1' })
    expect(service.assertProjectMembership).toHaveBeenCalledWith(projectId, authPayload)
  })

  it('rejects unauthorized room joins with socket errors', async () => {
    service.assertProjectMembership.mockRejectedValue(
      new AppError(403, 'You do not have access to this project chat', 'PROJECT_CHAT_FORBIDDEN'),
    )
    const started = await startServer()
    httpServer = started.httpServer
    client = await connectClient(started.url)

    const ack = await emitWithAck<{ success: boolean; statusCode: number; code: string }>(client, 'join_project_room', {
      projectId,
    })

    expect(ack).toMatchObject({
      success: false,
      statusCode: 403,
      code: 'PROJECT_CHAT_FORBIDDEN',
    })
  })
})
