import type { Server, Socket } from 'socket.io'
import { isAdminRole } from '../modules/auth/types'
import { isAppError, AppError } from '../utils/errors'
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketAck,
  SocketData,
  SocketErrorResponse,
  SocketInitOptions,
  SocketSuccessResponse,
} from './types'

export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

type AnyAck = (payload: any) => void
type JoinLeaveAck = SocketAck<SocketSuccessResponse<{ room: string; projectId: string }> | SocketErrorResponse>

type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void
  warn: (message: string, meta?: Record<string, unknown>) => void
  error: (message: string, meta?: Record<string, unknown>) => void
}

const log: Logger = {
  info: (message, meta) => console.log(`[socket] ${message}`, meta ?? ''),
  warn: (message, meta) => console.warn(`[socket] ${message}`, meta ?? ''),
  error: (message, meta) => console.error(`[socket] ${message}`, meta ?? ''),
}

export function userRoom(userId: string) {
  return `user_${userId}`
}

export function projectRoom(projectId: string) {
  return `project_${projectId}`
}

export function adminRoom() {
  return 'admin_operations'
}

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

function ackSuccess<T extends Record<string, unknown>>(ack: SocketAck<SocketSuccessResponse<T> | SocketErrorResponse> | undefined, payload: T) {
  if (typeof ack === 'function') {
    ack({ success: true, ...payload })
  }
}

function ackError(socket: TypedSocket, ack: AnyAck | undefined, error: unknown) {
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

async function joinProjectRoom(socket: TypedSocket, projectId: string, options: SocketInitOptions) {
  if (!projectId.trim()) {
    throw new AppError(400, 'projectId is required', 'PROJECT_ID_REQUIRED')
  }

  if (options.authorizeProjectRoom) {
    await options.authorizeProjectRoom(socket.data.user, projectId)
  } else {
    log.warn('No project room authorizer configured; allowing join', { userId: socket.data.user?.userId, projectId })
  }

  await socket.join(projectRoom(projectId))
  return projectId
}

async function handleJoinProjectRoom(
  socket: TypedSocket,
  payload: { projectId?: string },
  ack?: JoinLeaveAck,
  options?: SocketInitOptions,
) {
  try {
    const projectId = payload?.projectId

    if (!projectId) {
      throw new AppError(400, 'projectId is required', 'PROJECT_ID_REQUIRED')
    }

    const joinedProjectId = await joinProjectRoom(socket, projectId, options ?? {})
    const room = projectRoom(joinedProjectId)

    log.info('Joined project room', { userId: socket.data.user.userId, projectId: joinedProjectId, room })
    ackSuccess(ack, { room, projectId: joinedProjectId })
  } catch (error) {
    ackError(socket, ack as AnyAck | undefined, error)
  }
}

async function handleLeaveProjectRoom(socket: TypedSocket, payload: { projectId?: string }, ack?: JoinLeaveAck) {
  try {
    const projectId = payload?.projectId

    if (!projectId) {
      throw new AppError(400, 'projectId is required', 'PROJECT_ID_REQUIRED')
    }

    const room = projectRoom(projectId)
    await socket.leave(room)
    log.info('Left project room', { userId: socket.data.user.userId, projectId, room })

    ackSuccess(ack, { room, projectId })
  } catch (error) {
    ackError(socket, ack as AnyAck | undefined, error)
  }
}

export function registerSocketHandlers(io: TypedServer, options: SocketInitOptions = {}) {
  io.on('connection', (socket) => {
    const user = socket.data.user

    log.info('Client connected', {
      socketId: socket.id,
      userId: user?.userId,
      walletAddress: user?.walletAddress,
    })

    if (user?.userId) {
      void socket.join(userRoom(user.userId))
    }

    if (isAdminRole(user?.role)) {
      void socket.join(adminRoom())
    }

    const projectIds = [
      ...normalizeProjectIds(socket.handshake.auth?.projectId),
      ...normalizeProjectIds(socket.handshake.auth?.projectIds),
      ...normalizeProjectIds(socket.handshake.query.projectId),
      ...normalizeProjectIds(socket.handshake.query.projectIds),
    ]

    for (const projectId of new Set(projectIds)) {
      void joinProjectRoom(socket, projectId, options).catch((error) => {
        socket.emit('socket_error', toSocketError(error))
      })
    }

    socket.on('join_project_room', (payload, ack) => {
      void handleJoinProjectRoom(socket, payload, ack, options)
    })

    socket.on('leave_project_room', (payload, ack) => {
      void handleLeaveProjectRoom(socket, payload, ack)
    })

    socket.on('error', (error) => {
      log.error('Socket error', { socketId: socket.id, userId: user?.userId, error: String(error) })
    })

    socket.on('disconnect', (reason) => {
      log.info('Client disconnected', { socketId: socket.id, userId: user?.userId, reason })
    })
  })

  io.engine.on('connection_error', (err) => {
    log.warn('Engine connection error', {
      code: err.code,
      message: err.message,
      context: err.context,
    })
  })
}
