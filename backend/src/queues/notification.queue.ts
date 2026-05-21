import { Queue, QueueEvents, type DefaultJobOptions } from 'bullmq'
import type { NotificationJobPayload } from '../jobs/notification.job'
import {
  attachQueueEventLogging,
  closeRedisConnection,
  closeSharedRedisConnection,
  createRedisConnection,
  QUEUE_NAMES,
  redisConnection,
} from './redis'

const notificationQueueEventsConnection = createRedisConnection('notification-queue-events')

const defaultJobOptions: DefaultJobOptions = {
  attempts: Number(process.env.NOTIFICATION_JOB_ATTEMPTS ?? 5),
  backoff: {
    type: 'exponential',
    delay: Number(process.env.NOTIFICATION_JOB_BACKOFF_MS ?? 5_000),
  },
  removeOnComplete: {
    age: Number(process.env.NOTIFICATION_JOB_COMPLETE_TTL_SECONDS ?? 24 * 60 * 60),
    count: Number(process.env.NOTIFICATION_JOB_COMPLETE_COUNT ?? 1_000),
  },
  removeOnFail: {
    age: Number(process.env.NOTIFICATION_JOB_FAILED_TTL_SECONDS ?? 7 * 24 * 60 * 60),
    count: Number(process.env.NOTIFICATION_JOB_FAILED_COUNT ?? 5_000),
  },
}

export const notificationQueue = new Queue<NotificationJobPayload>(QUEUE_NAMES.notifications, {
  connection: redisConnection,
  defaultJobOptions,
})

export const notificationQueueEvents = new QueueEvents(QUEUE_NAMES.notifications, {
  connection: notificationQueueEventsConnection,
})

attachQueueEventLogging(QUEUE_NAMES.notifications, notificationQueueEvents)

export async function closeNotificationQueue() {
  await notificationQueue.close()
  await notificationQueueEvents.close()
  await Promise.all([
    closeSharedRedisConnection(),
    closeRedisConnection(notificationQueueEventsConnection, 'notification-queue-events'),
  ])
}
