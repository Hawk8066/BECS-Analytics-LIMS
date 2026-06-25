# ADR-0003: Section & Facility Data Scoping

- **Status:** Accepted
- **Date:** 2026-06-26
- **Deciders:** BECS Analytics (management), engineering
- **Related:** [SSOT §7](../SSOT.md#7-section--facility-scoping-rules)

## Context

The system serves two facilities (Lahore, RYK) and three sections (Lahore Lab, RYK Lab, Management). Users must see only their own section/facility data by default, while senior roles (COO, OM) need cross-section visibility. A leak across facilities/sections is both a confidentiality and an accreditation concern.

## Decision

- Stamp **every record** with `facilityId` and `sectionId`.
- Enforce scoping **centrally** via a **Prisma client extension** that injects the session's facility/section into every query — not ad-hoc per route.
- Add **PostgreSQL Row-Level Security (RLS)** policies as defense-in-depth, so even a missed application check cannot leak data.
- Model **cross-section/facility read** as an **explicit scoped capability** attached to senior roles (COO, OM), evaluated by the same authorization layer — never an implicit bypass.
- Writes are always scoped to the actor's section/facility unless an explicit cross-scope capability authorizes otherwise.

## Consequences

- **Positive:** isolation enforced in one place + DB-level backstop; senior cross-section access is auditable and intentional.
- **Negative / trade-offs:** all queries run through the scoped client (no raw unscoped access in app code); seed/admin tooling needs an explicit elevated context; RLS policies must be kept in sync with the app model via migrations.

## Alternatives Considered

- **Application-layer checks only** — rejected; single missed check leaks data.
- **One database per facility** — rejected; complicates cross-section management reporting and shared master data; RLS within one database meets the need.
