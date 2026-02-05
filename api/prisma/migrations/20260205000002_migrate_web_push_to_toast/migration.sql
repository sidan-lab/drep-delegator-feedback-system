-- Update existing WEB_PUSH alerts to IN_APP_TOAST
UPDATE "DeadlineAlert" SET "alertChannel" = 'IN_APP_TOAST'::"AlertChannel" WHERE "alertChannel" = 'WEB_PUSH'::"AlertChannel";

-- Create new enum without WEB_PUSH
CREATE TYPE "AlertChannel_new" AS ENUM ('DISCORD_CHANNEL', 'DISCORD_DM', 'IN_APP_TOAST');

-- Alter column to use new enum
ALTER TABLE "DeadlineAlert" ALTER COLUMN "alertChannel" TYPE "AlertChannel_new" USING ("alertChannel"::text::"AlertChannel_new");

-- Drop old enum and rename new one
DROP TYPE "AlertChannel";
ALTER TYPE "AlertChannel_new" RENAME TO "AlertChannel";

-- Drop old webPushEnabled index
DROP INDEX IF EXISTS "NotificationPreference_webPushEnabled_idx";

-- Create new index on inAppToastEnabled
CREATE INDEX IF NOT EXISTS "NotificationPreference_inAppToastEnabled_idx" ON "NotificationPreference"("inAppToastEnabled");

-- Drop old columns
ALTER TABLE "NotificationPreference" DROP COLUMN IF EXISTS "webPushEnabled";
ALTER TABLE "NotificationPreference" DROP COLUMN IF EXISTS "pushSubscription";
