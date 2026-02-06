-- Add IN_APP_TOAST to AlertChannel enum
ALTER TYPE "AlertChannel" ADD VALUE IF NOT EXISTS 'IN_APP_TOAST';

-- Add inAppToastEnabled column to NotificationPreference
ALTER TABLE "NotificationPreference" ADD COLUMN IF NOT EXISTS "inAppToastEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Copy webPushEnabled state to inAppToastEnabled (preserve user preferences)
UPDATE "NotificationPreference" SET "inAppToastEnabled" = "webPushEnabled" WHERE "webPushEnabled" IS NOT NULL;
