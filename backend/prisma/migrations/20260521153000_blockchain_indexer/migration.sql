-- CreateEnum
CREATE TYPE "BlockchainEventCategory" AS ENUM ('ESCROW', 'PAYMENT', 'NFT_MINT', 'UGF_EXECUTION');

-- CreateEnum
CREATE TYPE "BlockchainEventProcessingStatus" AS ENUM ('processed', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "BlockchainIndexedEvent" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "category" "BlockchainEventCategory" NOT NULL,
    "eventName" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" INTEGER NOT NULL,
    "blockHash" TEXT,
    "transactionIndex" INTEGER,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "args" JSONB NOT NULL DEFAULT '{}',
    "rawLog" JSONB NOT NULL DEFAULT '{}',
    "processingStatus" "BlockchainEventProcessingStatus" NOT NULL DEFAULT 'processed',
    "processingError" TEXT,
    "paymentId" UUID,
    "transactionId" UUID,
    "nftCertificateId" UUID,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainIndexedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainIndexerCursor" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chainId" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "lastBlockNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainIndexerCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainIndexedEvent_chainId_txHash_logIndex_key" ON "BlockchainIndexedEvent"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "BlockchainIndexedEvent_category_eventName_blockNumber_idx" ON "BlockchainIndexedEvent"("category", "eventName", "blockNumber");

-- CreateIndex
CREATE INDEX "BlockchainIndexedEvent_contractAddress_blockNumber_idx" ON "BlockchainIndexedEvent"("contractAddress", "blockNumber");

-- CreateIndex
CREATE INDEX "BlockchainIndexedEvent_paymentId_idx" ON "BlockchainIndexedEvent"("paymentId");

-- CreateIndex
CREATE INDEX "BlockchainIndexedEvent_transactionId_idx" ON "BlockchainIndexedEvent"("transactionId");

-- CreateIndex
CREATE INDEX "BlockchainIndexedEvent_nftCertificateId_idx" ON "BlockchainIndexedEvent"("nftCertificateId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainIndexerCursor_chainId_source_contractAddress_key" ON "BlockchainIndexerCursor"("chainId", "source", "contractAddress");

-- CreateIndex
CREATE INDEX "BlockchainIndexerCursor_source_idx" ON "BlockchainIndexerCursor"("source");
