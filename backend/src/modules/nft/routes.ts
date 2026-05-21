import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorizeRoles } from '../../middleware/role.middleware'
import { nftController } from './controller'
import { validateMintCertificate, validateProjectParam, validateTokenParam, validateWalletParam } from './validation'

const router = Router()

router.post('/mint', authenticate(), authorizeRoles('ADMIN'), validateMintCertificate, nftController.mint)
router.get('/verify/:tokenId', validateTokenParam, nftController.verify)
router.get('/explorer/:tokenId', validateTokenParam, nftController.explorer)
router.get('/user/:wallet', validateWalletParam, nftController.getByWallet)
router.get('/project/:projectId', validateProjectParam, nftController.getByProject)
router.get('/:tokenId', validateTokenParam, nftController.getByTokenId)

router.get('/', nftController.list)
router.get('/record/:id', nftController.getById)
router.post('/', nftController.create)
router.put('/:id', nftController.update)
router.delete('/:id', nftController.remove)

export default router
