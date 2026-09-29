---
name: AVEVA PI
anchor: pi
order: 20
icon: hierarchy
tagline: Ask your PI System about points, AF elements and history, through PI Web API.
highlights:
  - title: Point & Attribute Search
    description: Find Data Archive points and AF attributes by name, with each result flagged for whether it holds data.
  - title: AF Navigation
    description: Walk AF databases and element trees, or list the points on a Data Archive.
  - title: Tag Context
    description: Engineering units, point type, digital state set, and first and last timestamps for any point.
  - title: History in Four Modes
    description: Recorded, interpolated, summary and current values, with average, total, minimum and maximum.
  - title: Quality on Every Sample
    description: PI's good, questionable and substituted flags and system states come back as standard quality codes.
  - title: Analytics on PI History
    description: Baselines, change detection, correlation with lag, and gap detection all run on PI data.
---

Connects over PI Web API. It supports Basic authentication over TLS, or an OIDC
bearer token on PI Web API 2023 or later. The server doesn't support Kerberos
or NTLM yet, so you need Basic enabled on the PI Web API. Every request
the server makes to PI is a read, and we test it with a read-only account.

PI support runs on the same server as Canary, as its own instance. This is the
first phase. Event frames, AF template asset models and live-data subscriptions
are on the roadmap and not available yet.
