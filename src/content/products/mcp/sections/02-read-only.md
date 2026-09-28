---
title: Read-Only by Design
description: >-
  An AI assistant connected to production data should never be able to change
  it. Our MCP servers have no capability to write to, delete from, or
  reconfigure the systems they read.
icon: shield
features:
  - title: No Write Path
    description: There is no tool to set a value, change a configuration, or acknowledge an alarm.
  - title: Least-Privilege Credentials
    description: The server connects with a read-only account, so the boundary is enforced on both sides.
  - title: Tiered Access
    description: Capabilities are gated by tier, so routine users cannot reach administrative surfaces.
  - title: Per-Session Isolation
    description: Caches and rate-limit budgets are keyed per credential — sessions never see each other's data.
  - title: Audited
    description: Tool invocations are recorded, so you can review what was asked and answered.
  - title: Strict Input Validation
    description: Every tool rejects undeclared arguments rather than silently ignoring them.
---
