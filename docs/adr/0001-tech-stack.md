# ADR-0001: Technology Stack

- **Status:** Accepted
- **Date:** 2026-06-26
- **Deciders:** BECS Analytics (product), engineering
- **Related:** [SSOT §14](../SSOT.md#14-technology-stack--architecture-summary)

## Context

BECS Analytics needs an on-premise-friendly, multi-user LIMS with strong relational integrity, role- and function-gated access, approval workflows, audit/traceability, document/file handling (CoA, MSDS, raw-data photos, sealed reports), and dashboards. The labs may run network-restricted or self-hosted, and records must be retained for years with reproducible reports.

## Decision

Adopt a single full-stack TypeScript application:

- **Next.js (App Router, TypeScript)** — Server Components/Actions reduce API boilerplate; one codebase for UI + server logic; mature ecosystem.
- **PostgreSQL + Prisma** — relational integrity for a highly relational domain; JSONB available where needed; self-hostable; deterministic migrations. Extensions: `citext`, `pgcrypto`.
- **Auth.js (Credentials provider, Argon2id)** for authentication; a **custom two-tier authorization layer** (role permissions + per-Function capability gating) on top. OIDC adapter seam kept for future Active Directory integration.
- **Tailwind CSS + shadcn/ui** — vendored components, good for a long-lived/possibly air-gapped app.
- **React Hook Form + Zod** — one schema shared by client and Server Action validation.
- **TanStack Table** with server-side pagination/filtering for the many list/log/register screens.
- **Recharts** for dashboards.
- **MinIO** (S3-compatible) for object storage; S3 SDK so a cloud bucket is a config swap.
- **@react-pdf/renderer** + a QR library for sealed, QR-stamped reports.
- **pg-boss** (Postgres-backed queue) for background jobs (due/expiry/approval alerts) — avoids a separate Redis on-prem.
- **Docker Compose** deployment (Next.js standalone, Postgres, MinIO, worker) behind a TLS reverse proxy; nightly `pg_dump` + object-store backups; NTP-synced host.

## Consequences

- **Positive:** one language end-to-end; strong typing across DB→UI; self-hostable with minimal infra; integrity and auditability are first-class.
- **Negative / trade-offs:** Next.js Server Actions are relatively new — establish conventions early; Prisma polymorphism (for shared procurement/approval/attachment engines) needs a discriminator + typed-wrapper pattern to preserve referential integrity.
- **Operational:** backups, migrations, and clock sync are mandatory, not optional, due to traceability/retention requirements.

## Alternatives Considered

- **Django/FastAPI + React** — viable, but splits the codebase and language; no decisive advantage here.
- **SQLite / NoSQL** — rejected; the domain is strongly relational and integrity-critical.
- **Redis/BullMQ for jobs** — rejected for on-prem simplicity in favor of pg-boss.
