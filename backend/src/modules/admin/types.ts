import type { Prisma } from '@prisma/client'

export type AdminRequestContext = {
  adminId?: string
  ipAddress?: string
  userAgent?: string
}

export type PaginationParams = {
  page?: number
  limit?: number
}

export type PaginatedResult<T> = {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type AuditInput = AdminRequestContext & {
  actionType: string
  entityType: string
  entityId?: string | null
  previousValue?: Prisma.InputJsonValue | null
  newValue?: Prisma.InputJsonValue | null
}
