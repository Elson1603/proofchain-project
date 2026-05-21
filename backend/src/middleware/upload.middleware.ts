import path from 'path'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import multer, { MulterError } from 'multer'
import type { FileFilterCallback } from 'multer'
import { AppError } from '../utils/errors'
import { uploadRateLimiter } from './rateLimit.middleware'

export type UploadSecurityOptions = {
  fieldName?: string
  maxFileMb?: number
  allowedMimeTypes?: string[]
  allowedMimePrefixes?: string[]
  allowedExtensions?: string[]
  blockedExtensions?: string[]
}

const DEFAULT_MAX_FILE_MB = 20

const DEFAULT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/zip',
  'application/x-zip-compressed',
]

const DEFAULT_ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.zip']
const DEFAULT_ALLOWED_PREFIXES: string[] = []
const DEFAULT_BLOCKED_EXTENSIONS = [
  '.bat',
  '.cmd',
  '.com',
  '.cpl',
  '.dll',
  '.exe',
  '.js',
  '.jar',
  '.msi',
  '.ps1',
  '.scr',
  '.sh',
  '.vbs',
]

function csvEnv(name: string) {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function normalizeExtensions(values: string[]) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.startsWith('.') ? value.toLowerCase() : `.${value.toLowerCase()}`))
}

function positiveNumberFromEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function toMulterAppError(error: MulterError, maxFileMb: number) {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError(413, `File size must not exceed ${maxFileMb}MB`, 'UPLOAD_FILE_TOO_LARGE')
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return new AppError(400, 'Only one file can be uploaded at a time', 'UPLOAD_FILE_COUNT_EXCEEDED')
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError(400, 'Unexpected file field', 'UPLOAD_UNEXPECTED_FIELD')
  }

  return new AppError(400, 'File upload failed', 'UPLOAD_ERROR')
}

export function getFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase()
}

export function isAllowedMimeType(mimeType: string, allowedMimeTypes: string[], allowedPrefixes: string[]) {
  return allowedMimeTypes.includes(mimeType) || allowedPrefixes.some((prefix) => mimeType.startsWith(prefix))
}

export function createSecureUploadMiddleware(options: UploadSecurityOptions = {}): RequestHandler[] {
  const fieldName = options.fieldName ?? 'file'
  const maxFileMb = options.maxFileMb ?? positiveNumberFromEnv('UPLOAD_MAX_FILE_MB', DEFAULT_MAX_FILE_MB)
  const maxFileBytes = Math.max(1, maxFileMb) * 1024 * 1024
  const allowedMimeTypes = options.allowedMimeTypes ?? csvEnv('UPLOAD_ALLOWED_MIME_TYPES')
  const effectiveMimeTypes = allowedMimeTypes.length ? allowedMimeTypes : DEFAULT_ALLOWED_MIME_TYPES
  const allowedPrefixes = options.allowedMimePrefixes ?? DEFAULT_ALLOWED_PREFIXES
  const configuredExtensions = normalizeExtensions(options.allowedExtensions ?? csvEnv('UPLOAD_ALLOWED_EXTENSIONS'))
  const allowedExtensions = configuredExtensions.length ? configuredExtensions : DEFAULT_ALLOWED_EXTENSIONS
  const blockedExtensions = new Set(normalizeExtensions(options.blockedExtensions ?? DEFAULT_BLOCKED_EXTENSIONS))

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileBytes, files: 1 },
    fileFilter: (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
      const extension = getFileExtension(file.originalname)

      if (blockedExtensions.has(extension)) {
        return callback(new AppError(400, 'Executable files are not allowed', 'UPLOAD_EXTENSION_BLOCKED'))
      }

      if (!allowedExtensions.includes(extension)) {
        return callback(new AppError(400, 'File extension is not allowed', 'UPLOAD_EXTENSION_NOT_ALLOWED'))
      }

      if (!isAllowedMimeType(file.mimetype, effectiveMimeTypes, allowedPrefixes)) {
        return callback(new AppError(400, 'Unsupported file type', 'UPLOAD_MIME_NOT_ALLOWED'))
      }

      return callback(null, true)
    },
  })

  return [
    uploadRateLimiter,
    (req: Request, _res: Response, next: NextFunction) => {
      upload.single(fieldName)(req, _res, (error: unknown) => {
        if (error) {
          if (error instanceof MulterError) {
            return next(toMulterAppError(error, maxFileMb))
          }

          return next(error)
        }

        return next()
      })
    },
  ]
}

export const secureUploadSingle = createSecureUploadMiddleware()
