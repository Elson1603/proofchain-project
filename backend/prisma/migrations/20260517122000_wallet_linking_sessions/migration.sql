-- Add linked wallet support and optimize refresh session cleanup.
CREATE TABLE "UserWallet" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserWallet_walletAddress_key" ON "UserWallet"("walletAddress");
CREATE INDEX "UserWallet_userId_idx" ON "UserWallet"("userId");
CREATE INDEX "UserWallet_walletAddress_idx" ON "UserWallet"("walletAddress");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

ALTER TABLE "UserWallet"
  ADD CONSTRAINT "UserWallet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
