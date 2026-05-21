import { Worker } from 'bullmq'
import { processTransactionPollingJob, type TransactionPollingJobPayload } from '../jobs/transaction.job'
import { closeRedisConnection, createRedisConnection, QUEUE_NAMES } from '../queues/redis'

const transactionWorkerConnection = createRedisConnection('transaction-worker')

let transactionWorker: Worker<TransactionPollingJobPayload> | null = null

export function startTransactionWorker() {
  if (transactionWorker) {
    return transactionWorker
  }

  // Transaction polling jobs are small and idempotent: they read a receipt,
  // update local transaction/payment state, and schedule the next delayed poll
  // while the chain has not produced a terminal receipt yet.
  transactionWorker = new Worker<TransactionPollingJobPayload>(
    QUEUE_NAMES.transactionPolling,
    processTransactionPollingJob,
    {
      connection: transactionWorkerConnection,
      concurrency: Number(process.env.TRANSACTION_WORKER_CONCURRENCY ?? 5),
    },
  )

  transactionWorker.on('completed', (job, result) => {
    console.log(`[worker:${QUEUE_NAMES.transactionPolling}] completed job ${job.id}`, result)
  })

  transactionWorker.on('failed', (job, error) => {
    console.error(`[worker:${QUEUE_NAMES.transactionPolling}] failed job ${job?.id ?? 'unknown'}`, error)
  })

  transactionWorker.on('error', (error) => {
    console.error(`[worker:${QUEUE_NAMES.transactionPolling}] worker error`, error)
  })

  return transactionWorker
}

export async function shutdownTransactionWorker() {
  if (transactionWorker) {
    await transactionWorker.close()
    transactionWorker = null
  }

  await closeRedisConnection(transactionWorkerConnection, 'transaction-worker')
}
