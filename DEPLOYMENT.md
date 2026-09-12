# Deployment

Production runs on **Render** (Next.js server) with **Supabase** (Postgres + object
storage). Rationale and rejected alternatives are in
[ADR-0005](docs/adr/0005-cloud-deployment.md).

```
GitHub main ──push──> Render web service (auto-deploy)
                        Next.js 16 Node server · free tier · 512 MB
                          ├── Prisma ──────> Supabase Postgres (pooler :6543)
                          └── supabase-js ─> Supabase Storage (private bucket)
```

## For developers: moving your local setup onto this codebase

Read this before your next `git pull`. Three things changed that will break a
local checkout if you ignore them.

### 1. `DIRECT_URL` is now required, even locally

Prisma's datasource gained a `directUrl`. **Every Prisma command fails validation
if it is unset** — not just migrations. Add it to your `.env`:

```bash
# same value as DATABASE_URL for local docker-compose
DIRECT_URL="postgresql://becs:becs_dev_password@localhost:5432/becs_lims?schema=public"
```

`.env.example` has been rewritten to match reality; the old `S3_*` / `MINIO_*`
entries are gone because no code ever read them.

### 2. Attachments go through a storage driver, not the filesystem

`src/lib/storage/local.ts` is no longer imported directly. Import from
`@/lib/storage`, which picks a driver from `STORAGE_DRIVER`:

| Value | Behaviour |
|---|---|
| unset / `local` | writes to `./storage` on disk — the dev default, unchanged |
| `supabase` | Supabase Storage — what production uses |

Local development needs no change and no cloud account: leave `STORAGE_DRIVER`
unset. If you add a new upload path, import `saveFile` / `loadFile` from
`@/lib/storage` so it works in both places. The contract is in
`src/lib/storage/shared.ts`, and both drivers are checked against it at compile
time.

### 3. Use `prisma migrate dev`, not `prisma db push`

This is the one that already cost real time. `schema.prisma` had drifted **28
tables ahead** of the migration history, because work after 2026-06-26 was
applied with `db push`, which records nothing. It was invisible locally — your
pushed database already matched — but it meant a fresh deploy built 50 tables
while the generated Prisma Client expected 78, so every page touching a post-June
module would have failed on a missing relation.

Two migrations now close that gap (`20260909120000_sync_post_june_modules` and
`20260912000000_equipment_repair_finance_payables`). It stays closed only if
schema changes arrive as migrations:

```bash
npm run db:migrate   # prisma migrate dev -- creates the migration file
```

Check for drift any time with:

```bash
npx prisma migrate diff --from-url "$DIRECT_URL" \
  --to-schema-datamodel prisma/schema.prisma --script
```

Empty output means you are in sync. Anything else is a migration you still owe.

### Getting your branch onto the new main

If you have commits that are not yet pushed, do **not** try to reconcile an old
branch by hand. Branch from the new `main` and move your work across:

```bash
git fetch origin
git checkout main && git pull
git checkout -b feature/your-work-v2

# bring your commits over, oldest first
git cherry-pick <oldest-sha>..<newest-sha>
```

Expect conflicts only in import blocks. The resolution is nearly always: keep
your new imports, and take `@/lib/storage` over `@/lib/storage/local`.

Then, before opening a PR:

```bash
npm ci && npx prisma generate && npm run build
npx prisma migrate diff --from-url "$DIRECT_URL" \
  --to-schema-datamodel prisma/schema.prisma --script   # must be empty
```

### ⚠️ The test suite writes to whatever `DATABASE_URL` points at

`tests/setup.ts` loads `.env`, and `tests/qc-monthly-invoice.test.ts` calls
`facility.update`, `parameter.create`, `qcLot.create` and `invoice.delete`. It
cleans up after itself, but **if your `.env` points at production, `npm test`
writes to production.** Point tests at a throwaway database:

```bash
DATABASE_URL=postgresql://.../becs_test DIRECT_URL=postgresql://.../becs_test npm test
```

Real environment variables win over `.env`, which is what makes this work.

---

## Environment variables

Set these on the Render service. Nothing here belongs in the repository.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Supabase **pooled** connection, port **6543**, with `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | yes | Supabase **direct** connection, port **5432**. Migrations only — but Prisma fails validation if unset, so it must always be present |
| `AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `AUTH_URL` | no | Auth.js v5 infers the origin from the forwarded host when `AUTH_TRUST_HOST=true`, and the URL is unknown until the first deploy. Set it in the dashboard only if redirects misbehave. |
| `AUTH_TRUST_HOST` | yes | `true` — required behind Render's proxy |
| `STORAGE_DRIVER` | yes | `supabase` in the cloud. Defaults to `local`, which **loses every uploaded file on restart** |
| `SUPABASE_URL` | yes | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Secret.** Bypasses row-level security. Never prefix with `NEXT_PUBLIC_` |
| `SUPABASE_STORAGE_BUCKET` | no | Defaults to `becs-lims` |
| `NODE_ENV` | yes | `production` |

