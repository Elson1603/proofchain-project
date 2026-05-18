import { JsonRpcProvider, isAddress } from 'ethers'
import prisma from '../../config/db'
import { normalizeWalletAddress } from '../auth/utils'
import {
  PAYMENT_ACTIONS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  TRANSACTION_STATUSES,
  PaymentAction,
  TransactionStatus,
} from './types'

type PaymentListFilters = {
  projectId?: string
  payerId?: string
  payeeId?: string
  status?: string
}

type ExecuteInput = {
  projectId: string
  milestoneId?: string
  submissionId?: string
  payerId: string
  payeeId: string
  amount: number
  type: string
  action: PaymentAction
  projectChainId: number
  milestoneIndex: number
  escrowAddress: string
  payerWallet: string
  chainId?: number
  currency?: string
  txHash: string
  relayerRequestId?: string
  gasQuote?: number
  gasQuoteCurrency?: string
  status?: TransactionStatus
  blockNumber?: number
}

type RetryInput = {
  txHash: string
  relayerRequestId?: string
  gasQuote?: number
  gasQuoteCurrency?: string
  status?: TransactionStatus
  chainId?: number
  currency?: string
  escrowAddress?: string
  payerWallet?: string
  blockNumber?: number
}

type UpdateInput = {
  status?: string
  failureReason?: string
  metadata?: Record<string, unknown>
}

type PaymentMetadata = {
  action?: PaymentAction
  projectChainId?: number
  milestoneIndex?: number
  escrowAddress?: string
  payerWallet?: string
  chainId?: number
  gasQuote?: number
  gasQuoteCurrency?: string
  txHash?: string
  relayerRequestId?: string
}

const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID ?? 84532)
const DEFAULT_CURRENCY = process.env.UGF_GAS_CURRENCY || 'mUSD'
const MAX_POLL_LIMIT = Number(process.env.PAYMENTS_POLL_LIMIT ?? 25)
const POLL_INTERVAL_MS = Number(process.env.PAYMENTS_POLL_INTERVAL_MS ?? 0)

let provider: JsonRpcProvider | null = null
let poller: NodeJS.Timeout | null = null
let isPolling = false

const pendingStatuses: TransactionStatus[] = ['queued', 'submitted']

function getProvider() {
  if (provider) {
    return provider
  }

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL
  if (!rpcUrl) {
    return null
  }

  provider = new JsonRpcProvider(rpcUrl)
  return provider
}

function ensureAction(action: string): PaymentAction {
  if (!PAYMENT_ACTIONS.includes(action as PaymentAction)) {
    throw new Error(`Unsupported action ${action}`)
  }

  return action as PaymentAction
}

function ensureTransactionStatus(status?: string): TransactionStatus {
  if (!status) {
    return 'submitted'
  }

  if (!TRANSACTION_STATUSES.includes(status as TransactionStatus)) {
    throw new Error(`Unsupported transaction status ${status}`)
  }

  return status as TransactionStatus
}

function parseMetadata(metadata: unknown): PaymentMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return {}
  }

  return metadata as PaymentMetadata
}

function normalizeAddress(input: string) {
  if (!isAddress(input)) {
    throw new Error('Invalid wallet or contract address')
  }

  return normalizeWalletAddress(input)
}

function mapTransactionType(paymentType: string) {
  if (paymentType === 'milestone_release') {
    return 'payment_release'
  }

  if (paymentType === 'escrow_deposit') {
    return 'escrow_deposit'
  }

  if (paymentType === 'refund') {
    return 'refund'
  }

  return 'payment_release'
}

function getPaymentStatusUpdate(status: TransactionStatus, failureReason?: string) {
  if (status === 'confirmed') {
    return {
      status: 'released' as const,
      releasedAt: new Date(),
      failureReason: null,
    }
  }

  if (status === 'failed') {
    return {
      status: 'failed' as const,
      releasedAt: null,
      failureReason: failureReason ?? 'Transaction failed',
    }
  }

  return {
    status: 'pending' as const,
    releasedAt: null,
    failureReason: null,
  }
}

