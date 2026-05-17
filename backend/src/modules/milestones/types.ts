export const MILESTONE_STATUSES = [
  'pending',
  'in_progress',
  'submitted',
  'approved',
  'rejected',
  'completed',
  'disputed',
] as const

export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]

export const MILESTONE_STATUS_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  pending: ['in_progress', 'submitted', 'disputed'],
  in_progress: ['submitted', 'disputed'],
  submitted: ['approved', 'rejected', 'disputed'],
  approved: ['completed', 'disputed'],
  rejected: ['in_progress', 'disputed'],
  completed: [],
  disputed: ['approved', 'rejected', 'completed'],
}
