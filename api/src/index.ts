import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import path from "path";
import fs from "fs";
import dataRouter from "./routes/data.route";
import userRouter from "./routes/user.route";
import overviewRouter from "./routes/overview.route";
import proposalRouter from "./routes/proposal.route";
import sentimentRouter from "./routes/sentiment.route";
import authRouter from "./routes/auth.route";
import adminRouter from "./routes/admin.route";
import { apiKeyAuth } from "./middleware/auth.middleware";
import { startAllJobs } from "./jobs";

dotenv.config();

const app = express();

// Security: Helmet.js for HTTP security headers
app.use(helmet());

// Security: CORS - allow all origins
app.use(cors());

// Trust proxy (needed for rate limiting behind reverse proxy/Next.js)
// This allows express-rate-limit to use X-Forwarded-For header for client IP
app.set("trust proxy", 1);

// Security: Rate limiting (per client IP)
// Uses X-Forwarded-For header from Next.js proxy to get real client IP
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS!),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS!),
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: "Too many requests, please try again later." },
  // Disable IPv6 validation since we trust proxy and use req.ip
  // The trust proxy setting handles X-Forwarded-For correctly
  validate: { xForwardedForHeader: false },
});

app.use(limiter);

app.use(bodyParser.json());

// Serve Swagger documentation from static file (no auth required)
const swaggerPath = path.join(__dirname, "../docs/swagger.json");
if (fs.existsSync(swaggerPath)) {
  const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} else {
  console.warn(
    "⚠️  Swagger file not found. Run 'npm run swagger:generate' to create it."
  );
}

// Auth routes (public and JWT-authenticated)
app.use("/auth", authRouter);

// Admin routes (JWT-authenticated with wallet address check)
app.use("/admin", adminRouter);

// Public routes (governance data visible to all)
app.use("/overview", overviewRouter);
app.use("/proposal", proposalRouter);

// Per-DRep API key authenticated routes
app.use("/data", apiKeyAuth, dataRouter);
app.use("/user", apiKeyAuth, userRouter);

// Sentiment routes handle auth per-endpoint (public, per-DRep, or admin)
app.use("/sentiment", sentimentRouter);

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = res.statusCode || 500;
  console.error(err.stack);
  res.status(statusCode).json({ error: err.message });
});

// Start cron jobs only if not disabled
// When running in separate containers, set DISABLE_CRON_IN_API=true
if (process.env.DISABLE_CRON_IN_API !== "true") {
  console.log("Starting cron jobs in API process...");
  startAllJobs();
} else {
  console.log("Cron jobs disabled in API process (running in separate service)");
}

// Start the server
const port = parseInt(process.env.PORT!);
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

export default app;
