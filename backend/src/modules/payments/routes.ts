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
