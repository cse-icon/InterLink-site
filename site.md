# InterLink Product Site — Build Plan

> This document is the complete spec for building the InterLink marketing/product site.
> Drop it in the root of a new repo and tell Claude Code to build it.

## Prompt for Claude Code

> Build a product marketing site for CSE ICON InterLink based on the plan in site.md. Read it fully before starting. Build everything — Astro site, Azure Function, GitHub Actions. Make it production-ready.

---

## Architecture

- **Static site**: Astro (SSG mode), deployed to GitHub Pages
- **Domain**: `interlink.cse-icon.com` (CNAME to GitHub Pages)
- **Voting backend**: Azure Functions (Node.js/TypeScript) + Azure Table Storage
- **Roadmap data**: Synced from a private GitHub Project board via GitHub Actions
- **Repo structure**: Monorepo — site and API function live together

```
interlink-site/
├── src/
│   ├── pages/
│   │   ├── index.astro                # Landing / hero → redirects or IS the product page
│   │   └── roadmap.astro              # Roadmap page
│   ├── layouts/
│   │   └── BaseLayout.astro           # Shared layout (nav, footer, meta)
│   ├── components/
│   │   ├── Hero.astro                 # Hero section
│   │   ├── FeatureSection.astro       # Reusable topic section
│   │   ├── FeatureCard.astro          # Individual feature card
│   │   ├── RoadmapBoard.astro         # Roadmap kanban/list view
│   │   ├── RoadmapItem.astro          # Single roadmap item
│   │   └── VoteButton.astro           # Client-side vote interaction
│   ├── data/
│   │   └── roadmap.json               # Auto-generated from GitHub Projects
│   └── styles/
│       └── global.css                 # Tailwind or custom styles
├── api/
│   ├── vote/
│   │   └── index.ts                   # POST: submit vote, GET: get vote counts
│   ├── confirm/
│   │   └── index.ts                   # GET: email confirmation link handler
│   ├── package.json
│   ├── tsconfig.json
│   └── host.json                      # Azure Functions config
├── .github/
│   └── workflows/
│       ├── deploy-site.yml            # Build Astro → deploy to GitHub Pages
│       └── sync-roadmap.yml           # Pull roadmap from private GitHub Project → commit roadmap.json
├── astro.config.mjs
├── tailwind.config.mjs                # If using Tailwind
├── package.json
├── tsconfig.json
└── site.md                            # This file
```

---

## Design Direction

- Clean, modern, professional — think Vercel/Linear product pages, not enterprise bloatware
- Dark or light mode (default light, respect system preference)
- CSE ICON branding: use brand colors if available, otherwise a clean blue/slate palette
- Responsive: mobile-first
- Fast: no client-side JS except for the vote button interaction

---

## Page 1: Product Page (index)

### Hero Section

- Product name: **InterLink**
- Tagline: "Bridge your PI System to any OPC UA client — securely, in minutes"
- Subtitle: "CSE ICON InterLink connects AVEVA PI Data Archive and Asset Framework to the OPC UA ecosystem with enterprise security, real-time subscriptions, and zero-code configuration."
- CTA button: "View Roadmap" (links to /roadmap) and "Contact Sales" (mailto or form link)

### Feature Sections

Render each topic as a distinct section with a heading, brief description, and feature cards. Use icons where appropriate (Lucide or Heroicons).

#### Topic 1: PI Data Archive

Connect directly to PI Data Archive servers and expose points via OPC UA.

| Feature | Description |
|---|---|
| Browse & Filter Points | Search PI points by name pattern with configurable result limits |
| Real-Time Subscriptions | Subscribe to value changes — pushed to OPC UA clients automatically |
| Historical Data Access | Read time-series data with configurable date ranges via OPC UA HistoryRead |
| Write-Back | Write values back to PI points from any OPC UA client |
| Flexible Authentication | Windows integrated auth or explicit domain credentials (DOMAIN\user) |
| Server Discovery | Automatically discover available PI Data Archive servers on the network |
| Connection Resilience | Automatic retry with configurable intervals and attempt limits |

#### Topic 2: PI Asset Framework

Navigate AF hierarchies and expose attributes as OPC UA nodes.

| Feature | Description |
|---|---|
| Full Hierarchy Browsing | Navigate AF databases → elements → attributes as OPC UA folders and variables |
| Multi-Database Support | Connect to multiple AF databases simultaneously |
| Attribute Subscriptions | Real-time value change notifications on AF attributes |
| Historical Reads | Time-series data retrieval from AF attribute history |
| Write-Back | Write values to AF attributes from OPC UA clients |
| Element Metadata | Expose element descriptions and hierarchy context |

#### Topic 3: OPC UA Server

A standards-compliant OPC UA server with enterprise security.

| Feature | Description |
|---|---|
| Standards Compliant | Built on the OPC Foundation .NET Standard SDK |
| Security | Basic256Sha256 with SignAndEncrypt — no insecure endpoints |
| Dynamic Namespaces | Each PI adapter gets its own OPC UA namespace, auto-populated |
| Lazy Hierarchy Loading | Deep hierarchies populate on-demand for fast startup |
| Client Session Tracking | Monitor connected clients, subscriptions, and monitored items |
| Certificate Management | Auto-generate server certs, trust/reject client certs via web UI |

