-- Add notification type column
ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'system';
