import { Router } from 'express'
import { authController } from './controller'
import { validateCreateAuth, validateUpdateAuth } from './validation'

const router = Router()

router.get('/', authController.list)
router.get('/:id', authController.getById)
router.post('/', validateCreateAuth, authController.create)
router.put('/:id', validateUpdateAuth, authController.update)
router.delete('/:id', authController.remove)

export default router