async function syncTransactionStatus(transaction: {
  id: string
  status: TransactionStatus
  chainId: number
  txHash: string | null
  paymentId: string | null
}) {
  if (!transaction.txHash) {
    return null
  }

  const activeProvider = getProvider()
  if (!activeProvider) {
    return null
  }

  const receipt = await activeProvider.getTransactionReceipt(transaction.txHash)
  if (!receipt) {
    return null
  }

  const updatedStatus: TransactionStatus = receipt.status === 1 ? 'confirmed' : 'failed'
  if (updatedStatus === transaction.status) {
    return null
  }

  const updated = await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: updatedStatus,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber ? Number(receipt.blockNumber) : undefined,
      gasUsed: receipt.gasUsed ? Number(receipt.gasUsed) : undefined,
      errorMessage: updatedStatus === 'failed' ? 'Transaction failed' : null,
      confirmedAt: updatedStatus === 'confirmed' ? new Date() : undefined,
    },
  })

  if (transaction.paymentId) {
    if (updatedStatus === 'confirmed') {
      await prisma.payment.update({
        where: { id: transaction.paymentId },
        data: {
          status: 'released',
          releasedAt: new Date(),
          failureReason: null,
        },
      })
    }

    if (updatedStatus === 'failed') {
      await prisma.payment.update({
        where: { id: transaction.paymentId },
        data: {
          status: 'failed',
          failureReason: 'Transaction failed',
        },
      })
    }
  }

  return updated
}

