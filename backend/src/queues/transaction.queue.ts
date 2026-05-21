import { Queue, QueueEvents, type DefaultJobOptions } from 'bullmq'
import type { TransactionPollingJobPayload } from '../jobs/transaction.job'
import {
  attachQueueEventLogging,
  closeRedisConnection,
  closeSharedRedisConnection,
  createRedisConnection,
  QUEUE_NAMES,
  redisConnection,
} from './redis'

const transactionQueueEventsConnection = createRedisConnection('transaction-queue-events')

const defaultJobOptions: DefaultJobOptions = {
  attempts: Number(process.env.TRANSACTION_JOB_ATTEMPTS ?? 5),
  backoff: {
    type: 'exponential',
    delay: Number(process.env.TRANSACTION_JOB_BACKOFF_MS ?? 5_000),
  },
  removeOnComplete: {
    age: Number(process.env.TRANSACTION_JOB_COMPLETE_TTL_SECONDS ?? 24 * 60 * 60),
    count: Number(process.env.TRANSACTION_JOB_COMPLETE_COUNT ?? 2_000),
  },
  removeOnFail: {
    age: Number(process.env.TRANSACTION_JOB_FAILED_TTL_SECONDS ?? 14 * 24 * 60 * 60),
    count: Number(process.env.TRANSACTION_JOB_FAILED_COUNT ?? 10_000),
  },
}

export const transactionPollingQueue = new Queue<TransactionPollingJobPayload>(QUEUE_NAMES.transactionPolling, {
  connection: redisConnection,
  defaultJobOptions,
})

export const transactionPollingQueueEvents = new QueueEvents(QUEUE_NAMES.transactionPolling, {
  connection: transactionQueueEventsConnection,
})

attachQueueEventLogging(QUEUE_NAMES.transactionPolling, transactionPollingQueueEvents)

export async function closeTransactionPollingQueue() {
  await transactionPollingQueue.close()
  await transactionPollingQueueEvents.close()
  await Promise.all([
    closeSharedRedisConnection(),
    closeRedisConnection(transactionQueueEventsConnection, 'transaction-queue-events'),
  ])
}
