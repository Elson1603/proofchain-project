import type { Prisma } from '@prisma/client'
import { Interface, JsonRpcProvider, type Log, type LogDescription } from 'ethers'
import prisma from '../../config/db'
import { nftService } from '../nft/service'
import { CERTIFICATE_INDEXER_ABI, DEFAULT_UGF_INDEXER_ABI, ESCROW_INDEXER_ABI } from './abis'

type IndexerSource = 'escrow' | 'certificate' | 'ugf'
type EventCategory = 'ESCROW' | 'PAYMENT' | 'NFT_MINT' | 'UGF_EXECUTION'
type ProcessingStatus = 'processed' | 'failed' | 'skipped'

type SourceConfig = {
  source: IndexerSource
  address: string
  iface: Interface
  categoryForEvent: (eventName: string) => EventCategory
}

type IndexedLogContext = {
  chainId: number
  source: IndexerSource
  category: EventCategory
  address: string
  log: Log
  parsed: LogDescription
}

const DEFAULT_CHAIN_ID = Number(process.env.CHAIN_ID ?? process.env.BASE_SEPOLIA_CHAIN_ID ?? 84532)
const POLL_INTERVAL_MS = Number(process.env.BLOCKCHAIN_INDEXER_POLL_INTERVAL_MS ?? 15_000)
const BLOCK_RANGE = Number(process.env.BLOCKCHAIN_INDEXER_BLOCK_RANGE ?? 1_000)
const CONFIRMATIONS = Number(process.env.BLOCKCHAIN_INDEXER_CONFIRMATIONS ?? 2)
const BACKFILL_BLOCKS = Number(process.env.BLOCKCHAIN_INDEXER_BACKFILL_BLOCKS ?? 5_000)
const UGF_TRANSACTION_LIMIT = Number(process.env.UGF_INDEX_RECENT_TRANSACTIONS ?? 50)

let provider: JsonRpcProvider | null = null
let poller: NodeJS.Timeout | null = null
let isPolling = false

function isEnabled() {
  return process.env.BLOCKCHAIN_INDEXER_ENABLED !== 'false'
}

function getRpcUrl() {
  return process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL
}

function getProvider() {
  if (provider) {
    return provider
  }

  const rpcUrl = getRpcUrl()
  if (!rpcUrl) {
    return null
  }

  provider = new JsonRpcProvider(rpcUrl)
  return provider
}

function normalizeAddress(address?: string | null) {
  return address ? address.toLowerCase() : ''
}

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.map((item) => asJsonValue(item)) as Prisma.InputJsonArray
  }

  if (value && typeof value === 'object') {
    const output: Record<string, Prisma.InputJsonValue> = {}
    for (const [key, item] of Object.entries(value)) {
      if (typeof item !== 'function' && typeof item !== 'undefined') {
        output[key] = asJsonValue(item)
      }
    }
    return output
  }

  if (typeof value === 'undefined') {
    return '' as Prisma.InputJsonValue
  }

  return value as Prisma.InputJsonValue
}

function parseArgs(parsed: LogDescription) {
  const args: Record<string, Prisma.InputJsonValue> = {}

  parsed.fragment.inputs.forEach((input, index) => {
    const key = input.name || `arg${index}`
    args[key] = asJsonValue(parsed.args[index])
  })

  return args
}

