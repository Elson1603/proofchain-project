import { NextFunction, Request, Response } from 'express'
import { pinataService } from './pinata.service'
import { submissionsService } from './service'

export const submissionsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        milestoneId: typeof req.query.milestoneId === 'string' ? req.query.milestoneId : undefined,
        submittedById: typeof req.query.submittedById === 'string' ? req.query.submittedById : undefined,
      }

      res.json(await submissionsService.list(filters))
    } catch (error) {
      next(error)
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await submissionsService.getById(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await submissionsService.create(req.body))
    } catch (error) {
      next(error)
    }
  },

  async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const file = (req as Request & { file?: Express.Multer.File }).file

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'File is required',
        })
      }

      const { milestoneId, submittedById, remarks } = req.body

      const uploadResult = await pinataService.uploadFile(file)
      const submission = await submissionsService.createFileSubmission({
        milestoneId,
        submittedById,
        remarks,
        ipfsCid: uploadResult.cid,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      })

      res.status(201).json({
        ...submission,
        gatewayUrl: pinataService.buildGatewayUrl(uploadResult.cid),
      })
    } catch (error) {
      next(error)
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await submissionsService.update(String(req.params.id), req.body))
    } catch (error) {
      next(error)
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await submissionsService.remove(String(req.params.id)))
    } catch (error) {
      next(error)
    }
  },
}
