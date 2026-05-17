-- Upgrade the initial ProofChain schema for Web3 wallet authentication.
CREATE TYPE "UserRole" AS ENUM ('FREELANCER', 'CLIENT', 'ADMIN');

ALTER TABLE "User"
  ADD COLUMN "nonce" TEXT,
  ADD COLUMN "nonceExpiresAt" TIMESTAMP(3),
  ADD COLUMN "profileImage" TEXT,
  ADD COLUMN "profileMetadata" JSONB,
  ADD COLUMN "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "User"
  ALTER COLUMN "fullName" DROP NOT NULL,
  ALTER COLUMN "username" DROP NOT NULL,
  ALTER COLUMN "email" DROP NOT NULL,
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ALTER COLUMN "walletAddress" SET NOT NULL;

ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole"
  USING (
    CASE
      WHEN upper("role") IN ('FREELANCER', 'CLIENT', 'ADMIN') THEN upper("role")::"UserRole"
      ELSE 'FREELANCER'::"UserRole"
    END
  );

ALTER TABLE "User"
  ALTER COLUMN "role" SET DEFAULT 'FREELANCER';

ALTER TABLE "Project"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Milestone"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "Session" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "deviceInfo" TEXT,
  "ipAddress" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserWallet" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");
CREATE UNIQUE INDEX "UserWallet_walletAddress_key" ON "UserWallet"("walletAddress");

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_refreshToken_idx" ON "Session"("refreshToken");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE INDEX "UserWallet_userId_idx" ON "UserWallet"("userId");
CREATE INDEX "UserWallet_walletAddress_idx" ON "UserWallet"("walletAddress");

CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");
CREATE INDEX "Milestone_status_idx" ON "Milestone"("status");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Submission_milestoneId_idx" ON "Submission"("milestoneId");
CREATE INDEX "Submission_submittedById_idx" ON "Submission"("submittedById");
CREATE INDEX "User_walletAddress_idx" ON "User"("walletAddress");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserWallet"
  ADD CONSTRAINT "UserWallet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
