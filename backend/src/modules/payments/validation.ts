import { z } from 'zod'
import { validate } from '../../utils/validation'
import {
  PAYMENT_ACTIONS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  TRANSACTION_STATUSES,
} from './types'

const addressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')

const txHashSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash')

const executeSchema = z.object({
  body: z.object({
    projectId: z.string().uuid('Invalid project id'),
    milestoneId: z.string().uuid('Invalid milestone id').optional(),
    submissionId: z.string().uuid('Invalid submission id').optional(),
    payerId: z.string().uuid('Invalid payer id'),
    payeeId: z.string().uuid('Invalid payee id'),
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    type: z.enum(PAYMENT_TYPES),
    action: z.enum(PAYMENT_ACTIONS),
    projectChainId: z.coerce.number().int().nonnegative(),
    milestoneIndex: z.coerce.number().int().nonnegative(),
    escrowAddress: addressSchema,
    payerWallet: addressSchema,
    chainId: z.coerce.number().int().optional(),
    currency: z.string().trim().optional(),
    txHash: txHashSchema,
    relayerRequestId: z.string().trim().optional(),
    gasQuote: z.coerce.number().positive().optional(),
    gasQuoteCurrency: z.string().trim().optional(),
    status: z.enum(TRANSACTION_STATUSES).optional(),
    blockNumber: z.coerce.number().int().nonnegative().optional(),
  }),
})

const createPaymentSchema = z.object({
  body: z.object({
    projectId: z.string().uuid('Invalid project id'),
    milestoneId: z.string().uuid('Invalid milestone id').optional(),
    submissionId: z.string().uuid('Invalid submission id').optional(),
    payerId: z.string().uuid('Invalid payer id'),
    payeeId: z.string().uuid('Invalid payee id'),
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    type: z.enum(PAYMENT_TYPES),
    status: z.enum(PAYMENT_STATUSES).optional(),
    currency: z.string().trim().optional(),
    escrowAddress: addressSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
})

const updatePaymentSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid payment id'),
  }),
  body: z
    .object({
      status: z.enum(PAYMENT_STATUSES).optional(),
      failureReason: z.string().trim().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
})

const retrySchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid payment id'),
  }),
  body: z.object({
    txHash: txHashSchema,
    relayerRequestId: z.string().trim().optional(),
    gasQuote: z.coerce.number().positive().optional(),
    gasQuoteCurrency: z.string().trim().optional(),
    status: z.enum(TRANSACTION_STATUSES).optional(),
    chainId: z.coerce.number().int().optional(),
    currency: z.string().trim().optional(),
    escrowAddress: addressSchema.optional(),
    payerWallet: addressSchema.optional(),
    blockNumber: z.coerce.number().int().nonnegative().optional(),
  }),
})

const recoverSchema = retrySchema

const pollSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().positive().max(200).optional(),
  }),
})

export const validateExecutePayment = validate(executeSchema)
export const validateCreatePayment = validate(createPaymentSchema)
export const validateUpdatePayment = validate(updatePaymentSchema)
export const validatePaymentRetry = validate(retrySchema)
export const validatePaymentRecover = validate(recoverSchema)
export const validatePaymentPoll = validate(pollSchema)
