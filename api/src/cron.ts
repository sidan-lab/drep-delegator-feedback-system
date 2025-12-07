/**
 * Cron Service Entry Point
 * Runs only the cron jobs without starting the API server
 */

import dotenv from "dotenv";
import { startAllJobs } from "./jobs";

dotenv.config();

console.log("Starting drep delegator feedback Cron Service...");

// Start all cron jobs
startAllJobs();

console.log("✅ drep delegator feedback Cron Service is running");

// Keep the process alive
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  process.exit(0);
});