function numberArg(args: Record<string, unknown>, key: string) {
  const value = args[key]
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function stringArg(args: Record<string, unknown>, key: string) {
  const value = args[key]
  return typeof value === 'string' ? value : null
}

function rawLog(log: Log) {
  return asJsonValue({
    address: log.address,
    blockHash: log.blockHash,
    blockNumber: log.blockNumber,
    data: log.data,
    index: log.index,
    logIndex: log.index,
    removed: log.removed,
    topics: log.topics,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
  })
}

function readJsonAbi(value?: string) {
  if (!value) {
    return DEFAULT_UGF_INDEXER_ABI
  }

  try {
    return JSON.parse(value) as readonly string[]
  } catch (error) {
    console.warn('Invalid UGF_EXECUTION_ABI_JSON, using default UGF event ABI', error)
    return DEFAULT_UGF_INDEXER_ABI
  }
}

function sourceConfigs() {
  const configs: SourceConfig[] = []
  const escrowAddress = normalizeAddress(process.env.ESCROW_CONTRACT_ADDRESS || process.env.VITE_ESCROW_CONTRACT_ADDRESS)
  const certificateAddress = normalizeAddress(process.env.PROOFCHAIN_CERTIFICATE_CONTRACT_ADDRESS)
  const ugfAddress = normalizeAddress(process.env.UGF_RELAYER_ADDRESS)

  if (escrowAddress) {
    configs.push({
      source: 'escrow',
      address: escrowAddress,
      iface: new Interface(ESCROW_INDEXER_ABI),
      categoryForEvent: (eventName) =>
        eventName === 'FundsDeposited' || eventName === 'PaymentReleased' ? 'PAYMENT' : 'ESCROW',
    })
  }

  if (certificateAddress) {
    configs.push({
      source: 'certificate',
      address: certificateAddress,
      iface: new Interface(CERTIFICATE_INDEXER_ABI),
      categoryForEvent: () => 'NFT_MINT',
    })
  }

  if (ugfAddress) {
    configs.push({
      source: 'ugf',
      address: ugfAddress,
      iface: new Interface(readJsonAbi(process.env.UGF_EXECUTION_ABI_JSON)),
      categoryForEvent: () => 'UGF_EXECUTION',
    })
  }

  return configs
}

async function markProcessed(id: string, status: ProcessingStatus, error?: unknown) {
  await prisma.blockchainIndexedEvent.update({
    where: { id },
    data: {
      processingStatus: status,
      processingError: error instanceof Error ? error.message : error ? String(error) : null,
      processedAt: new Date(),
    },
  })
}

async function updateTransactionFromReceipt(input: {
  txHash: string
  status: 'confirmed' | 'failed'
  blockNumber: number
  gasUsed?: number | null
  paymentId?: string | null
}) {
  const existing = await prisma.transaction.findFirst({
    where: { txHash: input.txHash },
    orderBy: { createdAt: 'desc' },
  })

  if (!existing) {
    return null
  }

  const updated = await prisma.transaction.update({
    where: { id: existing.id },
    data: {
      status: input.status,
      blockNumber: input.blockNumber,
      gasUsed: input.gasUsed ?? undefined,
      errorMessage: input.status === 'failed' ? 'Transaction failed' : null,
      confirmedAt: input.status === 'confirmed' ? new Date() : undefined,
    },
  })

  if (existing.paymentId || input.paymentId) {
    const paymentId = existing.paymentId ?? input.paymentId
    const released = input.status === 'confirmed' && existing.type === 'payment_release'
    const escrowed = input.status === 'confirmed' && existing.type === 'escrow_deposit'

    await prisma.payment.update({
      where: { id: String(paymentId) },
      data: {
        status: input.status === 'failed' ? 'failed' : released ? 'released' : escrowed ? 'escrowed' : undefined,
        releasedAt: released ? new Date() : undefined,
        failureReason: input.status === 'failed' ? 'Transaction failed' : null,
      },
    })

    if (released) {
      void nftService.mintFromPayment(String(paymentId)).catch((error) => {
        console.error('Failed to mint certificate after indexed payment release', error)
      })
    }
  }

  return updated
}

async function findPaymentForEscrowEvent(contractAddress: string, args: Record<string, unknown>, eventName: string) {
  const projectChainId = numberArg(args, 'projectId')
  const milestoneIndex = numberArg(args, 'milestoneIndex')
  const type =
    eventName === 'FundsDeposited'
      ? 'escrow_deposit'
      : eventName === 'PaymentReleased'
        ? 'milestone_release'
        : undefined

  const metadataFilters = []
  if (projectChainId !== null) {
    metadataFilters.push({ metadata: { path: ['projectChainId'], equals: projectChainId } })
  }
  if (milestoneIndex !== null) {
    metadataFilters.push({ metadata: { path: ['milestoneIndex'], equals: milestoneIndex } })
  }

  return prisma.payment.findFirst({
    where: {
      escrowAddress: contractAddress,
      type,
      ...(metadataFilters.length ? { AND: metadataFilters } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
}

async function processPaymentEvent(indexedEvent: { id: string; txHash: string; blockNumber: number; contractAddress: string }, args: Record<string, unknown>, eventName: string) {
  const payment = await findPaymentForEscrowEvent(indexedEvent.contractAddress, args, eventName)

  if (!payment) {
    await markProcessed(indexedEvent.id, 'skipped', `No local payment matched ${eventName}`)
    return
  }

  if (eventName === 'FundsDeposited') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'escrowed',
        metadata: {
          ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
          indexedFundsDepositedTxHash: indexedEvent.txHash,
          indexedFundsDepositedBlockNumber: indexedEvent.blockNumber,
        } as Prisma.InputJsonValue,
      },
    })
  }

  if (eventName === 'PaymentReleased') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'released',
        releasedAt: payment.releasedAt ?? new Date(),
        failureReason: null,
        metadata: {
          ...(payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {}),
          indexedPaymentReleasedTxHash: indexedEvent.txHash,
          indexedPaymentReleasedBlockNumber: indexedEvent.blockNumber,
        } as Prisma.InputJsonValue,
      },
    })

    await updateTransactionFromReceipt({
      txHash: indexedEvent.txHash,
      status: 'confirmed',
      blockNumber: indexedEvent.blockNumber,
      paymentId: payment.id,
    })

    void nftService.mintFromPayment(payment.id).catch((error) => {
      console.error('Failed to mint certificate after PaymentReleased event', error)
    })
  }

  await prisma.blockchainIndexedEvent.update({
    where: { id: indexedEvent.id },
    data: {
      paymentId: payment.id,
      transactionId: payment.transactions[0]?.id,
    },
  })
  await markProcessed(indexedEvent.id, 'processed')
}

