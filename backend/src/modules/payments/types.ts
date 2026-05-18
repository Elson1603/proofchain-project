export const PAYMENT_STATUSES = [
  'pending',
  'escrowed',
  'released',
  'refunded',
  'failed',
  'cancelled',
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_TYPES = [
  'escrow_deposit',
  'milestone_release',
  'refund',
  'platform_fee',
] as const

export type PaymentType = (typeof PAYMENT_TYPES)[number]

export const TRANSACTION_STATUSES = [
  'queued',
  'submitted',
  'confirmed',
  'failed',
  'replaced',
] as const

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]

export const TRANSACTION_TYPES = [
  'escrow_deposit',
  'payment_release',
  'refund',
  'certificate_mint',
  'certificate_revoke',
] as const

export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const PAYMENT_ACTIONS = ['approve_milestone', 'release_payment'] as const

export type PaymentAction = (typeof PAYMENT_ACTIONS)[number]
