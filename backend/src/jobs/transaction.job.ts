import type { Job, JobsOptions } from 'bullmq'
import { JsonRpcProvider } from 'ethers'
import prisma from '../config/db'
import { applyPaymentWorkflowState } from '../modules/payments/service'
import type { TransactionStatus } from '../modules/payments/types'
import { transactionPollingQueue } from '../queues/transaction.queue'
import { emitTransactionStatusUpdated } from '../socket/events'

export const TRANSACTION_POLLING_JOB_NAME = 'poll-blockchain-transaction'

export interface TransactionPollingJobPayload {
  transactionId?: string
  paymentId?: string
  txHash?: string
  limit?: number
  currentPollAttempt?: number
  maxPollAttempts?: number
  pollIntervalMs?: number
  correlationId?: string
}

export type BlockchainTransactionPollingStatus = 'pending' | 'confirmed' | 'failed'

export interface AddTransactionPollingJobOptions {
  delayMs?: number
  jobId?: string
  attempts?: number
  priority?: number
}

type TargetTransaction = {
  id: string
  paymentId: string | null
  txHash: string | null
  status: TransactionStatus
  projectId: string | null
  gasUsed: number | null
  blockNumber: number | null
}

const TERMINAL_TRANSACTION_STATUSES: TransactionStatus[] = ['confirmed', 'failed', 'replaced']

let provider: JsonRpcProvider | null = null

function getProvider() {
  if (provider) {
    return provider
  }

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL
  if (!rpcUrl) {
    throw new Error('BASE_SEPOLIA_RPC_URL or RPC_URL is required to poll blockchain transactions')
  }

  provider = new JsonRpcProvider(rpcUrl)
  return provider
}

function toBullMQOptions(options: AddTransactionPollingJobOptions = {}): JobsOptions {
  return {
    delay: options.delayMs,
    jobId: options.jobId,
    attempts: options.attempts,
    priority: options.priority,
  }
}

function isTerminalStatus(status: TransactionStatus) {
  return TERMINAL_TRANSACTION_STATUSES.includes(status)
}

function toPublicStatus(status: TransactionStatus): BlockchainTransactionPollingStatus {
  if (status === 'confirmed') {
    return 'confirmed'
  }

  if (status === 'failed' || status === 'replaced') {
    return 'failed'
  }

  return 'pending'
}

function emitTransactionUpdate(input: {
  transactionId: string
  projectId: string | null
  paymentId: string | null
  txHash: string | null
  status: BlockchainTransactionPollingStatus
  blockNumber?: number | null
  gasUsed?: number | null
  pollAttempt?: number
  correlationId?: string
}) {
  try {
    emitTransactionStatusUpdated({
      transactionId: input.transactionId,
      projectId: input.projectId,
      paymentId: input.paymentId,
      txHash: input.txHash,
      status: input.status,
      blockNumber: input.blockNumber,
      gasUsed: input.gasUsed,
      updatedAt: new Date().toISOString(),
      meta: {
        pollAttempt: input.pollAttempt,
        correlationId: input.correlationId,
      },
    })
  } catch (error) {
    console.warn('Failed to emit transaction status update', error)
  }
}

function nextPollingJobId(payload: TransactionPollingJobPayload, nextAttempt: number) {
  const key = payload.transactionId ?? payload.paymentId ?? payload.txHash ?? 'pending-batch'
  return `${key}-poll-${nextAttempt}`
}

async function findTargetTransaction(payload: TransactionPollingJobPayload): Promise<TargetTransaction | null> {
  if (payload.transactionId) {
    return prisma.transaction.findUnique({
      where: { id: payload.transactionId },
      select: { id: true, paymentId: true, txHash: true, status: true, projectId: true, gasUsed: true, blockNumber: true },
    }) as Promise<TargetTransaction | null>
  }

  if (payload.txHash) {
    return prisma.transaction.findFirst({
      where: { txHash: payload.txHash },
      orderBy: { createdAt: 'desc' },
      select: { id: true, paymentId: true, txHash: true, status: true, projectId: true, gasUsed: true, blockNumber: true },
    }) as Promise<TargetTransaction | null>
  }

  if (payload.paymentId) {
    return prisma.transaction.findFirst({
      where: { paymentId: payload.paymentId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, paymentId: true, txHash: true, status: true, projectId: true, gasUsed: true, blockNumber: true },
    }) as Promise<TargetTransaction | null>
  }

  return null
}

async function updatePaymentForTransaction(transaction: TargetTransaction, status: BlockchainTransactionPollingStatus) {
  if (!transaction.paymentId) {
    return
  }

  if (status === 'confirmed') {
    await prisma.payment.update({
      where: { id: transaction.paymentId },
      data: {
        status: 'released',
        releasedAt: new Date(),
        failureReason: null,
      },
    })
    return
  }

  if (status === 'failed') {
    await prisma.payment.update({
      where: { id: transaction.paymentId },
      data: {
        status: 'failed',
        failureReason: 'Transaction failed',
      },
    })
  }
}