async function processCertificateEvent(indexedEvent: { id: string; txHash: string; blockNumber: number }, args: Record<string, unknown>) {
  const tokenId = numberArg(args, 'tokenId')
  const metadataURI = stringArg(args, 'metadataURI')

  if (tokenId === null) {
    await markProcessed(indexedEvent.id, 'failed', 'CertificateMinted event did not include tokenId')
    return
  }

  const existing =
    (await prisma.nftCertificate.findFirst({ where: { transactionHash: indexedEvent.txHash } })) ??
    (await prisma.nftCertificate.findUnique({ where: { tokenId } }).catch(() => null))

  if (!existing) {
    await markProcessed(indexedEvent.id, 'skipped', `No local certificate matched token ${tokenId}`)
    return
  }

  const certificate = await prisma.nftCertificate.update({
    where: { id: existing.id },
    data: {
      tokenId,
      metadataURI: metadataURI ?? existing.metadataURI,
      transactionHash: indexedEvent.txHash,
      blockNumber: indexedEvent.blockNumber,
      certificateStatus: 'verified',
      mintedAt: existing.mintedAt ?? new Date(),
      verifiedAt: new Date(),
    },
  })

  await prisma.transaction.updateMany({
    where: { txHash: indexedEvent.txHash, type: 'certificate_mint' },
    data: {
      status: 'confirmed',
      blockNumber: indexedEvent.blockNumber,
      nftCertificateId: certificate.id,
      confirmedAt: new Date(),
    },
  })

  await prisma.blockchainIndexedEvent.update({
    where: { id: indexedEvent.id },
    data: {
      nftCertificateId: certificate.id,
      paymentId: certificate.paymentId,
    },
  })
  await markProcessed(indexedEvent.id, 'processed')
}

async function processEscrowEvent(indexedEvent: { id: string }, eventName: string) {
  if (eventName === 'ProjectCreated' || eventName === 'MilestoneApproved' || eventName === 'DisputeRaised' || eventName === 'DisputeResolved') {
    await markProcessed(indexedEvent.id, 'processed')
    return
  }

  await markProcessed(indexedEvent.id, 'skipped', `No processor for ${eventName}`)
}

async function processUgfEvent(indexedEvent: { id: string }) {
  await markProcessed(indexedEvent.id, 'processed')
}

async function processIndexedEvent(
  indexedEvent: { id: string; txHash: string; blockNumber: number; contractAddress: string; category: EventCategory; eventName: string },
  args: Record<string, unknown>,
) {
  try {
    if (indexedEvent.category === 'PAYMENT') {
      await processPaymentEvent(indexedEvent, args, indexedEvent.eventName)
      return
    }

    if (indexedEvent.category === 'NFT_MINT') {
      await processCertificateEvent(indexedEvent, args)
      return
    }

    if (indexedEvent.category === 'UGF_EXECUTION') {
      await processUgfEvent(indexedEvent)
      return
    }

    await processEscrowEvent(indexedEvent, indexedEvent.eventName)
  } catch (error) {
    await markProcessed(indexedEvent.id, 'failed', error)
  }
}

