# DRep Vote Submission and Sync Flow

This document traces the full user journey from a DRep casting an on-chain governance vote to the frontend confirming the vote has been synced with the backend.

---

## Table of Contents

1. [Overview](#overview)
2. [Step 1 - User Selects a Vote Choice](#step-1---user-selects-a-vote-choice)
3. [Step 2 - Build the Vote Transaction](#step-2---build-the-vote-transaction)
4. [Step 3 - Sign and Submit the Transaction](#step-3---sign-and-submit-the-transaction)
5. [Step 4 - Start Polling](#step-4---start-polling)
6. [Step 5 - Frontend Polling Loop](#step-5---frontend-polling-loop)
7. [Step 6 - Redux Thunk Fetches Proposal Detail](#step-6---redux-thunk-fetches-proposal-detail)
8. [Step 7 - Next.js Proxy Forwards to Backend](#step-7---nextjs-proxy-forwards-to-backend)
9. [Step 8 - Backend Controller Triggers Sync-on-Read](#step-8---backend-controller-triggers-sync-on-read)
10. [Step 9 - Sync-on-Read Compares DB vs Koios](#step-9---sync-on-read-compares-db-vs-koios)
11. [Step 10 - Re-ingestion of Proposal and Votes](#step-10---re-ingestion-of-proposal-and-votes)
12. [Step 11 - Frontend Detects Vote Count Increase](#step-11---frontend-detects-vote-count-increase)
13. [File Reference Index](#file-reference-index)

---

## Overview

The flow involves two main phases:

1. **Transaction Build & Submit** (frontend) - The DRep builds a Cardano vote transaction using MeshJS, signs it with their wallet, and submits it to the blockchain.
2. **Polling & Sync-on-Read** (frontend + backend) - The frontend polls the backend every 20 seconds. Each poll triggers the backend's sync-on-read service, which compares the local database state against the Koios blockchain indexer API to detect new votes. When the vote count increases, polling stops and the UI confirms the sync.

```
Frontend (VoteOnProposal)         Next.js Proxy          Backend API           Koios API
─────────────────────────         ──────────────         ───────────           ─────────
  1. User clicks Yes/No/Abstain
  2. Build tx (MeshTxBuilder)
  3. Sign tx (wallet.signTx)
  4. Submit tx (wallet.submitTx)
     │
     ├── Capture current vote count
     └── Start 20s polling interval
           │
           │  every 20s: dispatch(loadGovernanceActionDetail)
           │         │
           │         ├─── GET /api/proposal/:id ──────────► GET /proposal/:id
           │         │                                          │
           │         │                              syncProposalDetailsOnRead()  ─── (background) ──►
           │         │                                          │                     fetch /vote_list
           │         │                              return DB data immediately        fetch /proposal_voting_summary
           │         │                                          │                     compare counts
           │         │                              ◄───────────┘                     re-ingest if changed
           │         │
           │         ◄──── proposal detail (with votes) ────────┘
           │
           │  useEffect: compare votes.length > countAtSubmission?
           │    NO  → continue polling (up to 15 polls / 5 min)
           │    YES → stop polling, set isSynced = true
           │
           ▼
  UI shows "Vote synced!"
```

---

## Step 1 - User Selects a Vote Choice

**File:** `frontend/src/components/governance/VoteOnProposal.tsx` (lines 289-294)

The `VoteOnProposal` component renders three vote buttons (Yes, No, Abstain) for active proposals. A wallet must be connected via MeshJS (`useWallet` hook). Clicking a button calls `handleVoteClick`, which stores the selected choice in local state and opens the confirmation modal.

```ts
const handleVoteClick = (vote: VoteChoice) => {
  if (!connected) return;
  setSelectedVote(vote);
  setIsModalOpen(true);
  setVoteState({ isSubmitting: false, isSuccess: false, error: null, txHash: null });
};
```

The modal displays the proposal title, the selected vote, and an optional **Rationale URL** field (for linking to a CIP-100 compatible JSON anchor document). If draft mode is toggled on, clicking "Publish Draft" calls `handlePublishDraft` instead (off-chain intent only; no transaction). Otherwise, clicking "Confirm Vote" invokes `submitVote`.

> **Note:** A simpler variant of the same transaction-building logic also exists in `VoteButtons` (`frontend/src/components/governance/VoteButtons.tsx`, lines 71-165), which is used in compact/landing page contexts. `VoteButtons` does **not** include polling logic.

---

## Step 2 - Build the Vote Transaction

**File:** `frontend/src/components/governance/VoteOnProposal.tsx` (lines 364-433)

The `submitVote` callback (wrapped in `useCallback`) performs the following:

### 2a. Retrieve wallet data

```ts
const utxos = await wallet.getUtxos();
const changeAddress = await wallet.getChangeAddress();
const dRep = await wallet.getDRep();
const drepId = dRep.dRepIDCip105;
```

- `wallet.getUtxos()` - fetches the connected wallet's unspent transaction outputs.
- `wallet.getChangeAddress()` - gets the address to return leftover ADA.
- `wallet.getDRep()` - retrieves the DRep registration info; the `dRepIDCip105` field is the DRep identifier in CIP-105 format.

If `getDRep()` returns null or lacks `dRepIDCip105`, an error is thrown telling the user to ensure they are registered as a DRep.

### 2b. Compute the anchor hash (optional)

If the user provided a rationale URL (`anchorUrl`), the code:

1. Fetches the URL content via `fetch()`.
2. Parses the response as JSON.
3. Computes a Blake2b-256 hash using `hashDrepAnchor()` from `@meshsdk/core`.

```ts
const contentJson = JSON.parse(contentText);
const anchorDataHash = hashDrepAnchor(contentJson);
anchor = { anchorUrl: trimmedUrl, anchorDataHash };
```

If fetching or parsing fails, the entire vote submission is aborted with a descriptive error.

### 2c. Build the transaction

```ts
const txBuilder = new MeshTxBuilder({ verbose: true });

await txBuilder
  .vote(
    { type: "DRep", drepId: drepId },
    { txHash: txHash, txIndex: certIndex },
    { voteKind: selectedVote, anchor }
  )
  .selectUtxosFrom(utxos)
  .changeAddress(changeAddress)
  .complete();

const unsignedTx = txBuilder.txHex;
```

- `txBuilder.vote()` adds a governance vote certificate to the transaction with:
  - **Voter:** `{ type: "DRep", drepId }` - identifies the voter as a DRep.
  - **Governance action reference:** `{ txHash, txIndex: certIndex }` - the proposal's on-chain transaction hash and certificate index (passed as props from the parent page).
  - **Vote details:** `{ voteKind: "Yes"|"No"|"Abstain", anchor? }` - the vote choice and optional rationale anchor.
- `.selectUtxosFrom(utxos)` - uses the wallet's UTXOs to fund the transaction fee.
- `.changeAddress(changeAddress)` - sends leftover ADA back to the wallet.
- `.complete()` - finalizes the transaction, producing the unsigned CBOR hex in `txBuilder.txHex`.

---

## Step 3 - Sign and Submit the Transaction

**File:** `frontend/src/components/governance/VoteOnProposal.tsx` (lines 437-448)

```ts
const signedTx = await wallet.signTx(unsignedTx);
const submittedTxHash = await wallet.submitTx(signedTx);
```

- `wallet.signTx(unsignedTx)` - prompts the user's browser wallet extension to sign the transaction with their private key.
- `wallet.submitTx(signedTx)` - submits the signed transaction to the Cardano blockchain via the wallet's connected node. Returns the on-chain transaction hash.

The component updates `voteState` to `{ isSuccess: true, txHash: submittedTxHash }` and shows a success message with an AdaStat link to the transaction.

---

## Step 4 - Start Polling

**File:** `frontend/src/components/governance/VoteOnProposal.tsx` (lines 450-466)

After the transaction is confirmed, the component starts the polling loop:

```ts
startPolling();
```

---

## Step 5 - Frontend Polling Loop

**File:** `frontend/src/components/governance/VoteOnProposal.tsx` (lines 122-176)

The `startPolling` callback:

1. **Captures the current vote count** from the Redux store (`selectedAction.votes.length`) at the moment polling starts. This is stored in `voteCountAtSubmissionRef` and used later to detect when the vote has synced (line 124-125).
2. **Sets `syncState` to `isPolling: true`** with `maxPolls: 15` (line 128-133).
3. **Starts a `setInterval` that fires every 20 seconds** (line 143, 171):
   - Increments the local poll counter.
   - If the counter reaches 15 (5 minutes total), clears the interval and stops polling (line 148-159).
   - Otherwise, dispatches `loadGovernanceActionDetail(proposalId)` to refresh the proposal data from the backend (line 170).

```ts
pollingIntervalRef.current = setInterval(() => {
  localPollCount += 1;
  if (localPollCount >= 15) {
    clearInterval(pollingIntervalRef.current);
    setSyncState((prev) => ({ ...prev, isPolling: false }));
    return;
  }
  dispatch(loadGovernanceActionDetail(proposalId));
}, 20000);
```

> **Design detail:** The pending state in `loadGovernanceActionDetail` intentionally does NOT clear `selectedAction` (see `governanceSlice.ts` line 170-172). This is a stale-while-revalidate pattern that prevents the `VoteOnProposal` component from unmounting mid-poll, which would close the voting modal.

---

## Step 6 - Redux Thunk Fetches Proposal Detail

**File:** `frontend/src/store/governanceSlice.ts` (lines 75-92)

The `loadGovernanceActionDetail` async thunk calls `fetchGovernanceActionDetail(proposalId)`.

**File:** `frontend/src/services/api.ts` (lines 118-129)

`fetchGovernanceActionDetail` calls the Next.js API route:

```ts
const data = await fetchApi<GovernanceActionDetail>(
  API_ENDPOINTS.proposalDetail(proposalId)
);
```

**File:** `frontend/src/config/api.ts` (line 20-21)

This resolves to `GET /api/proposal/{proposalId}`.

---

## Step 7 - Next.js Proxy Forwards to Backend

**File:** `frontend/src/pages/api/proposal/[id].ts` (lines 1-31)

The Next.js API route extracts the `id` from the URL params and forwards the request to the backend Express API:

```ts
const response = await callApi({
  endpoint: `/proposal/${encodeURIComponent(id)}`,
  method: "GET",
  req,
});
```

This hits the backend route `GET /proposal/:proposal_id`.

---

## Step 8 - Backend Controller Triggers Sync-on-Read

**File:** `api/src/routes/proposal.route.ts` (line 42)

```ts
router.get("/:proposal_id", proposalController.getProposalDetails);
```

**File:** `api/src/controllers/proposal/getProposalDetails.ts` (lines 54-102)

The controller performs two operations:

1. **Triggers a background sync** (non-blocking, line 68):

```ts
syncProposalDetailsOnRead(proposalId);
```

2. **Immediately queries the database** and returns the current proposal data (lines 79-94). The sync runs in the background; its results will be available on the **next** request.

---

## Step 9 - Sync-on-Read Compares DB vs Koios

**File:** `api/src/services/syncOnRead.ts` (lines 162-308)

`syncProposalDetailsOnRead(identifier)` is a fire-and-forget function. It:

1. **Checks concurrency and cooldown** - Skips if a sync for this proposal is already in progress, or if less than 1 second has elapsed since the last sync for this proposal (lines 166-175).
2. **Runs `doProposalSync(identifier)` in the background** (line 181).

### doProposalSync (lines 196-308)

1. **Looks up the proposal in the local DB** via `findProposalByIdentifier` (line 200). This supports multiple identifier formats: `gov_action*` IDs, numeric IDs, `txHash:certIndex`, or plain txHash (lines 342-413).
2. **Skips non-ACTIVE proposals** - only proposals still in voting are synced (line 213).
3. **Fetches vote transactions from Koios** for this proposal via paginated calls to `/vote_list?proposal_id=eq.{id}` (lines 223-224, 314-337).
4. **Compares vote count** between DB and Koios (line 236):
   ```ts
   const hasVoteCountChange = koiosVoteCount !== dbVoteCount;
   ```
5. **Compares voting power totals** from Koios `/proposal_voting_summary` against the DB fields (`drepActiveYesVotePower`, `drepActiveNoVotePower`, etc.) for additional safety (lines 239-279).
6. **If either vote count or voting power changed**, re-ingests the full proposal (lines 282-302):
   ```ts
   if (hasVoteCountChange || hasVotingPowerChange) {
     await ingestProposalData(koiosProposal, {
       minVotesEpoch: koiosProposal.proposed_epoch,
       useCache: false,
     });
   }
   ```

---

## Step 10 - Re-ingestion of Proposal and Votes

### Proposal Ingestion

**File:** `api/src/services/ingestion/proposal.service.ts` (lines 76-231)

`ingestProposalData` performs a complete upsert of the proposal:

1. Derives the proposal status from epoch fields (lines 86-103).
2. Extracts metadata (title, description, rationale) from `meta_json` or by fetching `meta_url` (line 106-107).
3. Upserts the `Proposal` row in the database (lines 117-148).
4. Calls `ingestVotesForProposal` to sync all votes (line 163).
5. Fetches and updates voting power summary data from Koios (lines 170-219).

### Vote Ingestion

**File:** `api/src/services/ingestion/vote.service.ts` (lines 49-181)

`ingestVotesForProposal` in **sync-on-read mode** (`useCache: false`):

1. Fetches votes specifically for this proposal from Koios `/vote_list?proposal_id=eq.{id}` with pagination (lines 121-161).
2. For each vote, calls `ingestSingleVote` (line 172).

**`ingestSingleVote`** (lines 186-296):

1. Ensures the voter (DRep/SPO/CC) exists in the DB via `ensureVoterExists` (line 193).
2. Maps Koios role (`DRep`/`SPO`/`ConstitutionalCommittee`) to Prisma `VoterType` enum (lines 221-227).
3. Maps Koios vote (`Yes`/`No`/`Abstain`) to Prisma `VoteType` enum (lines 229-235).
4. Checks if this vote transaction already exists in the DB (lines 249-258).
5. Creates a new `OnchainVote` record or updates an existing one (lines 260-295).

After this completes, the next API request for this proposal will return the updated vote count.

---

## Step 11 - Frontend Detects Vote Count Increase

**File:** `frontend/src/components/governance/VoteOnProposal.tsx` (lines 178-200)

A `useEffect` hook watches `selectedAction.votes.length` and runs on each Redux store update:

```ts
useEffect(() => {
  const currentVoteCount = selectedAction?.votes?.length || 0;
  const countAtSubmission = voteCountAtSubmissionRef.current;

  if (syncState.isPolling && voteState.txHash && syncState.pollCount >= 1) {
    if (countAtSubmission !== null && currentVoteCount > countAtSubmission) {
      // Vote synced - stop polling
      clearInterval(pollingIntervalRef.current);
      setSyncState((prev) => ({ ...prev, isPolling: false, isSynced: true }));
    }
  }
}, [syncState.isPolling, syncState.pollCount, selectedAction?.votes?.length, voteState.txHash]);
```

When the current vote count exceeds the count captured at submission time, the hook clears the polling interval and sets `syncState.isSynced = true`.

The UI transitions from the spinning "Syncing your vote..." indicator to a green checkmark with "Vote synced! You can view it in the voting records below."

---

## File Reference Index

### Frontend

| File | Role |
|------|------|
| `frontend/src/components/governance/VoteOnProposal.tsx` | Main voting component: tx build, sign, submit, polling loop, sync detection |
| `frontend/src/components/governance/VoteButtons.tsx` | Compact vote buttons variant (tx build + sign only, no polling) |
| `frontend/src/store/governanceSlice.ts` | Redux slice with `loadGovernanceActionDetail` async thunk (stale-while-revalidate pattern) |
| `frontend/src/services/api.ts` | `fetchGovernanceActionDetail()` - calls the Next.js proxy API |
| `frontend/src/config/api.ts` | API endpoint URL definitions |
| `frontend/src/pages/api/proposal/[id].ts` | Next.js proxy: forwards `GET /api/proposal/:id` to backend |

### Backend

| File | Role |
|------|------|
| `api/src/routes/proposal.route.ts` | Route: `GET /proposal/:proposal_id` |
| `api/src/controllers/proposal/getProposalDetails.ts` | Controller: triggers sync-on-read, queries DB, returns proposal detail |
| `api/src/services/syncOnRead.ts` | Sync-on-Read service: non-blocking background sync comparing DB vs Koios vote counts and voting power |
| `api/src/services/ingestion/proposal.service.ts` | Proposal ingestion: upserts proposal, triggers vote ingestion, updates voting power |
| `api/src/services/ingestion/vote.service.ts` | Vote ingestion: fetches votes from Koios `/vote_list`, creates/updates `OnchainVote` records |
| `api/src/libs/proposalMapper.ts` | Maps Prisma `Proposal` + `OnchainVote` to the API response shape |

### Database Schema

| File | Relevant Models |
|------|----------------|
| `api/prisma/schema.prisma` | `Proposal` (voting power fields, status), `OnchainVote` (vote records), `Drep`/`SPO`/`CC` (voter records) |
