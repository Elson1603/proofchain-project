import { z } from 'zod'
import { validate } from '../../utils/validation'
import { MILESTONE_STATUSES } from './types'

const createMilestoneSchema = z.object({
  body: z.object({
    projectId: z.string().uuid('Invalid project id'),
    title: z.string().trim().min(3, 'Milestone title is required'),
    description: z.string().trim().optional(),
    amount: z.coerce.number().positive('Amount must be greater than 0'),
  }),
})

const updateMilestoneSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid milestone id'),
  }),
  body: z
    .object({
      title: z.string().trim().min(3).optional(),
      description: z.string().trim().optional(),
      amount: z.coerce.number().positive().optional(),
      status: z.enum(MILESTONE_STATUSES).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
})

export const validateCreateMilestone = validate(createMilestoneSchema)
export const validateUpdateMilestone = validate(updateMilestoneSchema)
