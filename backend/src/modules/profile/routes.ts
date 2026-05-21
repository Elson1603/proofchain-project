import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { profileController } from './controller'
import { validateGetPublicProfile, validateUpdateMyProfile } from './validation'

const router = Router()

/**
 * @openapi
 * /api/profile/me:
 *   get:
 *     tags: [Profile]
 *     summary: Get my profile
 *     description: JWT-protected endpoint that returns the authenticated user's editable profile fields for dashboard and account settings screens.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user's profile.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *             example:
 *               success: true
 *               data:
 *                 id: "5b827f08-4a8b-4d1a-bf8b-e6dc3ea4e3f7"
 *                 walletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
 *                 role: "FREELANCER"
 *                 username: "satoshi-builder"
 *                 skills: ["Solidity", "TypeScript"]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Profile]
 *     summary: Update my profile
 *     description: JWT-protected endpoint for users to update public profile metadata such as username, bio, portfolio links, avatar URL, and skills.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 nullable: true
 *               bio:
 *                 type: string
 *                 nullable: true
 *               avatarUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *               githubUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *               linkedinUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *               portfolioUrl:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *               skills:
 *                 type: array
 *                 nullable: true
 *                 items:
 *                   type: string
 *           example:
 *             username: "satoshi-builder"
 *             bio: "Smart contract and backend engineer."
 *             githubUrl: "https://github.com/proofchain-dev"
 *             portfolioUrl: "https://proofchain.dev"
 *             skills: ["Solidity", "Node.js", "PostgreSQL"]
 *     responses:
 *       200:
 *         description: Profile updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *
 * /api/profile/{userId}:
 *   get:
 *     tags: [Profile]
 *     summary: Get a public user profile
 *     description: Returns public freelancer profile details for portfolio pages and client discovery. Non-freelancer users are hidden from this public profile endpoint.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Public profile.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/me', authenticate(), profileController.getMe)
router.patch('/me', authenticate(), validateUpdateMyProfile, profileController.updateMe)
router.get('/:userId', validateGetPublicProfile, profileController.getPublic)

export default router
