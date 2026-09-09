# ADR-0005: Cloud Deployment (Render + Supabase)

- **Status:** Accepted
- **Date:** 2026-09-09
- **Deciders:** BECS Analytics (management), engineering
- **Related:** [ADR-0001](0001-tech-stack.md) (**supersedes its deployment decision**), [SSOT §14](../SSOT.md#14-technology-stack--architecture-summary), [DEPLOYMENT.md](../../DEPLOYMENT.md)

## Context

[ADR-0001](0001-tech-stack.md) chose **Docker Compose deployment (Next.js standalone, Postgres, MinIO, worker) behind a TLS reverse proxy**, on-premise. That assumed BECS would run and maintain a server.

That is no longer the near-term plan. The application needs to be reachable over the internet now, at **zero hosting cost**, with **automatic deployment from `main`**. Nobody is available to administer an on-prem host, and there is no budget line for hosting.

This forces two questions ADR-0001 never had to answer: which managed platform, and what replaces MinIO and the local filesystem for attachments.

## Decision

**Application → Render (free web service). Database and object storage → Supabase (free).**

### Why not a serverless platform

Netlify was evaluated first and **rejected on hard limits**, not preference:

| Constraint | Netlify | Effect on this app |
|---|---|---|
| Function request payload | 6 MB (~4.5 MB binary) | `next.config.ts` sets `serverActions.bodySizeLimit: "15mb"` for Excel register imports. Not raisable on any tier. |
| Function timeout (free) | 10 s | Imports run multi-model Prisma transactions; workbook export is in-process. |
| Production deploys | 15 credits each, 300 credits/month | **~20 deploys/month**, shared with bandwidth and compute — incompatible with deploy-on-merge. |

Render runs Next.js as a **long-running Node server** rather than per-request functions, so none of the three applies. Vercel's free tier was excluded separately: its Hobby plan prohibits commercial use, and this is a commercial lab system.

### Why the filesystem had to go

`src/lib/storage/local.ts` wrote attachments to `./storage` on local disk. Any container filesystem is ephemeral — on Render the disk is wiped on every restart and redeploy, so uploaded files would disappear and `/api/files/[id]` would 404. This is true of *every* managed platform, not just serverless ones, and was the single blocking code change.

Storage is now behind a **driver interface** (`src/lib/storage/shared.ts`) with two implementations selected by `STORAGE_DRIVER`:

- `local` — unchanged behaviour, still the default, so `npm run dev` works with no cloud account.
- `supabase` — Supabase Storage, a private bucket accessed with the service-role key.

The `saveFile` / `loadFile` contract and the storage-key layout are **identical across drivers**, so `Attachment.storageKey` rows stay meaningful and the five call sites were unchanged apart from their import path. Files are still served through the auth-gated `/api/files/[id]` route; no public or signed URLs are issued.

### Database

Supabase Postgres. Prisma connects through the **Supavisor transaction pooler** (`:6543`) for queries and needs a **separate direct connection** (`:5432`) for migrations, which cannot run through a pooler — hence the new `directUrl` on the datasource. `DIRECT_URL` is **required**, including locally: Prisma fails schema validation when it is unset.

Migrations are **not** run automatically on deploy. For a lab operating under ISO 17025 with live records, `prisma migrate deploy` stays a deliberate, supervised step.

## Consequences

- **Positive:** zero hosting cost; deploy-on-merge to `main`; no server to administer; storage is now pluggable, so moving to Cloudflare R2 or back to MinIO is a one-file change.
- **Negative / trade-offs:**
  - **Cold starts.** Render free spins down after 15 minutes idle; the next request waits ~50 s. Accepted for now; a scheduled ping resolves it whenever it becomes annoying.
  - **Supabase pauses** a free project after 7 days with no requests, requiring a manual resume from the dashboard.
  - **1 GB storage ceiling** on the Supabase free tier. This — not the 500 MB database — is the limit that will bind first, because raw-data photographs accumulate. Expect to need R2 (10 GB free, no egress fees) or a paid tier.
  - **No background worker.** [SSOT §14](../SSOT.md#14-technology-stack--architecture-summary) assumes pg-boss for due/expiry alerts and report sealing. None is implemented yet, and Render's free tier has no worker service. Deferred, not solved.
  - **Free-tier posture generally.** Free tiers carry no uptime guarantee and no backup guarantee. Before this holds real accredited-lab records, a paid database tier with point-in-time recovery should be revisited.
- **Operational:** secrets live in the Render dashboard, not in the repository. The service-role key bypasses row-level security and must never reach client code; `import "server-only"` in the Supabase driver makes that a build error.

## Alternatives Considered

- **On-prem Docker Compose** (ADR-0001) — still the better long-term answer for data custody, but needs a maintained host and someone to run it. Superseded for now, not disproven.
- **Netlify** — rejected on the three hard limits above.
- **Splitting frontend and backend across two hosts** — considered to fit free tiers. Rejected: this is a single App Router application whose server actions are co-located with their pages; splitting it is a rewrite, not a deployment change.
- **Fly.io / Railway** — better cold-start behaviour and real persistent volumes, but neither has a genuine free tier; roughly $5/month. Revisit if cold starts prove unacceptable.
- **Attachments in Postgres** — avoids a second service, but consumes the 500 MB database quota and degrades backup/restore.