export const paymentsService = {
  startPolling() {
    if (!POLL_INTERVAL_MS || poller) {
      return
    }

    poller = setInterval(async () => {
      if (isPolling) {
        return
      }

      isPolling = true
      try {
        await paymentsService.pollPendingTransactions()
      } finally {
        isPolling = false
      }
    }, POLL_INTERVAL_MS)

    poller.unref()
  },

  async list(filters: PaymentListFilters = {}) {
    const where: Record<string, unknown> = {}

    if (filters.projectId) {
      where.projectId = filters.projectId
    }

    if (filters.payerId) {
      where.payerId = filters.payerId
    }

    if (filters.payeeId) {
      where.payeeId = filters.payeeId
    }

    if (filters.status && PAYMENT_STATUSES.includes(filters.status as (typeof PAYMENT_STATUSES)[number])) {
      where.status = filters.status
    }

    return prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
  },

  async getById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  },

  async execute(input: ExecuteInput) {
    const action = ensureAction(input.action)
    const chainId = input.chainId ?? DEFAULT_CHAIN_ID
    const currency = input.currency || DEFAULT_CURRENCY
    const escrowAddress = normalizeAddress(input.escrowAddress)
    const payerWallet = normalizeAddress(input.payerWallet)

    if (!PAYMENT_TYPES.includes(input.type as (typeof PAYMENT_TYPES)[number])) {
      throw new Error('Invalid payment type')
    }

    const transactionStatus = ensureTransactionStatus(input.status)
    const paymentStatus = getPaymentStatusUpdate(transactionStatus)

    const metadata: PaymentMetadata = {
      action,
      projectChainId: input.projectChainId,
      milestoneIndex: input.milestoneIndex,
      escrowAddress,
      payerWallet,
      chainId,
      gasQuote: input.gasQuote,
      gasQuoteCurrency: input.gasQuoteCurrency,
      txHash: input.txHash,
      relayerRequestId: input.relayerRequestId,
    }

    const transactionType = mapTransactionType(input.type)
    const now = new Date()

    const payment = await prisma.payment.create({
      data: {
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        submissionId: input.submissionId,
        payerId: input.payerId,
        payeeId: input.payeeId,
        type: input.type as (typeof PAYMENT_TYPES)[number],
        status: paymentStatus.status,
        amount: input.amount,
        currency,
        escrowAddress,
        releasedAt: paymentStatus.releasedAt ?? undefined,
        failureReason: paymentStatus.failureReason ?? undefined,
        metadata,
      },
    })

    const transaction = await prisma.transaction.create({
      data: {
        projectId: input.projectId,
        milestoneId: input.milestoneId,
        paymentId: payment.id,
        initiatedBy: input.payerId,
        type: transactionType as Parameters<typeof prisma.transaction.create>[0]['data']['type'],
        status: transactionStatus,
        chainId,
        toAddress: escrowAddress,
        fromAddress: payerWallet,
        amount: input.amount,
        currency,
        gasQuote: input.gasQuote,
        gasQuoteCurrency: input.gasQuoteCurrency,
        txHash: input.txHash,
        relayerRequestId: input.relayerRequestId,
        submittedAt: transactionStatus === 'queued' ? undefined : now,
        confirmedAt: transactionStatus === 'confirmed' ? now : undefined,
        blockNumber: input.blockNumber,
      },
    })

    return {
      payment,
      transaction,
    }
  },

  async retry(id: string, input: RetryInput) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!payment) {
      throw new Error('Payment not found')
    }

    const latestTransaction = payment.transactions[0]
    if (!latestTransaction) {
      throw new Error('No transaction found for payment')
    }

    if (latestTransaction.status === 'confirmed') {
      return {
        payment,
        transaction: latestTransaction,
      }
    }

    const metadata = parseMetadata(payment.metadata)
    const escrowAddress = normalizeAddress(input.escrowAddress ?? metadata.escrowAddress ?? payment.escrowAddress ?? '')
    const payerWallet = normalizeAddress(input.payerWallet ?? metadata.payerWallet ?? '')
    const chainId = input.chainId ?? metadata.chainId ?? DEFAULT_CHAIN_ID
    const currency = input.currency ?? payment.currency
    const transactionStatus = ensureTransactionStatus(input.status)
    const paymentStatus = getPaymentStatusUpdate(transactionStatus)
    const now = new Date()

    await prisma.transaction.update({
      where: { id: latestTransaction.id },
      data: {
        status: latestTransaction.status === 'confirmed' ? latestTransaction.status : 'replaced',
      },
    })

    const updatedMetadata: PaymentMetadata = {
      ...metadata,
      escrowAddress,
      payerWallet,
      chainId,
      gasQuote: input.gasQuote ?? metadata.gasQuote,
      gasQuoteCurrency: input.gasQuoteCurrency ?? metadata.gasQuoteCurrency,
      txHash: input.txHash,
      relayerRequestId: input.relayerRequestId ?? metadata.relayerRequestId,
    }

    const retryTransaction = await prisma.transaction.create({
      data: {
        projectId: payment.projectId,
        milestoneId: payment.milestoneId,
        paymentId: payment.id,
        initiatedBy: payment.payerId,
        type: latestTransaction.type,
        status: transactionStatus,
        chainId,
        toAddress: escrowAddress,
        fromAddress: payerWallet,
        amount: latestTransaction.amount ?? payment.amount,
        currency,
        gasQuote: input.gasQuote ?? latestTransaction.gasQuote ?? undefined,
        gasQuoteCurrency: input.gasQuoteCurrency ?? latestTransaction.gasQuoteCurrency ?? undefined,
        txHash: input.txHash,
        relayerRequestId: input.relayerRequestId,
        submittedAt: transactionStatus === 'queued' ? undefined : now,
        confirmedAt: transactionStatus === 'confirmed' ? now : undefined,
        blockNumber: input.blockNumber,
      },
    })

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus.status,
        releasedAt: paymentStatus.releasedAt ?? undefined,
        failureReason: paymentStatus.failureReason ?? undefined,
        metadata: updatedMetadata,
      },
    })

    return {
      payment: await paymentsService.getById(payment.id),
      transaction: retryTransaction,
    }
  },

  async recover(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!payment) {
      throw new Error('Payment not found')
    }

    const latestTransaction = payment.transactions[0]
    if (!latestTransaction) {
      throw new Error('No transaction found for payment')
    }

    const updated = await syncTransactionStatus({
      id: latestTransaction.id,
      status: latestTransaction.status as TransactionStatus,
      chainId: latestTransaction.chainId,
      txHash: latestTransaction.txHash,
      paymentId: latestTransaction.paymentId,
    })

    return {
      payment: await paymentsService.getById(payment.id),
      transaction: updated ?? latestTransaction,
    }
  },

  async pollPendingTransactions(limit = MAX_POLL_LIMIT) {
    const pending = await prisma.transaction.findMany({
      where: {
        status: {
          in: pendingStatuses,
        },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    })

    const updates = [] as unknown[]

    for (const transaction of pending) {
      try {
        const updated = await syncTransactionStatus({
          id: transaction.id,
          status: transaction.status as TransactionStatus,
          chainId: transaction.chainId,
          txHash: transaction.txHash,
          paymentId: transaction.paymentId,
        })

        if (updated) {
          updates.push(updated)
        }
      } catch (error) {
        console.error('Failed to sync transaction', transaction.id, error)
      }
    }

    return {
      polled: pending.length,
      updated: updates.length,
    }
  },

  async create(data: Record<string, unknown>) {
    return prisma.payment.create({
      data: data as Parameters<typeof prisma.payment.create>[0]['data'],
    })
  },

  async update(id: string, data: UpdateInput) {
    return prisma.payment.update({
      where: { id },
      data,
    })
  },

  async remove(id: string) {
    return prisma.payment.delete({ where: { id } })
  },
}
