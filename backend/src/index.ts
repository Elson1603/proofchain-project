import { createServer } from 'http'
import { createApp } from './app'
import { registerMessagingGateway } from './modules/chat/gateway'
import { messagingService } from './modules/chat/service'
import { notificationsService } from './modules/notifications/service'
import { paymentsService } from './modules/payments/service'
import { blockchainIndexerService } from './modules/blockchain-indexer/service'
import { initializeSocket } from './socket/socket'

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
  console.log(`Server running on port ${PORT}`)
})
