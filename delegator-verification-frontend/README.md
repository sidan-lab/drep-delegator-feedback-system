# Delegator Verification Frontend

Frontend application for DRep delegators to verify their wallet and link to Discord for governance feedback participation.

## Overview

This frontend is deployed by each DRep who wants to collect sentiment from their delegators. It allows delegators to:

1. Connect their Cardano wallet
2. Delegate to the DRep (if not already)
3. Verify their delegation and link to their Discord account

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_DREP_ID` | Your DRep ID in CIP-129 format |
| `NEXT_PUBLIC_DREP_NAME` | Display name for your DRep |
| `NEXT_PUBLIC_API_BASE_URL` | URL of the central API |
| `API_KEY` | Your DRep's API key (from registration) |
| `BLOCKFROST_KEY` | Blockfrost API key for checking delegation |
| `NEXT_PUBLIC_DISCORD_CHANNEL_LINK` | Link to your Discord governance channel |

### 3. Run Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:3002`

### 4. Build for Production

```bash
npm run build
npm start
```

## How It Works

### Verification Flow

1. Delegator uses `/verify` command in Discord
2. Bot sends personalized link: `https://your-domain.com/verify/{discordId}`
3. Delegator connects wallet on this frontend
4. Frontend checks delegation status via Blockfrost
5. If not delegated, delegator can delegate directly
6. Once delegated, delegator clicks "Verify & Connect"
7. Frontend sends verification to central API
8. Delegator returns to Discord and confirms

### API Endpoints

**Internal (Next.js API routes):**
- `POST /api/checkDelegation` - Check if wallet is delegating to DRep
- `POST /api/delegateToDRep` - Build delegation transaction

**External (Central API):**
- `POST /sentiment/delegator/verify` - Register verified delegator

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

### Docker

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

## Customization

### Branding

Edit `src/lib/text.ts` to customize:
- Page titles
- Instructions
- Button labels
- Error messages

### Styling

The frontend uses Tailwind CSS. Modify:
- `tailwind.config.ts` for theme colors
- `src/styles/globals.css` for CSS variables
