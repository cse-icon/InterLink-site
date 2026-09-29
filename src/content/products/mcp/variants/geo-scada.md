---
name: Geo SCADA
anchor: geo-scada
order: 30
icon: globe
tagline: Ask your Geo SCADA Expert system about points, alarms, comms and history.
highlights:
  - title: Point Search
    description: Search by name, point class or site, with current value and quality on every hit.
  - title: Hierarchy Navigation
    description: Walk the object tree a level at a time, and get full configuration for any point or object.
  - title: History & Coverage
    description: Read raw history, and check coverage and gaps without scanning the whole archive.
  - title: Alarm Forensics
    description: Standing alarms, full alarm lifecycles, and why an alarm didn't fire.
  - title: Alarm Configuration Census
    description: An estate-wide count of which points are set up to raise an alarm.
  - title: Operator & Config Audit
    description: Operator controls and acknowledgements from the event journal, and config changes with before and after values.
  - title: Comms Diagnosis
    description: Sweep comms objects for faults, and trace whether a data gap belongs to Geo SCADA or a downstream collector.
  - title: Point Triage
    description: Triage one point and get a verdict, such as history disabled or configured but not reporting.
  - title: Guided Prompts
    description: Built-in prompts for a morning health check, an incident timeline and failing-point triage.
---

Connects through a 64-bit ODBC System DSN, using the AVEVA Geo SCADA Data Access
components installed with ViewX. We build and test it against Geo SCADA Expert
2023. Use a dedicated Geo SCADA account with read permission only. Each
connection takes one Data Access licence slot, and the server opens two by
default.

Queries use fixed templates, and the server rejects anything that isn't a
SELECT. It runs on each engineer's Windows workstation, next to Claude Desktop,
Claude Code, Cursor or VS Code.
