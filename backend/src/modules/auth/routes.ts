import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorizeRoles } from '../../middleware/role.middleware'
import { authController } from './controller'
import {
  linkWalletSchema,
  logoutSchema,
  nonceSchema,
  refreshSchema,
  revokeSessionSchema,
  validate,
  verifySchema,
} from './validation'

const router = Router()

/**
 * @openapi
 * /api/auth/nonce:
 *   post:
 *     tags: [Auth]
 *     summary: Request a wallet authentication nonce
 *     description: Creates a short-lived nonce that the wallet owner signs to prove address ownership.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress]
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 example: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *           examples:
 *             nonceRequest:
 *               value:
 *                 walletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *     responses:
 *       200:
 *         description: Nonce created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         nonce:
 *                           type: string
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *             example:
 *               success: true
 *               data:
 *                 nonce: "8f8ad2bfbef5f6f8d6f67f0ce0cebb68"
 *                 expiresAt: "2026-05-22T09:35:00.000Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *
 * /api/auth/verify:
 *   post:
 *     tags: [Auth]
 *     summary: Verify signed wallet nonce
 *     description: Verifies a wallet signature and returns JWT access and refresh tokens.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress, signature]
 *             properties:
 *               walletAddress:
 *                 type: string
 *               signature:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [CLIENT, FREELANCER, ADMIN]
 *                 default: FREELANCER
 *           example:
 *             walletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *             signature: "0x2f1c...walletSignature"
 *             role: "FREELANCER"
 *     responses:
 *       200:
 *         description: Wallet verified and tokens issued.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         tokens:
 *                           type: object
 *                           properties:
 *                             accessToken:
 *                               type: string
 *                             refreshToken:
 *                               type: string
 *             example:
 *               success: true
 *               data:
 *                 user:
 *                   id: "5b827f08-4a8b-4d1a-bf8b-e6dc3ea4e3f7"
 *                   walletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *                   role: "FREELANCER"
 *                 tokens:
 *                   accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                   refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh JWT tokens
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *           example:
 *             refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: New token pair issued.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke a refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *           example:
 *             refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Session revoked.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current authenticated user.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/auth/sessions:
 *   get:
 *     tags: [Auth]
 *     summary: List authenticated user sessions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active sessions for the current user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/auth/link-wallet:
 *   post:
 *     tags: [Auth]
 *     summary: Link an additional wallet to the authenticated account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress, nonce, signature]
 *             properties:
 *               walletAddress:
 *                 type: string
 *               nonce:
 *                 type: string
 *               signature:
 *                 type: string
 *           example:
 *             walletAddress: "0x1111111111111111111111111111111111111111"
 *             nonce: "8f8ad2bfbef5f6f8d6f67f0ce0cebb68"
 *             signature: "0x2f1c...walletSignature"
 *     responses:
 *       201:
 *         description: Wallet linked.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *
 * /api/auth/link-wallet/nonce:
 *   post:
 *     tags: [Auth]
 *     summary: Request nonce for linking another wallet
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet-link nonce created for the authenticated account.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               data:
 *                 nonce: "f9f2d59a0d8e4f77a25c92da0a36c3aa"
 *                 expiresAt: "2026-05-22T09:35:00.000Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/auth/sessions/{sessionId}:
 *   delete:
 *     tags: [Auth]
 *     summary: Revoke an authenticated user's session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session revoked.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /api/auth/admin-only:
 *   get:
 *     tags: [Auth]
 *     summary: Verify ADMIN-only access
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin route access granted.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *
 * /api/auth/freelancer-only:
 *   get:
 *     tags: [Auth]
 *     summary: Verify FREELANCER-only access
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Freelancer route access granted.
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/nonce', validate(nonceSchema), authController.nonce)
router.post('/verify', validate(verifySchema), authController.verify)
router.post('/refresh', validate(refreshSchema), authController.refresh)
router.post('/logout', validate(logoutSchema), authController.logout)

router.get('/me', authenticate(), authController.me)
router.get('/sessions', authenticate(), authController.sessions)
router.delete('/sessions/:sessionId', authenticate(), validate(revokeSessionSchema), authController.revokeSession)
router.post('/link-wallet/nonce', authenticate(), authController.linkWalletNonce)
router.post('/link-wallet', authenticate(), validate(linkWalletSchema), authController.linkWallet)

router.get('/admin-only', authenticate(), authorizeRoles('ADMIN'), (_req, res) => {
  res.json({
    success: true,
    message: 'Admin route access granted',
  })
})

router.get('/freelancer-only', authenticate(), authorizeRoles('FREELANCER'), (_req, res) => {
  res.json({
    success: true,
    message: 'Freelancer route access granted',
  })
})

export default router