async function pollAndUpdateTransaction(transaction: TargetTransaction) {
  if (!transaction.txHash) {
    return {
      status: 'pending' as const,
      transaction,
    }
  }

  const receipt = await getProvider().getTransactionReceipt(transaction.txHash)

  if (!receipt) {
    const pending = transaction.status === 'queued'
      ? await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'submitted',
            submittedAt: new Date(),
          },
          select: { id: true, paymentId: true, txHash: true, status: true, projectId: true, gasUsed: true, blockNumber: true },
        }) as TargetTransaction
      : transaction

    return {
      status: 'pending' as const,
      transaction: pending,
    }
  }

  const status: BlockchainTransactionPollingStatus = receipt.status === 1 ? 'confirmed' : 'failed'
  const internalStatus: TransactionStatus = status
  const updated = await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: internalStatus,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: Number(receipt.gasUsed),
      errorMessage: status === 'failed' ? 'Transaction failed' : null,
      confirmedAt: status === 'confirmed' ? new Date() : undefined,
    },
    select: { id: true, paymentId: true, txHash: true, status: true, projectId: true, gasUsed: true, blockNumber: true },
  }) as TargetTransaction

  await updatePaymentForTransaction(updated, status)
  if (updated.paymentId && (status === 'confirmed' || status === 'failed')) {
    await applyPaymentWorkflowState({
      paymentId: updated.paymentId,
      transactionStatus: status,
      txHash: updated.txHash,
    })
  }

  return {
    status,
    transaction: updated,
  }
}

async function enqueuePendingTransactions(limit = Number(process.env.TRANSACTION_POLL_LIMIT ?? 25)) {
  const pending = await prisma.transaction.findMany({
    where: {
      status: {
        in: ['queued', 'submitted'],
      },
      txHash: {
        not: null,
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true, paymentId: true, txHash: true },
  })

  await Promise.all(
    pending.map((transaction) =>
      addTransactionPollingJob(
        {
          transactionId: transaction.id,
          paymentId: transaction.paymentId ?? undefined,
          txHash: transaction.txHash ?? undefined,
          currentPollAttempt: 1,
        },
        {
          jobId: `${transaction.id}-poll-1`,
        },
      ),
    ),
  )

  return {
    scanned: pending.length,
    enqueued: pending.length,
  }
}

export async function addTransactionPollingJob(
  payload: TransactionPollingJobPayload = {},
  options: AddTransactionPollingJobOptions = {},
) {
  return transactionPollingQueue.add(TRANSACTION_POLLING_JOB_NAME, payload, toBullMQOptions(options))
}

export async function processTransactionPollingJob(job: Job<TransactionPollingJobPayload>) {
  await job.updateProgress(10)

  const payload = job.data
  const currentPollAttempt = payload.currentPollAttempt ?? 1
  const maxPollAttempts = payload.maxPollAttempts ?? Number(process.env.TRANSACTION_POLL_MAX_ATTEMPTS ?? 30)
  const pollIntervalMs = payload.pollIntervalMs ?? Number(process.env.TRANSACTION_POLL_INTERVAL_MS ?? 15_000)

  if (!payload.transactionId && !payload.paymentId && !payload.txHash) {
    const result = await enqueuePendingTransactions(payload.limit)
    await job.updateProgress(100)
    return {
      mode: 'batch',
      ...result,
      correlationId: payload.correlationId,
    }
  }

  const target = await findTargetTransaction(payload)
  if (!target) {
    throw new Error('Transaction polling job could not find a matching transaction')
  }

  if (isTerminalStatus(target.status)) {
    const status = toPublicStatus(target.status)
    emitTransactionUpdate({
      transactionId: target.id,
      projectId: target.projectId,
      paymentId: target.paymentId,
      txHash: target.txHash,
      status,
      blockNumber: target.blockNumber,
      gasUsed: target.gasUsed,
      pollAttempt: currentPollAttempt,
      correlationId: payload.correlationId,
    })
    await job.updateProgress(100)
    return {
      mode: 'specific',
      transactionId: target.id,
      status,
      terminal: true,
      correlationId: payload.correlationId,
    }
  }

  await job.updateProgress(45)

  const polled = await pollAndUpdateTransaction(target)

  emitTransactionUpdate({
    transactionId: polled.transaction.id,
    projectId: polled.transaction.projectId,
    paymentId: polled.transaction.paymentId,
    txHash: polled.transaction.txHash,
    status: polled.status,
    blockNumber: polled.transaction.blockNumber,
    gasUsed: polled.transaction.gasUsed,
    pollAttempt: currentPollAttempt,
    correlationId: payload.correlationId,
  })

  if (polled.status === 'confirmed' || polled.status === 'failed') {
    await job.updateProgress(100)
    return {
      mode: 'specific',
      transactionId: target.id,
      status: polled.status,
      terminal: true,
      correlationId: payload.correlationId,
    }
  }

  if (currentPollAttempt >= maxPollAttempts) {
    throw new Error(`Transaction ${target.id} did not reach a terminal state after ${maxPollAttempts} polling attempts`)
  }

  const nextAttempt = currentPollAttempt + 1
  await addTransactionPollingJob(
    {
      ...payload,
      transactionId: target.id,
      paymentId: polled.transaction.paymentId ?? payload.paymentId,
      txHash: polled.transaction.txHash ?? payload.txHash,
      currentPollAttempt: nextAttempt,
      maxPollAttempts,
      pollIntervalMs,
    },
    {
      delayMs: pollIntervalMs,
      jobId: nextPollingJobId(payload, nextAttempt),
    },
  )

  await job.updateProgress(100)

  return {
    mode: 'specific',
    transactionId: target.id,
    status: polled.status,
    terminal: false,
    requeued: true,
    nextPollAttempt: nextAttempt,
    delayMs: pollIntervalMs,
    correlationId: payload.correlationId,
  }
}
