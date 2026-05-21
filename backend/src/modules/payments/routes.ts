import { Router } from 'express'
import { paymentsController } from './controller'
import {
	validateCreatePayment,
	validateExecutePayment,
	validatePaymentPoll,
	validatePaymentRecover,
	validatePaymentRetry,
	validateUpdatePayment,
} from './validation'

const router = Router()

/**
 * @openapi
 * /api/payments:
 *   get:
 *     tags: [Payments]
 *     summary: List payments
 *     description: Returns escrow payment records for project ledgers, freelancer earnings, and transaction monitoring dashboards.
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: payerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: payeeId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment collection.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Payment'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *   post:
 *     tags: [Payments]
 *     summary: Create a payment record
 *     description: Creates an off-chain payment tracking record for escrow deposits, milestone releases, or refunds before blockchain execution is finalized.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, payerId, payeeId, amount, type]
 *             properties:
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               milestoneId:
 *                 type: string
 *                 format: uuid
 *               submissionId:
 *                 type: string
 *                 format: uuid
 *               payerId:
 *                 type: string
 *                 format: uuid
 *               payeeId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [escrow_deposit, milestone_release, refund]
 *               status:
 *                 type: string
 *               currency:
 *                 type: string
 *               escrowAddress:
 *                 type: string
 *               metadata:
 *                 type: object
 *           example:
 *             projectId: "17696acb-df61-41f0-a08d-6f024bf9acda"
 *             milestoneId: "96842c43-665c-46fe-9b27-751f1c4df8f0"
 *             payerId: "5b827f08-4a8b-4d1a-bf8b-e6dc3ea4e3f7"
 *             payeeId: "0f2d15a5-25c1-4579-85ef-aaf64a7457aa"
 *             amount: 1250
 *             type: "escrow_deposit"
 *             currency: "USDC"
 *             escrowAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *     responses:
 *       201:
 *         description: Payment created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *
 * /api/payments/execute:
 *   post:
 *     tags: [Payments]
 *     summary: Record an executed blockchain payment transaction
 *     description: Records a submitted blockchain transaction for escrow approval or payment release and queues it for confirmation tracking.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId, payerId, payeeId, amount, type, action, projectChainId, milestoneIndex, escrowAddress, payerWallet, txHash]
 *             properties:
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               milestoneId:
 *                 type: string
 *                 format: uuid
 *               submissionId:
 *                 type: string
 *                 format: uuid
 *               payerId:
 *                 type: string
 *                 format: uuid
 *               payeeId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [escrow_deposit, milestone_release, refund]
 *               action:
 *                 type: string
 *                 enum: [approve_milestone, release_payment]
 *               projectChainId:
 *                 type: integer
 *               milestoneIndex:
 *                 type: integer
 *               escrowAddress:
 *                 type: string
 *               payerWallet:
 *                 type: string
 *               chainId:
 *                 type: integer
 *               currency:
 *                 type: string
 *               txHash:
 *                 type: string
 *               relayerRequestId:
 *                 type: string
 *               gasQuote:
 *                 type: number
 *               gasQuoteCurrency:
 *                 type: string
 *               status:
 *                 type: string
 *               blockNumber:
 *                 type: integer
 *           example:
 *             projectId: "17696acb-df61-41f0-a08d-6f024bf9acda"
 *             milestoneId: "96842c43-665c-46fe-9b27-751f1c4df8f0"
 *             payerId: "5b827f08-4a8b-4d1a-bf8b-e6dc3ea4e3f7"
 *             payeeId: "0f2d15a5-25c1-4579-85ef-aaf64a7457aa"
 *             amount: 1250
 *             type: "milestone_release"
 *             action: "release_payment"
 *             projectChainId: 84532
 *             milestoneIndex: 0
 *             escrowAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *             payerWallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *             txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
 *             currency: "USDC"
 *     responses:
 *       201:
 *         description: Payment execution recorded.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *
 * /api/payments/poll:
 *   post:
 *     tags: [Payments]
 *     summary: Poll pending blockchain transactions
 *     description: Operational endpoint that asks the payment tracker to inspect pending transactions and update confirmation status.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *     responses:
 *       200:
 *         description: Pending transaction poll result.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *
 * /api/payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment by ID
 *     description: Returns one escrow or payment transaction record for audit, recovery, and project detail screens.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     tags: [Payments]
 *     summary: Update payment status or metadata
 *     description: Updates operational payment state such as confirmation status, failure reason, or indexer metadata.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               failureReason:
 *                 type: string
 *               metadata:
 *                 type: object
 *           example:
 *             status: "completed"
 *             metadata:
 *               confirmationSource: "indexer"
 *     responses:
 *       200:
 *         description: Payment updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Payments]
 *     summary: Delete payment
 *     description: Removes a payment tracking record. Intended for administrative cleanup, not normal escrow lifecycle handling.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment removed.
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/payments/{id}/retry:
 *   post:
 *     tags: [Payments]
 *     summary: Retry payment transaction tracking
 *     description: Requeues a failed or stale payment record with an updated transaction hash or chain metadata.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [txHash]
 *             properties:
 *               txHash:
 *                 type: string
 *               status:
 *                 type: string
 *               chainId:
 *                 type: integer
 *           example:
 *             txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
 *             status: "pending"
 *             chainId: 84532
 *     responses:
 *       200:
 *         description: Retry queued.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/payments/{id}/recover:
 *   post:
 *     tags: [Payments]
 *     summary: Recover a payment from a transaction hash
 *     description: Associates a payment with a transaction hash or relayer request so confirmation state can be recovered after an interrupted client or worker flow.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [txHash]
 *             properties:
 *               txHash:
 *                 type: string
 *               relayerRequestId:
 *                 type: string
 *           example:
 *             txHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
 *             relayerRequestId: "ugf_req_123"
 *     responses:
 *       200:
 *         description: Payment recovered.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/', paymentsController.list)
router.post('/execute', validateExecutePayment, paymentsController.execute)
router.post('/poll', validatePaymentPoll, paymentsController.poll)
router.post('/:id/retry', validatePaymentRetry, paymentsController.retry)
router.post('/:id/recover', validatePaymentRecover, paymentsController.recover)
router.get('/:id', paymentsController.getById)
router.post('/', validateCreatePayment, paymentsController.create)
router.put('/:id', validateUpdatePayment, paymentsController.update)
router.delete('/:id', paymentsController.remove)

export default router
