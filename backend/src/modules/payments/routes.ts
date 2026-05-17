import { Router } from 'express'
import { paymentsController } from './controller'
import { validateCreatePayment, validateUpdatePayment } from './validation'

const router = Router()

router.get('/', paymentsController.list)
router.get('/:id', paymentsController.getById)
router.post('/', validateCreatePayment, paymentsController.create)
router.put('/:id', validateUpdatePayment, paymentsController.update)
router.delete('/:id', paymentsController.remove)

export default router
