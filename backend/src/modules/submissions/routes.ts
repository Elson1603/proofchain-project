import { Router } from 'express'
import { createSecureUploadMiddleware } from '../../middleware/upload.middleware'
import { submissionsController } from './controller'
import { validateCreateSubmission, validateUpdateSubmission, validateUploadSubmission } from './validation'

const router = Router()

const uploadSingle = createSecureUploadMiddleware()

router.get('/', submissionsController.list)
router.get('/:id', submissionsController.getById)
router.post('/', validateCreateSubmission, submissionsController.create)
router.post('/upload', ...uploadSingle, validateUploadSubmission, submissionsController.upload)
router.put('/:id', validateUpdateSubmission, submissionsController.update)
router.delete('/:id', submissionsController.remove)

export default router