#### Topic 4: Configuration & Management

Web-based configuration with zero downtime.

| Feature | Description |
|---|---|
| Web-Based Dashboard | Configure, monitor, and explore data from a browser |
| Hot Reload | Change adapter settings without restarting the service |
| Data Explorer | Browse tags, view live values, chart historical data |
| Real-Time Logs | Live log streaming via SignalR with level filtering |
| Config Backups | Automatic timestamped backups on every config change |
| Adapter Lifecycle | Add, remove, enable, or disable adapters at runtime |

#### Topic 5: Security

Enterprise-grade security at every layer.

| Feature | Description |
|---|---|
| Windows AD Authentication | Log into the management UI with domain credentials |
| Certificate Trust Store | Import, approve, reject, and manage OPC UA client certificates |
| DPAPI Credential Encryption | Stored passwords encrypted with Windows DPAPI |
| JWT API Security | Internal APIs protected with JWT tokens |
| Group-Based Access | Restrict management UI access to "CSE InterLink Admins" group |
| RSA-Signed Licensing | Machine-bound licenses with RSA signature validation |

#### Topic 6: Enterprise & Federation

Multi-site deployment and centralized management.

| Feature | Description |
|---|---|
| Multi-Site Topology | Connect multiple InterLink instances to a central hub |
| Heartbeat Monitoring | Automatic availability detection across sites |
| Pairing Workflow | Secure approval process for new site connections |
| API Key Management | Issue and revoke API keys for federated instances |
| Centralized Visibility | Monitor remote instance status from a single dashboard |

#### Topic 7: Deployment

Runs as native Windows services with simple administration.

| Feature | Description |
|---|---|
| Windows Services | Runs as two Windows services (DataProcessor + ConfigMonitor) |
| Single Config File | One config.json governs everything — version-controllable |
| Console Debug Mode | Run interactively for troubleshooting |
| Auto-Migration | Config file automatically upgraded when you update InterLink |
| Structured Logging | SQLite + file logging with configurable retention |

---

## Page 2: Roadmap (/roadmap)

### Data Source

The roadmap is powered by a **GitHub Project board** on the private `cse-icon` org. The project should have these custom fields:

| Field | Type | Values / Notes |
|---|---|---|
| `Status` | Single select | Backlog, Investigating, In Development, Released |
| `Public` | Checkbox | Only items with Public=true appear on the site |
| `Released In` | Text | Version string, e.g., "v2.1.0" |
| `Category` | Single select | PI, OPC UA, Federation, Platform, Configuration, Security |
| `Summary` | Text | Public-facing description (use this instead of issue body) |

### Sync Mechanism

A GitHub Action (`sync-roadmap.yml`) runs on a schedule (every 6 hours) and on manual trigger:

1. Uses a GitHub App or PAT with `read:project` scope on the private org
2. Queries the GitHub Projects GraphQL API for items where `Public = true`
3. Outputs `src/data/roadmap.json` with this shape:

```json
[
  {
    "id": "PVTI_abc123",
    "title": "AF Analysis Support",
    "summary": "Expose AF Analysis outputs as OPC UA nodes",
    "category": "PI",
    "status": "In Development",
    "releasedIn": null
  },
  {
    "id": "PVTI_def456",
    "title": "Modbus TCP Adapter",
    "summary": "New ingress adapter for Modbus TCP devices",
    "category": "Platform",
    "status": "Backlog",
    "releasedIn": null,
    "votes": 0
  }
]
```

4. Commits and pushes if the file changed — this triggers the site deploy action

### Roadmap UI

- Display as a **kanban-style board** with columns: Backlog → Investigating → In Development → Released
- Each card shows: title, summary, category badge, vote count
- Released items show the version badge
- Filter by category (tabs or dropdown)
- Each card has a "Vote" button (see voting section below)

---

## Voting System

### Architecture

- **Azure Function App** with two functions:
  - `POST /api/vote` — submit a vote (email + roadmap item ID)
  - `GET /api/vote/{itemId}` — get vote count for an item
  - `GET /api/confirm?token=xxx` — confirm vote via email link
- **Azure Table Storage** — two tables:
  - `votes`: PartitionKey=itemId, RowKey=email, Confirmed=bool, Token=string, Timestamp
  - `votecounts`: PartitionKey="counts", RowKey=itemId, Count=number (denormalized for fast reads)

### Vote Flow

1. User clicks "Vote" on a roadmap item
2. Modal/inline form asks for their email
3. Static site POSTs to Azure Function: `{ itemId, email }`
4. Function checks if this email already voted for this item → if yes, return "already voted"
5. Function creates a pending vote row with a random confirmation token
6. Function sends a confirmation email (via SendGrid free tier or Azure Communication Services)
7. User clicks the link → `GET /api/confirm?token=xxx`
8. Function marks vote as confirmed, increments the count in `votecounts`
9. Static site polls `GET /api/vote/{itemId}` to show updated counts

