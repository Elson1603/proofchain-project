-- CreateEnum
CREATE TYPE "NftCertificateStatus" AS ENUM ('pending', 'minting', 'minted', 'verified', 'failed', 'revoked');

-- CreateTable
CREATE TABLE "NftCertificate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "paymentId" UUID,
    "freelancerWallet" TEXT NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "metadataURI" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "transactionHash" TEXT,
    "blockNumber" INTEGER,
    "gasUsed" DOUBLE PRECISION,
    "certificateStatus" "NftCertificateStatus" NOT NULL DEFAULT 'pending',
    "mintedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NftCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NftCertificate_paymentId_key" ON "NftCertificate"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "NftCertificate_tokenId_key" ON "NftCertificate"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "NftCertificate_projectId_key" ON "NftCertificate"("projectId");

-- CreateIndex
CREATE INDEX "NftCertificate_userId_idx" ON "NftCertificate"("userId");

-- CreateIndex
CREATE INDEX "NftCertificate_projectId_idx" ON "NftCertificate"("projectId");

-- CreateIndex
CREATE INDEX "NftCertificate_freelancerWallet_idx" ON "NftCertificate"("freelancerWallet");

-- CreateIndex
CREATE INDEX "NftCertificate_certificateStatus_createdAt_idx" ON "NftCertificate"("certificateStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NftCertificate_transactionHash_key" ON "NftCertificate"("transactionHash");

-- AddForeignKey
ALTER TABLE "NftCertificate" ADD CONSTRAINT "NftCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftCertificate" ADD CONSTRAINT "NftCertificate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftCertificate" ADD CONSTRAINT "NftCertificate_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_nftCertificateId_fkey" FOREIGN KEY ("nftCertificateId") REFERENCES "NftCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;