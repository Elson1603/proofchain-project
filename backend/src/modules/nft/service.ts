import type { Prisma } from '@prisma/client'
import prisma from '../../config/db'
import { AppError } from '../../utils/errors'
import { notificationsService } from '../notifications/service'
import { blockchainService } from './blockchain.service'
import { nftEvents } from './events'
import { pinataService } from './pinata.service'
import { buildCertificateMetadata, buildExplorerUrl, normalizeSkillTags, normalizeWalletAddress, sanitizeText, toIsoString } from './utils'
import type { CertificateExplorerResponse, CertificateMetadata, MintCertificateInput } from './types'

type MintContext = {
  payment?: PaymentWithRelations
  project: ProjectWithFreelancer
  freelancer: NonNullable<ProjectWithFreelancer['freelancer']>
}

type ProjectWithFreelancer = Prisma.ProjectGetPayload<{
  include: { freelancer: true }
}>

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    project: { include: { freelancer: true } }
    payee: true
    transactions: true
  }
}>

function asPlainObject(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return value as Record<string, unknown>
}

function parseProjectCompletionProof(payment?: MintContext['payment'], fallback?: string) {
  const metadata = asPlainObject(payment?.metadata)
  const proof = typeof metadata.projectCompletionProof === 'string' ? metadata.projectCompletionProof : undefined
  return sanitizeText(proof || fallback || payment?.transactions?.[0]?.txHash || '')
}

function ensureProjectEligibility(project: { status: string; freelancerId: string | null }) {
  if (project.status !== 'completed') {
    throw new AppError(409, 'Project must be completed before a certificate can be minted', 'PROJECT_NOT_COMPLETED')
  }

  if (!project.freelancerId) {
    throw new AppError(409, 'Project must be assigned to a freelancer before minting', 'FREELANCER_REQUIRED')
  }
}

async function findExistingCertificate(paymentId?: string, projectId?: string) {
  if (paymentId) {
    const existingByPayment = await prisma.nftCertificate.findUnique({
      where: { paymentId },
      include: { project: true, user: true, payment: true },
    })

    if (existingByPayment) {
      return existingByPayment
    }
  }

  if (projectId) {
    const existingByProject = await prisma.nftCertificate.findUnique({
      where: { projectId },
      include: { project: true, user: true, payment: true },
    })

    if (existingByProject) {
      return existingByProject
    }
  }

  return null
}

function publishNotification(userId: string, title: string, message: string, projectTitle?: string, tokenId?: number) {
  void notificationsService
    .sendNftMintedNotification({
      userId,
      projectTitle: projectTitle ?? title,
      tokenId: tokenId ?? null,
    })
    .catch((error) => {
      console.error('Failed to send NFT notification', error)
    })

}

function emit(event: 'nft_mint_started' | 'nft_minted' | 'nft_failed' | 'certificate_verified', payload: Record<string, unknown>) {
  nftEvents.publish(event, payload)
}

async function buildMetadataContext(params: {
  payment: PaymentWithRelations
  project: ProjectWithFreelancer
  freelancer: NonNullable<ProjectWithFreelancer['freelancer']>
  metadataURI: string
  projectCompletionProof: string
}) {
  return buildCertificateMetadata({
    freelancerName: sanitizeText(params.freelancer.fullName ?? params.freelancer.username ?? params.freelancer.walletAddress),
    projectTitle: sanitizeText(params.project.title),
    projectDescription: sanitizeText(params.project.description ?? ''),
    projectCompletionProof: sanitizeText(params.projectCompletionProof),
    clientApprovalStatus: true,
    completionTimestamp: toIsoString(params.payment.releasedAt ?? params.payment.updatedAt),
    paymentTransactionHash: sanitizeText(params.payment.transactions?.[0]?.txHash ?? ''),
    metadataURI: params.metadataURI,
    skillTags: normalizeSkillTags(params.freelancer.skills),
    platformName: 'ProofChain',
  })
}

