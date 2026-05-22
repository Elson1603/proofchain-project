import { z } from 'zod'
import { validate } from '../../utils/validation'
import { NOTIFICATION_TYPES } from './types'

const listSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().positive().max(100).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
    unreadOnly: z.coerce.boolean().optional(),
  }),
})

const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid notification id'),
  }),
})

const createSchema = z.object({
  body: z.object({
    userId: z.string().uuid('Invalid user id').optional(),
    title: z.string().trim().min(1, 'Title is required'),
    message: z.string().trim().min(1, 'Message is required'),
    type: z.enum(NOTIFICATION_TYPES).optional(),
    actionUrl: z.string().trim().startsWith('/').refine((value) => !value.startsWith('//'), 'Action URL must be a same-origin path').optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
})

export const validateListNotifications = validate(listSchema)
export const validateNotificationId = validate(notificationIdSchema)
export const validateCreateNotification = validate(createSchema)
