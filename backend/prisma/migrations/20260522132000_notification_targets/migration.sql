ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "actionUrl" TEXT,
ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");