async function createCertificateRecord(input: {
  tokenId: number
  metadataURI: string
  metadata: CertificateMetadata
  project: ProjectWithFreelancer
  payment: PaymentWithRelations
  freelancer: NonNullable<ProjectWithFreelancer['freelancer']>
  txHash: string
  blockNumber: number | null
  gasUsed: number | null
}) {
  return prisma.$transaction(async (tx) => {
    const certificate = await tx.nftCertificate.create({
      data: {
        userId: input.freelancer.id,
        projectId: input.project.id,
        paymentId: input.payment.id,
        freelancerWallet: normalizeWalletAddress(input.freelancer.walletAddress),
        tokenId: input.tokenId,
        metadataURI: input.metadataURI,
        metadata: input.metadata as Prisma.InputJsonValue,
        transactionHash: input.txHash,
        blockNumber: input.blockNumber ?? undefined,
        gasUsed: input.gasUsed ?? undefined,
        certificateStatus: 'verified',
        mintedAt: new Date(),
        verifiedAt: new Date(),
      },
    })

    await tx.transaction.create({
      data: {
        projectId: input.project.id,
        paymentId: input.payment.id,
        initiatedBy: input.project.ownerId,
        nftCertificateId: certificate.id,
        type: 'certificate_mint',
        status: 'confirmed',
        chainId: Number(process.env.BASE_SEPOLIA_CHAIN_ID ?? 84532),
        txHash: input.txHash,
        toAddress: process.env.PROOFCHAIN_CERTIFICATE_CONTRACT_ADDRESS ?? input.freelancer.walletAddress,
        fromAddress: process.env.PROOFCHAIN_CERTIFICATE_PRIVATE_KEY ? 'backend-relayer' : undefined,
        blockNumber: input.blockNumber ?? undefined,
        gasUsed: input.gasUsed ?? undefined,
        submittedAt: new Date(),
        confirmedAt: new Date(),
      },
    })

    await tx.payment.update({
      where: { id: input.payment.id },
      data: {
        metadata: {
          ...(asPlainObject(input.payment.metadata) as Record<string, unknown>),
          nftCertificateId: certificate.id,
          nftTokenId: input.tokenId,
          nftMetadataURI: input.metadataURI,
        },
      },
    })

    return certificate
  })
}

