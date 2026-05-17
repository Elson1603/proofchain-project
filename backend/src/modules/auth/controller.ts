import { NextFunction, Request, Response } from 'express'
import { AuthenticatedRequest } from './types'
import { authService } from './service'

function getDeviceContext(req: Request) {
  return {
    ipAddress: req.ip,
    deviceInfo: req.headers['user-agent'],
  }
}

function handleAuthError(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof Error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    })
  }

  return next(error)
}

export const authController = {
  async nonce(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.requestNonce(req.body.walletAddress)

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      return handleAuthError(error, res, next)
    }
  },

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifySignature(
        req.body.walletAddress,
        req.body.signature,
        req.body.role,
        getDeviceContext(req),
      )

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      return handleAuthError(error, res, next)
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refresh(req.body.refreshToken)

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      return handleAuthError(error, res, next)
    }
  },

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const user = await authService.getMe(req.user!.userId)

      return res.status(200).json({
        success: true,
        data: user,
      })
    } catch (error) {
      return handleAuthError(error, res, next)
    }
  },

  async sessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const sessions = await authService.listSessions(req.user!.userId)

      return res.status(200).json({
        success: true,
        data: sessions,
      })
    } catch (error) {
      return handleAuthError(error, res, next)
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.logout(req.body.refreshToken)

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      return handleAuthError(error, res, next)
    }
  },

  async revokeSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.revokeSession(req.user!.userId, String(req.params.sessionId))

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      return handleAuthError(error, res, next)
    }
  },

  async linkWallet(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const wallet = await authService.linkWallet(
        req.user!.userId,
        req.body.walletAddress,
        req.body.nonce,
        req.body.signature,
      )

      return res.status(201).json({
        success: true,
        data: wallet,
      })
    } catch (error) {
      return handleAuthError(error, res, next)
    }
  },

  async linkWalletNonce(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await authService.requestLinkWalletNonce(req.user!.userId)

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (error) {
      return handleAuthError(error, res, next)
    }
  },
}
