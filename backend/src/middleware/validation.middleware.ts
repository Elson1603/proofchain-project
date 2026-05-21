import { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../utils/errors'

export type ValidationTarget = 'body' | 'params' | 'query' | 'all'

export type RequestValidationSchemas = {
  body?: z.ZodTypeAny
  params?: z.ZodTypeAny
  query?: z.ZodTypeAny
}

function assignParsedValue(req: Request, target: Exclude<ValidationTarget, 'all'>, value: unknown) {
  if (target === 'body') {
    req.body = value
  }

  if (target === 'params') {
    req.params = value as Request['params']
  }

  if (target === 'query') {
    req.query = value as Request['query']
  }
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }))
}

export function validate(schema: z.ZodTypeAny) {
  return validateRequest({ body: z.any(), params: z.any(), query: z.any() }, schema)
}

export function validateBody(schema: z.ZodTypeAny) {
  return validateRequest({ body: schema })
}

export function validateParams(schema: z.ZodTypeAny) {
  return validateRequest({ params: schema })
}

export function validateQuery(schema: z.ZodTypeAny) {
  return validateRequest({ query: schema })
}

export function validateRequest(schemas: RequestValidationSchemas, combinedSchema?: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (combinedSchema) {
        const result = combinedSchema.safeParse({
          body: req.body,
          params: req.params,
          query: req.query,
        })

        if (!result.success) {
          return next(new AppError(400, 'Invalid request payload', 'VALIDATION_ERROR', formatZodError(result.error)))
        }

        return next()
      }

      for (const [target, schema] of Object.entries(schemas) as Array<[Exclude<ValidationTarget, 'all'>, z.ZodTypeAny | undefined]>) {
        if (!schema) {
          continue
        }

        const result = schema.safeParse(req[target])
        if (!result.success) {
          return next(new AppError(400, 'Invalid request payload', 'VALIDATION_ERROR', formatZodError(result.error)))
        }

        assignParsedValue(req, target, result.data)
      }

      return next()
    } catch (error) {
      return next(error)
    }
  }
}
