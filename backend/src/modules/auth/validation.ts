import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { USER_ROLES } from './types'

const walletAddressSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address')

export const nonceSchema = z.object({
  body: z.object({
    walletAddress: walletAddressSchema,
  }),
})

export const verifySchema = z.object({
  body: z.object({
    walletAddress: walletAddressSchema,
    signature: z.string().trim().min(20, 'Signature is required'),
    role: z.enum(USER_ROLES).default('FREELANCER'),
  }),
})

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().trim().min(20, 'Refresh token is required'),
  }),
})

export const logoutSchema = refreshSchema

export const revokeSessionSchema = z.object({
  params: z.object({
    sessionId: z.string().uuid('Invalid session id'),
  }),
})

export const linkWalletSchema = z.object({
  body: z.object({
    walletAddress: walletAddressSchema,
    signature: z.string().trim().min(20, 'Signature is required'),
    nonce: z.string().trim().min(32, 'Nonce is required'),
  }),
})

export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    })

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request payload',
        errors: result.error.flatten(),
      })
    }

    return next()
  }
}
