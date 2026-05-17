export const PROJECT_STATUSES = [
  'draft',
  'open',
  'in_progress',
  'submitted',
  'approved',
  'rejected',
  'completed',
  'disputed',
] as const

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ['open'],
  open: ['in_progress', 'disputed'],
  in_progress: ['submitted', 'disputed'],
  submitted: ['approved', 'rejected', 'disputed'],
  approved: ['completed', 'disputed'],
  rejected: ['open', 'disputed'],
  completed: [],
  disputed: ['approved', 'rejected', 'completed'],
}
