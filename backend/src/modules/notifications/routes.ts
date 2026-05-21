import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorizeRoles } from '../../middleware/role.middleware'
import { notificationsController } from './controller'
import {
	validateCreateNotification,
	validateListNotifications,
	validateNotificationId,
} from './validation'

const router = Router()

router.get('/', authenticate(), validateListNotifications, notificationsController.list)
router.get('/unread-count', authenticate(), notificationsController.unreadCount)
router.get('/:id', authenticate(), validateNotificationId, notificationsController.getById)
router.post('/', authenticate(), authorizeRoles('ADMIN'), validateCreateNotification, notificationsController.create)
router.post('/:id/read', authenticate(), validateNotificationId, notificationsController.markRead)
router.post('/read-all', authenticate(), notificationsController.markAllRead)
router.delete('/:id', authenticate(), validateNotificationId, notificationsController.remove)

export default router
