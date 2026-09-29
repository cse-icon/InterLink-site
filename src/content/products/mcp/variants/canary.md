---
name: Canary
anchor: canary
order: 10
icon: database
tagline: Query your Canary Historian for tags, history, events, asset models and fleet analytics.
highlights:
  - title: Model-Aware Tag Search
    description: Search across every view at once, with each result flagged for whether it holds data.
  - title: Hierarchy Navigation
    description: Walk dataset, node and tag structure, or step through very large hierarchies a level at a time.
  - title: History & Events
    description: Read raw and processed history, alarms, system events, and batch or campaign events.
  - title: Asset Model
    description: Query virtual views, asset types and asset instances to compare like equipment with like.
  - title: Fleet Leaderboards
    description: Rank one metric across many asset instances and get back one number per asset, not a series.
  - title: Statistical Baselines
    description: Hour-of-day and hour-of-week baselines with a verdict from normal through to extreme.
  - title: Correlation & Lag
    description: Find which tags move together, and which one moves first.
  - title: Anomaly Scans
    description: Find excursions from a threshold expression across every instance of an asset type.
  - title: Pipeline Diagnosis
    description: Explain why a tag is returning nothing. Missing, stale, bad quality, flat-lining or intermittent.
  - title: Scorecard Reports
    description: Template-driven reports that combine scalars, rankings, trends, status and formulas in one view.
  - title: Live Data
    description: Poll current values for a scoped set of tags, using live-data tokens that belong to your session.
  - title: Guided Prompts
    description: Seven built-in prompts, including a morning summary and failing-tag triage.
  - title: Built-In Product Knowledge
    description: An embedded Canary knowledge base, so assistants can answer configuration questions too.
---

Connects over the Canary Views API and requires Canary System v25.4 or later.
Each user connects with their own Canary API token, so the server never shows
anyone more historian data than their token already allows. Access tiers follow
from what the token can see. Diagnosis, live data and anomaly scans need a
higher tier than routine queries.

Canary can also run as one shared Windows service instead of on each laptop.
In that mode users sign in with OAuth, so claude.ai and ChatGPT connectors can
reach it. The server writes every tool call to an audit log, and keeps caches
and rate limits separate for each credential. It exposes health and Prometheus
metrics endpoints, and can dial out through a tunnel so you never open an
inbound port.

For deployments that also hold engineering documentation, an optional companion
server adds P&ID, datasheet and equipment-dossier lookups alongside the
historian data.
