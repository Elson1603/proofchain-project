import type {
  AdminRealtimePayload,
  NftMintedPayload,
  NewMessagePayload,
  PaymentCompletedPayload,
  ProjectUpdatedPayload,
  SubmissionUploadedPayload,
  TransactionStatusUpdatedPayload,
} from './types'
import { broadcastEvent, emitToProject, getIO } from './socket'
import { adminRoom } from './handlers'

export const platformEvents = {
  submission_uploaded: 'submission_uploaded',
  project_updated: 'project_updated',
  payment_completed: 'payment_completed',
  transaction_status_updated: 'transaction_status_updated',
  nft_minted: 'nft_minted',
  new_message: 'new_message',
} as const

export function emitSubmissionUploaded(payload: SubmissionUploadedPayload) {
  emitToProject(payload.projectId, platformEvents.submission_uploaded, payload)
}

export function emitProjectUpdated(payload: ProjectUpdatedPayload) {
  emitToProject(payload.projectId, platformEvents.project_updated, payload)
}

export function emitPaymentCompleted(payload: PaymentCompletedPayload) {
  emitToProject(payload.projectId, platformEvents.payment_completed, payload)
}

export function emitTransactionStatusUpdated(payload: TransactionStatusUpdatedPayload) {
  if (!payload.projectId) {
    return
  }

  emitToProject(payload.projectId, platformEvents.transaction_status_updated, payload)
}

export function emitNFTMinted(payload: NftMintedPayload) {
  if (!payload.projectId) {
    return
  }

  emitToProject(payload.projectId, platformEvents.nft_minted, payload)
}

// Backwards-compatible alias
export const emitNftMinted = emitNFTMinted

export function emitNewMessage(payload: NewMessagePayload) {
  emitToProject(payload.projectId, platformEvents.new_message, payload)
}

export function broadcastSubmissionUploaded(payload: SubmissionUploadedPayload) {
  broadcastEvent(platformEvents.submission_uploaded, payload)
}

export function broadcastProjectUpdated(payload: ProjectUpdatedPayload) {
  broadcastEvent(platformEvents.project_updated, payload)
}

export function broadcastPaymentCompleted(payload: PaymentCompletedPayload) {
  broadcastEvent(platformEvents.payment_completed, payload)
}

export function broadcastTransactionStatusUpdated(payload: TransactionStatusUpdatedPayload) {
  broadcastEvent(platformEvents.transaction_status_updated, payload)
}

export function broadcastNftMinted(payload: NftMintedPayload) {
  broadcastEvent(platformEvents.nft_minted, payload)
}

export function broadcastNewMessage(payload: NewMessagePayload) {
  broadcastEvent(platformEvents.new_message, payload)
}

export function broadcastAdminEvent(payload: AdminRealtimePayload) {
  try {
    getIO().to(adminRoom()).emit('admin_event', {
      ...payload,
      createdAt: payload.createdAt ?? new Date().toISOString(),
    })
  } catch (error) {
    console.warn('[socket] admin_event skipped', error)
  }
}
