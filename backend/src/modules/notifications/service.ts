import axios from 'axios'
import prisma from '../../config/db'
import { emitToUser } from '../../socket/socket'
import type { NotificationPayload } from '../../socket/types'
import { AppError } from '../../utils/errors'
import type { NotificationType } from './types'

type ListOptions = {
  userId: string
  limit?: number
  offset?: number
  unreadOnly?: boolean
}

type CreateNotificationInput = {
  userId: string
  title: string
  message: string
  type?: NotificationType
}

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

const EMAIL_ENABLED = process.env.NOTIFICATIONS_EMAIL_ENABLED !== 'false'
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? ''
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME ?? 'ProofChain'
const APP_BASE_URL = (process.env.APP_BASE_URL ?? '').replace(/\/+$/, '')

const REMINDERS_ENABLED = process.env.NOTIFICATIONS_ENABLE_REMINDERS !== 'false'
const REMINDER_INTERVAL_MS = Number(process.env.NOTIFICATIONS_REMINDER_INTERVAL_MS ?? 6 * 60 * 60 * 1000)
const APPROVAL_REMINDER_AFTER_HOURS = Number(process.env.NOTIFICATIONS_APPROVAL_REMINDER_AFTER_HOURS ?? 24)
const DEADLINE_REMINDER_WINDOW_HOURS = Number(process.env.NOTIFICATIONS_DEADLINE_WINDOW_HOURS ?? 48)

let reminderTimer: NodeJS.Timeout | null = null

function clampPageSize(limit?: number) {
  if (!limit || Number.isNaN(limit)) {
    return DEFAULT_PAGE_SIZE
  }

  return Math.min(Math.max(limit, 1), MAX_PAGE_SIZE)
}

function canSendEmail() {
  return Boolean(EMAIL_ENABLED && RESEND_API_KEY && RESEND_FROM_EMAIL)
}

function formatSender() {
  if (!RESEND_FROM_EMAIL) {
    return ''
  }

  return RESEND_FROM_NAME ? `${RESEND_FROM_NAME} <${RESEND_FROM_EMAIL}>` : RESEND_FROM_EMAIL
}

