import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { requireAdminRole } from '../../middleware/role.middleware'
import { nftController } from './controller'
import { validateMintCertificate, validateProjectParam, validateTokenParam, validateWalletParam } from './validation'

const router = Router()

/**
 * @openapi
 * /api/nft/mint:
 *   post:
 *     tags: [NFT Certificates]
 *     summary: Mint a soulbound NFT certificate
 *     description: Admin-only endpoint that mints a certificate for a completed project or released payment.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             anyOf:
 *               - required: [paymentId]
 *               - required: [projectId]
 *             properties:
 *               paymentId:
 *                 type: string
 *                 description: Payment ID to mint from.
 *               projectId:
 *                 type: string
 *                 description: Project ID to mint from.
 *               projectCompletionProof:
 *                 type: string
 *           example:
 *             paymentId: "6f9c1df8-84a5-4f15-89d5-2ef024f614c2"
 *             projectCompletionProof: "Client approved the final milestone on-chain."
 *     responses:
 *       201:
 *         description: Certificate mint started or completed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *
 * /api/nft/verify/{tokenId}:
 *   get:
 *     tags: [NFT Certificates]
 *     summary: Verify an NFT certificate token
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Certificate verification result.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *
 * /api/nft/explorer/{tokenId}:
 *   get:
 *     tags: [NFT Certificates]
 *     summary: Get block explorer URL/details for a token
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Explorer metadata.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *
 * /api/nft/user/{wallet}:
 *   get:
 *     tags: [NFT Certificates]
 *     summary: List certificates owned by wallet
 *     parameters:
 *       - in: path
 *         name: wallet
 *         required: true
 *         schema:
 *           type: string
 *         example: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *     responses:
 *       200:
 *         description: Wallet certificate collection.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *
 * /api/nft/project/{projectId}:
 *   get:
 *     tags: [NFT Certificates]
 *     summary: Get certificate for a project
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project certificate.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *
 * /api/nft/{tokenId}:
 *   get:
 *     tags: [NFT Certificates]
 *     summary: Get certificate by token ID
 *     parameters:
 *       - in: path
 *         name: tokenId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Certificate details.
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *
 * /api/nft:
 *   get:
 *     tags: [NFT Certificates]
 *     summary: List certificate records
 *     responses:
 *       200:
 *         description: Certificate record collection.
 *   post:
 *     tags: [NFT Certificates]
 *     summary: Create a certificate record
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           example:
 *             userId: "5b827f08-4a8b-4d1a-bf8b-e6dc3ea4e3f7"
 *             projectId: "17696acb-df61-41f0-a08d-6f024bf9acda"
 *             tokenId: "42"
 *     responses:
 *       201:
 *         description: Certificate record created.
 */
router.post('/mint', authenticate(), requireAdminRole('ADMIN', 'SUPER_ADMIN', 'BLOCKCHAIN_ADMIN'), validateMintCertificate, nftController.mint)
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
