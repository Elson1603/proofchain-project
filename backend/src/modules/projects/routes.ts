import { Router } from 'express'
import { projectsController } from './controller'
import { validateCreateProject, validateUpdateProject } from './validation'

const router = Router()

router.get('/', projectsController.list)
router.get('/:id', projectsController.getById)
router.post('/', validateCreateProject, projectsController.create)
router.put('/:id', validateUpdateProject, projectsController.update)
router.delete('/:id', projectsController.remove)

export default router
