import { Queue, QueueEvents, type DefaultJobOptions } from 'bullmq'
import type { NFTMintJobPayload } from '../jobs/nft.job'
import {
  attachQueueEventLogging,
  closeRedisConnection,
  closeSharedRedisConnection,
  createRedisConnection,
  QUEUE_NAMES,
  redisConnection,
} from './redis'

const nftQueueEventsConnection = createRedisConnection('nft-queue-events')

const defaultJobOptions: DefaultJobOptions = {
  attempts: Number(process.env.NFT_JOB_ATTEMPTS ?? 4),
  backoff: {
    type: 'exponential',
    delay: Number(process.env.NFT_JOB_BACKOFF_MS ?? 10_000),
  },
  removeOnComplete: {
    age: Number(process.env.NFT_JOB_COMPLETE_TTL_SECONDS ?? 24 * 60 * 60),
    count: Number(process.env.NFT_JOB_COMPLETE_COUNT ?? 1_000),
  },
  removeOnFail: {
    age: Number(process.env.NFT_JOB_FAILED_TTL_SECONDS ?? 14 * 24 * 60 * 60),
    count: Number(process.env.NFT_JOB_FAILED_COUNT ?? 5_000),
  },
}

export const nftQueue = new Queue<NFTMintJobPayload>(QUEUE_NAMES.nftMinting, {
  connection: redisConnection,
  defaultJobOptions,
})

export const nftQueueEvents = new QueueEvents(QUEUE_NAMES.nftMinting, {
  connection: nftQueueEventsConnection,
})

attachQueueEventLogging(QUEUE_NAMES.nftMinting, nftQueueEvents)

export async function closeNFTQueue() {
  await nftQueue.close()
  await nftQueueEvents.close()
  await Promise.all([
    closeSharedRedisConnection(),
    closeRedisConnection(nftQueueEventsConnection, 'nft-queue-events'),
  ])
}
