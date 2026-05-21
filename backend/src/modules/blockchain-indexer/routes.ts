import { Router } from 'express'
import { blockchainIndexerController } from './controller'
import { validateIndexedEventList } from './validation'

const router = Router()

router.get('/status', blockchainIndexerController.status)
router.post('/run', blockchainIndexerController.run)
router.get('/events', validateIndexedEventList, blockchainIndexerController.events)

export default router
