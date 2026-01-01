# Cardano Drep Delegator Feedback Platform: Project Description

## Overview

Cardano Governance Tracking Dashboard and DRep Delegator Feedback Platform built with Next.js/TypeScript. The platform enables monitoring of on-chain governance actions, voting records, and provides a feedback mechanism for DRep delegators via Discord integration.

## Features

### Governance Dashboard
- Aggregate governance statistics dashboard
- Filterable governance actions table (by type: Info Action, Hardfork Initiation, Treasury Withdrawals, No Confidence, New Constitution, Parameter Change, New Committee)
- Detailed governance action pages with voting records
- DRep, SPO, and CC (Constitutional Committee) voting data with percentages and ADA amounts
- Search and filter voting records by voter name/ID and vote type
- Status tracking: Active, Ratified, Expired, Closed, Enacted

### NCL (Net Change Limit) Tracking
- Multi-year NCL display (2025 extended period + 2026)
- Treasury withdrawal tracking against yearly limits
- Visual progress bars showing usage percentage

### Authentication & Wallet Integration
- Cardano wallet connection via MeshSDK (supports Eternl, Nami, Flint, etc.)
- JWT-based authentication with wallet signature verification
- Session persistence across page refreshes

### DRep Registration & Integration
- DRep registration flow with Discord guild linking
- Admin approval workflow for new DRep registrations
- Per-DRep API key generation for Discord bot integration

### Delegator Sentiment System
- Discord-based sentiment collection (Yes/No/Abstain reactions)
- Delegator verification via stake address
- Sentiment aggregation displayed on proposal pages
- Comment collection from verified delegators

## Tech Stack

- Next.js 15.0.3 + React 18 + TypeScript 5
- Next.js Pages Router (/, /governance/[hash], /drep/register, /404)
- Redux Toolkit (state management)
- Radix UI + Tailwind CSS (shadcn/ui style components)
- MeshSDK (@meshsdk/core, @meshsdk/react) - Cardano blockchain integration
- date-fns, lucide-react

## Project Structure

```text
src/
├── components/
│   ├── ui/                         # shadcn-ui components (button, card, table, etc.)
│   ├── wallet/
│   │   ├── ConnectWalletButton.tsx # Wallet connection button with address display
│   │   └── ConnectWalletModal.tsx  # Wallet selection modal
│   ├── governance/
│   │   ├── VoteButtons.tsx         # Vote action buttons (Yes/No/Abstain)
│   │   ├── VoteOnProposal.tsx      # Vote submission dialog
│   │   └── DelegatorSentiment.tsx  # Sentiment display component
│   ├── layout/
│   │   └── Header.tsx              # App header with navigation
│   ├── GovernanceStats.tsx         # Statistics cards + NCL display
│   ├── GovernanceTable.tsx         # Actions table with tabs
│   └── VotingRecords.tsx           # Votes table with search/filter
├── pages/
│   ├── api/                        # Next.js API routes (proxy to backend)
│   │   ├── overview/
│   │   │   ├── index.ts            # GET /overview
│   │   │   ├── proposals.ts        # GET /overview/proposals
│   │   │   └── ncl/
│   │   │       ├── index.ts        # GET /overview/ncl
│   │   │       └── [year].ts       # GET /overview/ncl/:year
│   │   ├── proposal/
│   │   │   └── [id].ts             # GET /proposal/:id
│   │   └── auth/
│   │       └── sign-in.ts          # POST /auth/sign-in
│   ├── drep/
│   │   └── register.tsx            # DRep registration page
│   ├── governance/
│   │   └── [hash].tsx              # Proposal detail view
│   ├── index.tsx                   # Dashboard
│   ├── 404.tsx                     # 404 page
│   ├── _app.tsx                    # Next.js app wrapper
│   └── _document.tsx               # Next.js document wrapper
├── contexts/
│   └── AuthContext.tsx             # Authentication context (JWT, wallet state)
├── store/
│   ├── index.ts                    # Redux store
│   ├── governanceSlice.ts          # Governance state slice
│   └── hooks.ts                    # Redux hooks
├── services/
│   └── api.ts                      # API service functions
├── config/
│   └── api.ts                      # API endpoint configuration
├── types/
│   ├── governance.ts               # Governance TypeScript types
│   └── auth.ts                     # Auth TypeScript types
└── lib/
    └── utils.ts                    # Utility functions
```

## Data Models

```typescript
interface GovernanceAction {
  hash: string;
  proposalId: string;
  txHash: string;
  title: string;
  type: string;
  status: "Active" | "Ratified" | "Enacted" | "Expired" | "Closed";
  constitutionality: string;
  drep: GovernanceActionVoteInfo;
  spo?: GovernanceActionVoteInfo;
  cc?: CCGovernanceActionVoteInfo;
  totalYes: number;
  totalNo: number;
  totalAbstain: number;
  submissionEpoch: number;
  expiryEpoch: number;
}

interface VoteRecord {
  voterType: "DRep" | "SPO" | "CC";
  voterId: string;
  voterName?: string;
  vote: "Yes" | "No" | "Abstain";
  votingPower?: string;
  votingPowerAda?: number;
  anchorUrl?: string;
  anchorHash?: string;
  votedAt: string;
}

interface NCLDisplayData {
  year: number;
  currentValueAda: number;
  targetValueAda: number;
  percentUsed: number;
  isExtended?: boolean; // True for 2025 (extended period)
}

interface OverviewSummary {
  totalProposals: number;
  activeProposals: number;
  ratifiedProposals: number;
  enactedProposals: number;
  expiredProposals: number;
  closedProposals: number;
  nclData: NCLApiData[];
}
```

## API Integration

The frontend connects to the backend API via Next.js API routes that proxy requests:

### Public Endpoints (No Auth)
- `GET /api/overview` - Dashboard stats + NCL data
- `GET /api/overview/proposals` - Proposal list
- `GET /api/proposal/:id` - Proposal details
- `GET /api/overview/ncl` - NCL data for all years

### Authenticated Endpoints
- `POST /api/auth/sign-in` - Wallet authentication
- `GET /api/auth/me` - Current user (JWT required)
- Sentiment endpoints require DRep API key or JWT

## Status Colors

- Active → green
- Ratified → blue (primary)
- Enacted → blue-500
- Expired/Closed → gray (muted)

## NCL Display

- 2025 NCL: Shows "Extended" badge (extended to Epoch 612, Feb 2026)
- 2026 NCL: Standard display
- Both years shown stacked in same card
- Progress bar shows usage percentage

## Responsive Breakpoints

- Mobile: Single column
- Tablet: 2-column grids
- Desktop: 3-column grids

## User Flows

**Dashboard**: View statistics + NCL → Filter by type → Click action → Navigate to detail

**Detail View**: Read description → View delegator sentiment → Search votes → Filter by vote type → Read IPFS rationales

**Wallet Connection**: Click Connect Wallet → Select wallet → Sign message → Authenticated session

**DRep Registration**: Connect wallet → Navigate to /drep/register → Fill form with Discord Guild ID → Submit → Await admin approval