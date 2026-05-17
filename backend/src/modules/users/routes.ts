import { Router } from 'express'
import { usersController } from './controller'
import { validateCreateUser, validateUpdateUser } from './validation'

const router = Router()

router.get('/', usersController.list)
router.get('/:id', usersController.getById)
router.post('/', validateCreateUser, usersController.create)
router.put('/:id', validateUpdateUser, usersController.update)
router.delete('/:id', usersController.remove)

export default router
