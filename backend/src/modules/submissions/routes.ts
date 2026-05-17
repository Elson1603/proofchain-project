import { Router } from 'express'
import { submissionsController } from './controller'
import { validateCreateSubmission, validateUpdateSubmission } from './validation'

const router = Router()

router.get('/', submissionsController.list)
router.get('/:id', submissionsController.getById)
router.post('/', validateCreateSubmission, submissionsController.create)
router.put('/:id', validateUpdateSubmission, submissionsController.update)
router.delete('/:id', submissionsController.remove)

export default router
