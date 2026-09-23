---
name: Canary
anchor: canary
order: 10
icon: database
tagline: Ask your Canary Historian anything — tag discovery, history, events, and fleet analytics.
highlights:
  - title: Model-Aware Tag Search
    description: Search across every view at once, with each result flagged for whether it actually holds data.
  - title: Hierarchy Navigation
    description: Walk dataset, node, and tag structure, or step through very large hierarchies a level at a time.
  - title: History & Events
    description: Read historic values, alarms, system events, and structured batch or campaign events.
  - title: Asset Model
    description: Query virtual views, asset types, and asset instances to compare like equipment with like.
  - title: Fleet Leaderboards
    description: Rank one metric across many asset instances and get back scalars, not series.
  - title: Statistical Baselines
    description: Hour-of-day and hour-of-week baselines with a verdict from normal through to extreme.
  - title: Anomaly Detection
    description: Find excursions from threshold expressions, scanned across an entire asset type.
  - title: Pipeline Diagnosis
    description: Explain why a tag is returning nothing — missing, stale, bad quality, stuck, or intermittent.
  - title: Scorecard Reports
    description: Template-driven reports combining scalars, rankings, trends, and status into one view.
  - title: Live Data
    description: Poll current values for a scoped set of tags, with explicit session grants.
  - title: Built-In Product Knowledge
    description: An embedded Canary knowledge base, so assistants can answer configuration questions too.
---

Connects over the Canary Views API and requires Canary System v25.4 or later,
plus a read-only API token. Access is authenticated with your own Canary token,
so the server never widens what a user can already see.

For deployments that also hold engineering documentation, an optional companion
server adds P&ID, datasheet, and equipment-dossier lookups alongside the
historian data.
