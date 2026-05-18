-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'escrowed', 'released', 'refunded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('escrow_deposit', 'milestone_release', 'refund', 'platform_fee');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('queued', 'submitted', 'confirmed', 'failed', 'replaced');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('escrow_deposit', 'payment_release', 'refund', 'certificate_mint', 'certificate_revoke');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "freelancerId" UUID,
ADD COLUMN     "invitedFreelancerId" UUID;

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "milestoneId" UUID,
    "submissionId" UUID,
    "payerId" UUID NOT NULL,
    "payeeId" UUID NOT NULL,
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'mUSD',
    "escrowAddress" TEXT,
    "releasedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID,
    "milestoneId" UUID,
    "paymentId" UUID,
    "nftCertificateId" UUID,
    "initiatedBy" UUID,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'queued',
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT,
    "relayerRequestId" TEXT,
    "fromAddress" TEXT,
    "toAddress" TEXT,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "gasUsed" DOUBLE PRECISION,
    "gasQuote" DOUBLE PRECISION,
    "gasQuoteCurrency" TEXT,
    "blockNumber" INTEGER,
    "errorMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_projectId_status_createdAt_idx" ON "Payment"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_payeeId_status_createdAt_idx" ON "Payment"("payeeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_payerId_status_createdAt_idx" ON "Payment"("payerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_milestoneId_type_idx" ON "Payment"("milestoneId", "type");

-- CreateIndex
CREATE INDEX "Transaction_paymentId_createdAt_idx" ON "Transaction"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_status_createdAt_idx" ON "Transaction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Project_freelancerId_idx" ON "Project"("freelancerId");

-- CreateIndex
CREATE INDEX "Project_invitedFreelancerId_idx" ON "Project"("invitedFreelancerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_invitedFreelancerId_fkey" FOREIGN KEY ("invitedFreelancerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
