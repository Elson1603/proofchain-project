import type { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import { AppError } from '../../utils/errors'
import { blockchainIndexerService } from '../blockchain-indexer/service'
import { paymentsService } from '../payments/service'
import { broadcastAdminEvent } from '../../socket/events'
import type { AdminRequestContext, AuditInput, PaginatedResult, PaginationParams } from './types'

const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID ?? process.env.BASE_SEPOLIA_CHAIN_ID ?? 84532)
const PLATFORM_FEE_RATE = Number(process.env.PLATFORM_FEE_RATE ?? 0.025)
const ADMIN_PAGE_LIMIT = 25

function pagination(params: PaginationParams = {}) {
  const page = Math.max(1, Number(params.page ?? 1))
  const limit = Math.min(100, Math.max(1, Number(params.limit ?? ADMIN_PAGE_LIMIT)))

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  }
}

function pageResult<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

function daysAgo(days = 30) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(0, 0, 0, 0)
  return date
}

function dayKey(date: Date | string | null | undefined) {
  if (!date) {
    return 'unknown'
  }

  return new Date(date).toISOString().slice(0, 10)
}

function buildDailyBuckets(days: number) {
  return Array.from({ length: days }).map((_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (days - index - 1))
    date.setHours(0, 0, 0, 0)
    return date.toISOString().slice(0, 10)
  })
}

function sumByDay<T>(items: T[], days: number, getDate: (item: T) => Date | string, getValue: (item: T) => number) {
  const buckets = new Map(buildDailyBuckets(days).map((date) => [date, 0]))

  for (const item of items) {
    const key = dayKey(getDate(item))
    if (buckets.has(key)) {
      buckets.set(key, Number((buckets.get(key) ?? 0) + getValue(item)))
    }
  }

  return Array.from(buckets.entries()).map(([date, value]) => ({ date, value }))
}

function countByDay<T>(items: T[], days: number, getDate: (item: T) => Date | string) {
  return sumByDay(items, days, getDate, () => 1)
}

function toJson(value: unknown): Prisma.InputJsonValue {
  if (value === null || typeof value === 'undefined') {
    return {}
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function statusToMonitoring(status: string) {
  if (status === 'confirmed') return 'CONFIRMED'
  if (status === 'failed') return 'FAILED'
  if (status === 'replaced') return 'REVERTED'
  if (status === 'submitted') return 'PROCESSING'
  return 'PENDING'
}

function typeToMonitoringCategory(type: string) {
  if (type === 'certificate_mint' || type === 'certificate_revoke') return 'NFT_MINT'
  if (type === 'payment_release') return 'ESCROW_RELEASE'
  if (type === 'escrow_deposit' || type === 'refund') return 'UGF_PAYMENT'
  return 'GASLESS_EXECUTION'
}

function explorerUrl(txHash?: string | null, chainId = DEFAULT_CHAIN_ID) {
  if (!txHash) {
    return null
  }

  if (chainId === 84532) {
    return `https://sepolia.basescan.org/tx/${txHash}`
  }

  return `https://basescan.org/tx/${txHash}`
}

function latencyMs(submittedAt?: Date | null, confirmedAt?: Date | null) {
  if (!submittedAt || !confirmedAt) {
    return null
  }

  return Math.max(0, confirmedAt.getTime() - submittedAt.getTime())
}

async function writeAudit(input: AuditInput) {
  return prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      previousValue: input.previousValue ?? undefined,
      newValue: input.newValue ?? undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  })
}

async function upsertMonitoring(transaction: {
  id: string
  paymentId: string | null
  nftCertificateId: string | null
  txHash: string | null
  chainId: number
  type: string
  status: string
  gasQuote: number | null
  gasQuoteCurrency: string | null
  submittedAt: Date | null
  confirmedAt: Date | null
  errorMessage: string | null
}) {
  return prisma.transactionMonitoring.upsert({
    where: { transactionId: transaction.id },
    create: {
      transactionId: transaction.id,
      paymentId: transaction.paymentId,
      nftCertificateId: transaction.nftCertificateId,
      txHash: transaction.txHash,
      chainId: transaction.chainId,
      category: typeToMonitoringCategory(transaction.type) as Parameters<typeof prisma.transactionMonitoring.create>[0]['data']['category'],
      status: statusToMonitoring(transaction.status) as Parameters<typeof prisma.transactionMonitoring.create>[0]['data']['status'],
      gasQuote: transaction.gasQuote ?? undefined,
      gasQuoteCurrency: transaction.gasQuoteCurrency ?? undefined,
      latencyMs: latencyMs(transaction.submittedAt, transaction.confirmedAt) ?? undefined,
      explorerUrl: explorerUrl(transaction.txHash, transaction.chainId) ?? undefined,
      failureReason: transaction.errorMessage ?? undefined,
      riskScore: transaction.status === 'failed' ? 75 : 0,
      lastSyncedAt: new Date(),
    },
    update: {
      paymentId: transaction.paymentId,
      nftCertificateId: transaction.nftCertificateId,
      txHash: transaction.txHash,
      chainId: transaction.chainId,
      category: typeToMonitoringCategory(transaction.type) as Parameters<typeof prisma.transactionMonitoring.update>[0]['data']['category'],
      status: statusToMonitoring(transaction.status) as Parameters<typeof prisma.transactionMonitoring.update>[0]['data']['status'],
      gasQuote: transaction.gasQuote ?? undefined,
      gasQuoteCurrency: transaction.gasQuoteCurrency ?? undefined,
      latencyMs: latencyMs(transaction.submittedAt, transaction.confirmedAt) ?? undefined,
      explorerUrl: explorerUrl(transaction.txHash, transaction.chainId) ?? undefined,
      failureReason: transaction.errorMessage ?? undefined,
      riskScore: transaction.status === 'failed' ? 75 : 0,
      lastSyncedAt: new Date(),
    },
  })
}

