import { areBackgroundJobsEnabled } from '../queues/redis'

type WorkerModules = {
  addTransactionPollingJob: typeof import('../jobs/transaction.job')['addTransactionPollingJob']
  closeNFTQueue: typeof import('../queues/nft.queue')['closeNFTQueue']
  closeNotificationQueue: typeof import('../queues/notification.queue')['closeNotificationQueue']
  closeTransactionPollingQueue: typeof import('../queues/transaction.queue')['closeTransactionPollingQueue']
  shutdownNFTWorker: typeof import('./nft.worker')['shutdownNFTWorker']
  shutdownNotificationWorker: typeof import('./notification.worker')['shutdownNotificationWorker']
  shutdownTransactionWorker: typeof import('./transaction.worker')['shutdownTransactionWorker']
  startNFTWorker: typeof import('./nft.worker')['startNFTWorker']
  startNotificationWorker: typeof import('./notification.worker')['startNotificationWorker']
  startTransactionWorker: typeof import('./transaction.worker')['startTransactionWorker']
}

let started = false
let workerModules: WorkerModules | null = null

async function loadWorkerModules(): Promise<WorkerModules> {
  if (workerModules) {
    return workerModules
  }

  const [
    transactionJob,
    nftQueue,
    notificationQueue,
    transactionQueue,
    nftWorker,
    notificationWorker,
    transactionWorker,
  ] = await Promise.all([
    import('../jobs/transaction.job'),
    import('../queues/nft.queue'),
    import('../queues/notification.queue'),
    import('../queues/transaction.queue'),
    import('./nft.worker'),
    import('./notification.worker'),
    import('./transaction.worker'),
  ])

  workerModules = {
    addTransactionPollingJob: transactionJob.addTransactionPollingJob,
    closeNFTQueue: nftQueue.closeNFTQueue,
    closeNotificationQueue: notificationQueue.closeNotificationQueue,
    closeTransactionPollingQueue: transactionQueue.closeTransactionPollingQueue,
    shutdownNFTWorker: nftWorker.shutdownNFTWorker,
    shutdownNotificationWorker: notificationWorker.shutdownNotificationWorker,
    shutdownTransactionWorker: transactionWorker.shutdownTransactionWorker,
    startNFTWorker: nftWorker.startNFTWorker,
    startNotificationWorker: notificationWorker.startNotificationWorker,
    startTransactionWorker: transactionWorker.startTransactionWorker,
  }

  return workerModules
}

export async function startBackgroundWorkers() {
  if (!areBackgroundJobsEnabled()) {
    console.log('[workers] background jobs are disabled')
    return
  }

  if (started) {
    return
  }

  const modules = await loadWorkerModules()

  modules.startNotificationWorker()
  modules.startNFTWorker()
  modules.startTransactionWorker()
  started = true

  // Bootstraps one delayed batch poll so queued/submitted blockchain
  // transactions are checked after process start even if no API request
  // enqueues a specific polling job.
  if (process.env.TRANSACTION_BOOTSTRAP_POLLING_JOB !== 'false') {
    await modules.addTransactionPollingJob(
      {
        limit: Number(process.env.TRANSACTION_BOOTSTRAP_POLL_LIMIT ?? 25),
        correlationId: 'startup-transaction-poll',
      },
      {
        delayMs: Number(process.env.TRANSACTION_BOOTSTRAP_POLL_DELAY_MS ?? 2_000),
        jobId: 'startup-transaction-poll',
      },
    )
  }

  console.log('[workers] background workers started')
}

export async function shutdownBackgroundWorkers() {
  if (!started || !workerModules) {
    return
  }

  console.log('[workers] shutting down background workers')

  await Promise.all([
    workerModules.shutdownNotificationWorker(),
    workerModules.shutdownNFTWorker(),
    workerModules.shutdownTransactionWorker(),
  ])

  await Promise.all([
    workerModules.closeNotificationQueue(),
    workerModules.closeNFTQueue(),
    workerModules.closeTransactionPollingQueue(),
  ])

  started = false
  console.log('[workers] background workers stopped')
}
