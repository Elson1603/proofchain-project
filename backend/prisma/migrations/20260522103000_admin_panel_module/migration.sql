-- ExtendEnum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MODERATOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPPORT_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BLOCKCHAIN_ADMIN';

-- CreateEnum
CREATE TYPE "FraudAlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FraudAlertStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SuspensionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DisputeResolutionType" AS ENUM ('RELEASE_PAYMENT', 'REFUND_CLIENT', 'SPLIT_PAYMENT', 'REQUEST_EVIDENCE', 'REJECT_DISPUTE');

-- CreateEnum
CREATE TYPE "TransactionMonitoringCategory" AS ENUM ('UGF_PAYMENT', 'ESCROW_RELEASE', 'NFT_MINT', 'GASLESS_EXECUTION', 'INDEXER_EVENT');

-- CreateEnum
CREATE TYPE "TransactionMonitoringStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'FAILED', 'REVERTED');

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "adminId" UUID,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudAlert" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "assignedAdminId" UUID,
    "type" TEXT NOT NULL,
    "severity" "FraudAlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "FraudAlertStatus" NOT NULL DEFAULT 'OPEN',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "walletAddress" TEXT,
    "txHash" TEXT,
    "signals" JSONB NOT NULL DEFAULT '{}',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSuspension" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "adminId" UUID,
    "status" "SuspensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "milestoneId" UUID,
    "raisedById" UUID NOT NULL,
    "againstUserId" UUID,
    "assignedAdminId" UUID,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "walletActivity" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeResolution" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "disputeId" UUID NOT NULL,
    "adminId" UUID,
    "paymentId" UUID,
    "action" "DisputeResolutionType" NOT NULL,
    "notes" TEXT NOT NULL,
    "releaseAmount" DOUBLE PRECISION,
    "refundAmount" DOUBLE PRECISION,
    "freelancerAmount" DOUBLE PRECISION,
    "clientAmount" DOUBLE PRECISION,
    "previousValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputeResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionMonitoring" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transactionId" UUID,
    "paymentId" UUID,
    "nftCertificateId" UUID,
    "txHash" TEXT,
    "chainId" INTEGER NOT NULL DEFAULT 84532,
    "category" "TransactionMonitoringCategory" NOT NULL,
    "status" "TransactionMonitoringStatus" NOT NULL DEFAULT 'PENDING',
    "gasQuote" DOUBLE PRECISION,
    "gasQuoteCurrency" TEXT,
    "latencyMs" INTEGER,
    "retryAttempts" INTEGER NOT NULL DEFAULT 0,
    "explorerUrl" TEXT,
    "failureReason" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionMonitoring_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actionType_createdAt_idx" ON "AdminAuditLog"("actionType", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "FraudAlert_status_severity_createdAt_idx" ON "FraudAlert"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "FraudAlert_riskScore_createdAt_idx" ON "FraudAlert"("riskScore", "createdAt");

-- CreateIndex
CREATE INDEX "FraudAlert_userId_createdAt_idx" ON "FraudAlert"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FraudAlert_walletAddress_idx" ON "FraudAlert"("walletAddress");

-- CreateIndex
CREATE INDEX "FraudAlert_txHash_idx" ON "FraudAlert"("txHash");

-- CreateIndex
CREATE INDEX "FraudAlert_entityType_entityId_idx" ON "FraudAlert"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "UserSuspension_userId_status_idx" ON "UserSuspension"("userId", "status");

-- CreateIndex
CREATE INDEX "UserSuspension_adminId_createdAt_idx" ON "UserSuspension"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "UserSuspension_status_endsAt_idx" ON "UserSuspension"("status", "endsAt");

-- CreateIndex
CREATE INDEX "Dispute_projectId_status_idx" ON "Dispute"("projectId", "status");

-- CreateIndex
CREATE INDEX "Dispute_milestoneId_idx" ON "Dispute"("milestoneId");

-- CreateIndex
CREATE INDEX "Dispute_raisedById_createdAt_idx" ON "Dispute"("raisedById", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_againstUserId_createdAt_idx" ON "Dispute"("againstUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Dispute_assignedAdminId_status_idx" ON "Dispute"("assignedAdminId", "status");

-- CreateIndex
CREATE INDEX "Dispute_status_createdAt_idx" ON "Dispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DisputeResolution_disputeId_createdAt_idx" ON "DisputeResolution"("disputeId", "createdAt");

-- CreateIndex
CREATE INDEX "DisputeResolution_adminId_createdAt_idx" ON "DisputeResolution"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "DisputeResolution_action_createdAt_idx" ON "DisputeResolution"("action", "createdAt");

-- CreateIndex
CREATE INDEX "DisputeResolution_paymentId_idx" ON "DisputeResolution"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionMonitoring_transactionId_key" ON "TransactionMonitoring"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionMonitoring_txHash_idx" ON "TransactionMonitoring"("txHash");

-- CreateIndex
CREATE INDEX "TransactionMonitoring_status_createdAt_idx" ON "TransactionMonitoring"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionMonitoring_category_status_idx" ON "TransactionMonitoring"("category", "status");

-- CreateIndex
CREATE INDEX "TransactionMonitoring_paymentId_createdAt_idx" ON "TransactionMonitoring"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionMonitoring_nftCertificateId_createdAt_idx" ON "TransactionMonitoring"("nftCertificateId", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionMonitoring_riskScore_createdAt_idx" ON "TransactionMonitoring"("riskScore", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSuspension" ADD CONSTRAINT "UserSuspension_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSuspension" ADD CONSTRAINT "UserSuspension_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_againstUserId_fkey" FOREIGN KEY ("againstUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeResolution" ADD CONSTRAINT "DisputeResolution_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeResolution" ADD CONSTRAINT "DisputeResolution_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeResolution" ADD CONSTRAINT "DisputeResolution_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMonitoring" ADD CONSTRAINT "TransactionMonitoring_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMonitoring" ADD CONSTRAINT "TransactionMonitoring_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionMonitoring" ADD CONSTRAINT "TransactionMonitoring_nftCertificateId_fkey" FOREIGN KEY ("nftCertificateId") REFERENCES "NftCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
