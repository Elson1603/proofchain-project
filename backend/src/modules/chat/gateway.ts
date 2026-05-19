import type { Server as HttpServer } from 'http'
import { Server, Socket } from 'socket.io'
import { JwtAuthPayload } from '../auth/types'
import { verifyAccessToken } from '../auth/utils'
import { AppError, isAppError } from '../../utils/errors'
import { messagingService } from './service'
import { MessagingBroadcastEvent, MessagingBroadcastPayload, messagingEvents } from './sockets/events'
import { projectRoom, userRoom } from './utils/rooms'

type Ack = (payload: unknown) => void
type AuthenticatedSocket = Socket & {
  data: {
    user: JwtAuthPayload
  }
}

const SOCKET_RATE_WINDOW_MS = Number(process.env.SOCKET_MESSAGE_RATE_WINDOW_MS ?? 10_000)
const SOCKET_RATE_LIMIT = Number(process.env.SOCKET_MESSAGE_RATE_LIMIT ?? 20)

let io: Server | null = null
let busHandlers: Array<{ event: MessagingBroadcastEvent; handler: (payload: MessagingBroadcastPayload) => void }> = []
const socketMessageBuckets = new Map<string, number[]>()

function getAllowedOrigins() {
  return process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true
}

function extractToken(socket: Socket) {
  const authToken = socket.handshake.auth?.token
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim()
  }

  const queryToken = socket.handshake.query.token
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim()
  }

  const authHeader = socket.handshake.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

function toSocketError(error: unknown) {
  if (isAppError(error)) {
    return {
      success: false,
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    }
  }

  return {
    success: false,
    statusCode: 500,
    message: 'Socket operation failed',
  }
}

function ackSuccess(ack: Ack | undefined, payload: Record<string, unknown> = {}) {
  if (typeof ack === 'function') {
    ack({ success: true, ...payload })
  }
}

function ackError(socket: Socket, ack: Ack | undefined, error: unknown) {
  const payload = toSocketError(error)
  if (typeof ack === 'function') {
    ack(payload)
    return
  }

  socket.emit('socket_error', payload)
}

function normalizeProjectIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeProjectIds(item))
  }

  if (typeof value !== 'string') {
    return []
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function assertSocketRateLimit(userId: string) {
  const now = Date.now()
  const windowStart = now - SOCKET_RATE_WINDOW_MS
  const bucket = (socketMessageBuckets.get(userId) ?? []).filter((timestamp) => timestamp >= windowStart)

  if (bucket.length >= SOCKET_RATE_LIMIT) {
    socketMessageBuckets.set(userId, bucket)
    throw new AppError(429, 'Too many messages. Please slow down.', 'SOCKET_RATE_LIMITED')
  }

  bucket.push(now)
  socketMessageBuckets.set(userId, bucket)
}

async function joinProjectRoom(socket: AuthenticatedSocket, projectId: string) {
  await messagingService.assertProjectMembership(projectId, socket.data.user)
  await socket.join(projectRoom(projectId))

  return projectId
}

async function handleJoin(socket: AuthenticatedSocket, payload: { projectId?: string }, ack?: Ack) {
  try {
    if (!payload?.projectId) {
      throw new AppError(400, 'projectId is required', 'PROJECT_ID_REQUIRED')
    }

    const projectId = await joinProjectRoom(socket, payload.projectId)
    ackSuccess(ack, { room: projectRoom(projectId), projectId })
  } catch (error) {
    ackError(socket, ack, error)
  }
}

async function handleLeave(socket: AuthenticatedSocket, payload: { projectId?: string }, ack?: Ack) {
  try {
    if (!payload?.projectId) {
      throw new AppError(400, 'projectId is required', 'PROJECT_ID_REQUIRED')
    }

    await socket.leave(projectRoom(payload.projectId))
    ackSuccess(ack, { room: projectRoom(payload.projectId), projectId: payload.projectId })
  } catch (error) {
    ackError(socket, ack, error)
  }
}

async function handleSendMessage(
  socket: AuthenticatedSocket,
  payload: { conversationId?: string; projectId?: string; content?: string; messageType?: 'TEXT' | 'FILE' | 'SYSTEM' },
  ack?: Ack,
) {
  try {
    assertSocketRateLimit(socket.data.user.userId)
    const message = await messagingService.sendMessage(
      {
        conversationId: payload?.conversationId,
        projectId: payload?.projectId,
        content: payload?.content,
        messageType: payload?.messageType,
        senderId: socket.data.user.userId,
      },
      socket.data.user,
    )

    ackSuccess(ack, { message })
  } catch (error) {
    ackError(socket, ack, error)
  }
}

async function handleRead(socket: AuthenticatedSocket, payload: { messageId?: string }, ack?: Ack) {
  try {
    if (!payload?.messageId) {
      throw new AppError(400, 'messageId is required', 'MESSAGE_ID_REQUIRED')
    }

    const read = await messagingService.markMessageRead(payload.messageId, socket.data.user)
    ackSuccess(ack, { read })
  } catch (error) {
    ackError(socket, ack, error)
  }
}

async function handleConversationSeen(socket: AuthenticatedSocket, payload: { conversationId?: string }, ack?: Ack) {
  try {
    if (!payload?.conversationId) {
      throw new AppError(400, 'conversationId is required', 'CONVERSATION_ID_REQUIRED')
    }

    const result = await messagingService.markConversationSeen(payload.conversationId, socket.data.user)
    ackSuccess(ack, result)
  } catch (error) {
    ackError(socket, ack, error)
  }
}

async function handleReaction(socket: AuthenticatedSocket, payload: { messageId?: string; emoji?: string }, ack?: Ack) {
  try {
    if (!payload?.messageId || !payload?.emoji) {
      throw new AppError(400, 'messageId and emoji are required', 'REACTION_PAYLOAD_REQUIRED')
    }

    const result = await messagingService.toggleReaction(payload.messageId, payload.emoji, socket.data.user)
    ackSuccess(ack, result)
  } catch (error) {
    ackError(socket, ack, error)
  }
}

async function handleTyping(
  socket: AuthenticatedSocket,
  event: 'typing_start' | 'typing_stop',
  payload: { projectId?: string; conversationId?: string },
  ack?: Ack,
) {
  try {
    if (!payload?.projectId) {
      throw new AppError(400, 'projectId is required', 'PROJECT_ID_REQUIRED')
    }

    await messagingService.assertProjectMembership(payload.projectId, socket.data.user)
    socket.to(projectRoom(payload.projectId)).emit(event, {
      projectId: payload.projectId,
      conversationId: payload.conversationId,
      userId: socket.data.user.userId,
    })
    ackSuccess(ack)
  } catch (error) {
    ackError(socket, ack, error)
  }
}

function bindBroadcasts(server: Server) {
  const handlers: Array<{ event: MessagingBroadcastEvent; handler: (payload: MessagingBroadcastPayload) => void }> = [
    {
      event: 'receive_message',
      handler: (payload) => {
        server.to(projectRoom(String(payload.projectId))).emit('receive_message', payload.message)
      },
    },
    {
      event: 'message_edited',
      handler: (payload) => {
        server.to(projectRoom(String(payload.projectId))).emit('message_edited', payload.message)
      },
    },
    {
      event: 'message_deleted',
      handler: (payload) => {
        server.to(projectRoom(String(payload.projectId))).emit('message_deleted', payload)
      },
    },
    {
      event: 'message_seen',
      handler: (payload) => {
        const room = projectRoom(String(payload.projectId))
        server.to(room).emit('message_seen', payload)
        server.to(room).emit('message_read', payload)
      },
    },
    {
      event: 'conversation_seen',
      handler: (payload) => {
        server.to(projectRoom(String(payload.projectId))).emit('conversation_seen', payload)
      },
    },
    {
      event: 'reaction_added',
      handler: (payload) => {
        const room = projectRoom(String(payload.projectId))
        server.to(room).emit('reaction_added', payload)
        server.to(room).emit('message_reaction_added', payload)
      },
    },
    {
      event: 'reaction_removed',
      handler: (payload) => {
        const room = projectRoom(String(payload.projectId))
        server.to(room).emit('reaction_removed', payload)
        server.to(room).emit('message_reaction_removed', payload)
      },
    },
    {
      event: 'file_uploaded',
      handler: (payload) => {
        server.to(projectRoom(String(payload.projectId))).emit('file_uploaded', payload)
      },
    },
    {
      event: 'notification_created',
      handler: (payload) => {
        if (typeof payload.userId === 'string') {
          server.to(userRoom(payload.userId)).emit('notification', payload)
        }
      },
    },
  ]

  for (const { event, handler } of handlers) {
    messagingEvents.on(event, handler)
  }

  busHandlers = handlers
}

function unbindBroadcasts() {
  for (const { event, handler } of busHandlers) {
    messagingEvents.off(event, handler)
  }

  busHandlers = []
}

export function initializeMessagingGateway(httpServer: HttpServer) {
  if (io) {
    return io
  }

  io = new Server(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
    maxHttpBufferSize: 1e6,
  })

  io.use((socket, next) => {
    const token = extractToken(socket)

    if (!token) {
      return next(new Error('Authentication token is required'))
    }

    try {
      socket.data.user = verifyAccessToken(token)
      return next()
    } catch (_error) {
      return next(new Error('Invalid or expired authentication token'))
    }
  })

  io.on('connection', (socket) => {
    const authedSocket = socket as AuthenticatedSocket
    const user = authedSocket.data.user

    void authedSocket.join(userRoom(user.userId))

    const projectIds = [
      ...normalizeProjectIds(socket.handshake.auth?.projectId),
      ...normalizeProjectIds(socket.handshake.auth?.projectIds),
      ...normalizeProjectIds(socket.handshake.query.projectId),
      ...normalizeProjectIds(socket.handshake.query.projectIds),
    ]

    for (const projectId of new Set(projectIds)) {
      void joinProjectRoom(authedSocket, projectId).catch((error) => {
        authedSocket.emit('socket_error', toSocketError(error))
      })
    }

    authedSocket.on('join_project_room', (payload, ack) => {
      void handleJoin(authedSocket, payload, ack)
    })
    authedSocket.on('leave_project_room', (payload, ack) => {
      void handleLeave(authedSocket, payload, ack)
    })
    authedSocket.on('send_message', (payload, ack) => {
      void handleSendMessage(authedSocket, payload, ack)
    })
    authedSocket.on('message_read', (payload, ack) => {
      void handleRead(authedSocket, payload, ack)
    })
    authedSocket.on('message_seen', (payload, ack) => {
      void handleRead(authedSocket, payload, ack)
    })
    authedSocket.on('conversation_seen', (payload, ack) => {
      void handleConversationSeen(authedSocket, payload, ack)
    })
    authedSocket.on('message_reaction_added', (payload, ack) => {
      void handleReaction(authedSocket, payload, ack)
    })
    authedSocket.on('reaction_added', (payload, ack) => {
      void handleReaction(authedSocket, payload, ack)
    })
    authedSocket.on('typing_start', (payload, ack) => {
      void handleTyping(authedSocket, 'typing_start', payload, ack)
    })
    authedSocket.on('typing_stop', (payload, ack) => {
      void handleTyping(authedSocket, 'typing_stop', payload, ack)
    })
  })

  bindBroadcasts(io)
  return io
}

export function closeMessagingGateway() {
  unbindBroadcasts()
  io?.close()
  io = null
  socketMessageBuckets.clear()
}
