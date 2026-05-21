export type SkillTagInput = string[] | string | null | undefined

export type CertificateMetadataAttribute = {
  trait_type: string
  value: string | number | boolean
}

export type CertificateMetadata = {
  name: string
  description: string
  image?: string
  external_url?: string
  attributes: CertificateMetadataAttribute[]
}

export type CertificateExplorerResponse = {
  valid: boolean
  owner: string
  project: string
  issuedAt: string
  tokenId: number
  metadataURI: string
  certificate: Record<string, unknown>
  blockchain: {
    txHash?: string | null
    blockNumber?: number | null
    explorerUrl?: string
  }
}

export type MintCertificateInput = {
  paymentId?: string
  projectId?: string
  projectCompletionProof?: string
  tokenId?: number
}