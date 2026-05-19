import { NextFunction, Request, Response, Router } from 'express'
import multer from 'multer'
import type { FileFilterCallback } from 'multer'
import { submissionsController } from './controller'
import { validateCreateSubmission, validateUpdateSubmission, validateUploadSubmission } from './validation'

const router = Router()

const DEFAULT_MAX_FILE_MB = 20
const maxFileMb = Number(process.env.SUBMISSION_MAX_FILE_MB ?? DEFAULT_MAX_FILE_MB)
const maxFileBytes = Math.max(1, maxFileMb) * 1024 * 1024

const defaultMimeTypes = [
	'application/pdf',
	'application/zip',
	'application/x-zip-compressed',
	'application/x-7z-compressed',
	'application/gzip',
	'text/plain',
	'text/markdown',
	'application/json',
]

const allowedMimeTypes = (process.env.SUBMISSION_ALLOWED_MIME_TYPES ?? '')
	.split(',')
	.map((value) => value.trim())
	.filter(Boolean)

const effectiveAllowedMimeTypes = allowedMimeTypes.length ? allowedMimeTypes : defaultMimeTypes

const allowedPrefixes = ['image/', 'video/']

const isMimeAllowed = (mimeType: string) => {
	if (effectiveAllowedMimeTypes.includes(mimeType)) {
		return true
	}

	return allowedPrefixes.some((prefix) => mimeType.startsWith(prefix))
}

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: maxFileBytes },
	fileFilter: (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
		if (!isMimeAllowed(file.mimetype)) {
			return callback(new Error('Unsupported file type'))
		}
		return callback(null, true)
	},
})

const uploadSingle = (req: Request, res: Response, next: NextFunction) => {
	upload.single('file')(req, res, (error: unknown) => {
		if (error) {
			const message = error instanceof Error ? error.message : 'File upload failed'
			return res.status(400).json({
				success: false,
				message,
			})
		}
		return next()
	})
}

router.get('/', submissionsController.list)
router.get('/:id', submissionsController.getById)
router.post('/', validateCreateSubmission, submissionsController.create)
router.post('/upload', uploadSingle, validateUploadSubmission, submissionsController.upload)
router.put('/:id', validateUpdateSubmission, submissionsController.update)
router.delete('/:id', submissionsController.remove)

export default router
