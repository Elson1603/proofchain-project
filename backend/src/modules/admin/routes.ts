import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { requireAdminRole } from '../../middleware/role.middleware'
import { adminController } from './controller'
import {
  validateAdminIdParam,
  validateAnalyticsRange,
  validateAuditLogs,
  validateCloseProject,
  validateCreateDispute,
  validateDisputeList,
  validateFlagUser,
  validateFraudAlerts,
  validateProjectList,
  validateResetReputation,
  validateResolveDispute,
  validateRetryTransaction,
  validateRoleUpdate,
  validateSuspendUser,
  validateTransactionList,
  validateTxHashParam,
  validateUserList,
  validateVerifyUser,
} from './validation'

const router = Router()

router.use(authenticate(), requireAdminRole())

router.get('/analytics/overview', validateAnalyticsRange, adminController.overview)
router.get('/analytics/payments', validateAnalyticsRange, adminController.paymentAnalytics)
router.get('/analytics/nfts', validateAnalyticsRange, adminController.nftAnalytics)

router.get('/users', validateUserList, adminController.users)
router.get('/users/:id/activity', validateAdminIdParam, adminController.userActivity)
router.patch(
  '/users/:id/suspend',
  requireAdminRole('ADMIN', 'SUPER_ADMIN', 'SUPPORT_ADMIN'),
  validateAdminIdParam,
  validateSuspendUser,
  adminController.suspendUser,
)
router.patch(
  '/users/:id/verify',
  requireAdminRole('ADMIN', 'SUPER_ADMIN', 'SUPPORT_ADMIN'),
  validateAdminIdParam,
  validateVerifyUser,
  adminController.verifyUser,
)
router.patch(
  '/users/:id/role',
  requireAdminRole('ADMIN', 'SUPER_ADMIN'),
  validateAdminIdParam,
  validateRoleUpdate,
  adminController.updateUserRole,
)
router.patch(
  '/users/:id/reputation',
  requireAdminRole('ADMIN', 'SUPER_ADMIN', 'SUPPORT_ADMIN'),
  validateAdminIdParam,
  validateResetReputation,
  adminController.resetReputation,
)
router.post(
  '/users/:id/flag',
  requireAdminRole('ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT_ADMIN'),
  validateAdminIdParam,
  validateFlagUser,
  adminController.flagUser,
)

router.get('/projects', validateProjectList, adminController.projects)
router.get('/projects/:id', validateAdminIdParam, adminController.project)
router.patch(
  '/projects/:id/close',
  requireAdminRole('ADMIN', 'SUPER_ADMIN', 'MODERATOR'),
  validateAdminIdParam,
  validateCloseProject,
  adminController.closeProject,
)

router.get('/disputes', validateDisputeList, adminController.disputes)
router.post('/disputes', requireAdminRole('ADMIN', 'SUPER_ADMIN', 'MODERATOR'), validateCreateDispute, adminController.createDispute)
router.get('/disputes/:id', validateAdminIdParam, adminController.dispute)
router.patch(
  '/disputes/:id/resolve',
  requireAdminRole('ADMIN', 'SUPER_ADMIN', 'MODERATOR'),
  validateAdminIdParam,
  validateResolveDispute,
  adminController.resolveDispute,
)

router.get('/transactions', requireAdminRole('ADMIN', 'SUPER_ADMIN', 'BLOCKCHAIN_ADMIN'), validateTransactionList, adminController.transactions)
router.post('/transactions/sync', requireAdminRole('ADMIN', 'SUPER_ADMIN', 'BLOCKCHAIN_ADMIN'), adminController.syncTransactions)
router.get('/transactions/:txHash', requireAdminRole('ADMIN', 'SUPER_ADMIN', 'BLOCKCHAIN_ADMIN'), validateTxHashParam, adminController.transaction)
router.post(
  '/transactions/:txHash/retry',
  requireAdminRole('ADMIN', 'SUPER_ADMIN', 'BLOCKCHAIN_ADMIN'),
  validateTxHashParam,
  validateRetryTransaction,
  adminController.retryTransaction,
)

router.get('/fraud/alerts', validateFraudAlerts, adminController.fraudAlerts)
router.post('/fraud/scan', requireAdminRole('ADMIN', 'SUPER_ADMIN', 'MODERATOR'), adminController.runFraudScan)

router.get('/audit-logs', requireAdminRole('ADMIN', 'SUPER_ADMIN'), validateAuditLogs, adminController.auditLogs)

export default router
