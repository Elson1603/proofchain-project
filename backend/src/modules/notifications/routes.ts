import { Router } from 'express'
import { notificationsController } from './controller'
import { validateCreateNotification, validateUpdateNotification } from './validation'

const router = Router()

router.get('/', notificationsController.list)
router.get('/:id', notificationsController.getById)
router.post('/', validateCreateNotification, notificationsController.create)
router.put('/:id', validateUpdateNotification, notificationsController.update)
router.delete('/:id', notificationsController.remove)

export default router
