import { Router } from 'express'
import { blockchainIndexerController } from './controller'
import { validateIndexedEventList } from './validation'

const router = Router()

/**
 * @openapi
 * /api/indexer/status:
 *   get:
 *     tags: [Blockchain Indexer]
 *     summary: Get blockchain indexer status
 *     responses:
 *       200:
 *         description: Current indexer status and configuration.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *
 * /api/indexer/run:
 *   post:
 *     tags: [Blockchain Indexer]
 *     summary: Manually run an indexer cycle
 *     responses:
 *       200:
 *         description: Indexer cycle completed or scheduled.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *
 * /api/indexer/events:
 *   get:
 *     tags: [Blockchain Indexer]
 *     summary: List indexed blockchain events
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [ESCROW, PAYMENT, NFT_MINT, UGF_EXECUTION]
 *       - in: query
 *         name: eventName
 *         schema:
 *           type: string
 *       - in: query
 *         name: txHash
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{64}$'
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Indexed event collection.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/status', blockchainIndexerController.status)
router.post('/run', blockchainIndexerController.run)
router.get('/events', validateIndexedEventList, blockchainIndexerController.events)

export default router
