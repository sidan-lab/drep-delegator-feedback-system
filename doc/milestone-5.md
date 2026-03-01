# Milestone 5 - Community Deployment Guide

A step-by-step guide for DRep communities to deploy the full DRep Delegator Feedback System: **API**, **Frontend**, **Discord Bot**, and **Delegator Verification Frontend**.

---

## Table of Contents

- [System Overview](#system-overview)
- [Prerequisites](#prerequisites)
- [Deployment Order](#deployment-order)
- [Phase 1: Deploy the Central API](#phase-1-deploy-the-central-api)
- [Phase 2: Deploy the Governance Frontend](#phase-2-deploy-the-governance-frontend)
- [Phase 3: DRep Registration and Onboarding](#phase-3-drep-registration-and-onboarding)
- [Phase 4: Deploy the Discord Bot (Per-DRep)](#phase-4-deploy-the-discord-bot-per-drep)
- [Phase 5: Deploy the Delegator Verification Frontend (Per-DRep)](#phase-5-deploy-the-delegator-verification-frontend-per-drep)
- [End-to-End Verification Checklist](#end-to-end-verification-checklist)
- [Ongoing Maintenance](#ongoing-maintenance)
- [Appendix A: Environment Variable Reference](#appendix-a-environment-variable-reference)
- [Appendix B: Alternative Deployment Options](#appendix-b-alternative-deployment-options)

---

## System Overview

The system has four deployable components with the following ownership model:

| Component | Deployed By | Technology | Hosting |
|-----------|-------------|------------|---------|
| **Central API** | System operator (once) | Express.js 5 + Prisma + PostgreSQL | GCP Cloud Run, or any Docker-capable host |
| **Governance Frontend** | System operator (once) | Next.js 15 | Vercel, or any Node.js host |
| **Discord Bot** | Each DRep (one per DRep) | Discord.js 14 | GCP Compute Engine, or any Docker-capable host |
| **Delegator Verification Frontend** | Each DRep (one per DRep) | Next.js 15 | Vercel, or any Node.js host |

```
                        External Data Sources
              Koios (Gov Data) / Blockfrost (Chain Data)
                              │
                              ▼
     ┌─────────────────────────────────────────────┐
     │            Central API  (operator)           │
     │    Express.js + Prisma + PostgreSQL          │
     │    - Proposal sync     - DRep management     │
     │    - Sentiment storage - Voting power sync   │
     └──────────────┬──────────────────────────────┘
                    │
       ┌────────────┼─────────────┐
       ▼            ▼             ▼
  ┌──────────┐ ┌──────────┐ ┌─────────────────┐
  │ Frontend │ │ Discord  │ │ Verification    │
  │(operator)│ │   Bot    │ │   Frontend      │
  │          │ │(per-DRep)│ │  (per-DRep)     │
  └──────────┘ └──────────┘ └─────────────────┘
```

**Key distinction:** The Central API and Governance Frontend are deployed once for the entire community. Each DRep deploys their own Discord Bot and Delegator Verification Frontend.

---

## Prerequisites

### For the system operator (API + Frontend)

- GCP account with billing enabled (or alternative cloud provider)
- `gcloud` CLI installed and authenticated
- PostgreSQL 15+ database instance
- API keys:
  - [Blockfrost](https://blockfrost.io/) mainnet API key
  - [Koios](https://api.koios.rest/) API key (optional but recommended for higher rate limits)
- A GitHub repository (for CI/CD workflows)
- Node.js 18+ and Yarn

### For each DRep (Discord Bot + Verification Frontend)

- A Discord server with admin permissions
- A Discord Application and Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))
- A registered DRep on the Central API (to receive a `drep_sk_*` API key)
- Blockfrost mainnet API key
- Hosting for the Verification Frontend (Vercel account recommended)
- GCP account or any Docker-capable host for the Discord Bot

---

## Deployment Order

Follow this sequence - each phase depends on the previous:

```
Phase 1: Central API          ← Everything depends on this
    ▼
Phase 2: Governance Frontend  ← Reads data from the API
    ▼
Phase 3: DRep Registration    ← DRep registers and gets API key
    ▼
Phase 4: Discord Bot          ← Needs DRep API key from Phase 3
    ▼
Phase 5: Verification Frontend ← Needs DRep API key + Discord bot running
```

---

## Phase 1: Deploy the Central API

The Central API is the backbone of the system. It stores proposals, votes, delegator sentiment, and manages DRep registration. It must be deployed first.

> For detailed GCP-specific infrastructure setup (Cloud SQL, VPC connectors, Workload Identity Federation, service accounts), see [`api/gcp-deployment.md`](../api/gcp-deployment.md).

### 1.1 Provision a PostgreSQL Database

You need a PostgreSQL 15+ instance. Options:

- **GCP Cloud SQL** (recommended for GCP deployments)
- **Supabase**, **Neon**, **Railway**, or any managed PostgreSQL provider
- **Self-hosted** PostgreSQL

Save your connection string:

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

For GCP Cloud SQL with Cloud Run:

```
postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT:REGION:INSTANCE
```

### 1.2 Generate Secrets

Generate the required secrets before deployment:

```bash
# Server API key (used by cron jobs, admin endpoints, and frontends)
openssl rand -hex 32

# JWT secret (for DRep wallet authentication)
openssl rand -hex 32

# VAPID keys for web push notifications (optional)
npx web-push generate-vapid-keys
```

### 1.3 Configure Environment

Copy `.env.example` and fill in values:

```bash
cd api
cp .env.example .env
```

Critical variables to set:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SERVER_API_KEY` | Generated in step 1.2 |
| `JWT_SECRET` | Generated in step 1.2 |
| `ADMIN_WALLET_ADDRESSES` | Comma-separated Cardano wallet addresses for admin access |
| `MAINNET_BLOCKFROST_API_KEY` | From [blockfrost.io](https://blockfrost.io/) |
| `KOIOS_BASE_URL` | `https://api.koios.rest/api/v1` |
| `PROPOSAL_SYNC_SCHEDULE` | Cron syntax, e.g. `*/15 * * * *` (every 15 min) |
| `VOTER_POWER_SYNC_SCHEDULE` | Cron syntax, e.g. `0 0 * * *` (daily at midnight) |
| `DEADLINE_ALERT_SCHEDULE` | Cron syntax, e.g. `0 9 * * *` (daily at 9 AM) |

### 1.4 Run Database Migrations

```bash
# Local development
yarn install
npx prisma migrate dev

# Production (via Cloud SQL proxy or direct connection)
DATABASE_URL="your_production_url" npx prisma migrate deploy
```

### 1.5 Deploy the API

**Option A: GCP Cloud Run (recommended)**

Follow the full infrastructure setup in [`api/gcp-deployment.md`](../api/gcp-deployment.md), then push to your deployment branch to trigger the GitHub Actions workflow.

The workflow (`.github/workflows/deploy-api-gcp.yml`) will:
1. Build the Docker image
2. Push to Artifact Registry
3. Deploy to Cloud Run
4. Create/update Cloud Scheduler jobs for proposal sync, voter power sync, and deadline alerts

**Option B: Docker Compose (self-hosted)**

```bash
cd api
docker compose up -d
```

This starts two containers:
- `drep-delegator-feedback-api` on port 3001
- `cardano-governance-action-sync-cron` for scheduled sync jobs

**Option C: Direct Node.js**

```bash
cd api
yarn install
yarn build
yarn start   # Runs on port 3001
```

### 1.6 Verify API Deployment

```bash
# Health check
curl https://YOUR_API_URL/health

# View API documentation
open https://YOUR_API_URL/api-docs

# Trigger initial proposal sync
curl -X POST https://YOUR_API_URL/data/trigger-sync \
  -H "X-API-Key: YOUR_SERVER_API_KEY"

# Trigger initial voter power sync
curl -X POST https://YOUR_API_URL/data/trigger-voter-sync \
  -H "X-API-Key: YOUR_SERVER_API_KEY"
```

---

## Phase 2: Deploy the Governance Frontend

The Governance Frontend is the web dashboard where DReps and the community can view proposals, votes, and delegator sentiment.

### 2.1 Configure Environment

```bash
cd frontend
cp .env.example .env
```

Set the following variables:

| Variable | Description |
|----------|-------------|
| `BACKEND_API_URL` | The Central API URL from Phase 1 (e.g. `https://your-api.run.app`) |
| `BACKEND_API_KEY` | Must match `SERVER_API_KEY` from Phase 1 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | (Optional) VAPID public key for web push notifications |

### 2.2 Deploy the Frontend

**Option A: Vercel (recommended)**

1. Push your repository to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Set the root directory to `frontend`
4. Add the environment variables from step 2.1
5. Deploy

**Option B: Self-hosted**

```bash
cd frontend
yarn install
yarn build
yarn start   # Runs on port 3000
```

### 2.3 Verify Frontend Deployment

- Open the frontend URL in a browser
- Confirm the governance proposal list loads with data
- Confirm proposal detail pages show vote breakdowns
- Connect a Cardano wallet and verify the authentication flow works

---

## Phase 3: DRep Registration and Onboarding

Before a DRep can deploy their Discord Bot or Verification Frontend, they must register on the Central API and receive an API key.

### 3.1 DRep Registration Flow

1. **DRep connects wallet** on the Governance Frontend and signs in
2. **DRep submits registration** via the registration page, providing their DRep ID
3. **System admin approves** the registration through the admin panel (the admin's wallet address must be in `ADMIN_WALLET_ADDRESSES`)
4. **API key is generated** upon approval in the format `drep_sk_*`

### 3.2 Obtaining the API Key

After admin approval, the DRep can view their API key on the registration page of the Governance Frontend. This key is needed for:

- The Discord Bot's `API_KEY` environment variable
- The Delegator Verification Frontend's `BACKEND_API_KEY` environment variable

### 3.3 Admin API Alternative

Admins can also approve DReps directly via the API:

```bash
curl -X POST https://YOUR_API_URL/sentiment/drep/{drepId}/approve \
  -H "X-API-Key: YOUR_SERVER_API_KEY"
```

---

## Phase 4: Deploy the Discord Bot (Per-DRep)

Each DRep deploys their own Discord Bot instance. The bot posts governance proposal threads, collects delegator sentiment, and handles delegator verification.

> For detailed GCP-specific setup, see [`discord-bot/gcp-deployment.md`](../discord-bot/gcp-deployment.md).

### 4.1 Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and name it (e.g. "DRep Governance Bot")
3. Go to **Bot** and click **Add Bot**
4. Copy the **Bot Token**
5. Enable these Privileged Gateway Intents:
   - Server Members Intent
   - Message Content Intent

### 4.2 Set Up the Discord Server

1. Create a **Forum Channel** for governance proposals (e.g. `#governance-proposals`)
2. Create a **Text Channel** for delegator verification (e.g. `#verify-delegation`)
3. Create a **Role** for verified delegators (e.g. `Delegator`)
4. (Optional) Create forum tags for proposal types: Parameter Change, Hard Fork Initiation, Treasury Withdrawals, No Confidence, New Committee, New Constitution, Info Action

Enable **Developer Mode** in Discord (User Settings > Advanced > Developer Mode) and right-click to copy IDs for all channels, roles, and tags.

### 4.3 Invite the Bot to Your Server

In the Discord Developer Portal, go to **OAuth2 > URL Generator**:

- **Scopes**: `bot`, `applications.commands`
- **Permissions**: Send Messages, Manage Messages, Embed Links, Read Message History, Use Slash Commands, Manage Roles, Create Public Threads, Send Messages in Threads

Open the generated URL to invite the bot.

### 4.4 Configure Environment

```bash
cd discord-bot
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Bot token from step 4.1 |
| `DISCORD_CLIENT_ID` | Application client ID from Developer Portal |
| `DISCORD_GUILD_ID` | Your Discord server ID |
| `API_BASE_URL` | Central API URL from Phase 1 |
| `API_KEY` | Your DRep API key (`drep_sk_*`) from Phase 3 |
| `DREP_ID` | Your DRep ID in CIP-105 format |
| `FORUM_CHANNEL_ID` | Forum channel ID for proposal threads |
| `DELEGATE_CHANNEL_ID` | Text channel ID for verification |
| `ROLE_ID_DELEGATED` | Role ID for verified delegators |
| `TAG_ID_*` | (Optional) Forum tag IDs for each proposal type |

### 4.5 Deploy the Discord Bot

**Option A: GCP Compute Engine (recommended)**

Follow [`discord-bot/gcp-deployment.md`](../discord-bot/gcp-deployment.md) for full GCP setup. The GitHub Actions workflow (`.github/workflows/deploy-discord-bot-gcp.yml`) will:
1. Build the Docker image
2. Push to Artifact Registry
3. SSH into the VM and deploy the container

**Option B: Docker (self-hosted)**

```bash
cd discord-bot
docker compose up -d
```

**Option C: Direct Node.js**

```bash
cd discord-bot
yarn install
yarn build
yarn start
```

### 4.6 Verify Discord Bot Deployment

- Confirm the bot appears online in your Discord server
- Run the `/verify` slash command - the bot should respond with a verification link
- Check that proposal threads are being created in the forum channel (may take up to 5 minutes for the first sync)
- Check container logs for any errors

---

## Phase 5: Deploy the Delegator Verification Frontend (Per-DRep)

Each DRep deploys their own Verification Frontend. This is the web app that delegators visit to connect their wallet and verify their delegation status.

### 5.1 Configure Environment

```bash
cd delegator-verification-frontend
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_DREP_ID` | Your DRep ID in CIP-129 format |
| `NEXT_PUBLIC_DREP_NAME` | Display name for your DRep |
| `BACKEND_API_URL` | Central API URL from Phase 1 |
| `BACKEND_API_KEY` | Your DRep API key (`drep_sk_*`) from Phase 3 |
| `BLOCKFROST_KEY` | Your Blockfrost mainnet API key |
| `NEXT_PUBLIC_DISCORD_CHANNEL_LINK` | Link to your Discord governance channel |

### 5.2 Customize Branding (Optional)

- **Text content**: Edit `src/lib/text.ts` to customize page titles, instructions, button labels, and error messages
- **Theme colors**: Modify `tailwind.config.ts` to match your DRep branding
- **CSS variables**: Update `src/styles/globals.css` for further style customization

### 5.3 Deploy the Verification Frontend

**Option A: Vercel (recommended)**

1. Fork or push the repository to your GitHub account
2. Import the project in [Vercel](https://vercel.com)
3. Set the root directory to `delegator-verification-frontend`
4. Add the environment variables from step 5.1
5. Deploy

Note your deployed URL (e.g. `https://your-drep-verify.vercel.app`) - this is used by the Discord Bot's `VERIFICATION_FRONTEND_URL` secret and must be set in the Discord Bot's configuration.

**Option B: Docker**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3002
CMD ["npm", "start"]
```

**Option C: Direct Node.js**

```bash
cd delegator-verification-frontend
yarn install
yarn build
yarn start   # Runs on port 3002
```

### 5.4 Update Discord Bot Configuration

After deploying the Verification Frontend, update the Discord Bot's `VERIFICATION_FRONTEND_URL` GitHub secret (or environment variable) to point to the deployed URL. Redeploy the bot if needed.

### 5.5 Verify the Full Verification Flow

1. In Discord, run `/verify` - the bot should send a personalized verification link
2. Open the link - the Verification Frontend should load
3. Connect a Cardano wallet
4. If delegated to the DRep, the "Verify & Connect" button should appear
5. Complete verification - you should receive the delegator role in Discord

---

## End-to-End Verification Checklist

After deploying all components, walk through this checklist to confirm everything works:

- [ ] **API**: `GET /health` returns 200
- [ ] **API**: `GET /api-docs` loads Swagger UI
- [ ] **API**: Proposal sync is running (check `GET /proposal` returns data)
- [ ] **Frontend**: Governance proposal list loads and shows proposals
- [ ] **Frontend**: Proposal detail pages show vote breakdowns (DRep, SPO, CC)
- [ ] **Frontend**: Wallet connection and DRep sign-in works
- [ ] **Frontend**: Admin panel is accessible with admin wallet
- [ ] **Discord Bot**: Bot appears online in the Discord server
- [ ] **Discord Bot**: Proposal threads are created in the forum channel
- [ ] **Discord Bot**: `/verify` command responds with a verification link
- [ ] **Verification Frontend**: Loads and shows the DRep name
- [ ] **Verification Frontend**: Wallet connection works
- [ ] **Verification Frontend**: Delegation check returns correct status
- [ ] **Verification Flow**: Full flow from `/verify` to receiving Discord role completes
- [ ] **Sentiment**: Delegator reactions in Discord threads are recorded in the API
- [ ] **Sentiment**: DRep can view aggregated delegator sentiment on proposal detail pages
- [ ] **Cron Jobs**: Proposal sync runs on schedule (check Cloud Scheduler or API logs)
- [ ] **Cron Jobs**: Voter power sync runs on schedule

---

## Ongoing Maintenance

### Monitoring

**API Logs:**

```bash
# GCP Cloud Run
gcloud beta run services logs tail drep-delegator-api \
  --region=YOUR_REGION --project=YOUR_PROJECT_ID

# Docker
docker logs -f drep-delegator-feedback-api
```

**Discord Bot Logs:**

```bash
# GCP Compute Engine
gcloud compute ssh YOUR_VM_NAME --zone=YOUR_ZONE \
  --command="docker logs -f delegator-feedback-discord-bot"

# Docker
docker logs -f drep-discord-bot
```

### Manual Sync Triggers

```bash
# Force proposal sync
curl -X POST https://YOUR_API_URL/data/trigger-sync \
  -H "X-API-Key: YOUR_SERVER_API_KEY"

# Force voter power sync
curl -X POST https://YOUR_API_URL/data/trigger-voter-sync \
  -H "X-API-Key: YOUR_SERVER_API_KEY"

# Force deadline alert check
curl -X POST https://YOUR_API_URL/data/trigger-deadline-alerts \
  -H "X-API-Key: YOUR_SERVER_API_KEY"
```

### Database Migrations

When updating to a new version with schema changes:

```bash
# Via Cloud SQL proxy
cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432 &
DATABASE_URL="postgresql://user:pass@localhost:5432/db" npx prisma migrate deploy

# Or directly
DATABASE_URL="your_production_url" npx prisma migrate deploy
```

### Updating Components

1. Pull the latest code from the repository
2. Run database migrations if there are schema changes
3. Redeploy each component:
   - **API / Discord Bot**: Push to `main` branch to trigger GitHub Actions, or rebuild Docker images
   - **Frontend / Verification Frontend**: Push to trigger Vercel auto-deploy, or rebuild manually

---

## Appendix A: Environment Variable Reference

### Central API

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `MAINNET_BLOCKFROST_API_KEY` | Yes | Blockfrost API key |
| `SERVER_API_KEY` | Yes | Internal API key for cron jobs and admin endpoints |
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `ADMIN_WALLET_ADDRESSES` | Yes | Comma-separated admin wallet addresses |
| `KOIOS_BASE_URL` | No | Koios API URL (default: `https://api.koios.rest/api/v1`) |
| `KOIOS_API_KEY` | No | Koios API key for higher rate limits |
| `PORT` | No | Server port (default: 3000, not needed for Cloud Run) |
| `ENABLE_CRON_JOBS` | No | Enable/disable in-process cron (default: `true`) |
| `DISABLE_CRON_IN_API` | No | Set `true` when using a separate cron container |
| `PROPOSAL_SYNC_SCHEDULE` | No | Cron syntax for proposal sync |
| `VOTER_POWER_SYNC_SCHEDULE` | No | Cron syntax for voter power sync |
| `VOTER_SYNC_CONCURRENCY` | No | Concurrent API calls for voter sync (default: 5, range: 1-10) |
| `DEADLINE_ALERT_SCHEDULE` | No | Cron syntax for deadline alerts (default: `0 9 * * *`) |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window in ms (default: 900000) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per window (default: 100) |
| `JWT_EXPIRY_SECONDS` | No | JWT expiry (default: 604800 = 7 days) |
| `VAPID_SUBJECT` | No | Web push VAPID mailto address |
| `VAPID_PUBLIC_KEY` | No | Web push VAPID public key |
| `VAPID_PRIVATE_KEY` | No | Web push VAPID private key |

### Governance Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `BACKEND_API_URL` | Yes | Central API URL |
| `BACKEND_API_KEY` | Yes | Must match `SERVER_API_KEY` from the API |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Web push VAPID public key |

### Discord Bot

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Discord application client ID |
| `DISCORD_GUILD_ID` | Yes | Discord server/guild ID |
| `API_BASE_URL` | Yes | Central API URL |
| `API_KEY` | Yes | DRep API key (`drep_sk_*`) |
| `DREP_ID` | Yes | DRep ID in CIP-105 format |
| `FORUM_CHANNEL_ID` | Yes | Forum channel for proposal threads |
| `DELEGATE_CHANNEL_ID` | Yes | Text channel for verification |
| `ROLE_ID_DELEGATED` | No | Role ID for verified delegators |
| `TAG_ID_PARAMETER_CHANGE` | No | Forum tag ID |
| `TAG_ID_HARD_FORK_INITIATION` | No | Forum tag ID |
| `TAG_ID_TREASURY_WITHDRAWALS` | No | Forum tag ID |
| `TAG_ID_NO_CONFIDENCE` | No | Forum tag ID |
| `TAG_ID_NEW_COMMITTEE` | No | Forum tag ID |
| `TAG_ID_NEW_CONSTITUTION` | No | Forum tag ID |
| `TAG_ID_INFO_ACTION` | No | Forum tag ID |

### Delegator Verification Frontend

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_DREP_ID` | Yes | DRep ID in CIP-129 format |
| `NEXT_PUBLIC_DREP_NAME` | Yes | Display name for your DRep |
| `BACKEND_API_URL` | Yes | Central API URL |
| `BACKEND_API_KEY` | Yes | DRep API key (`drep_sk_*`) |
| `BLOCKFROST_KEY` | Yes | Blockfrost mainnet API key |
| `NEXT_PUBLIC_DISCORD_CHANNEL_LINK` | Yes | Link to Discord governance channel |

---

## Appendix B: Alternative Deployment Options

While GCP is the reference deployment, the system can run on any platform that supports Docker or Node.js.

### API Alternatives

| Platform | How |
|----------|-----|
| **AWS ECS / Fargate** | Build Docker image, deploy to ECS with RDS PostgreSQL |
| **Railway** | Connect repo, set environment variables, auto-deploy |
| **Fly.io** | `fly launch` with the Dockerfile, add Fly Postgres |
| **DigitalOcean App Platform** | Import repo, configure as Docker service |
| **Self-hosted VPS** | Run `docker compose up -d` with the provided docker-compose.yml |

### Frontend Alternatives

| Platform | How |
|----------|-----|
| **Vercel** | Import repo, set root directory, add env vars (recommended) |
| **Netlify** | Import repo, set build command to `yarn build`, set publish directory |
| **Cloudflare Pages** | Connect repo, configure Next.js build |
| **Self-hosted** | `yarn build && yarn start` behind Nginx/Caddy |

### Discord Bot Alternatives

| Platform | How |
|----------|-----|
| **AWS EC2** | Launch t3.micro, install Docker, run the container |
| **Railway** | Connect repo, set root directory to `discord-bot`, auto-deploy |
| **Fly.io** | `fly launch` with the discord-bot Dockerfile |
| **Self-hosted VPS** | Run `docker compose up -d` in the discord-bot directory |

> **Note for the Discord Bot:** Since it maintains a persistent WebSocket connection to Discord, it needs a long-running process (not serverless). Cloud Run, Lambda, or Vercel are **not** suitable for the bot.
