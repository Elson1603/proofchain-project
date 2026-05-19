import { z } from 'zod'
import { validate } from '../../utils/validation'

const MAX_BIO_LENGTH = 500
const MAX_SKILLS = 50

const urlField = z.string().trim().url('Invalid URL').nullable().optional()

const updateMyProfileSchema = z.object({
  body: z
    .object({
      username: z.string().trim().min(3, 'Username must be at least 3 characters').max(32).nullable().optional(),
      bio: z.string().trim().max(MAX_BIO_LENGTH, `Bio must be at most ${MAX_BIO_LENGTH} characters`).nullable().optional(),
      avatarUrl: urlField,
      githubUrl: urlField,
      linkedinUrl: urlField,
      portfolioUrl: urlField,
      skills: z
        .array(z.string().trim().min(1, 'Skill cannot be empty').max(32, 'Skill is too long'))
        .max(MAX_SKILLS, `Skills must contain at most ${MAX_SKILLS} items`)
        .nullable()
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
})

const userIdParamSchema = z.object({
  params: z.object({
    userId: z.string().uuid('Invalid user id'),
  }),
})

export const validateUpdateMyProfile = validate(updateMyProfileSchema)
export const validateGetPublicProfile = validate(userIdParamSchema)
