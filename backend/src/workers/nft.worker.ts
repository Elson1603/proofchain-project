import { Worker } from 'bullmq'
import { processNFTMintJob, type NFTMintJobPayload } from '../jobs/nft.job'
import { closeRedisConnection, createRedisConnection, QUEUE_NAMES } from '../queues/redis'

const nftWorkerConnection = createRedisConnection('nft-worker')

let nftWorker: Worker<NFTMintJobPayload> | null = null

export function startNFTWorker() {
  if (nftWorker) {
    return nftWorker
  }

  // NFT minting is intentionally low-concurrency because each job may write
  // metadata to IPFS and submit a blockchain transaction through the relayer.
  nftWorker = new Worker<NFTMintJobPayload>(
    QUEUE_NAMES.nftMinting,
    processNFTMintJob,
    {
      connection: nftWorkerConnection,
      concurrency: Number(process.env.NFT_WORKER_CONCURRENCY ?? 2),
    },
  )

  nftWorker.on('completed', (job, result) => {
    console.log(`[worker:${QUEUE_NAMES.nftMinting}] completed job ${job.id}`, result)
  })

  nftWorker.on('failed', (job, error) => {
    console.error(`[worker:${QUEUE_NAMES.nftMinting}] failed job ${job?.id ?? 'unknown'}`, error)
  })

  nftWorker.on('error', (error) => {
    console.error(`[worker:${QUEUE_NAMES.nftMinting}] worker error`, error)
  })

  return nftWorker
}

export async function shutdownNFTWorker() {
  if (nftWorker) {
    await nftWorker.close()
    nftWorker = null
  }

  await closeRedisConnection(nftWorkerConnection, 'nft-worker')
}
