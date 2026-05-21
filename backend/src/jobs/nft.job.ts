import type { Job, JobsOptions } from 'bullmq'
import type { Prisma } from '@prisma/client'
import prisma from '../config/db'
import { blockchainService } from '../modules/nft/blockchain.service'
import { notificationsService } from '../modules/notifications/service'
import { nftQueue } from '../queues/nft.queue'
import { normalizeSkillTags, normalizeWalletAddress, sanitizeText } from '../modules/nft/utils'

export const NFT_MINT_JOB_NAME = 'mint-nft-certificate'

export interface NFTMintJobPayload {
  userId: string
  projectId: string
  metadataUri: string
  correlationId?: string
}

export interface AddNFTMintJobOptions {
  delayMs?: number
  jobId?: string
  attempts?: number
  priority?: number
}

function toBullMQOptions(options: AddNFTMintJobOptions = {}): JobsOptions {
  return {
    delay: options.delayMs,
    jobId: options.jobId,
    attempts: options.attempts,
    priority: options.priority,
  }
}

export async function addNFTMintJob(payload: NFTMintJobPayload, options: AddNFTMintJobOptions = {}) {
  if (!payload.userId || !payload.projectId || !payload.metadataUri) {
    throw new Error('NFT mint job requires userId, projectId, and metadataUri')
  }

  return nftQueue.add(NFT_MINT_JOB_NAME, payload, toBullMQOptions(options))
}

export async function processNFTMintJob(job: Job<NFTMintJobPayload>) {
  await job.updateProgress(10)

  const [user, project, existingCertificate] = await Promise.all([
    prisma.user.findUnique({
      where: { id: job.data.userId },
      select: {
        id: true,
        fullName: true,
        username: true,
        walletAddress: true,
        skills: true,
      },
    }),
    prisma.project.findUnique({
      where: { id: job.data.projectId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        ownerId: true,
        freelancerId: true,
      },
    }),
    prisma.nftCertificate.findUnique({
      where: { projectId: job.data.projectId },
    }),
  ])

  if (!user) {
    throw new Error(`NFT mint job user not found: ${job.data.userId}`)
  }

  if (!project) {
    throw new Error(`NFT mint job project not found: ${job.data.projectId}`)
  }

  if (project.freelancerId && project.freelancerId !== user.id) {
    throw new Error('NFT mint job user is not assigned as the project freelancer')
  }

  if (existingCertificate) {
    await job.updateProgress(100)
    return {
      certificateId: existingCertificate.id,
      tokenId: existingCertificate.tokenId,
      projectId: existingCertificate.projectId,
      userId: existingCertificate.userId,
      metadataUri: existingCertificate.metadataURI,
      alreadyMinted: true,
      correlationId: job.data.correlationId,
    }
  }

  await job.updateProgress(35)

  const freelancerWallet = normalizeWalletAddress(user.walletAddress)
  const projectCompletionProof = sanitizeText(`Metadata URI: ${job.data.metadataUri}`)
  const blockchainResult = await blockchainService.mintCertificate({
    to: freelancerWallet,
    metadataURI: job.data.metadataUri,
    certificate: {
      freelancerName: sanitizeText(user.fullName ?? user.username ?? user.walletAddress),
      freelancerWallet,
      projectTitle: sanitizeText(project.title),
      projectDescription: sanitizeText(project.description ?? ''),
      projectCompletionProof,
      clientApprovalStatus: project.status === 'completed',
      completionTimestamp: BigInt(Math.floor(Date.now() / 1000)),
      paymentTransactionHash: '',
      metadataURI: job.data.metadataUri,
      skillTags: normalizeSkillTags(user.skills),
      platformName: 'ProofChain',
    },
  })

  await job.updateProgress(75)

  const tokenId = blockchainResult.tokenId ?? (await prisma.nftCertificate.count()) + 1
  const metadata = {
    metadataUri: job.data.metadataUri,
    mintedByJobId: job.id,
    correlationId: job.data.correlationId,
    explorerUrl: blockchainResult.explorerUrl,
  } satisfies Prisma.InputJsonObject

  const certificate = await prisma.$transaction(async (tx) => {
    const created = await tx.nftCertificate.create({
      data: {
        userId: user.id,
        projectId: project.id,
        freelancerWallet,
        tokenId,
        metadataURI: job.data.metadataUri,
        metadata,
        transactionHash: blockchainResult.txHash,
        blockNumber: blockchainResult.blockNumber ?? undefined,
        gasUsed: blockchainResult.gasUsed ?? undefined,
        certificateStatus: 'verified',
        mintedAt: new Date(),
        verifiedAt: new Date(),
      },
    })

    await tx.transaction.create({
      data: {
        projectId: project.id,
        initiatedBy: project.ownerId,
        nftCertificateId: created.id,
        type: 'certificate_mint',
        status: 'confirmed',
        chainId: Number(process.env.BASE_SEPOLIA_CHAIN_ID ?? process.env.CHAIN_ID ?? 84532),
        txHash: blockchainResult.txHash,
        toAddress: process.env.PROOFCHAIN_CERTIFICATE_CONTRACT_ADDRESS,
        fromAddress: 'backend-relayer',
        blockNumber: blockchainResult.blockNumber ?? undefined,
        gasUsed: blockchainResult.gasUsed ?? undefined,
        submittedAt: new Date(),
        confirmedAt: new Date(),
      },
    })

    return created
  })

  await notificationsService.sendNftMintedNotification({
    userId: user.id,
    projectTitle: project.title,
    tokenId: certificate.tokenId,
  })

  await job.updateProgress(100)

  return {
    certificateId: certificate.id,
    tokenId: certificate.tokenId,
    projectId: certificate.projectId,
    userId: certificate.userId,
    metadataUri: certificate.metadataURI,
    txHash: certificate.transactionHash,
    correlationId: job.data.correlationId,
  }
}
