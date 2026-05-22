export type ApiSuccessResponse<T> = {
  success: true
  data: T
}

export type ApiErrorResponse = {
  success: false
  message: string
  errors?: unknown
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export type UserProfile = {
  id: string
  fullName: string | null
  username: string | null
  walletAddress: string
  isVerified: boolean
  bio: string | null
  avatarUrl: string | null
  githubUrl: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
  skills: string[]
  reputationScore: number
  role: string
  createdAt: Date
  updatedAt: Date
}

export type PublicProfile = Omit<UserProfile, 'role'>

export type UpdateMyProfileInput = {
  username?: string | null
  bio?: string | null
  avatarUrl?: string | null
  githubUrl?: string | null
  linkedinUrl?: string | null
  portfolioUrl?: string | null
  skills?: string[] | null
}
