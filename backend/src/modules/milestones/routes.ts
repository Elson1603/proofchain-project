import { Router } from 'express'
import { milestonesController } from './controller'
import { validateCreateMilestone, validateUpdateMilestone } from './validation'

const router = Router()

router.get('/', milestonesController.list)
router.get('/:id', milestonesController.getById)
router.post('/', validateCreateMilestone, milestonesController.create)
router.put('/:id', validateUpdateMilestone, milestonesController.update)
router.delete('/:id', milestonesController.remove)

export default router
