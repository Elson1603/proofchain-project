import type { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { verifyAccessToken } from '../modules/auth/utils'
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData, SocketInitOptions } from './types'
import { registerSocketHandlers, projectRoom, userRoom } from './handlers'

export type TypedSocketServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

export let io: TypedSocketServer | null = null
let initOptions: SocketInitOptions = {}

function getAllowedOrigins() {
  return process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true
}

function extractToken(handshake: { auth: any; query: any; headers: any }) {
  const authToken = handshake.auth?.token
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim()
  }

  const queryToken = handshake.query?.token
  if (typeof queryToken === 'string' && queryToken.trim()) {
    return queryToken.trim()
  }

  const authHeader = handshake.headers?.authorization
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

export function initializeSocket(httpServer: HttpServer, options: SocketInitOptions = {}) {
  if (io) {
    return io
  }

  initOptions = options

  io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
    maxHttpBufferSize: 1e6,
  })

  io.use((socket, next) => {
    const token = extractToken(socket.handshake)

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

  registerSocketHandlers(io, options)

  io.on('connection', (socket) => {
    console.log('[socket] connected', {
      socketId: socket.id,
      userId: socket.data.user?.userId,
      walletAddress: socket.data.user?.walletAddress,
      ip: socket.handshake.address,
    })

    socket.on('error', (error) => {
      console.error('[socket] client error', {
        socketId: socket.id,
        userId: socket.data.user?.userId,
        error: error instanceof Error ? error.message : String(error),
      })
    })

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', {
        socketId: socket.id,
        userId: socket.data.user?.userId,
        reason,
      })
    })
  })

  return io
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initializeSocket(httpServer) first.')
  }

  return io
}

export function closeSocket() {
  io?.close()
  io = null
  initOptions = {}
}

export function emitToUser<E extends keyof ServerToClientEvents>(
  userId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  const server = getIO()
  const room = userRoom(userId)

  console.log('[socket] emitToUser', { event, userId, room })
  server.to(room).emit(event, ...args)
}

export function emitToProject<E extends keyof ServerToClientEvents>(
  projectId: string,
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) {
  const server = getIO()
  const room = projectRoom(projectId)

  console.log('[socket] emitToProject', { event, projectId, room })
  server.to(room).emit(event, ...args)
}

export function broadcastEvent<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>) {
  const server = getIO()

  console.log('[socket] broadcastEvent', { event })
  server.emit(event, ...args)
}

export function getSocketInstance() {
  return getIO()
}

export function getSocketInitOptions() {
  return initOptions
}
