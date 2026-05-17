import { Router } from 'express'
import { nftController } from './controller'
import { validateCreateNft, validateUpdateNft } from './validation'

const router = Router()

router.get('/', nftController.list)
router.get('/:id', nftController.getById)
router.post('/', validateCreateNft, nftController.create)
router.put('/:id', validateUpdateNft, nftController.update)
router.delete('/:id', nftController.remove)

export default router