async function persistLogEvent(context: IndexedLogContext) {
  const args = parseArgs(context.parsed)
  const indexed = await prisma.blockchainIndexedEvent.upsert({
    where: {
      chainId_txHash_logIndex: {
        chainId: context.chainId,
        txHash: context.log.transactionHash,
        logIndex: context.log.index,
      },
    },
    create: {
      chainId: context.chainId,
      contractAddress: normalizeAddress(context.log.address || context.address),
      category: context.category,
      eventName: context.parsed.name,
      txHash: context.log.transactionHash,
      logIndex: context.log.index,
      blockNumber: context.log.blockNumber,
      blockHash: context.log.blockHash,
      transactionIndex: context.log.transactionIndex,
      removed: context.log.removed,
      args,
      rawLog: rawLog(context.log),
    },
    update: {
      contractAddress: normalizeAddress(context.log.address || context.address),
      category: context.category,
      eventName: context.parsed.name,
      blockNumber: context.log.blockNumber,
      blockHash: context.log.blockHash,
      transactionIndex: context.log.transactionIndex,
      removed: context.log.removed,
      args,
      rawLog: rawLog(context.log),
    },
  })

  await processIndexedEvent(
    {
      id: indexed.id,
      txHash: indexed.txHash,
      blockNumber: indexed.blockNumber,
      contractAddress: indexed.contractAddress,
      category: indexed.category as EventCategory,
      eventName: indexed.eventName,
    },
    args as Record<string, unknown>,
  )

  return indexed
}

async function getFromBlock(config: SourceConfig, latestSafeBlock: number) {
  const cursor = await prisma.blockchainIndexerCursor.findUnique({
    where: {
      chainId_source_contractAddress: {
        chainId: DEFAULT_CHAIN_ID,
        source: config.source,
        contractAddress: config.address,
      },
    },
  })

  if (cursor) {
    return cursor.lastBlockNumber + 1
  }

  const configuredStart = process.env.BLOCKCHAIN_INDEXER_START_BLOCK
    ? Number(process.env.BLOCKCHAIN_INDEXER_START_BLOCK)
    : null

  if (configuredStart !== null && Number.isFinite(configuredStart)) {
    return Math.max(0, configuredStart)
  }

  return Math.max(0, latestSafeBlock - BACKFILL_BLOCKS)
}

async function setCursor(config: SourceConfig, blockNumber: number) {
  await prisma.blockchainIndexerCursor.upsert({
    where: {
      chainId_source_contractAddress: {
        chainId: DEFAULT_CHAIN_ID,
        source: config.source,
        contractAddress: config.address,
      },
    },
    create: {
      chainId: DEFAULT_CHAIN_ID,
      source: config.source,
      contractAddress: config.address,
      lastBlockNumber: blockNumber,
    },
    update: {
      lastBlockNumber: blockNumber,
    },
  })
}

async function indexSource(providerClient: JsonRpcProvider, config: SourceConfig, latestSafeBlock: number) {
  const fromBlock = await getFromBlock(config, latestSafeBlock)
  if (fromBlock > latestSafeBlock) {
    return { source: config.source, fromBlock, toBlock: latestSafeBlock, logs: 0 }
  }

  const toBlock = Math.min(latestSafeBlock, fromBlock + BLOCK_RANGE - 1)
  const logs = await providerClient.getLogs({
    address: config.address,
    fromBlock,
    toBlock,
  })

  let indexed = 0
  for (const log of logs) {
    const parsed = config.iface.parseLog({
      topics: [...log.topics],
      data: log.data,
    })

    if (!parsed) {
      continue
    }

    await persistLogEvent({
      chainId: DEFAULT_CHAIN_ID,
      source: config.source,
      category: config.categoryForEvent(parsed.name),
      address: config.address,
      log,
      parsed,
    })
    indexed += 1
  }

  await setCursor(config, toBlock)
  return { source: config.source, fromBlock, toBlock, logs: indexed }
}

