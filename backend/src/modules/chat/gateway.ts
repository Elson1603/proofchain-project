import type { Server as HttpServer } from 'http'
import type { SocketAck, SocketErrorResponse, SocketSuccessResponse } from '../../socket/types'
import type { TypedServer, TypedSocket } from '../../socket/handlers'
import { projectRoom, userRoom } from '../../socket/handlers'
import { closeSocket, initializeSocket } from '../../socket/socket'
import { AppError, isAppError } from '../../utils/errors'
import { messagingService } from './service'
import { MessagingBroadcastEvent, MessagingBroadcastPayload, messagingEvents } from './sockets/events'
import { nftEvents, type NftBroadcastEvent, type NftBroadcastPayload } from '../nft/events'

const SOCKET_RATE_WINDOW_MS = Number(process.env.SOCKET_MESSAGE_RATE_WINDOW_MS ?? 10_000)
const SOCKET_RATE_LIMIT = Number(process.env.SOCKET_MESSAGE_RATE_LIMIT ?? 20)

let busHandlers: Array<{ event: MessagingBroadcastEvent; handler: (payload: MessagingBroadcastPayload) => void }> = []
let nftBusHandlers: Array<{ event: NftBroadcastEvent; handler: (payload: NftBroadcastPayload) => void }> = []
const socketMessageBuckets = new Map<string, number[]>()

function toSocketError(error: unknown): SocketErrorResponse {
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

function ackSuccess<T extends Record<string, unknown>>(
  ack: SocketAck<SocketSuccessResponse<T> | SocketErrorResponse> | undefined,
  payload: T,
) {
  if (typeof ack === 'function') {
    ack({ success: true, ...payload })
  }
}

function ackError(socket: TypedSocket, ack: SocketAck<unknown> | undefined, error: unknown) {
  const payload = toSocketError(error)
  if (typeof ack === 'function') {
    ;(ack as SocketAck<SocketErrorResponse>)(payload)
    return
  }

  socket.emit('socket_error', payload)
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

async function handleSendMessage(
  socket: TypedSocket,
  payload: { conversationId?: string; projectId?: string; content?: string; messageType?: 'TEXT' | 'FILE' | 'SYSTEM' },
  ack?: SocketAck<unknown>,
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

    ackSuccess(ack as any, { message })
  } catch (error) {
    ackError(socket, ack, error)
  }
}

async function handleRead(socket: TypedSocket, payload: { messageId?: string }, ack?: SocketAck<unknown>) {
  try {
    if (!payload?.messageId) {
      throw new AppError(400, 'messageId is required', 'MESSAGE_ID_REQUIRED')
    }

    const read = await messagingService.markMessageRead(payload.messageId, socket.data.user)
    ackSuccess(ack as any, { read })
  } catch (error) {
    ackError(socket, ack, error)
  }
}

async function handleConversationSeen(socket: TypedSocket, payload: { conversationId?: string }, ack?: SocketAck<unknown>) {
  try {
    if (!payload?.conversationId) {
      throw new AppError(400, 'conversationId is required', 'CONVERSATION_ID_REQUIRED')
    }

    const result = await messagingService.markConversationSeen(payload.conversationId, socket.data.user)
    ackSuccess(ack as any, result)
  } catch (error) {
    ackError(socket, ack, error)
  }
}

async function handleReaction(socket: TypedSocket, payload: { messageId?: string; emoji?: string }, ack?: SocketAck<unknown>) {
  try {
    if (!payload?.messageId || !payload?.emoji) {
      throw new AppError(400, 'messageId and emoji are required', 'REACTION_PAYLOAD_REQUIRED')
    }

    const result = await messagingService.toggleReaction(payload.messageId, payload.emoji, socket.data.user)
    ackSuccess(ack as any, result)
  } catch (error) {
    ackError(socket, ack, error)
  }
}

async function handleTyping(
  socket: TypedSocket,
  event: 'typing_start' | 'typing_stop',
  payload: { projectId?: string; conversationId?: string },
  ack?: SocketAck<unknown>,
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
    ackSuccess(ack as any, {})
  } catch (error) {
    ackError(socket, ack, error)
  }
}

function bindBroadcasts(server: TypedServer) {
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

function bindNftBroadcasts(server: TypedServer) {
  const handlers: Array<{ event: NftBroadcastEvent; handler: (payload: NftBroadcastPayload) => void }> = [
    {
      event: 'nft_mint_started',
      handler: (payload) => {
        if (typeof payload.userId === 'string') {
          server.to(userRoom(payload.userId)).emit('nft_mint_started', payload)
        }
      },
    },
    {
      event: 'nft_minted',
      handler: (payload) => {
        if (typeof payload.userId === 'string') {
          server.to(userRoom(payload.userId)).emit('nft_minted', payload)
        }

        if (typeof payload.projectId === 'string') {
          server.to(projectRoom(payload.projectId)).emit('nft_minted', payload)
        }
      },
    },
    {
      event: 'nft_failed',
      handler: (payload) => {
        if (typeof payload.userId === 'string') {
          server.to(userRoom(payload.userId)).emit('nft_failed', payload)
        }
      },
    },
    {
      event: 'certificate_verified',
      handler: (payload) => {
        if (typeof payload.userId === 'string') {
          server.to(userRoom(payload.userId)).emit('certificate_verified', payload)
        }

        if (typeof payload.projectId === 'string') {
          server.to(projectRoom(payload.projectId)).emit('certificate_verified', payload)
        }
      },
    },
  ]

  for (const { event, handler } of handlers) {
    nftEvents.on(event, handler)
  }

  nftBusHandlers = handlers
}

function unbindBroadcasts() {
  for (const { event, handler } of busHandlers) {
    messagingEvents.off(event, handler)
  }

  busHandlers = []

  for (const { event, handler } of nftBusHandlers) {
    nftEvents.off(event, handler)
  }

  nftBusHandlers = []
}

export function initializeMessagingGateway(httpServer: HttpServer) {
  const server = initializeSocket(httpServer, {
    authorizeProjectRoom: async (user, projectId) => {
      await messagingService.assertProjectMembership(projectId, user)
    },
  })

  registerMessagingGateway(server)
  return server
}

let registered = false

export function registerMessagingGateway(io: TypedServer) {
  if (registered) {
    return
  }

  registered = true

  io.on('connection', (socket) => {
    socket.on('send_message', (payload, ack) => {
      void handleSendMessage(socket, payload as any, ack)
    })
    socket.on('message_read', (payload, ack) => {
      void handleRead(socket, payload as any, ack)
    })
    socket.on('message_seen', (payload, ack) => {
      void handleRead(socket, payload as any, ack)
    })
    socket.on('conversation_seen', (payload, ack) => {
      void handleConversationSeen(socket, payload as any, ack)
    })
    socket.on('message_reaction_added', (payload, ack) => {
      void handleReaction(socket, payload as any, ack)
    })
    socket.on('reaction_added', (payload, ack) => {
      void handleReaction(socket, payload as any, ack)
    })
    socket.on('typing_start', (payload, ack) => {
      void handleTyping(socket, 'typing_start', payload as any, ack)
    })
    socket.on('typing_stop', (payload, ack) => {
      void handleTyping(socket, 'typing_stop', payload as any, ack)
    })
  })

  bindBroadcasts(io)
  bindNftBroadcasts(io)
}

export function closeMessagingGateway() {
  unbindBroadcasts()
  registered = false
  closeSocket()
  socketMessageBuckets.clear()
}
