# Discord Bot GCP Deployment Guide

This guide walks DReps through deploying the Delegator Feedback Discord Bot to Google Cloud Platform (GCP) Compute Engine.

## Overview

The Discord bot runs on a GCP Compute Engine e2-micro instance with Container-Optimized OS. GitHub Actions handles CI/CD - pushing to the deployment branch automatically builds and deploys the bot.

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
┌─────────────────────┐
│  Compute Engine     │  ← e2-micro + Container-Optimized OS
│  (Discord Bot)      │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Central API        │  ← Shared API service
└─────────────────────┘
```

---

## Prerequisites

Before starting, ensure you have:

- [ ] A GCP account with billing enabled
- [ ] `gcloud` CLI installed and authenticated
- [ ] A Discord server where you have admin permissions
- [ ] A registered DRep with an API key (from the central API)

---

## Step 1: Discord Bot Setup

### 1.1 Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to "Bot" section and click "Add Bot"
4. Copy the **Bot Token** (you'll need this later)
5. Under "Privileged Gateway Intents", enable:
   - Server Members Intent
   - Message Content Intent

### 1.2 Get Discord IDs

Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode), then:

1. **Client ID**: Found in Discord Developer Portal → General Information
2. **Guild ID**: Right-click your server → Copy Server ID
3. **Forum Channel ID**: Right-click your forum channel → Copy Channel ID
4. **Delegate Channel ID**: Right-click your verification text channel → Copy Channel ID
5. **Role ID**: Right-click the delegator role → Copy Role ID

### 1.3 Create Forum Tags (Optional)

In your forum channel settings, create tags for each proposal type:

- Parameter Change
- Hard Fork Initiation
- Treasury Withdrawals
- No Confidence
- New Committee
- New Constitution
- Info Action

Copy each tag's ID (right-click → Copy Tag ID).

### 1.4 Invite Bot to Server

Generate an invite URL in Discord Developer Portal → OAuth2 → URL Generator:

- Scopes: `bot`, `applications.commands`
- Permissions: `Send Messages`, `Manage Messages`, `Embed Links`, `Read Message History`, `Use Slash Commands`, `Manage Roles`, `Create Public Threads`, `Send Messages in Threads`

---

## Step 2: GCP Setup

### 2.1 Set Environment Variables

```bash
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-south1"  # Change to your preferred region
export ZONE="asia-south1-a"
export VM_NAME="delegator-feedback-discord-bot"
export REPOSITORY="delegator-feedback-discord-bot"
```

### 2.2 Create Artifact Registry Repository

```bash
gcloud artifacts repositories create $REPOSITORY \
  --project=$PROJECT_ID \
  --location=$REGION \
  --repository-format=docker \
  --description="Discord bot container images"
```

### 2.3 Create Compute Engine VM

```bash
gcloud compute instances create $VM_NAME \
  --project=$PROJECT_ID \
  --zone=$ZONE \
  --machine-type=e2-micro \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --boot-disk-size=10GB \
  --tags=discord-bot \
  --scopes=https://www.googleapis.com/auth/cloud-platform
```

### 2.4 Configure Docker Credentials on VM

SSH into the VM and configure Docker to pull from Artifact Registry:

```bash
gcloud compute ssh $VM_NAME --zone=$ZONE --command="docker-credential-gcr configure-docker --registries=${REGION}-docker.pkg.dev"
```

### 2.5 Set Up Workload Identity Federation (for GitHub Actions)

Create a service account:

```bash
gcloud iam service-accounts create github-actions-sa \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions Service Account"
```

Grant necessary roles:

```bash
# Artifact Registry Writer
gcloud artifacts repositories add-iam-policy-binding $REPOSITORY \
  --project=$PROJECT_ID \
  --location=$REGION \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Compute Instance Admin (for SSH)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin.v1"

# Service Account User
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

Create Workload Identity Pool:

