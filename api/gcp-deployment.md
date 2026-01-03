# API GCP Deployment Guide

This guide covers deploying the Delegator Feedback API to Google Cloud Platform (GCP) Cloud Run.

## Overview

The API runs on GCP Cloud Run with Cloud SQL (PostgreSQL) for data storage. Cloud Scheduler handles cron jobs for syncing proposal and voter data.

### Architecture

```
GitHub Actions
     │
     ▼
┌─────────────────────┐
│  Artifact Registry  │  ← Docker image storage
└─────────────────────┘
     │
     ▼
┌─────────────────────┐      ┌─────────────────────┐
│  Cloud Run (API)    │ ──── │  Cloud SQL          │
└─────────────────────┘      │  (PostgreSQL)       │
     │                       └─────────────────────┘
     │
┌────┴────┐
│ Cloud   │
│Scheduler│  ← Cron jobs for proposal/voter sync
└─────────┘
```

### Cloud Scheduler Jobs

| Job | Schedule | Endpoint | Description |
|-----|----------|----------|-------------|
| `drep-proposal-sync` | Every 15 min | `POST /data/trigger-sync` | Sync proposals from Koios |
| `drep-voter-power-sync` | Daily at midnight | `POST /data/trigger-voter-sync` | Sync DRep/SPO voting power |

---

## Prerequisites

- [ ] GCP account with billing enabled
- [ ] `gcloud` CLI installed and authenticated
- [ ] Blockfrost API key (mainnet)
- [ ] Koios API key (optional but recommended)

---

## Step 1: GCP Infrastructure Setup

### 1.1 Set Environment Variables

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-south1"
export SERVICE_NAME="drep-delegator-api"
export REPOSITORY="drep-delegator-feedback"
export DB_INSTANCE="drep-delegator-feedback"
export VPC_CONNECTOR="drep-delegator-feedback"
```

### 1.2 Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudscheduler.googleapis.com \
  vpcaccess.googleapis.com \
  --project=$PROJECT_ID
```

### 1.3 Create Artifact Registry Repository

```bash
gcloud artifacts repositories create $REPOSITORY \
  --project=$PROJECT_ID \
  --location=$REGION \
  --repository-format=docker \
  --description="DRep Delegator Feedback System images"
```

### 1.4 Create Cloud SQL Instance

```bash
# Create PostgreSQL instance
gcloud sql instances create $DB_INSTANCE \
  --project=$PROJECT_ID \
  --region=$REGION \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --storage-size=10GB \
  --storage-auto-increase

# Create database
gcloud sql databases create drep_delegator \
  --instance=$DB_INSTANCE \
  --project=$PROJECT_ID

# Create user (save the password!)
gcloud sql users create api_user \
  --instance=$DB_INSTANCE \
  --password=YOUR_SECURE_PASSWORD \
  --project=$PROJECT_ID
```

### 1.5 Create VPC Connector

Cloud Run needs a VPC connector to access Cloud SQL via private IP:

```bash
gcloud compute networks vpc-access connectors create $VPC_CONNECTOR \
  --project=$PROJECT_ID \
  --region=$REGION \
  --range=10.8.0.0/28
```

### 1.6 Set Up Service Account

```bash
# Create service account
gcloud iam service-accounts create github-actions-sa \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions Service Account"

# Grant Cloud Run Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Grant Service Account User
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# Grant Cloud Scheduler Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudscheduler.admin"

# Grant Artifact Registry Writer
gcloud artifacts repositories add-iam-policy-binding $REPOSITORY \
  --project=$PROJECT_ID \
  --location=$REGION \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### 1.7 Set Up Workload Identity Federation

```bash
# Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project=$PROJECT_ID \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create OIDC Provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow GitHub repo to impersonate service account
# Replace YOUR_GITHUB_ORG/YOUR_REPO_NAME with your actual repo
gcloud iam service-accounts add-iam-policy-binding "github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_ORG/YOUR_REPO_NAME"

# Get the Workload Identity Provider resource name (save this!)
gcloud iam workload-identity-pools providers describe "github-provider" \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
```

---

## Step 2: GitHub Secrets Configuration

Go to your repository → Settings → Secrets and variables → Actions → New repository secret

| Secret | Description | Example |
|--------|-------------|---------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider resource name | `projects/123456/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | Service account email | `github-actions-sa@your-project.iam.gserviceaccount.com` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://api_user:password@/drep_delegator?host=/cloudsql/project:region:instance` |
| `MAINNET_BLOCKFROST_API_KEY` | Blockfrost API key | `mainnetXXX...` |
| `KOIOS_API_KEY` | Koios API key (optional) | `xxx...` |
| `SERVER_API_KEY` | Internal API key for cron jobs | Generate: `openssl rand -hex 32` |
| `JWT_SECRET` | JWT signing secret | Generate: `openssl rand -hex 32` |
| `ADMIN_WALLET_ADDRESSES` | Comma-separated admin wallet addresses | `addr1...,addr1...` |

