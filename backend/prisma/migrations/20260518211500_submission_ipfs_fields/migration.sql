-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Submission" ADD COLUMN "ipfsCid" TEXT;
ALTER TABLE "Submission" ADD COLUMN "fileName" TEXT;
ALTER TABLE "Submission" ADD COLUMN "fileSize" INTEGER;
ALTER TABLE "Submission" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "Submission" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "Submission_ipfsCid_idx" ON "Submission"("ipfsCid");
CREATE INDEX "Submission_milestoneId_version_idx" ON "Submission"("milestoneId", "version");
