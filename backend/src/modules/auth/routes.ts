import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { authorizeRoles } from '../../middleware/role.middleware'
import { authRateLimiter } from '../../middleware/rateLimit.middleware'
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

router.post('/nonce', authRateLimiter, validate(nonceSchema), authController.nonce)
router.post('/verify', authRateLimiter, validate(verifySchema), authController.verify)
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
