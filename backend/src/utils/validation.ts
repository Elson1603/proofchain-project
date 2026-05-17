import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'

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
