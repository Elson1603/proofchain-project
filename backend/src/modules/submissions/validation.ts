import { z } from 'zod'
import { validate } from '../../utils/validation'

const createSubmissionSchema = z.object({
  body: z.object({
    milestoneId: z.string().uuid('Invalid milestone id'),
    submittedById: z.string().uuid('Invalid user id'),
    githubLink: z.string().url('Invalid GitHub link').optional(),
    demoLink: z.string().url('Invalid demo link').optional(),
    remarks: z.string().trim().optional(),
  }),
})

const updateSubmissionSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid submission id'),
  }),
  body: z
    .object({
      githubLink: z.string().url('Invalid GitHub link').optional(),
      demoLink: z.string().url('Invalid demo link').optional(),
      remarks: z.string().trim().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
})

export const validateCreateSubmission = validate(createSubmissionSchema)
export const validateUpdateSubmission = validate(updateSubmissionSchema)
