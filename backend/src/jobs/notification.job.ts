import type { Job, JobsOptions } from 'bullmq'
import { notificationsService } from '../modules/notifications/service'
import { notificationQueue } from '../queues/notification.queue'

export const NOTIFICATION_JOB_NAME = 'send-notification'

export type BackgroundNotificationType = 'submission_uploaded' | 'payment_completed' | 'nft_minted'

export type NotificationChannel = 'in_app' | 'email'

export interface NotificationJobPayload {
  userId: string
  type: BackgroundNotificationType
  title?: string
  message?: string
  channels?: NotificationChannel[]
  metadata?: {
    projectId?: string
    projectTitle?: string
    milestoneTitle?: string
    amount?: string | number
    currency?: string
    txHash?: string
    tokenId?: string | number
    [key: string]: unknown
  }
  correlationId?: string
}

export interface AddJobOptions {
  delayMs?: number
  jobId?: string
  attempts?: number
  priority?: number
}

function toBullMQOptions(options: AddJobOptions = {}): JobsOptions {
  return {
    delay: options.delayMs,
    jobId: options.jobId,
    attempts: options.attempts,
    priority: options.priority,
  }
}

function compactLabel(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function moneyLabel(amount: unknown, currency: unknown) {
  if (typeof amount === 'undefined' || amount === null || amount === '') {
    return undefined
  }

  return `${amount}${typeof currency === 'string' && currency.trim() ? ` ${currency.trim()}` : ''}`
}

function renderNotification(payload: NotificationJobPayload) {
  if (payload.title && payload.message) {
    return {
      title: payload.title,
      message: payload.message,
    }
  }

  const projectTitle = compactLabel(payload.metadata?.projectTitle) ?? 'your project'

  if (payload.type === 'submission_uploaded') {
    const milestone = compactLabel(payload.metadata?.milestoneTitle)
    const suffix = milestone ? ` for ${milestone}` : ''
    return {
      title: payload.title ?? 'Submission uploaded',
      message: payload.message ?? `A new submission was uploaded${suffix} on ${projectTitle}.`,
    }
  }

  if (payload.type === 'payment_completed') {
    const amount = moneyLabel(payload.metadata?.amount, payload.metadata?.currency)
    const txHash = compactLabel(payload.metadata?.txHash)
    const amountLine = amount ? ` of ${amount}` : ''
    const txLine = txHash ? ` Transaction: ${txHash.slice(0, 10)}...` : ''
    return {
      title: payload.title ?? 'Payment completed',
      message: payload.message ?? `Payment${amountLine} was completed for ${projectTitle}.${txLine}`,
    }
  }

  const tokenId = payload.metadata?.tokenId
  const tokenLine = tokenId ? ` Token #${tokenId}.` : ''
  return {
    title: payload.title ?? 'NFT minted',
    message: payload.message ?? `Your ProofChain certificate was minted for ${projectTitle}.${tokenLine}`,
  }
}

export async function addNotificationJob(payload: NotificationJobPayload, options: AddJobOptions = {}) {
  if (!payload.userId || !payload.type) {
    throw new Error('Notification job requires userId and type')
  }

  return notificationQueue.add(NOTIFICATION_JOB_NAME, payload, toBullMQOptions(options))
}

export async function processNotificationJob(job: Job<NotificationJobPayload>) {
  await job.updateProgress(10)

  const channels = job.data.channels ?? ['in_app', 'email']
  if (!channels.includes('in_app') && !channels.includes('email')) {
    throw new Error('Notification job requires at least one delivery channel')
  }

  const notificationContent = renderNotification(job.data)
  await job.updateProgress(50)

  // The notification service creates the in-app record, emits the realtime
  // notification, and sends email when email delivery is enabled/configured.
  const notification = await notificationsService.create({
    userId: job.data.userId,
    title: notificationContent.title,
    message: notificationContent.message,
    type: job.data.type,
    channels,
    awaitEmail: channels.includes('email'),
  })

  await job.updateProgress(100)

  return {
    notificationId: notification.id,
    userId: notification.userId,
    type: job.data.type,
    channels,
    correlationId: job.data.correlationId,
  }
}
