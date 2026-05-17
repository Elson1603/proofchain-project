import { Router } from 'express'
import { projectsController } from './controller'
import {
	validateAcceptProject,
	validateCreateProject,
	validateInviteFreelancer,
	validateProjectTransition,
	validateUpdateProject,
} from './validation'

const router = Router()

router.get('/', projectsController.list)
router.get('/:id', projectsController.getById)
router.post('/', validateCreateProject, projectsController.create)
router.put('/:id', validateUpdateProject, projectsController.update)
router.post('/:id/invite', validateInviteFreelancer, projectsController.invite)
router.post('/:id/accept', validateAcceptProject, projectsController.accept)
router.post('/:id/submit', validateProjectTransition, projectsController.submit)
router.post('/:id/approve', validateProjectTransition, projectsController.approve)
router.post('/:id/reject', validateProjectTransition, projectsController.reject)
router.post('/:id/complete', validateProjectTransition, projectsController.complete)
router.post('/:id/dispute', validateProjectTransition, projectsController.dispute)
router.delete('/:id', projectsController.remove)

export default router
