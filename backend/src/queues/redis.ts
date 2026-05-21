import { QueueEvents } from 'bullmq'
import Redis, { type RedisOptions } from 'ioredis'

export const QUEUE_PREFIX = process.env.BULLMQ_QUEUE_PREFIX ?? 'proofchain'

export const QUEUE_NAMES = {
  notifications: `${QUEUE_PREFIX}-notifications`,
  nftMinting: `${QUEUE_PREFIX}-nft-minting`,
  transactionPolling: `${QUEUE_PREFIX}-transaction-polling`,
} as const

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function baseRedisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: numberFromEnv(process.env.REDIS_CONNECT_TIMEOUT_MS, 10_000),
    keyPrefix: process.env.REDIS_KEY_PREFIX,
  }
}

function describeRedisTarget(connectionName: string) {
  if (process.env.REDIS_URL) {
    return `${connectionName} -> REDIS_URL`
  }

  return `${connectionName} -> ${process.env.REDIS_HOST ?? '127.0.0.1'}:${process.env.REDIS_PORT ?? 6379}`
}

function attachRedisLogging(connection: Redis, connectionName: string) {
  connection.on('connect', () => {
    console.log(`[redis:${connectionName}] connecting to ${describeRedisTarget(connectionName)}`)
  })

  connection.on('ready', () => {
    console.log(`[redis:${connectionName}] connected and ready`)
  })

  connection.on('reconnecting', (delay: number) => {
    console.warn(`[redis:${connectionName}] reconnecting in ${delay}ms`)
  })

  connection.on('end', () => {
    console.log(`[redis:${connectionName}] connection closed`)
  })

  connection.on('error', (error) => {
    console.error(`[redis:${connectionName}] connection error`, error)
  })
}

export function createRedisConnection(connectionName: string) {
  const redisUrl = process.env.REDIS_URL

  const connection = redisUrl
    ? new Redis(redisUrl, {
        ...baseRedisOptions(),
        connectionName,
      })
    : new Redis({
        ...baseRedisOptions(),
        connectionName,
        host: process.env.REDIS_HOST ?? '127.0.0.1',
        port: numberFromEnv(process.env.REDIS_PORT, 6379),
        db: numberFromEnv(process.env.REDIS_DB, 0),
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      })

  attachRedisLogging(connection, connectionName)
  return connection
}

export const redisConnection = createRedisConnection('bullmq-shared')

let sharedRedisClosePromise: Promise<void> | null = null

export function closeSharedRedisConnection() {
  if (!sharedRedisClosePromise) {
    sharedRedisClosePromise = closeRedisConnection(redisConnection, 'bullmq-shared')
  }

  return sharedRedisClosePromise
}

export async function closeRedisConnection(connection: Redis, label: string) {
  try {
    await connection.quit()
  } catch (error) {
    console.warn(`[redis:${label}] graceful quit failed, disconnecting`, error)
    connection.disconnect()
  }
}

export function attachQueueEventLogging(queueName: string, queueEvents: QueueEvents) {
  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`[queue:${queueName}] job ${jobId} completed`, returnvalue)
  })

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[queue:${queueName}] job ${jobId} failed: ${failedReason}`)
  })

  queueEvents.on('progress', ({ jobId, data }) => {
    console.log(`[queue:${queueName}] job ${jobId} progress`, data)
  })

  queueEvents.on('error', (error) => {
    console.error(`[queue:${queueName}] queue event error`, error)
  })
}

export function areBackgroundJobsEnabled() {
  return process.env.BACKGROUND_JOBS_ENABLED !== 'false'
}