async function sendEmail(payload: { to: string; subject: string; html: string; text: string }) {
  if (!canSendEmail()) {
    return false
  }

  try {
    await axios.post(
      'https://api.resend.com/emails',
      {
        from: formatSender(),
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    )
    return true
  } catch (error) {
    console.error('Failed to send notification email', error)
    return false
  }
}

function renderEmail(notification: { title: string; message: string; createdAt: Date }, recipientName?: string | null) {
  const safeName = recipientName?.trim() || 'there'
  const createdLabel = notification.createdAt.toLocaleString()
  const appLink = APP_BASE_URL ? `<p><a href="${APP_BASE_URL}" target="_blank">Open ProofChain</a></p>` : ''

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">${notification.title}</h2>
      <p style="margin: 0 0 12px;">Hi ${safeName},</p>
      <p style="margin: 0 0 16px;">${notification.message}</p>
      <p style="margin: 0 0 16px; font-size: 12px; color: #64748b;">${createdLabel}</p>
      ${appLink}
    </div>
  `.trim()

  const text = `Hi ${safeName},\n\n${notification.title}\n${notification.message}\n\n${createdLabel}`

  return { html, text }
}

async function sendNotificationEmail(userId: string, notification: { title: string; message: string; createdAt: Date }) {
  if (!canSendEmail()) {
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, fullName: true, username: true },
  })

  if (!user?.email) {
    return
  }

  const name = user.fullName ?? user.username ?? null
  const { html, text } = renderEmail(notification, name)

  await sendEmail({
    to: user.email,
    subject: notification.title,
    html,
    text,
  })
}

function safeEmitNotification(userId: string, payload: NotificationPayload) {
  try {
    emitToUser(userId, 'notification', payload)
  } catch (error) {
    console.warn('Socket emit failed for notification', error)
  }
}

async function notifyUser(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type ?? 'system',
    },
  })

  safeEmitNotification(input.userId, {
    userId: input.userId,
    type: notification.type,
    notification,
  })

  void sendNotificationEmail(input.userId, notification).catch((error) => {
    console.error('Notification email failed', error)
  })

  return notification
}

async function shouldSendReminder(userId: string, type: NotificationType, cooldownHours = 24) {
  const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000)
  const recent = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: cutoff },
    },
    select: { id: true },
  })

  return !recent
}

async function runApprovalReminders() {
  const threshold = new Date(Date.now() - APPROVAL_REMINDER_AFTER_HOURS * 60 * 60 * 1000)

  const submissions = await prisma.submission.findMany({
    where: {
      createdAt: { lte: threshold },
      milestone: { status: 'submitted' },
    },
    include: {
      milestone: {
        include: {
          project: true,
        },
      },
    },
  })

  if (!submissions.length) {
    return { reminded: 0 }
  }

  const ownerCounts = new Map<string, { count: number; projects: Set<string> }>()

  for (const submission of submissions) {
    const project = submission.milestone?.project
    if (!project) {
      continue
    }

    const entry = ownerCounts.get(project.ownerId) ?? { count: 0, projects: new Set<string>() }
    entry.count += 1
    entry.projects.add(project.title ?? 'Untitled project')
    ownerCounts.set(project.ownerId, entry)
  }

  let reminded = 0

  for (const [ownerId, data] of ownerCounts.entries()) {
    if (!(await shouldSendReminder(ownerId, 'approval_reminder'))) {
      continue
    }

    const projectList = Array.from(data.projects).slice(0, 3).join(', ')
    const message = data.count > 1
      ? `You have ${data.count} submissions awaiting approval. Projects: ${projectList}.`
      : `A submission is awaiting approval. Project: ${projectList}.`

    await notifyUser({
      userId: ownerId,
      title: 'Approval reminder',
      message,
      type: 'approval_reminder',
    })

    reminded += 1
  }

  return { reminded }
}

async function runDeadlineReminders() {
  const now = new Date()
  const windowEnd = new Date(Date.now() + DEADLINE_REMINDER_WINDOW_HOURS * 60 * 60 * 1000)

  const projects = await prisma.project.findMany({
    where: {
      deadline: {
        gte: now,
        lte: windowEnd,
      },
      status: {
        not: 'completed',
      },
    },
    include: {
      owner: true,
      freelancer: true,
    },
  })

  if (!projects.length) {
    return { reminded: 0 }
  }

  const userProjects = new Map<string, { count: number; soonest: Date | null; title: string }>()

  for (const project of projects) {
    const deadline = project.deadline
    if (!deadline) {
      continue
    }

    const userIds = [project.ownerId, project.freelancerId].filter(Boolean) as string[]
    for (const userId of userIds) {
      const entry = userProjects.get(userId) ?? { count: 0, soonest: null, title: project.title }
      entry.count += 1
      if (!entry.soonest || deadline < entry.soonest) {
        entry.soonest = deadline
        entry.title = project.title
      }
      userProjects.set(userId, entry)
    }
  }

  let reminded = 0

  for (const [userId, data] of userProjects.entries()) {
    if (!(await shouldSendReminder(userId, 'project_deadline_reminder'))) {
      continue
    }

    const deadlineLabel = data.soonest ? data.soonest.toLocaleString() : 'soon'
    const message = data.count > 1
      ? `You have ${data.count} projects nearing deadline. Next deadline: ${data.title} (${deadlineLabel}).`
      : `Project deadline approaching: ${data.title} (${deadlineLabel}).`

    await notifyUser({
      userId,
      title: 'Project deadline reminder',
      message,
      type: 'project_deadline_reminder',
    })

    reminded += 1
  }

  return { reminded }
}

export const notificationsService = {
  async list(options: ListOptions) {
    const limit = clampPageSize(options.limit)
    const offset = Math.max(0, options.offset ?? 0)

    return prisma.notification.findMany({
      where: {
        userId: options.userId,
        ...(options.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
    })
  },

  async unreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    })
  },

  async getById(userId: string, id: string) {
    const notification = await prisma.notification.findUnique({ where: { id } })

    if (!notification || notification.userId !== userId) {
      throw new AppError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND')
    }

    return notification
  },

  async create(input: CreateNotificationInput) {
    return notifyUser(input)
  },

  async markRead(userId: string, id: string) {
    const updated = await prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    })

    if (!updated.count) {
      throw new AppError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND')
    }

    return prisma.notification.findUnique({ where: { id } })
  },

  async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })

    return { updated: result.count }
  },

  async remove(userId: string, id: string) {
    const deleted = await prisma.notification.deleteMany({
      where: { id, userId },
    })

    if (!deleted.count) {
      throw new AppError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND')
    }

    return { id }
  },

  async sendWorkSubmittedNotification(params: { userId: string; projectTitle: string; milestoneTitle?: string }) {
    const milestoneLabel = params.milestoneTitle ? ` (${params.milestoneTitle})` : ''

    return notifyUser({
      userId: params.userId,
      title: 'Work submitted',
      message: `New work submitted for ${params.projectTitle}${milestoneLabel}.`,
      type: 'work_submitted',
    })
  },

  async sendPaymentReleasedNotification(params: { userId: string; projectTitle: string; amount: string; txHash?: string | null }) {
    const txLine = params.txHash ? ` Transaction: ${params.txHash.slice(0, 10)}...` : ''

    return notifyUser({
      userId: params.userId,
      title: 'Payment released',
      message: `Payment of ${params.amount} released for ${params.projectTitle}.${txLine}`,
      type: 'payment_released',
    })
  },

  async sendTransactionAlert(params: { userId: string; projectTitle: string; status: string; amount?: string }) {
    const amountLine = params.amount ? ` for ${params.amount}` : ''
    return notifyUser({
      userId: params.userId,
      title: 'Transaction alert',
      message: `Transaction ${params.status}${amountLine} on ${params.projectTitle}.`,
      type: 'transaction_alert',
    })
  },

  async sendNftMintedNotification(params: { userId: string; projectTitle: string; tokenId?: string | number | null }) {
    const tokenLine = params.tokenId ? ` Token #${params.tokenId}.` : ''
    return notifyUser({
      userId: params.userId,
      title: 'NFT minted',
      message: `Your ProofChain certificate was minted for ${params.projectTitle}.${tokenLine}`,
      type: 'nft_minted',
    })
  },

  async runReminders() {
    const [approval, deadlines] = await Promise.all([runApprovalReminders(), runDeadlineReminders()])
    return {
      approval,
      deadlines,
    }
  },

  startReminderPolling() {
    if (!REMINDERS_ENABLED || reminderTimer || !REMINDER_INTERVAL_MS) {
      return
    }

    reminderTimer = setInterval(() => {
      void notificationsService.runReminders().catch((error) => {
        console.error('Notification reminders failed', error)
      })
    }, REMINDER_INTERVAL_MS)

    reminderTimer.unref()
  },
}
