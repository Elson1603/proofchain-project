import 'dotenv/config'
import { addNotificationJob } from './notification.job'
import { addTransactionPollingJob } from './transaction.job'
import { closeNotificationQueue } from '../queues/notification.queue'
import { closeTransactionPollingQueue } from '../queues/transaction.queue'

async function main() {
  const testUserId = process.env.TEST_JOB_USER_ID

  if (testUserId) {
    const notification = await addNotificationJob(
      {
        userId: testUserId,
        type: 'submission_uploaded',
        title: 'ProofChain background jobs are online',
        message: 'This submission notification was queued by the BullMQ verification script.',
        correlationId: 'manual-smoke-test',
      },
      {
        delayMs: 1_000,
        jobId: `manual-smoke-test-${Date.now()}`,
      },
    )

    console.log(`Queued notification smoke-test job ${notification.id}`)
  } else {
    console.log('Skipping notification smoke test because TEST_JOB_USER_ID is not set')
  }

  const poll = await addTransactionPollingJob(
    {
      limit: 5,
      correlationId: 'manual-transaction-poll-smoke-test',
    },
  {
    delayMs: 2_000,
    jobId: `manual-transaction-poll-${Date.now()}`,
  },
)

  console.log(`Queued transaction polling smoke-test job ${poll.id}`)
}

main()
  .catch((error) => {
    console.error('Failed to queue smoke-test jobs', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await Promise.allSettled([
      closeNotificationQueue(),
      closeTransactionPollingQueue(),
    ])
    process.exit(process.exitCode ?? 0)
  })
