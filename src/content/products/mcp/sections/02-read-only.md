---
title: Read-Only by Design
description: >-
  An AI assistant connected to production data should never be able to change
  it. None of our MCP servers can write a value, acknowledge an alarm, or change
  the configuration of the system it reads.
icon: shield
features:
  - title: No Write Path
    description: Every tool is a read. Nothing in the server sends a write to the historian or SCADA system.
  - title: Scoped to Your Permissions
    description: The server can only read what its account or token can read. The historian's own permissions still apply.
  - title: Bounded Queries
    description: The server checks the type and range of every argument, and caps time windows and result sizes.
---
