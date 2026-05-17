import { z } from 'zod'
import { validate } from '../../utils/validation'
import { PROJECT_STATUSES } from './types'

const milestoneInputSchema = z.object({
  title: z.string().trim().min(3, 'Milestone title is required'),
  description: z.string().trim().optional(),
  amount: z.coerce.number().positive('Milestone amount must be greater than 0'),
})

const createProjectSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, 'Project title is required'),
    description: z.string().trim().optional(),
    budget: z.coerce.number().positive('Budget must be greater than 0'),
    deadline: z.string().datetime().optional(),
    ownerId: z.string().uuid('Invalid owner id'),
    invitedFreelancerId: z.string().uuid('Invalid freelancer id').optional(),
    milestones: z.array(milestoneInputSchema).min(1).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
  }),
})

const updateProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project id'),
  }),
  body: z
    .object({
      title: z.string().trim().min(3).optional(),
      description: z.string().trim().optional(),
      budget: z.coerce.number().positive().optional(),
      deadline: z.string().datetime().optional(),
      status: z.enum(PROJECT_STATUSES).optional(),
      invitedFreelancerId: z.string().uuid().nullable().optional(),
      freelancerId: z.string().uuid().nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
})

const inviteFreelancerSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project id'),
  }),
  body: z.object({
    invitedFreelancerId: z.string().uuid('Invalid freelancer id'),
  }),
})

const acceptProjectSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project id'),
  }),
  body: z.object({
    freelancerId: z.string().uuid('Invalid freelancer id'),
  }),
})

const transitionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid project id'),
  }),
})

export const validateCreateProject = validate(createProjectSchema)
export const validateUpdateProject = validate(updateProjectSchema)
export const validateInviteFreelancer = validate(inviteFreelancerSchema)
export const validateAcceptProject = validate(acceptProjectSchema)
export const validateProjectTransition = validate(transitionSchema)