async function mintCertificateWithContext(context: MintContext, input: MintCertificateInput = {}) {
  const existing = await findExistingCertificate(input.paymentId ?? context.payment?.id, input.projectId ?? context.project.id)
  if (existing) {
    return existing
  }

  const payment = context.payment ?? (await prisma.payment.findFirst({
    where: { projectId: context.project.id, status: 'released' },
    orderBy: { createdAt: 'desc' },
    include: {
      project: { include: { freelancer: true } },
      payee: true,
      transactions: true,
    },
  })) as PaymentWithRelations | null

  if (!payment) {
    throw new AppError(404, 'Released payment not found for project', 'PAYMENT_NOT_FOUND')
  }

  ensureProjectEligibility(context.project)

  if (payment.status !== 'released') {
    throw new AppError(409, 'Payment must be released before minting a certificate', 'PAYMENT_NOT_RELEASED')
  }

  const projectCompletionProof = parseProjectCompletionProof(payment, input.projectCompletionProof)

  emit('nft_mint_started', {
    userId: context.freelancer.id,
    projectId: context.project.id,
    paymentId: payment.id,
    wallet: context.freelancer.walletAddress,
  })

  try {
    const metadata = await buildMetadataContext({
      payment,
      project: context.project,
      freelancer: context.freelancer,
      metadataURI: 'pending',
      projectCompletionProof,
    })

    const pinataUpload = await pinataService.uploadJson(metadata)

    const finalMetadata = {
      ...metadata,
      external_url: pinataUpload.gatewayUrl,
    }

    const blockchainResult = await blockchainService.mintCertificate({
      to: normalizeWalletAddress(context.freelancer.walletAddress),
      metadataURI: pinataUpload.uri,
      certificate: {
        freelancerName: sanitizeText(context.freelancer.fullName ?? context.freelancer.username ?? context.freelancer.walletAddress),
        freelancerWallet: normalizeWalletAddress(context.freelancer.walletAddress),
        projectTitle: sanitizeText(context.project.title),
        projectDescription: sanitizeText(context.project.description ?? ''),
        projectCompletionProof,
        clientApprovalStatus: true,
        completionTimestamp: BigInt(Math.floor(new Date(payment.releasedAt ?? new Date()).getTime() / 1000)),
        paymentTransactionHash: sanitizeText(payment.transactions[0]?.txHash ?? ''),
        metadataURI: pinataUpload.uri,
        skillTags: normalizeSkillTags(context.freelancer.skills),
        platformName: 'ProofChain',
      },
    })

    const tokenId = input.tokenId ?? blockchainResult.tokenId ?? (await prisma.nftCertificate.count()) + 1

    const certificate = await createCertificateRecord({
      tokenId,
      metadataURI: pinataUpload.uri,
      metadata: finalMetadata,
      project: context.project,
      payment,
      freelancer: context.freelancer,
      txHash: blockchainResult.txHash,
      blockNumber: blockchainResult.blockNumber,
      gasUsed: blockchainResult.gasUsed,
    })

    publishNotification(
      context.freelancer.id,
      'Soulbound certificate minted',
      `ProofChain certificate #${certificate.tokenId} was minted for ${context.project.title}`,
      context.project.title,
      certificate.tokenId,
    )

    emit('nft_minted', {
      userId: context.freelancer.id,
      projectId: context.project.id,
      paymentId: payment.id,
      tokenId: certificate.tokenId,
      certificateId: certificate.id,
      wallet: context.freelancer.walletAddress,
      txHash: certificate.transactionHash,
    })

    return certificate
  } catch (error) {
    emit('nft_failed', {
      userId: context.freelancer.id,
      projectId: context.project.id,
      paymentId: payment.id,
      wallet: context.freelancer.walletAddress,
      error: error instanceof Error ? error.message : 'Certificate mint failed',
    })
    throw error
  }
}