async function getTransactionWithRelations(txHash: string) {
  return prisma.transaction.findFirst({
    where: { txHash },
    orderBy: { createdAt: 'desc' },
    include: {
      monitoring: true,
      payment: {
        include: {
          project: true,
          payer: { select: { id: true, walletAddress: true, email: true, fullName: true } },
          payee: { select: { id: true, walletAddress: true, email: true, fullName: true } },
        },
      },
      nftCertificate: {
        include: {
          project: true,
          user: { select: { id: true, walletAddress: true, email: true, fullName: true } },
        },
      },
    },
  })
}

async function createFraudAlertIfMissing(input: {
  type: string
  title: string
  entityType: string
  entityId?: string | null
  walletAddress?: string | null
  txHash?: string | null
  userId?: string | null
  riskScore: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description?: string
  signals?: Record<string, unknown>
}) {
  const existing = await prisma.fraudAlert.findFirst({
    where: {
      type: input.type,
      status: { in: ['OPEN', 'INVESTIGATING'] },
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      walletAddress: input.walletAddress ?? undefined,
      txHash: input.txHash ?? undefined,
    },
  })

  if (existing) {
    return null
  }

  const alert = await prisma.fraudAlert.create({
    data: {
      type: input.type,
      title: input.title,
      description: input.description,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      walletAddress: input.walletAddress ?? undefined,
      txHash: input.txHash ?? undefined,
      userId: input.userId ?? undefined,
      riskScore: input.riskScore,
      severity: input.severity,
      signals: toJson(input.signals ?? {}),
    },
  })

  broadcastAdminEvent({
    type: 'fraud_alert',
    severity: input.severity === 'CRITICAL' ? 'critical' : 'warning',
    title: input.title,
    message: input.description,
    entityType: input.entityType,
    entityId: input.entityId ?? undefined,
    txHash: input.txHash ?? undefined,
    meta: { riskScore: input.riskScore, walletAddress: input.walletAddress },
  })

  return alert
}

