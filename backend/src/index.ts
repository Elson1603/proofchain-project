import { createServer } from 'http'
import { createApp } from './app'
import { registerMessagingGateway } from './modules/chat/gateway'
import { messagingService } from './modules/chat/service'
import { notificationsService } from './modules/notifications/service'
import { paymentsService } from './modules/payments/service'
import { blockchainIndexerService } from './modules/blockchain-indexer/service'
import { initializeSocket } from './socket/socket'
import { shutdownBackgroundWorkers, startBackgroundWorkers } from './workers'

const app = createApp()
const server = createServer(app)
const PORT = process.env.PORT || 5000

const io = initializeSocket(server, {
  authorizeProjectRoom: async (user, projectId) => {
    await messagingService.assertProjectMembership(projectId, user)
  },
})

registerMessagingGateway(io)

server.listen(PORT, () => {
  paymentsService.startPolling()
  blockchainIndexerService.start()
  notificationsService.startReminderPolling()
  void startBackgroundWorkers().catch((error) => {
    console.error('Failed to start background workers', error)
  })
  console.log(`Server running on port ${PORT}`)
})

let isShuttingDown = false

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  console.log(`Received ${signal}, shutting down gracefully`)

  blockchainIndexerService.stop()

  server.close(async (error) => {
    if (error) {
      console.error('HTTP server shutdown failed', error)
    }

    try {
      await shutdownBackgroundWorkers()
      process.exit(error ? 1 : 0)
    } catch (workerError) {
      console.error('Background worker shutdown failed', workerError)
      process.exit(1)
    }
  })
}

process.on('SIGINT', (signal) => {
  void shutdown(signal)
})

process.on('SIGTERM', (signal) => {
  void shutdown(signal)
})
