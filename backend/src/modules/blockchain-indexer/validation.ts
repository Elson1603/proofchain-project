import { z } from 'zod'
import { validate } from '../../utils/validation'

const categories = ['ESCROW', 'PAYMENT', 'NFT_MINT', 'UGF_EXECUTION'] as const

const eventListSchema = z.object({
  query: z.object({
    category: z.enum(categories).optional(),
    eventName: z.string().trim().optional(),
    txHash: z
      .string()
      .trim()
      .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash')
      .optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
  }),
})

export const validateIndexedEventList = validate(eventListSchema)
