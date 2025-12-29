/*
  Warnings:

  - You are about to drop the `DiscordComment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DiscordComment" DROP CONSTRAINT "DiscordComment_drepId_discordUserId_fkey";

-- DropForeignKey
ALTER TABLE "DiscordComment" DROP CONSTRAINT "DiscordComment_guildId_drepId_fkey";

-- AlterTable
ALTER TABLE "DiscordReaction" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "messageId" TEXT;

-- DropTable
DROP TABLE "DiscordComment";
