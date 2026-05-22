import type { JwtAuthPayload } from '../modules/auth/types'

export type SocketErrorResponse = {
  success: false
  statusCode: number
  code?: string
  message: string
}

export type SocketSuccessResponse<T extends Record<string, unknown> = Record<string, never>> = {
  success: true
} & T

export type SocketAck<T> = (payload: T) => void

export type SubmissionUploadedPayload = {
  submissionId: string
  projectId: string
  uploaderId: string
  ipfsCid?: string | null
  uploadedAt?: string
}

export type ProjectUpdatedPayload = {
  projectId: string
  updatedBy?: string
  status?: string
  updatedAt?: string
  changes?: Record<string, unknown>
}

export type PaymentCompletedPayload = {
  paymentId: string
  projectId: string
  payerId?: string
  payeeId?: string
  amount?: string
  currency?: string
  txHash?: string
  completedAt?: string
  meta?: Record<string, unknown>
}

export type TransactionStatusUpdatedPayload = {
  transactionId: string
  projectId?: string | null
  paymentId?: string | null
  txHash?: string | null
  status: 'pending' | 'confirmed' | 'failed'
  blockNumber?: number | null
  gasUsed?: number | null
  updatedAt?: string
  meta?: Record<string, unknown>
}

export type NftBroadcastPayload = {
  userId?: string
  recipientId?: string
  projectId?: string
  paymentId?: string
  certificateId?: string
  tokenId?: string | number
  contractAddress?: string
  wallet?: string
  txHash?: string
  mintedAt?: string
  error?: string
  meta?: Record<string, unknown>
}

export type NftMintedPayload = NftBroadcastPayload

export type NewMessagePayload = {
  projectId: string
  conversationId?: string
  messageId: string
  senderId: string
  content?: string
  messageType?: string
  createdAt?: string
  meta?: Record<string, unknown>
}

export type NotificationPayload = {
  userId: string
  type?: string
  notification?: {
    id: string
    title: string
    message: string
    type?: string
    isRead: boolean
    createdAt: string | Date
  }
  title?: string
  message?: string
}

export type AdminRealtimePayload = {
  type:
    | 'dispute_raised'
    | 'dispute_resolved'
    | 'escrow_issue'
    | 'tx_failure'
    | 'tx_retry'
    | 'fraud_alert'
    | 'nft_minted'
    | 'ugf_update'
    | 'project_activity'
    | 'user_moderation'
    | 'system_warning'
  severity?: 'info' | 'success' | 'warning' | 'critical'
  title: string
  message?: string
  entityType?: string
  entityId?: string
  txHash?: string
  createdAt?: string
  meta?: Record<string, unknown>
}

export type PlatformBroadcastEvent =
  | 'submission_uploaded'
  | 'project_updated'
  | 'payment_completed'
  | 'transaction_status_updated'
  | 'nft_minted'
  | 'new_message'

export interface ServerToClientEvents {
  socket_error: (payload: SocketErrorResponse) => void

  submission_uploaded: (payload: SubmissionUploadedPayload) => void
  project_updated: (payload: ProjectUpdatedPayload) => void
  payment_completed: (payload: PaymentCompletedPayload) => void
  transaction_status_updated: (payload: TransactionStatusUpdatedPayload) => void
  nft_mint_started: (payload: NftBroadcastPayload) => void
  nft_minted: (payload: NftBroadcastPayload) => void
  nft_failed: (payload: NftBroadcastPayload) => void
  certificate_verified: (payload: NftBroadcastPayload) => void
  new_message: (payload: NewMessagePayload) => void

  // Chat module (kept loose so chat can evolve without retyping everything here)
  receive_message: (payload: unknown) => void
  message_edited: (payload: unknown) => void
  message_deleted: (payload: unknown) => void
  message_seen: (payload: unknown) => void
  message_read: (payload: unknown) => void
  conversation_seen: (payload: unknown) => void
  reaction_added: (payload: unknown) => void
  reaction_removed: (payload: unknown) => void
  message_reaction_added: (payload: unknown) => void
  message_reaction_removed: (payload: unknown) => void
  file_uploaded: (payload: unknown) => void
  notification: (payload: NotificationPayload) => void
  admin_event: (payload: AdminRealtimePayload) => void
  typing_start: (payload: unknown) => void
  typing_stop: (payload: unknown) => void
}

export interface ClientToServerEvents {
  join_project_room: (payload: { projectId?: string }, ack?: SocketAck<SocketSuccessResponse<{ room: string; projectId: string }> | SocketErrorResponse>) => void
  leave_project_room: (payload: { projectId?: string }, ack?: SocketAck<SocketSuccessResponse<{ room: string; projectId: string }> | SocketErrorResponse>) => void

  // Chat module handlers
  send_message: (payload: unknown, ack?: SocketAck<unknown>) => void
  message_read: (payload: unknown, ack?: SocketAck<unknown>) => void
  message_seen: (payload: unknown, ack?: SocketAck<unknown>) => void
  conversation_seen: (payload: unknown, ack?: SocketAck<unknown>) => void
  message_reaction_added: (payload: unknown, ack?: SocketAck<unknown>) => void
  reaction_added: (payload: unknown, ack?: SocketAck<unknown>) => void
  typing_start: (payload: unknown, ack?: SocketAck<unknown>) => void
  typing_stop: (payload: unknown, ack?: SocketAck<unknown>) => void
}

export interface InterServerEvents {
  ping: () => void
}

export interface SocketData {
  user: JwtAuthPayload
}

export type SocketInitOptions = {
  authorizeProjectRoom?: (user: JwtAuthPayload, projectId: string) => Promise<void>
}
