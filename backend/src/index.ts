import { createServer } from 'http'
import { createApp } from './app'
import { initializeMessagingGateway } from './modules/chat/gateway'
import { paymentsService } from './modules/payments/service'

const app = createApp()
const server = createServer(app)
const PORT = process.env.PORT || 5000

initializeMessagingGateway(server)

server.listen(PORT, () => {
  paymentsService.startPolling()
  console.log(`Server running on port ${PORT}`)
})
