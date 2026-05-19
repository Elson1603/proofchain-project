import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { profileController } from './controller'
import { validateGetPublicProfile, validateUpdateMyProfile } from './validation'

const router = Router()

router.get('/me', authenticate(), profileController.getMe)
router.patch('/me', authenticate(), validateUpdateMyProfile, profileController.updateMe)
router.get('/:userId', validateGetPublicProfile, profileController.getPublic)

export default router
