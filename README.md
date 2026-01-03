# DRep Delegator Feedback System

Tools and workflows for Cardano delegators to share feedback with their chosen DReps, and for DReps to better understand, track, and respond to their delegators' preferences.

This repository is created as part of a Project Catalyst initiative by **SIDAN Lab** to improve the signal flow between ADA holders and governance representatives.

---

## Goals

- Make it easy for **delegators** to:
  - Share feedback with their DRep (preferences, concerns, priorities)
  - Understand how their DRep is voting and why
  - Verify their delegation and participate in governance discussions
- Help **DReps** to:
  - Aggregate delegator feedback in one place
  - Visualize priorities and sentiment from their delegators
  - Use that feedback as input for future governance decisions
  - Engage with their community through Discord

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           External Data Sources                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │    Koios     │    │  Blockfrost  │    │   Discord    │               │
│  │  (Gov Data)  │    │ (Chain Data) │    │     API      │               │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘               │
└─────────┼───────────────────┼───────────────────┼───────────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              Central API                                 │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  Express.js + Prisma + PostgreSQL                                  │ │
│  │  - Proposal sync (Koios)          - DRep/SPO voting power tracking │ │
│  │  - Delegator sentiment storage    - Discord verification           │ │
│  │  - DRep registration & API keys   - Admin endpoints                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────────┐   ┌─────────────────────────┐
│  Discord Bot    │   │  Governance         │   │  Verification           │
│  (Per-DRep)     │   │  Frontend           │   │  Frontend (Per-DRep)    │
│                 │   │                     │   │                         │
│  - Proposal     │   │  - Track proposals  │   │  - Wallet connection    │
│    threads      │   │  - View sentiments  │   │  - Delegation check     │
│  - Delegator    │   │  - DRep dashboard   │   │  - Discord linking      │
│    verification │   │  - Admin panel      │   │                         │
│  - Sentiment    │   │                     │   │                         │
│    collection   │   │                     │   │                         │
└─────────────────┘   └─────────────────────┘   └─────────────────────────┘
```

---

## Repository Structure

| Directory | Description |
|-----------|-------------|
| `api/` | Central API service - Express.js with Prisma ORM, handles proposal sync, sentiment storage, DRep management, and Discord verification |
| `frontend/` | Governance dashboard - Next.js app for viewing proposals, delegator sentiments, and DRep voting |
| `discord-bot/` | Discord bot for DReps - Posts proposal threads, collects delegator feedback, handles verification |
| `delegator-verification-frontend/` | Verification portal - Next.js app for delegators to verify their wallet and link to Discord |

---

## Tech Stack

| Component | Technologies |
|-----------|-------------|
| **API** | Express.js 5, Prisma, PostgreSQL, TypeScript |
| **Frontend** | Next.js 15, React 19, TailwindCSS, MeshSDK |
| **Discord Bot** | Discord.js 14, TypeScript, node-cron |
| **Verification Frontend** | Next.js 15, React 18, MeshSDK |
| **Infrastructure** | GCP Cloud Run (API), GCP Compute Engine (Discord Bot), Vercel (Frontends) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Yarn package manager
- PostgreSQL database
- Blockfrost API key ([blockfrost.io](https://blockfrost.io))
- Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/sidan-lab/drep-delegator-feedback-system.git
   cd drep-delegator-feedback-system
   ```

2. **Set up the API**
   ```bash
   cd api
   cp .env.example .env
   # Edit .env with your configuration
   yarn install
   npx prisma migrate dev
   yarn dev
   ```

3. **Set up the Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   # Edit .env with your configuration
   yarn install
   yarn dev
   ```

4. **Set up the Discord Bot**
   ```bash
   cd discord-bot
   cp .env.example .env
   # Edit .env with your configuration
   yarn install
   yarn dev
   ```

5. **Set up the Verification Frontend**
   ```bash
   cd delegator-verification-frontend
   cp .env.example .env
   # Edit .env with your configuration
   yarn install
   yarn dev
   ```

### Default Ports

| Service | Port |
|---------|------|
| API | 3001 |
| Frontend | 3000 |
| Discord Bot | N/A (WebSocket) |
| Verification Frontend | 3002 |

---

## Deployment

Detailed deployment guides are available for GCP:

- **API**: See [`api/gcp-deployment.md`](./api/gcp-deployment.md) - Deploy to Cloud Run with Cloud SQL
- **Discord Bot**: See [`discord-bot/gcp-deployment.md`](./discord-bot/gcp-deployment.md) - Deploy to Compute Engine

---

## For DReps

If you're a DRep looking to deploy your own instance:

1. **Register as a DRep** on the central API
2. **Deploy your Discord Bot** following the [Discord Bot GCP Deployment Guide](./discord-bot/gcp-deployment.md)
3. **Deploy your Verification Frontend** (Vercel recommended)
4. **Configure your Discord server** with the bot and verification channels

---

## API Documentation

When running locally, API documentation is available at:
- Swagger UI: `http://localhost:3001/api-docs`

---

## Maintainers

- Anson Chui (GitHub: [@AnsoncSIDAN](https://github.com/AnsoncSIDAN)) - Project Lead & SIDAN Lab Governance Lead
- Jackal Leung (GitHub: [@leuhk](https://github.com/leuhk)) - Technical Program Manager
- Ken Lau (GitHub: [@kenlau666](https://github.com/kenlau666)) - Software Engineer

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this project.

---

## Community

- **Discord**: Join SIDAN Lab's server at https://discord.gg/prJvB6b6p4
- **Updates Channel**: https://discord.com/channels/1166784293805228061/1441817121909903370

---

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](./LICENSE) file for details.