### Security

- **CORS**: Azure Function only accepts requests from `interlink.cse-icon.com`
- **Rate limiting**: Max 10 vote requests per IP per hour (in-function check via Table Storage or Azure API Management)
- **Email confirmation**: Prevents fake votes
- **No secrets client-side**: The static site only knows the function URL
- **Input validation**: Email format validation, itemId must match known roadmap items

### Azure Function Code Notes

- Runtime: Node.js 20 + TypeScript
- Use `@azure/data-tables` SDK for Table Storage
- Use `@sendgrid/mail` or `@azure/communication-email` for confirmation emails
- Environment variables: `AZURE_STORAGE_CONNECTION_STRING`, `SENDGRID_API_KEY`, `SITE_URL`
- Deploy via GitHub Actions (`azure/functions-action`)

---

## GitHub Actions

### deploy-site.yml

```yaml
name: Deploy Site
on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'astro.config.mjs'
      - 'package.json'
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/
      - uses: actions/deploy-pages@v4
```

### sync-roadmap.yml

```yaml
name: Sync Roadmap
on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Fetch roadmap from GitHub Projects
        env:
          GH_TOKEN: ${{ secrets.PROJECT_READ_TOKEN }}
          PROJECT_NUMBER: ${{ vars.PROJECT_NUMBER }}
          ORG: cse-icon
        run: node scripts/sync-roadmap.mjs
      - name: Commit if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/data/roadmap.json
          git diff --staged --quiet || git commit -m "chore: sync roadmap data" && git push
```

### deploy-functions.yml

```yaml
name: Deploy Azure Functions
on:
  push:
    branches: [main]
    paths:
      - 'api/**'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd api && npm ci && npm run build
      - uses: azure/functions-action@v1
        with:
          app-name: interlink-votes
          package: api
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

---

## DNS Setup

1. Add CNAME record: `interlink.cse-icon.com` → `cse-icon.github.io`
2. In the GitHub repo settings → Pages → Custom domain: `interlink.cse-icon.com`
3. Enable "Enforce HTTPS"

---

## Azure Resources Needed

| Resource | SKU | Estimated Cost |
|---|---|---|
| Azure Function App | Consumption plan | Free (1M executions/month) |
| Azure Storage Account | General Purpose v2 | ~$0.01/month |
| SendGrid | Free tier (100 emails/day) | Free |

Total: effectively $0/month for expected traffic.

---

## Implementation Order

1. **Scaffold Astro project** — layout, global styles, nav, footer
2. **Build the features page** — all 7 topic sections with feature cards
3. **Build the roadmap page** — kanban view reading from static JSON (start with sample data)
4. **Create the sync-roadmap script** — GitHub Projects GraphQL query
5. **Build the Azure Function** — vote submission, confirmation, count retrieval
6. **Wire up the vote button** — client-side JS component
7. **GitHub Actions** — deploy site, sync roadmap, deploy functions
8. **DNS + go live**

---

## Sample roadmap.json (for initial development)

```json
[
  {
    "id": "1",
    "title": "AF Analysis Support",
    "summary": "Expose AF Analysis outputs as read-only OPC UA nodes",
    "category": "PI",
    "status": "In Development",
    "releasedIn": null,
    "votes": 12
  },
  {
    "id": "2",
    "title": "Modbus TCP Ingress Adapter",
    "summary": "Connect to Modbus TCP devices and expose registers via OPC UA",
    "category": "Platform",
    "status": "Backlog",
    "releasedIn": null,
    "votes": 34
  },
  {
    "id": "3",
    "title": "MQTT Egress Adapter",
    "summary": "Publish PI data to MQTT brokers for IoT integration",
    "category": "Platform",
    "status": "Investigating",
    "releasedIn": null,
    "votes": 21
  },
  {
    "id": "4",
    "title": "Bulk Tag Import",
    "summary": "Import tag configurations from CSV or Excel files",
    "category": "Configuration",
    "status": "Backlog",
    "releasedIn": null,
    "votes": 8
  },
  {
    "id": "5",
    "title": "Event/Alarm Forwarding",
    "summary": "Forward PI event frames and digital state alarms as OPC UA alarms",
    "category": "OPC UA",
    "status": "Investigating",
    "releasedIn": null,
    "votes": 15
  },
  {
    "id": "6",
    "title": "Hot-Standby Failover",
    "summary": "Automatic failover between primary and standby InterLink instances",
    "category": "Platform",
    "status": "Backlog",
    "releasedIn": null,
    "votes": 27
  },
  {
    "id": "7",
    "title": "Docker Container Support",
    "summary": "Run InterLink in a Windows container for cloud deployments",
    "category": "Platform",
    "status": "Backlog",
    "releasedIn": null,
    "votes": 19
  },
  {
    "id": "8",
    "title": "Grafana Data Source Plugin",
    "summary": "Native Grafana plugin for direct PI data visualization",
    "category": "Platform",
    "status": "Released",
    "releasedIn": "v2.0.0",
    "votes": 45
  }
]
```
