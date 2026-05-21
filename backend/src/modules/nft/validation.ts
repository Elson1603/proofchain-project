import { RequestHandler } from 'express'
import { AppError } from '../../utils/errors'

function ensureString(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, `${field} is required`, `${field.toUpperCase()}_REQUIRED`)
  }

  return value.trim()
}

export const validateMintCertificate: RequestHandler = (req, _res, next) => {
  try {
    if (!req.body.paymentId && !req.body.projectId) {
      throw new AppError(400, 'paymentId or projectId is required', 'CERTIFICATE_TARGET_REQUIRED')
    }

    if (req.body.paymentId) {
      ensureString(req.body.paymentId, 'paymentId')
    }

    if (req.body.projectId) {
      ensureString(req.body.projectId, 'projectId')
    }

    next()
  } catch (error) {
    next(error)
  }
}

export const validateTokenParam: RequestHandler = (req, _res, next) => {
  try {
    ensureString(req.params.tokenId, 'tokenId')
    next()
  } catch (error) {
    next(error)
  }
}

export const validateWalletParam: RequestHandler = (req, _res, next) => {
  try {
    ensureString(req.params.wallet, 'wallet')
    next()
  } catch (error) {
    next(error)
  }
}

export const validateProjectParam: RequestHandler = (req, _res, next) => {
  try {
    ensureString(req.params.projectId, 'projectId')
    next()
  } catch (error) {
    next(error)
  }
}
