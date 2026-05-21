import { Worker } from 'bullmq'
import { processNotificationJob, type NotificationJobPayload } from '../jobs/notification.job'
import { closeRedisConnection, createRedisConnection, QUEUE_NAMES } from '../queues/redis'

const notificationWorkerConnection = createRedisConnection('notification-worker')

let notificationWorker: Worker<NotificationJobPayload> | null = null

export function startNotificationWorker() {
  if (notificationWorker) {
    return notificationWorker
  }

  // Worker lifecycle: BullMQ claims a job from Redis, runs this processor,
  // retries failures with queue backoff settings, then emits terminal events.
  notificationWorker = new Worker<NotificationJobPayload>(
    QUEUE_NAMES.notifications,
    processNotificationJob,
    {
      connection: notificationWorkerConnection,
      concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY ?? 5),
    },
  )

  notificationWorker.on('completed', (job, result) => {
    console.log(`[worker:${QUEUE_NAMES.notifications}] completed job ${job.id}`, result)
  })

  notificationWorker.on('failed', (job, error) => {
    console.error(`[worker:${QUEUE_NAMES.notifications}] failed job ${job?.id ?? 'unknown'}`, error)
  })

  notificationWorker.on('error', (error) => {
    console.error(`[worker:${QUEUE_NAMES.notifications}] worker error`, error)
  })

  return notificationWorker
}

export async function shutdownNotificationWorker() {
  if (notificationWorker) {
    await notificationWorker.close()
    notificationWorker = null
  }

  await closeRedisConnection(notificationWorkerConnection, 'notification-worker')
}
