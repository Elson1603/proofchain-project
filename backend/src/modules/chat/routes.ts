import { Router } from 'express'
import { chatController } from './controller'
import { validateCreateChat, validateUpdateChat } from './validation'

const router = Router()

router.get('/', chatController.list)
router.get('/:id', chatController.getById)
router.post('/', validateCreateChat, chatController.create)
router.put('/:id', validateUpdateChat, chatController.update)
router.delete('/:id', chatController.remove)

export default router
