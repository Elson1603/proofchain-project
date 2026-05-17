import { Router } from 'express'
import { disputesController } from './controller'
import { validateCreateDispute, validateUpdateDispute } from './validation'

const router = Router()

router.get('/', disputesController.list)
router.get('/:id', disputesController.getById)
router.post('/', validateCreateDispute, disputesController.create)
router.put('/:id', validateUpdateDispute, disputesController.update)
router.delete('/:id', disputesController.remove)

export default router
