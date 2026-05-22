import { z } from 'zod'
import { validateBody, validateParams, validateQuery } from '../../utils/validation'
import { USER_ROLES } from '../auth/types'

const uuid = z.string().uuid('Invalid id')
const txHash = z.string().trim().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash')

const paginationQuery = z.object({
  page: z.coerce.number().int().positive().max(10_000).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().max(120).optional(),
})

export const validateAdminIdParam = validateParams(z.object({ id: uuid }))
export const validateTxHashParam = validateParams(z.object({ txHash }))

export const validateUserList = validateQuery(
  paginationQuery.extend({
    role: z.string().trim().optional(),
    verification: z.enum(['verified', 'unverified']).optional(),
    suspension: z.enum(['active', 'clear']).optional(),
  }),
)

export const validateProjectList = validateQuery(
  paginationQuery.extend({
    status: z.string().trim().optional(),
    participantId: uuid.optional(),
  }),
)

export const validateDisputeList = validateQuery(
  paginationQuery.extend({
    status: z.enum(['OPEN', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'REJECTED']).optional(),
    projectId: uuid.optional(),
  }),
)

export const validateTransactionList = validateQuery(
  paginationQuery.extend({
    status: z.string().trim().optional(),
    type: z.string().trim().optional(),
    category: z.string().trim().optional(),
  }),
)

export const validateAnalyticsRange = validateQuery(
  z.object({
    days: z.coerce.number().int().positive().max(365).optional(),
  }),
)

export const validateFraudAlerts = validateQuery(
  paginationQuery.extend({
    status: z.enum(['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED']).optional(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  }),
)

export const validateAuditLogs = validateQuery(
  paginationQuery.extend({
    actionType: z.string().trim().optional(),
    entityType: z.string().trim().optional(),
    adminId: uuid.optional(),
  }),
)

export const validateSuspendUser = validateBody(
  z.object({
    reason: z.string().trim().min(3).max(800),
    endsAt: z.string().datetime().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
)

export const validateVerifyUser = validateBody(
  z.object({
    isVerified: z.boolean().default(true),
    notes: z.string().trim().max(500).optional(),
  }),
)

export const validateRoleUpdate = validateBody(
  z.object({
    role: z.enum(USER_ROLES),
    reason: z.string().trim().min(3).max(500).optional(),
  }),
)

export const validateResetReputation = validateBody(
  z.object({
    reputationScore: z.coerce.number().min(0).max(100).default(0),
    reason: z.string().trim().min(3).max(500),
  }),
)

export const validateFlagUser = validateBody(
  z.object({
    reason: z.string().trim().min(3).max(800),
    riskScore: z.coerce.number().int().min(0).max(100).default(70),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  }),
)

export const validateCloseProject = validateBody(
  z.object({
    status: z.enum(['completed', 'rejected', 'disputed']).default('completed'),
    reason: z.string().trim().min(3).max(800),
  }),
)

export const validateCreateDispute = validateBody(
  z.object({
    projectId: uuid,
    milestoneId: uuid.optional(),
    raisedById: uuid,
    againstUserId: uuid.optional(),
    reason: z.string().trim().min(3).max(240),
    description: z.string().trim().max(2000).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    evidence: z.record(z.string(), z.unknown()).optional(),
  }),
)

export const validateResolveDispute = validateBody(
  z.object({
    action: z.enum(['RELEASE_PAYMENT', 'REFUND_CLIENT', 'SPLIT_PAYMENT', 'REQUEST_EVIDENCE', 'REJECT_DISPUTE']),
    notes: z.string().trim().min(3).max(2000),
    paymentId: uuid.optional(),
    releaseAmount: z.coerce.number().nonnegative().optional(),
    refundAmount: z.coerce.number().nonnegative().optional(),
    freelancerAmount: z.coerce.number().nonnegative().optional(),
    clientAmount: z.coerce.number().nonnegative().optional(),
  }),
)

export const validateRetryTransaction = validateBody(
  z.object({
    relayerRequestId: z.string().trim().max(160).optional(),
    gasQuote: z.coerce.number().nonnegative().optional(),
    gasQuoteCurrency: z.string().trim().max(20).optional(),
    notes: z.string().trim().max(500).optional(),
  }),
)
