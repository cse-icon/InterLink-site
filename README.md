# InterLink Product Site

Product marketing site and public roadmap for **CSE ICON InterLink**

**Live URL:** https://interlink.products.cse-icon.com

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Repository Structure](#repository-structure)
- [Initial Setup](#initial-setup)
  - [Prerequisites](#prerequisites)
  - [1. GitHub Repository Setup](#1-github-repository-setup)
  - [2. GitHub Pages Setup](#2-github-pages-setup)
  - [3. DNS Configuration](#3-dns-configuration)
  - [4. Azure Resources Setup](#4-azure-resources-setup)
  - [5. GitHub Projects Board Setup](#5-github-projects-board-setup)
  - [6. GitHub App for Roadmap Sync](#6-github-app-for-roadmap-sync)
  - [7. Configure Repository Secrets & Variables](#7-configure-repository-secrets--variables)
  - [8. First Deployment](#8-first-deployment)
- [Local Development](#local-development)
- [How to Push Updates](#how-to-push-updates)
  - [Updating Site Content or Features](#updating-site-content-or-features)
  - [Updating the Roadmap](#updating-the-roadmap)
  - [Updating the Vote API](#updating-the-vote-api)
  - [Manual Deployments](#manual-deployments)
- [Voting System](#voting-system)
  - [How It Works](#how-it-works)
  - [Anti-Spam Measures](#anti-spam-measures)
  - [Azure Table Schema](#azure-table-schema)
  - [API Endpoints](#api-endpoints)
- [Roadmap Sync](#roadmap-sync)
  - [GitHub Projects Field Requirements](#github-projects-field-requirements)
  - [Sync Behavior](#sync-behavior)
- [Estimated Azure Costs](#estimated-azure-costs)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub (cse-icon org)                    │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │  Main Branch  │───▶│ GitHub Pages │───▶│  Static Site      │  │
│  │  (push)       │    │ (deploy)     │    │  Astro + Tailwind │  │
│  └──────────────┘    └──────────────┘    └───────────────────┘  │
│         │                                         │             │
│         │ (api/ changes)          (vote requests)  │            │
│         ▼                                         ▼             │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │ GitHub Action │───▶│        Azure Function App            │   │
│  │ (deploy func) │    │  POST /api/vote  GET /api/vote/{id}  │   │
│  └──────────────┘    └──────────────┬───────────────────────┘   │
│                                     │                           │
│  ┌──────────────┐    ┌──────────────▼───────────────────────┐   │
│  │ GitHub Action │    │     Azure Table Storage              │   │
│  │ (daily sync)  │    │  votes table  │  votecounts table    │   │
│  └──────┬───────┘    └──────────────────────────────────────┘   │
│         │                                                       │
│  ┌──────▼───────┐                                               │
│  │ GitHub       │                                               │
│  │ Projects v2  │  (private board, public items synced daily)   │
│  └──────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Technology | Hosted On |
|---|---|---|
| Static site | Astro (SSG) + Tailwind CSS | GitHub Pages |
| Vote API | Azure Functions v4 (Node.js / TypeScript) | Azure (Flex Consumption) |
| Vote storage | Azure Table Storage | Azure Storage Account |
| Roadmap data | GitHub Projects v2 → JSON via GitHub Action | Committed to repo |
| CI/CD | GitHub Actions | GitHub |

---

## Repository Structure

```
InterLink-site/
├── .github/workflows/
│   ├── deploy-site.yml          # Build Astro → deploy to GitHub Pages
│   ├── deploy-functions.yml     # Build & deploy Azure Functions
│   └── sync-roadmap.yml         # Pull roadmap from GitHub Projects (daily)
├── api/
│   ├── vote/index.ts            # POST /api/vote + GET /api/vote/{itemId}
│   ├── host.json                # Azure Functions runtime config
│   ├── local.settings.json      # Local dev settings (not committed in prod)
│   ├── package.json
│   └── tsconfig.json
├── public/
│   ├── CNAME                    # Custom domain for GitHub Pages
│   └── favicon.svg
├── scripts/
│   └── sync-roadmap.mjs         # Fetches roadmap from GitHub Projects GraphQL API
├── src/
│   ├── components/
│   │   ├── FeatureCard.astro    # Individual feature card
│   │   ├── FeatureSection.astro # Topic section (heading + grid of cards)
│   │   ├── Hero.astro           # Landing page hero
│   │   ├── RoadmapBoard.astro   # Kanban board with category filtering
│   │   ├── RoadmapItem.astro    # Single roadmap card
│   │   └── VoteButton.astro     # Vote modal (client-side JS)
│   ├── data/
│   │   ├── roadmap.json         # Roadmap items (auto-synced or manual)
│   │   └── roadmap-meta.json    # Sync metadata (lastUpdated timestamp)
│   ├── layouts/
│   │   └── BaseLayout.astro     # Shared shell: nav, footer, dark mode, meta
│   ├── pages/
│   │   ├── index.astro          # Product features page
│   │   └── roadmap.astro        # Roadmap + voting page
│   └── styles/
│       └── global.css           # Tailwind directives + custom component classes
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
├── package.json
└── site.md                      # Original build specification
```

---

## Initial Setup

### Prerequisites

- **Node.js 24** (LTS) — [download](https://nodejs.org/)
- **Azure CLI** — [install](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)
- **Azure Functions Core Tools v4** — [install](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- **GitHub CLI** (optional, for testing) — [install](https://cli.github.com/)
- Admin access to the `cse-icon` GitHub organization
- An Azure subscription with permission to create resources

---

### 1. GitHub Repository Setup

The repo lives in the `cse-icon` org. If it isn't there yet:

```bash
# Push to the org
git remote add origin https://github.com/cse-icon/InterLink-site.git
git push -u origin main
```

---

### 2. GitHub Pages Setup

1. Go to **Settings → Pages** in the GitHub repo
2. Under **Build and deployment**:
   - **Source**: select **GitHub Actions** (not "Deploy from a branch")
3. Under **Custom domain**:
   - Enter `interlink.products.cse-icon.com`
   - Check **Enforce HTTPS**
4. GitHub will verify the domain — this requires the DNS step below

---

### 3. DNS Configuration

Add a CNAME record in your DNS provider (wherever `cse-icon.com` is managed):

| Type | Name | Value | TTL |
|---|---|---|---|
| CNAME | `interlink.products` | `cse-icon.github.io` | 3600 |

To verify it's working:

```bash
dig interlink.products.cse-icon.com +short
# Should return: cse-icon.github.io
```

GitHub will automatically provision an SSL certificate once DNS propagates (usually 5–30 minutes).

---

### 4. Azure Resources Setup

You need three Azure resources. All can live in a single resource group.

#### 4a. Create a Resource Group

```bash
az login
az group create --name rg-interlink-site --location eastus
```

#### 4b. Create a Storage Account

This stores the vote data in Table Storage.

```bash
az storage account create \
  --name cseinterlink \
  --resource-group InterLink \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2
```

Get the connection string (you'll need this later):

```bash
az storage account show-connection-string \
  --name interlinkvotest \
  --resource-group InterLink \
  --query connectionString \
  --output tsv
```

Save this value — it goes into the Function App settings as `AZURE_STORAGE_CONNECTION_STRING`.

#### 4c. Create a Function App

Use the **Flex Consumption** hosting plan — it scales to zero (no cost when idle), has fast cold starts, and includes a generous free grant.

**Via the Azure Portal (recommended):**

1. Go to **Function App → Create**
2. Select **Flex Consumption** as the hosting plan
3. Fill in:
   - **Function App name:** `cse-interlink-votes`
   - **Resource Group:** `InterLink`
   - **Runtime stack:** Node.js
   - **Version:** 24
   - **Region:** South Central US
   - **Instance size:** 512 MB
   - **Storage account:** select `cseinterlink` from step 4b
4. Review + Create

**Or via CLI:**

```bash
az functionapp create \
  --name cse-interlink-votes \
  --resource-group InterLink \
  --storage-account cseinterlink \
  --flexconsumption-location eastus \
  --runtime node \
  --runtime-version 24
```

#### 4d. Configure Function App Settings

```bash
# Get your storage connection string from step 4b
CONN_STRING="<your-connection-string-from-4b>"

az functionapp config appsettings set \
  --name interlink-votes \
  --resource-group rg-interlink-site \
  --settings \
    "AZURE_STORAGE_CONNECTION_STRING=$CONN_STRING" \
    "SITE_URL=https://interlink.products.cse-icon.com"
```

The `SITE_URL` setting controls the CORS origin — only requests from your site domain are accepted.

#### 4e. Set Up Azure Service Principal for GitHub Actions

Flex Consumption apps don't support publish profile auth. Instead, create a **service principal with federated credentials** so GitHub Actions can deploy securely without storing secrets.

**Create an App Registration and service principal:**

```bash
# Create the app registration
az ad app create --display-name "InterLink GitHub Deploy"
# Note the "appId" from the output — you'll need it for every step below

# Create the service principal
az ad sp create --id <appId>
```

**Grant it the minimum required role on the Function App only:**

```bash
az role assignment create \
  --assignee <appId> \
  --role "Website Contributor" \
  --scope /subscriptions/<subscription-id>/resourceGroups/InterLink/providers/Microsoft.Web/sites/cse-interlink-votes
```

> **Why Website Contributor?** It grants permission to manage the Function App (deploy code, read settings) without access to other resources in the resource group. This follows least-privilege — the service principal can't touch the storage account, other apps, or resource group settings.

**Add a federated credential for GitHub Actions:**

This lets GitHub Actions authenticate using OIDC — no client secrets to rotate.

**Via the Azure Portal (recommended):**

1. Go to **Microsoft Entra ID → App registrations** → select **InterLink GitHub Deploy**
2. In the sidebar, click **Certificates & secrets**
3. Click the **Federated credentials** tab → **Add credential**
4. For **Federated credential scenario**, select **GitHub Actions deploying Azure resources**
5. Fill in:
   - **Organization:** `cse-icon`
   - **Repository:** `InterLink-site`
   - **Entity type:** Branch
   - **GitHub branch name:** `main`
   - **Name:** `github-deploy`
6. Click **Add**

**Or via CLI:**

```bash
az ad app federated-credential create --id <appId> --parameters '{
  "name": "github-deploy",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:cse-icon/InterLink-site:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

> **Note:** The credential is scoped to the `main` branch. If you need to deploy from other branches, add additional federated credentials with the appropriate branch name.

**Gather these three values for step 7:**

| Value | Where to find it |
|---|---|
| **Client ID** | The `appId` from the app registration |
| **Tenant ID** | Run `az account show --query tenantId -o tsv` |
| **Subscription ID** | Run `az account show --query id -o tsv` |

---

### 5. GitHub Projects Board Setup

The roadmap page is powered by a GitHub Projects v2 board. Create one in the `cse-icon` org:

1. Go to https://github.com/orgs/cse-icon/projects → **New project**
2. Name it something like "InterLink Roadmap"
3. Note the **project number** from the URL (e.g., `https://github.com/orgs/cse-icon/projects/5` → number is `5`)

#### Required Custom Fields

Add these custom fields to the project:

| Field Name | Type | Values / Notes |
|---|---|---|
| `Public Status` | Single select | `Backlog`, `Investigating`, `In Development`, `Released` |
| `Public?` | Single select | Single value: `Yes` — leave blank to exclude from the site |
| `Public Released In` | Text | Version string, e.g., `v2.1.0` |
| `Public Category` | Single select | `PI`, `OPC UA`, `Federation`, `Platform`, `Configuration`, `Security` |
| `Public Summary` | Text | Public-facing description (shown on the site instead of issue body) |

---

### 6. GitHub App for Roadmap Sync

The sync action needs a token to read the private project board. A **GitHub App** is the recommended approach — it's owned by the org (not tied to any individual's account), has granular permissions, and won't break if someone leaves.

#### 6a. Create the App

1. Go to https://github.com/organizations/cse-icon/settings/apps → **New GitHub App**
2. Fill in:
   - **Name:** `InterLink Roadmap Sync`
   - **Homepage URL:** `https://interlink.products.cse-icon.com`
   - **Webhook:** uncheck "Active" (we don't need webhook events)
3. Under **Permissions → Organization permissions:**
   - **Projects:** Read-only
4. Under **Where can this GitHub App be installed?**
   - Select "Only on this account"
5. Click **Create GitHub App**

#### 6b. Generate a Private Key

1. On the app's settings page, scroll to **Private keys**
2. Click **Generate a private key** — a `.pem` file will download
3. Keep this file safe; you'll need its contents for a GitHub secret

#### 6c. Install the App on the Org

1. On the app's settings page, click **Install App** in the sidebar
2. Install it on the `cse-icon` organization

#### 6d. Note the App ID and Installation ID

- **App ID:** shown at the top of the app's **General** settings page
- **Installation ID:** after installing, go to https://github.com/organizations/cse-icon/settings/installations — click **Configure** next to the app — the installation ID is the number at the end of the URL (e.g., `.../installations/12345678` → `12345678`)

---

### 7. Configure Repository Secrets & Variables

Go to the repo **Settings → Secrets and variables → Actions**.

#### Secrets (Settings → Secrets → Actions → New repository secret)

| Secret Name | Value | Used By |
|---|---|---|
| `APP_PRIVATE_KEY` | Contents of the `.pem` file from step 6b | `sync-roadmap.yml` |

#### Variables (Settings → Secrets and variables → Actions → Variables tab → New repository variable)

| Variable Name | Value | Used By |
|---|---|---|
| `PROJECT_NUMBER` | The project number from step 5 (e.g., `5`) | `sync-roadmap.yml` |
| `APP_ID` | The GitHub App ID from step 6d | `sync-roadmap.yml` |
| `APP_INSTALLATION_ID` | The installation ID from step 6d | `sync-roadmap.yml` |
| `AZURE_CLIENT_ID` | The App Registration client ID from step 4e | `deploy-functions.yml` |
| `AZURE_TENANT_ID` | Your Entra tenant ID from step 4e | `deploy-functions.yml` |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID from step 4e | `deploy-functions.yml` |

---

### 8. First Deployment

Once all the above is configured:

```bash
# Install site dependencies
npm install

# Verify it builds locally
npm run build

# Push to main — this triggers the deploy-site workflow
git add -A
git commit -m "Initial site deployment"
git push origin main
```

Then trigger the other workflows manually for the first time:

1. Go to **Actions → Sync Roadmap → Run workflow** (populates roadmap from your project board)
2. Go to **Actions → Deploy Azure Functions → Run workflow** (deploys the vote API)

After a few minutes, visit https://interlink.products.cse-icon.com and verify:

- Product features page loads
- Roadmap page shows items in kanban columns
- Dark mode toggle works
- Vote buttons open the modal

---

## Local Development

### Local Install

```bash
npm install
cd api
npm install
```

### Site + Vote API

```bash
# Terminal 1 — Astro dev server
npm run dev
# → Site available at http://localhost:4321

# Terminal 2 — Azure Function + Azurite + TypeScript watch (all in one)
cd api
npm run dev
# → API available at http://localhost:7071
```

`npm run dev` in the `api/` directory starts three processes together:
- **Azurite** — local Azure Table Storage emulator
- **TypeScript watch** — recompiles on save
- **Azure Functions runtime** — serves the API

When running both locally, the vote button will show "Voting API not configured yet" unless you create a `.env` file in the project root:

```bash
# .env (project root, not committed)
PUBLIC_VOTE_API_URL=http://localhost:7071
```

### Running tests

```bash
npm test           # Run all tests once
npm run test:watch # Run tests in watch mode (re-runs on file changes)
```

---

## How to Push Updates

### Updating Site Content or Features

Any changes to files in `src/`, `public/`, `astro.config.mjs`, `tailwind.config.mjs`, or the root `package.json` will trigger an automatic deployment.

```bash
# Make your changes, then:
git add src/components/Hero.astro   # (or whatever you changed)
git commit -m "Update hero tagline"
git push origin main
```

The **Deploy Site** workflow runs automatically. Typical deploy time: ~1 minute. Monitor progress at **Actions → Deploy Site** in the repo.

To update feature content (titles, descriptions), edit [src/pages/index.astro](src/pages/index.astro) — all feature data is defined inline in the `sections` array in the frontmatter.

### Updating the Roadmap

There are two ways roadmap items appear on the site:

#### Automatic (recommended)

1. Go to your GitHub Projects board
2. Add or edit an item
3. Set `Public` = checked, fill in `Summary`, `Category`, and `Status`
4. The **Sync Roadmap** action runs daily at 6:00 AM UTC and commits any changes
5. That commit triggers the **Deploy Site** action automatically

To force an immediate sync: **Actions → Sync Roadmap → Run workflow**.

#### Manual

Edit [src/data/roadmap.json](src/data/roadmap.json) directly and push. Useful for tweaking vote counts or testing.

### Updating the Vote API

Changes to any files under `api/` trigger the **Deploy Azure Functions** workflow:

```bash
git add api/vote/index.ts
git commit -m "Update vote API response message"
git push origin main
```

### Manual Deployments

All three workflows support `workflow_dispatch` — you can trigger any of them manually from the **Actions** tab without pushing code.

---

## Voting System

### How It Works

1. User clicks **Vote** on a roadmap item
2. A modal asks for their email address
3. The static site sends `POST /api/vote` with `{ itemId, email }` to the Azure Function
4. The function normalizes the email (lowercase, strips `+alias` tags) and checks for duplicate votes
5. If new, the vote is recorded immediately and the count is incremented
6. The UI updates the count on the card in real time

Emails are stored so the sales team can identify interested users. The `originalEmail` field preserves what the user typed; the normalized version is used as the dedup key.

### Anti-Spam Measures

| Measure | Details |
|---|---|
| **Plus-alias stripping** | `damon+fake@gmail.com` and `damon@gmail.com` are treated as the same voter |
| **One vote per email per item** | Duplicate attempts return HTTP 409 |
| **CORS restriction** | API only accepts requests from `interlink.products.cse-icon.com` |
| **Email validation** | Basic format check before processing |

### Azure Table Schema

**`votes` table** — one row per vote

| Column | Type | Description |
|---|---|---|
| `partitionKey` | string | Roadmap item ID |
| `rowKey` | string | Normalized email (dedup key) |
| `originalEmail` | string | Email as the user entered it |
| `timestamp` | string | ISO 8601 timestamp |

**`votecounts` table** — denormalized counts for fast reads

| Column | Type | Description |
|---|---|---|
| `partitionKey` | string | Always `"counts"` |
| `rowKey` | string | Roadmap item ID |
| `count` | number | Total confirmed votes |

### API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/vote` | Submit a vote. Body: `{ "itemId": "1", "email": "user@co.com" }` |
| `GET` | `/api/vote/{itemId}` | Get vote count for an item. Returns: `{ "itemId": "1", "count": 42 }` |
| `OPTIONS` | `/api/vote` | CORS preflight |

---

## Roadmap Sync

### GitHub Projects Field Requirements

The sync script ([scripts/sync-roadmap.mjs](scripts/sync-roadmap.mjs)) queries the GitHub Projects v2 GraphQL API and expects these exact field names:

| Field | Required | Purpose |
|---|---|---|
| `Public Status` | Yes | Maps to kanban columns |
| `Public?` | Yes | Only items set to `Yes` are synced |
| `Public Summary` | Yes | Public-facing description |
| `Public Category` | Yes | Category badge on cards |
| `Public Released In` | No | Version badge for released items |

### Sync Behavior

- Runs daily at **6:00 AM UTC** via cron, or on manual trigger
- Only items where `Public` = true are included
- Preserves existing vote counts from the current `roadmap.json`
- Writes `roadmap-meta.json` with a `lastUpdated` timestamp (displayed on the roadmap page)
- Only commits + pushes if the data actually changed
- The commit from sync automatically triggers the site deploy workflow

---

## Estimated Azure Costs

| Resource | SKU | Monthly Cost |
|---|---|---|
| Azure Function App | Flex Consumption | Free (first 100K executions/month included) |
| Azure Storage Account | General Purpose v2, LRS | ~$0.01 |
| **Total** | | **~$0.01/month** |

---

## Troubleshooting

### Site deploy fails with "Pages not enabled"

Go to **Settings → Pages → Source** and select **GitHub Actions**. The workflow needs the Pages environment to exist.

### Sync roadmap action fails with "Project not found"

- Verify `PROJECT_NUMBER` variable matches the number in your project URL
- Verify the GitHub App has **Projects: Read-only** under Organization permissions
- Verify the App is installed on the `cse-icon` org (https://github.com/organizations/cse-icon/settings/installations)
- Verify `APP_ID`, `APP_INSTALLATION_ID` variables and `APP_PRIVATE_KEY` secret are set correctly
- If the App was recently created, it may take a few minutes for permissions to propagate

### Votes return CORS errors

The Azure Function's CORS origin is set via the `SITE_URL` environment variable. Verify it's set to `https://interlink.products.cse-icon.com` in the Function App configuration:

```bash
az functionapp config appsettings list \
  --name interlink-votes \
  --resource-group rg-interlink-site \
  --query "[?name=='SITE_URL']"
```

### Vote button shows "Voting API not configured yet"

The site needs the `PUBLIC_VOTE_API_URL` environment variable. For production, you can hardcode the URL or set it in your build environment. Create a `.env` file:

```
PUBLIC_VOTE_API_URL=https://interlink-votes.azurewebsites.net
```

Then rebuild and deploy.

### Azure Function deploy fails with 401 Unauthorized

This means the OIDC authentication between GitHub Actions and Azure isn't working:

- Verify `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` variables are set correctly in the repo
- Verify the service principal has **Website Contributor** role on the Function App:
  ```bash
  az role assignment list --assignee <client-id> --scope /subscriptions/<sub-id>/resourceGroups/InterLink/providers/Microsoft.Web/sites/cse-interlink-votes
  ```
- Verify the federated credential subject matches your repo and branch:
  ```bash
  az ad app federated-credential list --id <client-id>
  ```
  The `subject` must be `repo:cse-icon/InterLink-site:ref:refs/heads/main`
- If deploying from a workflow_dispatch on a non-main branch, you need an additional federated credential for that branch

### Dark mode flickers on page load

This shouldn't happen — the theme script runs inline in `<head>` before paint. If it does, check that the script in `BaseLayout.astro` hasn't been moved to a deferred/async position.
