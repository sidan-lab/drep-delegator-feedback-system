# Feature Enhancement to Delegator Feedback System based on DRep's and Community Suggestion

Suggested feature 1: Voting Deadline Alerts & Reminders

Features:
Proactive notifications to DReps when proposal voting deadlines approach
Configurable alert thresholds (e.g., 7 days, 3 days, 1 day before expiry)
Highlight proposals where DRep hasn't voted yet
Push via Discord DM or web notifcation

Suggested feature 2: DRep Draft Rationale Publishing

Current Gap: DReps only publish their voting decision after voting on-chain. There is no mechanism for DReps to share their intended vote before finalizing, missing the opportunity for delegator input before the decision is locked in.

Enhancement suggested:
Add "Draft Vote Intent" feature when DReps can publish their preliminary position
DReps can see sentiment shift based on their stated intent
Convert draft to final vote when DRep submits on-chain

Value:
Creates genuine two-way dialogue (not just post-vote reporting)
Gives delegators meaningful influence before decisions are final
Increases accountability and transparency in the governance process

# Curated List of Information being displayed in the DRep Management Web Platform

## 1. Dashboard - Governance Statistics Overview

- **Total Governance Actions**: Count of all on-chain proposals
- **Active Proposals Progress**: Number and percentage of currently active proposals
- **Status Breakdown**: Proposals categorized by status (Active, Ratified, Enacted, Expired/Closed)
- **NCL Data (Net Change Limit)**:
  - Multi-year treasury data (2025, 2026)
  - Current vs. target treasury ADA values
  - Percentage of budget used
  - Extended period indicators

## 2. Governance Proposal Listing Table

- Proposal title, type, and status
- Submission and expiry epochs with ISO dates
- **DRep Votes**: Yes/No percentages and ADA voting power
- **SPO Votes**: Yes/No percentages and ADA voting power (type-dependent)
- **Constitutional Committee (CC) Votes**: Yes/No percentages and vote counts (type-dependent)
- **Total Vote Counts**: Summary of Yes/No/Abstain votes across all voters
- Search functionality by proposal title
- Filter by 8 governance action types (All, Info Action, Treasury Withdrawals, New Constitution, Hard Fork Initiation, Protocol Parameter Change, No Confidence, Update Committee)

## 3. Governance Proposal Details Page

### Proposal Overview
- Title and status badge (Active/Ratified/Enacted/Expired/Closed)
- Proposal ID and type classification
- Submission and expiry epoch information with formatted dates
- Time until expiry indicator with urgency levels (urgent/soon/normal)
- Progress bar showing voting period elapsed

### Description & Rationale
- Full proposal description text
- Optional rationale text explaining the proposal

### Vote Information Panels
- **DRep Votes Card**: Yes/No percentages with ADA amounts
- **SPO Votes Card**: Yes/No percentages with ADA amounts (conditional based on proposal type)
- **Constitutional Committee Votes Card**: Yes/No percentages with vote counts (conditional)
- **Vote Summary Card**: Total Yes, No, and Abstain counts across all voters
- **Constitutionality Card**: Constitutional assessment text

## 4. Voting Records Section

### Vote Statistics
- Total votes count
- Yes, No, Abstain counts in card format

### Individual Voting Records Table
- Voter name and ID (with truncation)
- Voter type badge (DRep, SPO, CC)
- Vote badge (Yes/No/Abstain with color coding)
- Live voting power in ADA (for DRep/SPO, N/A for CC)
- Voted at timestamp
- Rationale link/preview (supports IPFS/HTTP URLs and CIP-100 JSON format)

### Advanced Filtering Features
- Search by voter name or ID
- Filter by voter type (DRep, SPO, CC)
- Filter by vote choice (Yes, No, Abstain)
- Superseded vote detection (older votes from same voter are marked with strikethrough)
- Rationale viewing in modal with external link access

## 5. DRep-Specific Information

### DRep Registration Page
- DRep authentication status
- DRep ID and wallet address display
- Registration status (Pending/Approved/Rejected) with badges
- API Key management (show/hide/copy/reset functionality)
- Admin controls for DRep registration approval/rejection (with rationale)
- Notification settings link

### Your Delegator Sentiment Component (on proposal detail page)
- Only visible to authenticated DRep users
- Aggregated delegator feedback:
  - Yes/No/Abstain sentiment distribution percentages
- Individual delegator votes displaying:
  - Discord username
  - Sentiment badge
  - Live stake in ADA (formatted with K/M suffixes)
  - Stake address link to Cardanoscan
  - Timestamp of sentiment submission
  - Optional comment text
- Expandable list (shows 3 initially, can show all)
- Total delegator count badge

## 6. User Profile & Authentication Information

### Header/Navigation
- Wallet connection status indicator
- Connected wallet address (truncated display)
- Admin badge (if user is admin)
- Sign out button

### Settings Pages
- Notification preferences configuration
- Voting deadline reminder settings

## 7. Feedback/Sentiment Data Displays

### Delegator Sentiment Summary
- Aggregated yes/no/abstain percentages from delegators
- Individual reaction tracking with Discord integration
- Comments from delegators with timestamps
- Stake-weighted sentiment display
- Last updated timestamps

### Draft Vote Intent Feature
- Pre-voting position announcement to delegators
- Shows preliminary voting choice before on-chain submission
- Allows delegators to provide feedback before finalization
- Displays publish timestamp

## 8. Vote Submission Interface

- Final vote mode (on-chain transaction)
- Draft mode (off-chain intent announcement)
- Anchor URL support for rationale (IPFS or HTTP)
- Vote submission progress tracking
- Sync status indicator showing polling count

## 9. Real-time Data Updates

- Governance actions list polling
- Proposal detail refreshing with vote sync detection
- 20-second polling interval for vote synchronization
- Vote count comparison to detect when votes have synced on-chain
- Authentication-required data loads only after wallet connection AND authentication
