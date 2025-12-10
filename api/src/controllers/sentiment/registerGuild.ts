import { Request, Response } from "express";
import { prisma } from "../../services";

/**
 * Register a Discord guild for sentiment collection
 * Called when bot joins a server or is configured
 */
export const registerGuild = async (req: Request, res: Response) => {
  try {
    const { guildId, guildName, drepId, governanceChannelId } = req.body;

    // Validate required fields
    if (!guildId || !guildName || !drepId) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "guildId, guildName, and drepId are required",
      });
    }

    // Check if DRep is registered and approved
    const drepRegistration = await prisma.drepRegistration.findUnique({
      where: { drepId },
    });

    if (!drepRegistration) {
      return res.status(403).json({
        error: "DRep not registered",
        message: "This DRep ID is not registered for sentiment collection",
      });
    }

    if (drepRegistration.status !== "APPROVED") {
      return res.status(403).json({
        error: "DRep not approved",
        message: "This DRep's registration is pending approval",
      });
    }

    // Upsert the guild registration
    const guild = await prisma.discordGuild.upsert({
      where: {
        guildId_drepId: { guildId, drepId },
      },
      update: {
        guildName,
        governanceChannelId,
        isActive: true,
      },
      create: {
        guildId,
        guildName,
        drepId,
        governanceChannelId,
        isActive: true,
      },
    });

    console.log(`[Sentiment] Guild registered: ${guildName} for DRep ${drepId}`);

    return res.status(200).json({
      success: true,
      message: "Guild registered successfully",
      guild: {
        id: guild.id,
        guildId: guild.guildId,
        guildName: guild.guildName,
        drepId: guild.drepId,
      },
    });
  } catch (error) {
    console.error("[Sentiment] Error registering guild:", error);
    return res.status(500).json({
      error: "Failed to register guild",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