> `STORAGE_DRIVER` is the one that fails quietly. With it unset the app boots, accepts
> uploads, and serves them — until the next restart, when every file is gone. Check it
> first if attachments vanish.

## Render service settings

The service was created directly against Render's API (via the Render MCP server),
not from a blueprint — Render cannot create services from `render.yaml`. Its
configuration therefore lives in the Render dashboard, and this table is the record
of it:

- Type: **Web Service** (not Static Site — the app is server-rendered)
- Build: `npm ci && npx prisma generate && npm run build`
- Start: `npm run start`
- Health check path: `/login`
- Instance type: Free
- Node version: from `.node-version` (24.11.1), matching CI

Builds run on Render's Starter build pipeline (2 CPU / 8 GB), **not** on the 512 MB
instance, so the ~1 GB build has ample headroom. The running server idles around
**173 MB**, well inside 512 MB.

## Database migrations

Migrations are **deliberately manual**. Deploying does not migrate — so every
merge that changes `schema.prisma` needs someone to run this, or the new code
meets an old database and crashes. This is the most likely way the deployment
breaks.

```bash
# Against DIRECT_URL (port 5432) — never the pooler
DIRECT_URL="postgresql://...:5432/postgres" \
DATABASE_URL="postgresql://...:5432/postgres" \
  npx prisma migrate deploy
```

### Ordering: additive vs destructive migrations

Most migrations only add tables and columns, so they are safe to apply **before**
deploying — old code simply ignores what it does not know about.

A migration that **drops** a column or table is the opposite: apply it before the
new code deploys and the running app breaks on the missing column. Check before
you run anything:

```bash
grep -nE 'DROP TABLE|DROP COLUMN|DROP TYPE' prisma/migrations/<name>/migration.sql
```

- **Nothing found** → apply first, then deploy. No downtime.
- **Something found** → deploy first, then migrate immediately. There is a short
  window where the new code is live against the old schema, so do the two
  together rather than leaving it overnight. Confirm the affected tables are
  empty (or that losing those columns is intended) before you start.

`20260912000000_equipment_repair_finance_payables` is a destructive one: it drops
`InventoryItem.stockMarkedAt/.stockMarkedById/.stockStatus` and
`Notification.title/.body/.link`. Both tables were empty when it was written.

First-time setup only:

```bash
npm run db:seed                                    # facilities + sections
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:admin # super-admin account
```

`npm run db:seed` also creates dev users with a shared known password — review
`prisma/seed.ts` before running it against anything real.

## Runbook

**Deploy.** Merge to `main`. Render builds and deploys automatically; GitHub Actions
runs the build gate in parallel (see `.github/workflows/ci.yml`).

**Roll back.** Render dashboard → service → *Events* → *Rollback* on the last good
deploy. Rolling back application code does **not** roll back a database migration; if
the bad deploy included one, reverse it by hand first.

**First request is slow.** Expected. Render free spins the service down after 15
minutes idle; the next request takes ~50 s to wake it. Not a fault.

**Supabase project paused.** Free projects pause after 7 days with no requests.
Resume from the Supabase dashboard; data is retained.

**Attachments 404 after a redeploy.** `STORAGE_DRIVER` is not set to `supabase`.
Files written while it was wrong are gone — the disk they were on no longer exists.

**Switching storage drivers.** Storage keys are driver-agnostic but files are not
copied automatically. Existing `Attachment` rows point at objects that only the
driver that wrote them can read, so copy the underlying files across before
switching, or old attachments will 404.

## Free-tier limits to watch

| Limit | Value | First to bind? |
|---|---|---|
| Supabase object storage | 1 GB | **Yes** — raw-data photos accumulate |
| Supabase database | 500 MB | No — years of records |
| Supabase egress | 5 GB/month | Watch alongside storage |
| Render instance hours | 750/month | Fine for one service |
| Render build minutes | 500/month | Build is ~15 s |

When storage runs out, the cheapest move is Cloudflare R2 (10 GB free, no egress
fees) — a new driver in `src/lib/storage/`, no call-site changes.

## Known gaps

- **No backups configured.** The Supabase free tier does not include point-in-time
  recovery. Before this holds real accredited-lab records, schedule `pg_dump` or move
  to a paid tier.
- **No background worker.** [SSOT §14](docs/SSOT.md#14-technology-stack--architecture-summary)
  assumes pg-boss for due/expiry alerts and report sealing; none exists yet, and
  Render free has no worker service.
- **7 pre-existing lint errors on `main`**, so the CI lint job is non-blocking. Once
  cleared, remove `continue-on-error` from `.github/workflows/ci.yml`. Note the
  check shows red in GitHub even though it does not block the workflow.
- **The test suite can write to production.** `tests/setup.ts` reads `.env`, and the
  QC-invoice suite creates and deletes records. Anyone running `npm test` with a
  production `.env` writes to the live database. A dedicated test database, or a
  guard that refuses to run against the production host, would close this.
- **The database now holds real data**, not just seed rows — a real user account was
  created through the app on 2026-09-11. The "it is only seed data" assumption
  behind the no-backup position no longer holds.