```bash
gcloud iam workload-identity-pools create "github-pool" \
  --project=$PROJECT_ID \
  --location="global" \
  --display-name="GitHub Actions Pool"

gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

Allow GitHub repo to impersonate the service account:

```bash
gcloud iam service-accounts add-iam-policy-binding "github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-pool/attribute.repository/YOUR_GITHUB_ORG/YOUR_REPO_NAME"
```

Get the Workload Identity Provider resource name:

```bash
gcloud iam workload-identity-pools providers describe "github-provider" \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
```

---

## Step 3: GitHub Repository Setup

### 3.1 Fork/Clone Repository

Fork or clone the repository to your GitHub account.

### 3.2 Configure GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

| Secret                           | Description                              | Example                                                                                        |
| -------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Provider resource name | `projects/123456/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT`            | Service account email                    | `github-actions-sa@your-project.iam.gserviceaccount.com`                                       |
| `DISCORD_BOT_TOKEN`              | Discord bot token                        | `MTIz...`                                                                                      |
| `DISCORD_CLIENT_ID`              | Discord application client ID            | `1234567890`                                                                                   |
| `DISCORD_GUILD_ID`               | Discord server ID                        | `1234567890`                                                                                   |
| `API_KEY`                        | DRep API key from central API            | `drep_sk_...`                                                                                  |
| `DREP_ID`                        | Your DRep ID                             | `drep1...`                                                                                     |
| `VERIFICATION_FRONTEND_URL`      | Your verification frontend URL           | `https://your-domain.com`                                                                      |
| `FORUM_CHANNEL_ID`               | Discord forum channel ID                 | `1234567890`                                                                                   |
| `DELEGATE_CHANNEL_ID`            | Discord verification channel ID          | `1234567890`                                                                                   |
| `ROLE_ID_DELEGATED`              | Discord delegator role ID                | `1234567890`                                                                                   |
| `TAG_ID_PARAMETER_CHANGE`        | Forum tag ID                             | `1234567890`                                                                                   |
| `TAG_ID_HARD_FORK_INITIATION`    | Forum tag ID                             | `1234567890`                                                                                   |
| `TAG_ID_TREASURY_WITHDRAWALS`    | Forum tag ID                             | `1234567890`                                                                                   |
| `TAG_ID_NO_CONFIDENCE`           | Forum tag ID                             | `1234567890`                                                                                   |
| `TAG_ID_NEW_COMMITTEE`           | Forum tag ID                             | `1234567890`                                                                                   |
| `TAG_ID_NEW_CONSTITUTION`        | Forum tag ID                             | `1234567890`                                                                                   |
| `TAG_ID_INFO_ACTION`             | Forum tag ID                             | `1234567890`                                                                                   |

### 3.3 Update Workflow Configuration

Edit `.github/workflows/deploy-discord-bot-gcp.yml` and update these values:

```yaml
env:
  PROJECT_ID: your-gcp-project-id # Change this
  REGION: asia-south1 # Change if needed
  ZONE: asia-south1-a # Change if needed
  SERVICE_NAME: delegator-feedback-discord-bot
  ARTIFACT_REGISTRY: asia-south1-docker.pkg.dev # Match your region
  REPOSITORY: delegator-feedback-discord-bot
  VM_NAME: delegator-feedback-discord-bot
```

---

## Step 4: Deploy

### 4.1 Trigger Deployment

Push to the `main` branch:

```bash
git push origin main
```

The GitHub Actions workflow will:

1. Build the Docker image
2. Push to Artifact Registry
3. SSH into the VM and deploy the container

### 4.2 Verify Deployment

Check if the container is running:

```bash
gcloud compute ssh $VM_NAME --zone=$ZONE --command="docker ps"
```

View logs:

```bash
gcloud compute ssh $VM_NAME --zone=$ZONE --command="docker logs delegator-feedback-discord-bot"
```

Follow logs in real-time:

```bash
gcloud compute ssh $VM_NAME --zone=$ZONE --command="docker logs -f delegator-feedback-discord-bot"
```

---

## Troubleshooting

### Container not starting

Check logs for errors:

```bash
gcloud compute ssh $VM_NAME --zone=$ZONE --command="docker logs delegator-feedback-discord-bot"
```

### Permission denied pushing to Artifact Registry

Ensure the service account has `roles/artifactregistry.writer`:

```bash
gcloud artifacts repositories add-iam-policy-binding $REPOSITORY \
  --project=$PROJECT_ID \
  --location=$REGION \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

### SSH connection failed

Ensure the service account has compute instance access:

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/compute.instanceAdmin.v1"
```

### Proposal sync not working

Check if `FORUM_CHANNEL_ID` is set correctly. The bot logs will show:

```
[Bot] FORUM_CHANNEL_ID not set - proposal sync disabled
```

### Bot not responding to commands

1. Ensure the bot has proper permissions in Discord
2. Check if slash commands are registered (may take up to an hour)
3. Verify `DISCORD_GUILD_ID` is correct

---

## Maintenance

### View Logs

```bash
gcloud compute ssh $VM_NAME --zone=$ZONE --command="docker logs -f delegator-feedback-discord-bot"
```

### Restart Container

```bash
gcloud compute ssh $VM_NAME --zone=$ZONE --command="docker restart delegator-feedback-discord-bot"
```

### Rollback to Previous Version

```bash
gcloud compute ssh $VM_NAME --zone=$ZONE --command="
  docker stop delegator-feedback-discord-bot
  docker rm delegator-feedback-discord-bot
  docker run -d --name delegator-feedback-discord-bot --restart unless-stopped \
    -e DISCORD_BOT_TOKEN='...' \
    -e ... \
    ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/delegator-feedback-discord-bot:<previous-sha>
"
```

### Update Environment Variables

To update environment variables, redeploy via GitHub Actions or manually:

```bash
gcloud compute ssh $VM_NAME --zone=$ZONE --command="
  docker stop delegator-feedback-discord-bot
  docker rm delegator-feedback-discord-bot
  docker run -d --name delegator-feedback-discord-bot --restart unless-stopped \
    -e DISCORD_BOT_TOKEN='new-value' \
    ... \
    ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/delegator-feedback-discord-bot:latest
"
```

---

## Support

For issues or questions:

- Open an issue on GitHub
- Join the community Discord server