export const adminService = {
  writeAudit,

  async listUsers(filters: {
    page?: number
    limit?: number
    search?: string
    role?: string
    verification?: 'verified' | 'unverified'
    suspension?: 'active' | 'clear'
  }) {
    const { page, limit, skip } = pagination(filters)
    const now = new Date()
    const where: Prisma.UserWhereInput = {}

    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { walletAddress: { contains: filters.search, mode: 'insensitive' } },
        { linkedWallets: { some: { walletAddress: { contains: filters.search, mode: 'insensitive' } } } },
      ]
    }

    if (filters.role) {
      where.role = filters.role as Prisma.UserWhereInput['role']
    }

    if (filters.verification) {
      where.isVerified = filters.verification === 'verified'
    }

    if (filters.suspension === 'active') {
      where.userSuspensions = {
        some: {
          status: 'ACTIVE',
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      }
    }

    if (filters.suspension === 'clear') {
      where.userSuspensions = {
        none: {
          status: 'ACTIVE',
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      }
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          linkedWallets: { orderBy: { linkedAt: 'desc' }, take: 5 },
          userSuspensions: {
            where: { status: 'ACTIVE', OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          fraudAlerts: {
            where: { status: { in: ['OPEN', 'INVESTIGATING'] } },
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
          _count: {
            select: {
              projects: true,
              freelancerProjects: true,
              nftCertificates: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ])

    const ids = users.map((user) => user.id)
    const earnings = ids.length
      ? await prisma.payment.groupBy({
          by: ['payeeId'],
          where: { payeeId: { in: ids }, status: 'released' },
          _sum: { amount: true },
        })
      : []

    const earningsByUser = new Map(earnings.map((item) => [item.payeeId, item._sum.amount ?? 0]))

    return pageResult(
      users.map((user) => ({
        ...user,
        projectsCount: user._count.projects + user._count.freelancerProjects,
        nftsOwned: user._count.nftCertificates,
        totalEarnings: earningsByUser.get(user.id) ?? 0,
        isSuspended: user.userSuspensions.length > 0,
        openFraudAlerts: user.fraudAlerts.length,
      })),
      total,
      page,
      limit,
    )
  },

  async getUserActivity(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        linkedWallets: { orderBy: { linkedAt: 'desc' } },
        userSuspensions: { orderBy: { createdAt: 'desc' } },
        fraudAlerts: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })

    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    }

    const [projects, payments, certificates, messages, auditLogs] = await Promise.all([
      prisma.project.findMany({
        where: { OR: [{ ownerId: id }, { freelancerId: id }, { invitedFreelancerId: id }] },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      prisma.payment.findMany({
        where: { OR: [{ payerId: id }, { payeeId: id }] },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { transactions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      prisma.nftCertificate.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.message.findMany({
        where: { senderId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.adminAuditLog.findMany({
        where: { adminId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    const timeline = [
      ...projects.map((item) => ({
        type: 'project',
        title: item.title,
        status: item.status,
        entityId: item.id,
        timestamp: item.updatedAt,
      })),
      ...payments.map((item) => ({
        type: 'payment',
        title: `${item.type} ${item.amount} ${item.currency}`,
        status: item.status,
        entityId: item.id,
        txHash: item.transactions[0]?.txHash,
        timestamp: item.createdAt,
      })),
      ...certificates.map((item) => ({
        type: 'nft',
        title: `Certificate #${item.tokenId}`,
        status: item.certificateStatus,
        entityId: item.id,
        txHash: item.transactionHash,
        timestamp: item.createdAt,
      })),
      ...messages.map((item) => ({
        type: 'message',
        title: item.content.slice(0, 120),
        status: item.messageType,
        entityId: item.id,
        timestamp: item.createdAt,
      })),
      ...auditLogs.map((item) => ({
        type: 'audit',
        title: item.actionType,
        status: item.entityType,
        entityId: item.entityId,
        timestamp: item.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 60)

    return { user, timeline }
  },

  async suspendUser(id: string, input: { reason: string; endsAt?: string; metadata?: Record<string, unknown> }, ctx: AdminRequestContext) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    }

    const suspension = await prisma.userSuspension.create({
      data: {
        userId: id,
        adminId: ctx.adminId,
        reason: input.reason,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        metadata: toJson(input.metadata ?? {}),
      },
    })

    await writeAudit({
      ...ctx,
      actionType: 'USER_SUSPENDED',
      entityType: 'User',
      entityId: id,
      previousValue: toJson({ role: user.role, isVerified: user.isVerified }),
      newValue: toJson(suspension),
    })

    broadcastAdminEvent({
      type: 'user_moderation',
      severity: 'warning',
      title: 'User suspended',
      message: input.reason,
      entityType: 'User',
      entityId: id,
      meta: { walletAddress: user.walletAddress },
    })

    return suspension
  },

  async verifyUser(id: string, input: { isVerified: boolean; notes?: string }, ctx: AdminRequestContext) {
    const previous = await prisma.user.findUnique({ where: { id } })
    if (!previous) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isVerified: input.isVerified },
    })

    await writeAudit({
      ...ctx,
      actionType: input.isVerified ? 'USER_VERIFIED' : 'USER_UNVERIFIED',
      entityType: 'User',
      entityId: id,
      previousValue: toJson({ isVerified: previous.isVerified }),
      newValue: toJson({ isVerified: user.isVerified, notes: input.notes }),
    })

    return user
  },

  async updateUserRole(id: string, input: { role: string; reason?: string }, ctx: AdminRequestContext) {
    const previous = await prisma.user.findUnique({ where: { id } })
    if (!previous) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role: input.role as Prisma.UserUpdateInput['role'] },
    })

    await writeAudit({
      ...ctx,
      actionType: 'USER_ROLE_UPDATED',
      entityType: 'User',
      entityId: id,
      previousValue: toJson({ role: previous.role }),
      newValue: toJson({ role: user.role, reason: input.reason }),
    })

    return user
  },

  async resetReputation(id: string, input: { reputationScore: number; reason: string }, ctx: AdminRequestContext) {
    const previous = await prisma.user.findUnique({ where: { id } })
    if (!previous) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    }

    const user = await prisma.user.update({
      where: { id },
      data: { reputationScore: input.reputationScore },
    })

    await writeAudit({
      ...ctx,
      actionType: 'USER_REPUTATION_RESET',
      entityType: 'User',
      entityId: id,
      previousValue: toJson({ reputationScore: previous.reputationScore }),
      newValue: toJson({ reputationScore: user.reputationScore, reason: input.reason }),
    })

    return user
  },

  async flagUser(id: string, input: { reason: string; riskScore: number; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }, ctx: AdminRequestContext) {
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      throw new AppError(404, 'User not found', 'USER_NOT_FOUND')
    }

    const alert = await prisma.fraudAlert.create({
      data: {
        userId: id,
        type: 'ADMIN_FLAGGED_ACCOUNT',
        severity: input.severity,
        status: 'OPEN',
        riskScore: input.riskScore,
        title: 'Account flagged by admin',
        description: input.reason,
        entityType: 'User',
        entityId: id,
        walletAddress: user.walletAddress,
        signals: { source: 'admin', adminId: ctx.adminId },
      },
    })

    await writeAudit({
      ...ctx,
      actionType: 'USER_FLAGGED',
      entityType: 'User',
      entityId: id,
      newValue: toJson(alert),
    })

    broadcastAdminEvent({
      type: 'fraud_alert',
      severity: input.severity === 'CRITICAL' ? 'critical' : 'warning',
      title: 'Account flagged',
      message: input.reason,
      entityType: 'User',
      entityId: id,
      meta: { walletAddress: user.walletAddress, riskScore: input.riskScore },
    })

    return alert
  },

  async listProjects(filters: { page?: number; limit?: number; status?: string; search?: string; participantId?: string }) {
    const { page, limit, skip } = pagination(filters)
    const where: Prisma.ProjectWhereInput = {}

    if (filters.status) {
      where.status = filters.status
    }

    if (filters.participantId) {
      where.OR = [
        { ownerId: filters.participantId },
        { freelancerId: filters.participantId },
        { invitedFreelancerId: filters.participantId },
      ]
    }

    if (filters.search) {
      const search: Prisma.ProjectWhereInput[] = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { owner: { walletAddress: { contains: filters.search, mode: 'insensitive' } } },
        { owner: { email: { contains: filters.search, mode: 'insensitive' } } },
        { freelancer: { walletAddress: { contains: filters.search, mode: 'insensitive' } } },
        { freelancer: { email: { contains: filters.search, mode: 'insensitive' } } },
      ]
      where.OR = where.OR ? [...(where.OR as Prisma.ProjectWhereInput[]), ...search] : search
    }

    const [projects, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: { select: { id: true, fullName: true, email: true, walletAddress: true, avatarUrl: true } },
          freelancer: { select: { id: true, fullName: true, email: true, walletAddress: true, avatarUrl: true } },
          milestones: { orderBy: { createdAt: 'asc' } },
          payments: { orderBy: { createdAt: 'desc' }, take: 3, include: { transactions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
          disputes: { where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'ESCALATED'] } }, take: 3 },
          nftCertificates: { take: 3 },
          _count: { select: { payments: true, disputes: true, nftCertificates: true } },
        },
      }),
      prisma.project.count({ where }),
    ])

    return pageResult(projects, total, page, limit)
  },

  async getProject(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: true,
        freelancer: true,
        invitedFreelancer: true,
        milestones: {
          orderBy: { createdAt: 'asc' },
          include: { submissions: { orderBy: { createdAt: 'desc' }, include: { submittedBy: true } } },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: { transactions: { orderBy: { createdAt: 'desc' } }, payer: true, payee: true },
        },
        nftCertificates: { orderBy: { createdAt: 'desc' }, include: { transactions: true } },
        disputes: { orderBy: { createdAt: 'desc' }, include: { resolutions: true, raisedBy: true, againstUser: true } },
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 100,
              include: { sender: true, attachments: true, reactions: true },
            },
          },
        },
      },
    })

    if (!project) {
      throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    return project
  },

  async forceCloseProject(id: string, input: { status: 'completed' | 'rejected' | 'disputed'; reason: string }, ctx: AdminRequestContext) {
    const previous = await prisma.project.findUnique({ where: { id } })
    if (!previous) {
      throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    const project = await prisma.project.update({
      where: { id },
      data: { status: input.status },
    })

    await writeAudit({
      ...ctx,
      actionType: 'PROJECT_FORCE_CLOSED',
      entityType: 'Project',
      entityId: id,
      previousValue: toJson({ status: previous.status }),
      newValue: toJson({ status: project.status, reason: input.reason }),
    })

    broadcastAdminEvent({
      type: 'project_activity',
      severity: 'warning',
      title: 'Project status changed by admin',
      message: input.reason,
      entityType: 'Project',
      entityId: id,
      meta: { status: project.status },
    })

    return project
  },

  async createDispute(input: {
    projectId: string
    milestoneId?: string
    raisedById: string
    againstUserId?: string
    reason: string
    description?: string
    priority: string
    evidence?: Record<string, unknown>
  }, ctx: AdminRequestContext) {
    const project = await prisma.project.findUnique({ where: { id: input.projectId } })
    if (!project) {
      throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND')
    }

    const dispute = await prisma.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          raisedById: input.raisedById,
          againstUserId: input.againstUserId,
          assignedAdminId: ctx.adminId,
          reason: input.reason,
          description: input.description,
          priority: input.priority,
          evidence: toJson(input.evidence ?? {}),
        },
      })

      await tx.project.update({
        where: { id: input.projectId },
        data: { status: 'disputed' },
      })

      return created
    })

    await writeAudit({
      ...ctx,
      actionType: 'DISPUTE_CREATED',
      entityType: 'Dispute',
      entityId: dispute.id,
      newValue: toJson(dispute),
    })

    broadcastAdminEvent({
      type: 'dispute_raised',
      severity: 'critical',
      title: 'New dispute opened',
      message: input.reason,
      entityType: 'Dispute',
      entityId: dispute.id,
      meta: { projectId: input.projectId, priority: input.priority },
    })

    return dispute
  },

  async listDisputes(filters: { page?: number; limit?: number; status?: string; projectId?: string; search?: string }) {
    const { page, limit, skip } = pagination(filters)
    const where: Prisma.DisputeWhereInput = {}

    if (filters.status) {
      where.status = filters.status as Prisma.DisputeWhereInput['status']
    }

    if (filters.projectId) {
      where.projectId = filters.projectId
    }

    if (filters.search) {
      where.OR = [
        { reason: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { project: { title: { contains: filters.search, mode: 'insensitive' } } },
        { raisedBy: { walletAddress: { contains: filters.search, mode: 'insensitive' } } },
        { againstUser: { walletAddress: { contains: filters.search, mode: 'insensitive' } } },
      ]
    }

    const [disputes, total] = await prisma.$transaction([
      prisma.dispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        include: {
          project: true,
          milestone: true,
          raisedBy: { select: { id: true, fullName: true, email: true, walletAddress: true, avatarUrl: true } },
          againstUser: { select: { id: true, fullName: true, email: true, walletAddress: true, avatarUrl: true } },
          assignedAdmin: { select: { id: true, fullName: true, email: true, walletAddress: true, role: true } },
          resolutions: { orderBy: { createdAt: 'desc' }, take: 3 },
        },
      }),
      prisma.dispute.count({ where }),
    ])

    return pageResult(disputes, total, page, limit)
  },

  async getDispute(id: string) {
    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            owner: true,
            freelancer: true,
            milestones: { include: { submissions: true } },
            payments: { include: { transactions: true, payer: true, payee: true } },
            nftCertificates: { include: { transactions: true } },
            conversation: {
              include: {
                messages: {
                  orderBy: { createdAt: 'desc' },
                  take: 120,
                  include: { sender: true, attachments: true },
                },
              },
            },
          },
        },
        milestone: { include: { submissions: true } },
        raisedBy: true,
        againstUser: true,
        assignedAdmin: true,
        resolutions: { orderBy: { createdAt: 'desc' }, include: { admin: true, payment: true } },
      },
    })

    if (!dispute) {
      throw new AppError(404, 'Dispute not found', 'DISPUTE_NOT_FOUND')
    }

    return dispute
  },

  async resolveDispute(
    id: string,
    input: {
      action: 'RELEASE_PAYMENT' | 'REFUND_CLIENT' | 'SPLIT_PAYMENT' | 'REQUEST_EVIDENCE' | 'REJECT_DISPUTE'
      notes: string
      paymentId?: string
      releaseAmount?: number
      refundAmount?: number
      freelancerAmount?: number
      clientAmount?: number
    },
    ctx: AdminRequestContext,
  ) {
    const previous = await prisma.dispute.findUnique({ where: { id }, include: { project: true } })
    if (!previous) {
      throw new AppError(404, 'Dispute not found', 'DISPUTE_NOT_FOUND')
    }

    const result = await prisma.$transaction(async (tx) => {
      let paymentUpdate: unknown = null

      if (input.paymentId) {
        const payment = await tx.payment.findUnique({ where: { id: input.paymentId } })
        if (!payment) {
          throw new AppError(404, 'Payment not found', 'PAYMENT_NOT_FOUND')
        }

        if (input.action === 'RELEASE_PAYMENT' || input.action === 'SPLIT_PAYMENT') {
          paymentUpdate = await tx.payment.update({
            where: { id: input.paymentId },
            data: {
              status: 'released',
              releasedAt: new Date(),
              failureReason: null,
              metadata: {
                ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
                adminResolution: input.action,
                releaseAmount: input.releaseAmount,
                freelancerAmount: input.freelancerAmount,
                clientAmount: input.clientAmount,
              } as Prisma.InputJsonValue,
            },
          })
        }

        if (input.action === 'REFUND_CLIENT') {
          paymentUpdate = await tx.payment.update({
            where: { id: input.paymentId },
            data: {
              status: 'refunded',
              failureReason: null,
              metadata: {
                ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
                adminResolution: input.action,
                refundAmount: input.refundAmount,
              } as Prisma.InputJsonValue,
            },
          })
        }
      }

      const status =
        input.action === 'REQUEST_EVIDENCE'
          ? 'UNDER_REVIEW'
          : input.action === 'REJECT_DISPUTE'
            ? 'REJECTED'
            : 'RESOLVED'

      const dispute = await tx.dispute.update({
        where: { id },
        data: {
          status,
          assignedAdminId: previous.assignedAdminId ?? ctx.adminId,
          resolvedAt: status === 'RESOLVED' || status === 'REJECTED' ? new Date() : undefined,
        },
      })

      if (status === 'RESOLVED') {
        await tx.project.update({
          where: { id: previous.projectId },
          data: { status: input.action === 'REFUND_CLIENT' ? 'rejected' : 'completed' },
        })
      }

      const resolution = await tx.disputeResolution.create({
        data: {
          disputeId: id,
          adminId: ctx.adminId,
          paymentId: input.paymentId,
          action: input.action,
          notes: input.notes,
          releaseAmount: input.releaseAmount,
          refundAmount: input.refundAmount,
          freelancerAmount: input.freelancerAmount,
          clientAmount: input.clientAmount,
          previousValue: toJson(previous),
          newValue: toJson({ dispute, paymentUpdate }),
        },
      })

      return { dispute, resolution, paymentUpdate }
    })

    await writeAudit({
      ...ctx,
      actionType: 'DISPUTE_RESOLVED',
      entityType: 'Dispute',
      entityId: id,
      previousValue: toJson(previous),
      newValue: toJson(result),
    })

    broadcastAdminEvent({
      type: result.dispute.status === 'UNDER_REVIEW' ? 'dispute_raised' : 'dispute_resolved',
      severity: result.dispute.status === 'RESOLVED' ? 'success' : 'warning',
      title: result.dispute.status === 'UNDER_REVIEW' ? 'Additional evidence requested' : 'Dispute resolved',
      message: input.notes,
      entityType: 'Dispute',
      entityId: id,
      meta: { action: input.action, projectId: previous.projectId },
    })

    return result
  },

  async listTransactions(filters: { page?: number; limit?: number; search?: string; status?: string; type?: string }) {
    const { page, limit, skip } = pagination(filters)
    const where: Prisma.TransactionWhereInput = {}

    if (filters.status) {
      where.status = filters.status as Prisma.TransactionWhereInput['status']
    }

    if (filters.type) {
      where.type = filters.type as Prisma.TransactionWhereInput['type']
    }

    if (filters.search) {
      where.OR = [
        { txHash: { contains: filters.search, mode: 'insensitive' } },
        { relayerRequestId: { contains: filters.search, mode: 'insensitive' } },
        { fromAddress: { contains: filters.search, mode: 'insensitive' } },
        { toAddress: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          monitoring: true,
          payment: { include: { project: true, payer: true, payee: true } },
          nftCertificate: { include: { project: true, user: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ])

    await Promise.all(
      transactions
        .filter((transaction) => !transaction.monitoring)
        .map((transaction) => upsertMonitoring(transaction)),
    )

    return pageResult(
      transactions.map((transaction) => ({
        ...transaction,
        explorerUrl: explorerUrl(transaction.txHash, transaction.chainId),
        monitoringStatus: transaction.monitoring?.status ?? statusToMonitoring(transaction.status),
      })),
      total,
      page,
      limit,
    )
  },

  async getTransaction(txHash: string) {
    const transaction = await getTransactionWithRelations(txHash)
    if (!transaction) {
      throw new AppError(404, 'Transaction not found', 'TRANSACTION_NOT_FOUND')
    }

    const [events, monitoring] = await Promise.all([
      prisma.blockchainIndexedEvent.findMany({
        where: { txHash },
        orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
      }),
      upsertMonitoring(transaction),
    ])

    return {
      ...transaction,
      monitoring,
      events,
      explorerUrl: explorerUrl(transaction.txHash, transaction.chainId),
    }
  },

  async retryTransaction(txHash: string, input: { relayerRequestId?: string; gasQuote?: number; gasQuoteCurrency?: string; notes?: string }, ctx: AdminRequestContext) {
    const transaction = await prisma.transaction.findFirst({
      where: { txHash },
      orderBy: { createdAt: 'desc' },
    })

    if (!transaction) {
      throw new AppError(404, 'Transaction not found', 'TRANSACTION_NOT_FOUND')
    }

    if (transaction.status === 'confirmed') {
      throw new AppError(409, 'Confirmed transactions cannot be retried', 'TRANSACTION_ALREADY_CONFIRMED')
    }

    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'queued',
        relayerRequestId: input.relayerRequestId ?? transaction.relayerRequestId,
        gasQuote: input.gasQuote ?? transaction.gasQuote,
        gasQuoteCurrency: input.gasQuoteCurrency ?? transaction.gasQuoteCurrency,
        errorMessage: null,
      },
    })

    const monitoring = await prisma.transactionMonitoring.upsert({
      where: { transactionId: transaction.id },
      create: {
        transactionId: transaction.id,
        paymentId: transaction.paymentId,
        nftCertificateId: transaction.nftCertificateId,
        txHash: transaction.txHash,
        chainId: transaction.chainId,
        category: typeToMonitoringCategory(transaction.type) as Parameters<typeof prisma.transactionMonitoring.create>[0]['data']['category'],
        status: 'PROCESSING',
        gasQuote: input.gasQuote ?? transaction.gasQuote ?? undefined,
        gasQuoteCurrency: input.gasQuoteCurrency ?? transaction.gasQuoteCurrency ?? undefined,
        retryAttempts: 1,
        explorerUrl: explorerUrl(transaction.txHash, transaction.chainId) ?? undefined,
        metadata: { retryNotes: input.notes },
        lastSyncedAt: new Date(),
      },
      update: {
        status: 'PROCESSING',
        gasQuote: input.gasQuote ?? transaction.gasQuote ?? undefined,
        gasQuoteCurrency: input.gasQuoteCurrency ?? transaction.gasQuoteCurrency ?? undefined,
        retryAttempts: { increment: 1 },
        failureReason: null,
        metadata: { retryNotes: input.notes },
        lastSyncedAt: new Date(),
      },
    })

    await writeAudit({
      ...ctx,
      actionType: 'TRANSACTION_RETRY_REQUESTED',
      entityType: 'Transaction',
      entityId: transaction.id,
      previousValue: toJson(transaction),
      newValue: toJson({ updated, monitoring }),
    })

    broadcastAdminEvent({
      type: 'tx_retry',
      severity: 'warning',
      title: 'Transaction queued for retry',
      message: input.notes,
      entityType: 'Transaction',
      entityId: transaction.id,
      txHash,
      meta: { relayerRequestId: updated.relayerRequestId },
    })

    return { transaction: updated, monitoring }
  },

  async syncTransactions(ctx: AdminRequestContext) {
    const [payments, indexer] = await Promise.all([
      paymentsService.pollPendingTransactions(),
      blockchainIndexerService.runOnce(),
    ])

    await writeAudit({
      ...ctx,
      actionType: 'TRANSACTION_MANUAL_SYNC',
      entityType: 'TransactionMonitoring',
      newValue: toJson({ payments, indexer }),
    })

    broadcastAdminEvent({
      type: 'ugf_update',
      severity: 'info',
      title: 'Manual blockchain sync completed',
      meta: { payments, indexer },
    })

    return { payments, indexer }
  },

  async overview(days = 14) {
    const since = daysAgo(days)
    const now = new Date()

    const [
      userCount,
      activeSessions,
      activeProjects,
      openDisputes,
      payments,
      platformFees,
      transactions,
      certificates,
      fraudAlerts,
      recentTransactions,
      recentDisputes,
      recentProjects,
      recentCertificates,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.session.groupBy({ by: ['userId'], where: { expiresAt: { gt: now } } }),
      prisma.project.count({ where: { status: { in: ['open', 'in_progress', 'submitted', 'approved', 'disputed'] } } }),
      prisma.dispute.count({ where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'ESCALATED'] } } }),
      prisma.payment.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } }),
      prisma.payment.aggregate({ where: { type: 'platform_fee', status: 'released' }, _sum: { amount: true } }),
      prisma.transaction.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } }),
      prisma.nftCertificate.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } }),
      prisma.fraudAlert.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } }),
      prisma.transaction.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { payment: { include: { project: true } } } }),
      prisma.dispute.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { project: true, raisedBy: true } }),
      prisma.project.findMany({ orderBy: { updatedAt: 'desc' }, take: 8, include: { owner: true, freelancer: true } }),
      prisma.nftCertificate.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { project: true, user: true } }),
    ])

    const allReleased = await prisma.payment.aggregate({
      where: { status: 'released' },
      _sum: { amount: true },
    })
    const ugf = await prisma.payment.aggregate({
      where: { type: { in: ['escrow_deposit', 'milestone_release', 'refund'] } },
      _sum: { amount: true },
      _count: { _all: true },
    })
    const escrowLocked = await prisma.payment.aggregate({
      where: { status: { in: ['pending', 'escrowed'] } },
      _sum: { amount: true },
    })
    const txCounts = await prisma.transaction.groupBy({ by: ['status'], _count: { _all: true } })
    const confirmed = txCounts.find((item) => item.status === 'confirmed')?._count._all ?? 0
    const failed = txCounts.find((item) => item.status === 'failed')?._count._all ?? 0
    const successRate = confirmed + failed === 0 ? 100 : Math.round((confirmed / (confirmed + failed)) * 1000) / 10

    const releasedRevenue = (allReleased._sum.amount ?? 0) * PLATFORM_FEE_RATE
    const totalRevenue = releasedRevenue + (platformFees._sum.amount ?? 0)

    return {
      kpis: {
        totalPlatformRevenue: totalRevenue,
        totalUgfPayments: ugf._sum.amount ?? 0,
        totalUgfPaymentCount: ugf._count._all,
        totalNftsMinted: await prisma.nftCertificate.count({ where: { certificateStatus: { in: ['minted', 'verified'] } } }),
        activeUsers: activeSessions.length,
        totalUsers: userCount,
        activeProjects,
        transactionSuccessRate: successRate,
        openDisputes,
        escrowLockedFunds: escrowLocked._sum.amount ?? 0,
        openFraudAlerts: await prisma.fraudAlert.count({ where: { status: { in: ['OPEN', 'INVESTIGATING'] } } }),
      },
      charts: {
        paymentActivity: sumByDay(payments, days, (item) => item.createdAt, (item) => item.amount),
        dailyActiveUsers: countByDay(
          await prisma.user.findMany({ where: { updatedAt: { gte: since } }, select: { updatedAt: true } }),
          days,
          (item) => item.updatedAt,
        ),
        nftMintTrends: countByDay(certificates, days, (item) => item.createdAt),
        transactionOutcomes: [
          { name: 'Confirmed', value: confirmed },
          { name: 'Failed', value: failed },
          { name: 'Pending', value: txCounts.find((item) => item.status === 'queued')?._count._all ?? 0 },
        ],
        projectCompletionTrends: countByDay(
          await prisma.project.findMany({ where: { status: 'completed', updatedAt: { gte: since } }, select: { updatedAt: true } }),
          days,
          (item) => item.updatedAt,
        ),
        fraudAlerts: countByDay(fraudAlerts, days, (item) => item.createdAt),
      },
      realtime: {
        transactions: recentTransactions,
        disputes: recentDisputes,
        projectActivity: recentProjects,
        nftMints: recentCertificates,
      },
    }
  },

  async paymentAnalytics(days = 30) {
    const since = daysAgo(days)
    const payments = await prisma.payment.findMany({
      where: { createdAt: { gte: since } },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    })

    const success = payments.filter((item) => ['released', 'escrowed'].includes(item.status)).length
    const failed = payments.filter((item) => item.status === 'failed').length
    const latency = payments
      .flatMap((item) => item.transactions)
      .filter((item) => item.submittedAt && item.confirmedAt)
      .map((item) => ({
        date: dayKey(item.createdAt),
        value: latencyMs(item.submittedAt, item.confirmedAt) ?? 0,
      }))

    return {
      volume: sumByDay(payments, days, (item) => item.createdAt, (item) => item.amount),
      successFailure: [
        { name: 'Succeeded', value: success },
        { name: 'Failed', value: failed },
        { name: 'Pending', value: Math.max(0, payments.length - success - failed) },
      ],
      gasQuotes: sumByDay(
        payments.flatMap((item) => item.transactions),
        days,
        (item) => item.createdAt,
        (item) => item.gasQuote ?? 0,
      ),
      executionTiming: latency,
      liveFeed: payments.slice(-12).reverse(),
    }
  },

  async nftAnalytics(days = 30) {
    const since = daysAgo(days)
    const certificates = await prisma.nftCertificate.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      include: { project: true, user: true },
    })

    const byStatus = await prisma.nftCertificate.groupBy({
      by: ['certificateStatus'],
      _count: { _all: true },
    })

    return {
      mintedTrend: countByDay(certificates, days, (item) => item.createdAt),
      byStatus: byStatus.map((item) => ({ name: item.certificateStatus, value: item._count._all })),
      recent: certificates.slice(-20).reverse(),
      total: await prisma.nftCertificate.count(),
      verified: await prisma.nftCertificate.count({ where: { certificateStatus: 'verified' } }),
    }
  },

  async listFraudAlerts(filters: { page?: number; limit?: number; status?: string; severity?: string; search?: string }) {
    const { page, limit, skip } = pagination(filters)
    const where: Prisma.FraudAlertWhereInput = {}

    if (filters.status) where.status = filters.status as Prisma.FraudAlertWhereInput['status']
    if (filters.severity) where.severity = filters.severity as Prisma.FraudAlertWhereInput['severity']
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { walletAddress: { contains: filters.search, mode: 'insensitive' } },
        { txHash: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [alerts, total] = await prisma.$transaction([
      prisma.fraudAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
        include: {
          user: { select: { id: true, walletAddress: true, email: true, fullName: true, reputationScore: true } },
          assignedAdmin: { select: { id: true, walletAddress: true, email: true, fullName: true, role: true } },
        },
      }),
      prisma.fraudAlert.count({ where }),
    ])

    return pageResult(alerts, total, page, limit)
  },

  async runFraudScan(ctx: AdminRequestContext) {
    const since = daysAgo(7)
    const created = []

    const failedWallets = await prisma.transaction.groupBy({
      by: ['fromAddress'],
      where: {
        status: 'failed',
        fromAddress: { not: null },
        createdAt: { gte: since },
      },
      _count: { _all: true },
    })

    for (const wallet of failedWallets.filter((item) => (item._count._all ?? 0) >= 3)) {
      const alert = await createFraudAlertIfMissing({
        type: 'REPEATED_FAILED_TRANSACTIONS',
        title: 'Repeated failed gasless executions',
        description: `${wallet.fromAddress} has ${wallet._count._all} failed transactions in the last 7 days.`,
        entityType: 'Wallet',
        walletAddress: wallet.fromAddress,
        riskScore: Math.min(100, 55 + wallet._count._all * 10),
        severity: wallet._count._all >= 6 ? 'CRITICAL' : 'HIGH',
        signals: { failedTransactions: wallet._count._all, windowDays: 7 },
      })
      if (alert) created.push(alert)
    }

    const projectSpammers = await prisma.project.groupBy({
      by: ['ownerId'],
      where: { createdAt: { gte: daysAgo(1) }, status: { in: ['draft', 'open'] } },
      _count: { _all: true },
    })

    for (const owner of projectSpammers.filter((item) => (item._count._all ?? 0) >= 5)) {
      const user = await prisma.user.findUnique({ where: { id: owner.ownerId } })
      const alert = await createFraudAlertIfMissing({
        type: 'SPAM_PROJECT_CREATION',
        title: 'High-velocity project creation',
        description: `${owner._count._all} draft/open projects were created in 24 hours.`,
        entityType: 'User',
        entityId: owner.ownerId,
        userId: owner.ownerId,
        walletAddress: user?.walletAddress,
        riskScore: Math.min(100, 50 + owner._count._all * 8),
        severity: owner._count._all >= 8 ? 'CRITICAL' : 'HIGH',
        signals: { projectCount: owner._count._all, windowHours: 24 },
      })
      if (alert) created.push(alert)
    }

    await writeAudit({
      ...ctx,
      actionType: 'FRAUD_SCAN_RUN',
      entityType: 'FraudAlert',
      newValue: toJson({ created: created.length }),
    })

    return { created, createdCount: created.length }
  },

  async listAuditLogs(filters: { page?: number; limit?: number; search?: string; actionType?: string; entityType?: string; adminId?: string }) {
    const { page, limit, skip } = pagination(filters)
    const where: Prisma.AdminAuditLogWhereInput = {}

    if (filters.actionType) where.actionType = filters.actionType
    if (filters.entityType) where.entityType = filters.entityType
    if (filters.adminId) where.adminId = filters.adminId
    if (filters.search) {
      where.OR = [
        { actionType: { contains: filters.search, mode: 'insensitive' } },
        { entityType: { contains: filters.search, mode: 'insensitive' } },
        { entityId: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    const [logs, total] = await prisma.$transaction([
      prisma.adminAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { id: true, walletAddress: true, email: true, fullName: true, role: true } } },
      }),
      prisma.adminAuditLog.count({ where }),
    ])

    return pageResult(logs, total, page, limit)
  },
}
