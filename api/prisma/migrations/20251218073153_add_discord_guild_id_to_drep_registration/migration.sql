-- AlterTable
ALTER TABLE "DrepRegistration" ADD COLUMN     "discordGuildId" TEXT;

-- CreateIndex
CREATE INDEX "DrepRegistration_discordGuildId_idx" ON "DrepRegistration"("discordGuildId");