### Database URL Format

```
postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

Example:
```
postgresql://api_user:mysecretpassword@/drep_delegator?host=/cloudsql/my-project:asia-south1:drep-delegator-feedback
```

---

## Step 3: Update Workflow Configuration

Edit `.github/workflows/deploy-api-gcp.yml` and update these values:

```yaml
env:
  PROJECT_ID: your-gcp-project-id      # Change this
  REGION: asia-south1                   # Change if needed
  SERVICE_NAME: drep-delegator-api
  ARTIFACT_REGISTRY: asia-south1-docker.pkg.dev  # Match your region
  REPOSITORY: drep-delegator-feedback
```

Also update the VPC connector and Cloud SQL instance names in the `gcloud run deploy` command if you used different names.

---

## Step 4: Deploy

### 4.1 Trigger Deployment

Push to the deployment branch:

```bash
git push origin gcp-deployment
```

The GitHub Actions workflow will:
1. Build the Docker image
2. Push to Artifact Registry
3. Deploy to Cloud Run
4. Create/update Cloud Scheduler jobs

### 4.2 Verify Deployment

```bash
# Get service URL
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(status.url)'

# Test health endpoint
curl https://YOUR_SERVICE_URL/health

# View API documentation
open https://YOUR_SERVICE_URL/api-docs
```

---

## Step 5: Database Migration

After the first deployment, run Prisma migrations:

```bash
# Connect to Cloud SQL via proxy (for local migration)
cloud_sql_proxy -instances=$PROJECT_ID:$REGION:$DB_INSTANCE=tcp:5432 &

# Run migrations
DATABASE_URL="postgresql://api_user:password@localhost:5432/drep_delegator" npx prisma migrate deploy
```

Or deploy migrations as part of your CI/CD pipeline.

---

## Maintenance

### View Logs

```bash
# View recent logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
  --project=$PROJECT_ID \
  --limit=100

# Stream logs
gcloud beta run services logs tail $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID
```

### Manual Trigger Sync Jobs

```bash
# Trigger proposal sync
curl -X POST https://YOUR_SERVICE_URL/data/trigger-sync \
  -H "X-API-Key: YOUR_SERVER_API_KEY"

# Trigger voter power sync
curl -X POST https://YOUR_SERVICE_URL/data/trigger-voter-sync \
  -H "X-API-Key: YOUR_SERVER_API_KEY"
```

### Check Cloud Scheduler Jobs

```bash
# List jobs
gcloud scheduler jobs list --location=$REGION --project=$PROJECT_ID

# View job details
gcloud scheduler jobs describe drep-proposal-sync --location=$REGION --project=$PROJECT_ID

# Manually run a job
gcloud scheduler jobs run drep-proposal-sync --location=$REGION --project=$PROJECT_ID
```

### Scale Configuration

The default configuration:
- Memory: 1GB
- CPU: 1
- Min instances: 0 (scale to zero)
- Max instances: 10
- Timeout: 900s (15 min)

To modify, update the `gcloud run deploy` command in the workflow.

---

## Troubleshooting

### Deployment fails with permission error

Ensure the service account has all required roles:

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"
```

### Cannot connect to Cloud SQL

1. Verify VPC connector exists and is configured
2. Check the Cloud SQL instance connection name format
3. Ensure database credentials are correct

### Cloud Scheduler jobs failing

1. Check the `SERVER_API_KEY` matches between Cloud Scheduler and the API
2. Verify the Cloud Run service URL is correct
3. Check Cloud Run logs for errors

### Rate limit errors (429)

The API has built-in rate limiting. If you see 429 errors from Koios:
- Reduce sync frequency in Cloud Scheduler
- Add `KOIOS_API_KEY` for higher rate limits

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `MAINNET_BLOCKFROST_API_KEY` | Yes | Blockfrost API key |
| `SERVER_API_KEY` | Yes | Internal API key for cron jobs |
| `JWT_SECRET` | Yes | JWT signing secret |
| `ADMIN_WALLET_ADDRESSES` | Yes | Admin wallet addresses |
| `KOIOS_API_KEY` | No | Koios API key for higher rate limits |
| `KOIOS_BASE_URL` | No | Koios API URL (default: `https://api.koios.rest/api/v1`) |
| `RATE_LIMIT_WINDOW_MS` | No | Rate limit window (default: 60000) |
| `RATE_LIMIT_MAX_REQUESTS` | No | Max requests per window (default: 100) |
| `JWT_EXPIRY_SECONDS` | No | JWT token expiry (default: 604800 = 7 days) |
| `DISABLE_CRON_IN_API` | No | Disable in-process cron (default: true for Cloud Run) |

---

## Support

For issues or questions:
- Open an issue on GitHub
- Join the community Discord server