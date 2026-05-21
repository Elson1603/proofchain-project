import { getAddress, isAddress } from 'ethers'
import { CertificateMetadata, CertificateMetadataAttribute, SkillTagInput } from './types'

export const DEFAULT_PLATFORM_NAME = 'ProofChain'
export const DEFAULT_CERTIFICATE_IMAGE = process.env.PROOFCHAIN_CERTIFICATE_IMAGE_URI || 'ipfs://certificate-image'

export function normalizeWalletAddress(walletAddress: string) {
  if (!isAddress(walletAddress)) {
    throw new Error('Invalid wallet address')
  }

  return getAddress(walletAddress)
}

export function normalizeSkillTags(skillTags: SkillTagInput) {
  if (!skillTags) {
    return [] as string[]
  }

  if (Array.isArray(skillTags)) {
    return skillTags.map((tag) => tag.trim()).filter(Boolean)
  }

  return skillTags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function sanitizeText(value: unknown, maxLength = 4000) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

export function toCertificateMetadataAttributes(input: Array<CertificateMetadataAttribute>) {
  return input.filter((attribute) => Boolean(attribute.trait_type) && attribute.value !== undefined)
}

export function buildCertificateMetadata(input: {
  freelancerName: string
  projectTitle: string
  projectDescription: string
  projectCompletionProof: string
  clientApprovalStatus: boolean
  completionTimestamp: string
  paymentTransactionHash: string
  metadataURI: string
  skillTags: string[]
  platformName?: string
}): CertificateMetadata {
  const platformName = input.platformName ?? DEFAULT_PLATFORM_NAME
  const attributes = toCertificateMetadataAttributes([
    { trait_type: 'Freelancer', value: input.freelancerName },
    { trait_type: 'Project', value: input.projectTitle },
    { trait_type: 'Skills', value: input.skillTags.join(', ') || 'Unspecified' },
    { trait_type: 'Client Approval Status', value: input.clientApprovalStatus ? 'Approved' : 'Pending' },
    { trait_type: 'Completion Timestamp', value: input.completionTimestamp },
    { trait_type: 'Payment Transaction Hash', value: input.paymentTransactionHash },
    { trait_type: 'Platform', value: platformName },
  ])

  return {
    name: `ProofChain Freelance Certificate - ${input.projectTitle}`,
    description: input.projectDescription,
    image: DEFAULT_CERTIFICATE_IMAGE,
    external_url: input.metadataURI,
    attributes,
  }
}

export function buildExplorerUrl(txHash?: string | null) {
  if (!txHash) {
    return undefined
  }

  const baseUrl = process.env.BASE_SEPOLIA_EXPLORER_URL || 'https://sepolia.basescan.org'
  return `${baseUrl.replace(/\/$/, '')}/tx/${txHash}`
}

export function toIsoString(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString() : new Date().toISOString()
}