async function indexUgfTransactions(providerClient: JsonRpcProvider) {
  const transactions = await prisma.transaction.findMany({
    where: {
      txHash: { not: null },
      OR: [{ relayerRequestId: { not: null } }, { paymentId: { not: null } }],
    },
    orderBy: { createdAt: 'desc' },
    take: UGF_TRANSACTION_LIMIT,
  })

  let indexed = 0

  for (const transaction of transactions) {
    if (!transaction.txHash) {
      continue
    }

    const receipt = await providerClient.getTransactionReceipt(transaction.txHash)
    if (!receipt) {
      continue
    }

    const status = receipt.status === 1 ? 'confirmed' : 'failed'
    const syntheticLogIndex = -1
    const eventName = status === 'confirmed' ? 'UGFExecutionConfirmed' : 'UGFExecutionFailed'
    const rawReceipt = asJsonValue({
      hash: receipt.hash,
      blockHash: receipt.blockHash,
      blockNumber: receipt.blockNumber,
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed,
      status: receipt.status,
      transactionIndex: receipt.index,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        data: log.data,
        topics: log.topics,
        index: log.index,
      })),
    })

    const args = asJsonValue({
      transactionId: transaction.id,
      paymentId: transaction.paymentId,
      relayerRequestId: transaction.relayerRequestId,
      txHash: transaction.txHash,
      type: transaction.type,
      status,
      from: receipt.from,
      to: receipt.to,
      gasUsed: receipt.gasUsed,
    })

    const indexedEvent = await prisma.blockchainIndexedEvent.upsert({
      where: {
        chainId_txHash_logIndex: {
          chainId: transaction.chainId,
          txHash: transaction.txHash,
          logIndex: syntheticLogIndex,
        },
      },
      create: {
        chainId: transaction.chainId,
        contractAddress: normalizeAddress(receipt.to ?? transaction.toAddress ?? 'ugf-relayer'),
        category: 'UGF_EXECUTION',
        eventName,
        txHash: transaction.txHash,
        logIndex: syntheticLogIndex,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        transactionIndex: receipt.index,
        args,
        rawLog: rawReceipt,
        transactionId: transaction.id,
        paymentId: transaction.paymentId,
      },
      update: {
        eventName,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        transactionIndex: receipt.index,
        args,
        rawLog: rawReceipt,
        transactionId: transaction.id,
        paymentId: transaction.paymentId,
      },
    })

    await updateTransactionFromReceipt({
      txHash: transaction.txHash,
      status,
      blockNumber: receipt.blockNumber,
      gasUsed: Number(receipt.gasUsed),
      paymentId: transaction.paymentId,
    })
    await markProcessed(indexedEvent.id, 'processed')
    indexed += 1
  }

  return { source: 'ugf-transactions', scanned: transactions.length, logs: indexed }
}

export const blockchainIndexerService = {
  start() {
    if (!isEnabled() || poller) {
      return
    }

    if (!getProvider()) {
      console.warn('Blockchain indexer disabled because BASE_SEPOLIA_RPC_URL/RPC_URL is not configured')
      return
    }

    poller = setInterval(() => {
      void blockchainIndexerService.runOnce().catch((error) => {
        console.error('Blockchain indexer poll failed', error)
      })
    }, POLL_INTERVAL_MS)

    poller.unref()
    void blockchainIndexerService.runOnce().catch((error) => {
      console.error('Initial blockchain indexer run failed', error)
    })
  },

  stop() {
    if (poller) {
      clearInterval(poller)
      poller = null
    }
  },

  async runOnce() {
    if (isPolling) {
      return { skipped: true, reason: 'Indexer is already polling' }
    }

    const providerClient = getProvider()
    if (!providerClient) {
      return { skipped: true, reason: 'RPC URL is not configured' }
    }

    isPolling = true
    try {
      const latestBlock = await providerClient.getBlockNumber()
      const latestSafeBlock = Math.max(0, latestBlock - CONFIRMATIONS)
      const results = []

      for (const config of sourceConfigs()) {
        results.push(await indexSource(providerClient, config, latestSafeBlock))
      }

      results.push(await indexUgfTransactions(providerClient))

      return {
        skipped: false,
        latestBlock,
        latestSafeBlock,
        results,
      }
    } finally {
      isPolling = false
    }
  },

  async status() {
    const [cursors, recentEvents] = await Promise.all([
      prisma.blockchainIndexerCursor.findMany({ orderBy: [{ source: 'asc' }, { updatedAt: 'desc' }] }),
      prisma.blockchainIndexedEvent.findMany({
        orderBy: { indexedAt: 'desc' },
        take: 10,
      }),
    ])

    return {
      enabled: isEnabled(),
      running: Boolean(poller),
      polling: isPolling,
      rpcConfigured: Boolean(getRpcUrl()),
      chainId: DEFAULT_CHAIN_ID,
      pollIntervalMs: POLL_INTERVAL_MS,
      confirmations: CONFIRMATIONS,
      blockRange: BLOCK_RANGE,
      sources: sourceConfigs().map(({ source, address }) => ({ source, address })),
      cursors,
      recentEvents,
    }
  },

  async listEvents(filters: { category?: EventCategory; eventName?: string; txHash?: string; limit?: number }) {
    return prisma.blockchainIndexedEvent.findMany({
      where: {
        category: filters.category,
        eventName: filters.eventName,
        txHash: filters.txHash,
      },
      orderBy: [{ blockNumber: 'desc' }, { logIndex: 'desc' }],
      take: Math.min(filters.limit ?? 50, 200),
    })
  },
}