export const nftService = {
  async list() {
    return prisma.nftCertificate.findMany({
      orderBy: { createdAt: 'desc' },
      include: { project: true, user: true, payment: true },
    })
  },

  async getById(id: string) {
    return prisma.nftCertificate.findUnique({
      where: { id },
      include: { project: true, user: true, payment: true, transactions: true },
    })
  },

  async getByTokenId(tokenId: number) {
    return prisma.nftCertificate.findUnique({
      where: { tokenId },
      include: { project: true, user: true, payment: true, transactions: true },
    })
  },

  async getByWallet(wallet: string) {
    return prisma.nftCertificate.findMany({
      where: { freelancerWallet: normalizeWalletAddress(wallet) },
      orderBy: { createdAt: 'desc' },
      include: { project: true, user: true, payment: true },
    })
  },

  async getByProject(projectId: string) {
    return prisma.nftCertificate.findUnique({
      where: { projectId },
      include: { project: true, user: true, payment: true, transactions: true },
    })
  },

  async mintCertificate(input: MintCertificateInput) {
    const context = input.paymentId
      ? await prisma.payment.findUnique({
          where: { id: input.paymentId },
          include: {
            project: { include: { freelancer: true } },
            payee: true,
            transactions: true,
          },
        }).then((payment) => {
          if (!payment) {
            throw new AppError(404, 'Payment not found', 'PAYMENT_NOT_FOUND')
          }

          return {
            payment,
            project: payment.project,
            freelancer: payment.payee,
          }
        })
      : await prisma.project.findUnique({
          where: { id: input.projectId ?? '' },
          include: { freelancer: true },
        }).then((project) => {
          if (!project) {
            throw new AppError(404, 'Project not found', 'PROJECT_NOT_FOUND')
          }

          if (!project.freelancer) {
            throw new AppError(409, 'Project must have an assigned freelancer before minting', 'FREELANCER_REQUIRED')
          }

          return {
            project,
            freelancer: project.freelancer,
          }
        })

    return mintCertificateWithContext(context, input)
  },

  async mintFromPayment(paymentId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        project: { include: { freelancer: true } },
        payee: true,
        transactions: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!payment) {
      throw new AppError(404, 'Payment not found', 'PAYMENT_NOT_FOUND')
    }

    if (payment.status !== 'released') {
      return null
    }

    return mintCertificateWithContext(
      {
        payment,
        project: payment.project,
        freelancer: payment.payee,
      },
      { paymentId },
    )
  },

  async verifyCertificate(tokenId: number) {
    const certificate = await prisma.nftCertificate.findUnique({
      where: { tokenId },
      include: {
        project: { include: { freelancer: true } },
        user: true,
        payment: { include: { transactions: { orderBy: { createdAt: 'desc' } } } },
      },
    })

    if (!certificate) {
      const blockchain = await blockchainService.verifyCertificate(tokenId).catch((error) => {
        console.warn(`Certificate ${tokenId} is not in the database and could not be verified on-chain`, error)

        return {
          valid: false,
          owner: 'Unavailable',
          metadataURI: '',
        }
      })

      return {
        valid: blockchain.valid,
        owner: blockchain.owner,
        project: 'Unknown',
        issuedAt: new Date().toISOString(),
        tokenId,
        metadataURI: blockchain.metadataURI,
        certificate: {},
        blockchain: {
          txHash: null,
          blockNumber: null,
          explorerUrl: blockchainService.getExplorerUrl(null),
        },
      } satisfies CertificateExplorerResponse
    }

    const blockchain = await blockchainService.verifyCertificate(tokenId).catch(() => ({
      valid: true,
      owner: certificate.freelancerWallet,
      metadataURI: certificate.metadataURI,
    }))

    const valid = Boolean(blockchain.valid) && certificate.certificateStatus !== 'failed' && certificate.certificateStatus !== 'revoked'

    const result: CertificateExplorerResponse = {
      valid,
      owner: blockchain.owner,
      project: certificate.project.title,
      issuedAt: certificate.mintedAt?.toISOString() ?? certificate.createdAt.toISOString(),
      tokenId: certificate.tokenId,
      metadataURI: certificate.metadataURI,
      certificate: {
        id: certificate.id,
        userId: certificate.userId,
        projectId: certificate.projectId,
        freelancerWallet: certificate.freelancerWallet,
        certificateStatus: certificate.certificateStatus,
        metadata: certificate.metadata,
        mintedAt: certificate.mintedAt,
        verifiedAt: certificate.verifiedAt,
        tokenId: certificate.tokenId,
      },
      blockchain: {
        txHash: certificate.transactionHash,
        blockNumber: certificate.blockNumber,
        explorerUrl: buildExplorerUrl(certificate.transactionHash),
      },
    }

    emit('certificate_verified', {
      userId: certificate.userId,
      projectId: certificate.projectId,
      tokenId: certificate.tokenId,
      certificateId: certificate.id,
      wallet: certificate.freelancerWallet,
    })

    return result
  },

  async getExplorer(tokenId: number) {
    return this.verifyCertificate(tokenId)
  },

  async create(data: Record<string, unknown>) {
    return prisma.nftCertificate.create({
      data: data as Parameters<typeof prisma.nftCertificate.create>[0]['data'],
    })
  },

  async update(id: string, data: Record<string, unknown>) {
    return prisma.nftCertificate.update({
      where: { id },
      data: data as Parameters<typeof prisma.nftCertificate.update>[0]['data'],
    })
  },

  async remove(id: string) {
    return prisma.nftCertificate.delete({ where: { id } })
  },
}
