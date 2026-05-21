export const NOTIFICATION_TYPES = [
  'system',
  'work_submitted',
  'payment_released',
  'nft_minted',
  'project_deadline_reminder',
  'transaction_alert',
  'approval_reminder',
  'chat',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
