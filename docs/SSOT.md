# BECS Analytics LIMS — Single Source of Truth (SSOT)

> **Status:** Draft v1 · **Owner:** BECS Analytics · **Audience:** product, engineering, QA, lab management
>
> This is the **authoritative** reference for everything cross-cutting in the LIMS. Module specs ([docs/modules/](modules/)) reference this document and must not duplicate or contradict it. When a rule changes, change it **here first**.

---

## 1. Purpose & Product Vision

BECS Analytics operates testing/QC laboratories that need to replace manual, paper-based workflows with a single web application that enforces controlled, auditable processes end to end. The LIMS will:

- Register clients and samples, route them through **blinded** testing, and produce **traceable, sealed, QR-stamped reports**.
- Enforce **role-based approval chains** (most terminating at the COO) for personnel, procurement, and reporting.
- Maintain **inventory, procurement, equipment calibration/qualification, and finance** in one system scoped per facility and section.
- Provide an **audit trail and traceability** suitable for an accredited testing environment (ISO/IEC 17025-aligned in spirit).

**Intended outcome:** every test result is reproducibly traceable to a method, a calibrated instrument, and an authorized analyst; every approval is recorded; and no privileged data crosses section/facility boundaries without authorization.

## 2. Scope

**In scope (this build) — 6 modules:**

| # | Module | One-line scope |
|---|---|---|
| 1 | Personnel | HR profile, functions, competence, authorization, attendance, leave, undertakings |
| 2 | Inventory & Procurement | Stores & sub-stores, procurement workflow, vendors, utilities |
| 3 | Samples & Client | Client/sample registration, blinding, parameters & prices, quotations, invoices, complaints |
| 4 | Testing & Reporting | Test methods, raw-data capture, verification, approval, final reports |
| 5 | Equipment & Traceability | Calibration, equipment repair/qualification, chemicals, glassware, lab supplies |
| 6 | Finance & Payroll | Revenue, expenses, payments, payroll |

**Deferred (extensibility hooks only — see §16):** staff Training, QMS/CAPA (Non-Compliance, Corrective Action), Quality Control (control charts, intermediate checks, interlab comparisons), Environment & Facilities, Risk Assessment, Internal Audit.

## 3. Glossary & Domain Terminology

| Term | Meaning |
|---|---|
| **SSOT** | This document — the single source of truth |
| **Facility** | A physical lab location: **Lahore** (Parent Lab) or **RYK** (Rahimyar Khan, on-site QC Sub-Lab) |
| **Section** | An organizational unit: **Lahore Lab**, **RYK Lab**, **Management** |
| **Blinding** | Concealing client/customer identity from analysts and the OM; samples are seen as coded IDs only |
| **Decoding** | Re-attaching client identity to a sample/report, unlocked only after COO approval, for the Liaison Officer |
| **Function** | A discrete authorized task (e.g. "run method TM-014", "sign final reports", "operate ICP") |
| **Competence** | An evaluation that a person can perform a Function; precondition for Authorization |
| **Authorization** | A COO-granted right to perform a Function; only authorized Functions are visible/actionable |
| **Accredited parameter** | A test parameter the lab is formally accredited to report |
| **GRN** | Goods Receiving Note — issued by the Store In-charge after accepted inspection |
| **PR / PO** | Purchase Request / Purchase Order |
| **Comparative Statement** | Side-by-side comparison of vendor quotations used to select a quote |
| **CoA** | Certificate of Analysis (for chemicals/reference materials) |
| **MSDS** | Material Safety Data Sheet |
| **IQ / OQ / PQ** | Installation / Operational / Performance Qualification of equipment |
| **Citrate-Soluble P₂O₅** | Citrate-soluble phosphorus pentoxide — a fertilizer phosphate-availability parameter |
| **Total Zinc** | Total zinc content parameter (e.g. on Raw Zinc) |
| **Zabardast Urea, Raw Zinc, AOM, MPF, BAZ** | BECS product / sample / parameter codes used in RYK on-site QC. *Exact technical definitions to be confirmed with BECS lab management; treated as named master-data values in the system.* |

> **Open item:** confirm the precise definitions of BAZ, AOM, MPF and the "Zabardast Urea / Raw Zinc" sample types with BECS so the parameter master data is seeded correctly.

## 4. Organization, Facilities & Sections

**Facilities:** Lahore (Parent Lab) · RYK (on-site QC Sub-Lab).
**Sections:** Lahore Lab · RYK Lab · Management (Management is located at Lahore).

**Technical hierarchy:** COO → Operations Manager (OM) → Lab Manager (RYK) → Analyst → Lab Assistant → Lab Attendant.

**Management hierarchy:** COO → Operations Manager (OM) → { Liaison Officer · Accountant · Purchase Officer · Store In-charge · IT Officer · Sales & Marketing Officer }.

The **COO** is the top approving authority for nearly all controlled actions. The **OM** is the primary operational coordinator (creates profile shells, inspects goods, assigns samples, verifies results).

## 5. Roles, Designations & Approval Matrix

This table is the **source of truth for who initiates vs. who approves**. Module specs must reference it rather than restate it.

| Action | Initiator | Reviews / Verifies | Approves / Authorizes | Result |
|---|---|---|---|---|
| HR profile creation | OM (shell: name, contact, email, designation, joining date) | User completes own detail | **COO** | User account created; user active |
| Function add/remove/edit | OM | — | **COO** | Function available for authorization |
| Competence evaluation | OM / designated evaluator | — | — | Competence record (precondition for authorization) |
| Authorization to a Function | OM (proposes) | — | **COO** | User may perform that Function; it appears in their UI |
| Resignation | OM | — | — | User tagged **non-active** |
| Daily attendance | User (e-sign) | — | — | Attendance record |
| Leave application | User | — | Approver per hierarchy | Leave approved/rejected |
| Purchase Request (PR) | Any employee | — | **COO** | PR approved → quotations may be requested |
| Quotations | Purchase Officer | — | — | Quotations recorded against PR |
| Comparative Statement | Purchase Officer | — | **COO** (selects a quote) | PO may be generated |
| Purchase Order (PO) | Purchase Officer | — | (per COO quote selection) | PO sent to vendor |
| Simplified PO (stationery/sanitary/furniture/PPE/utilities) | Any employee / Purchase Officer | — | **COO** | PO directly (no quotation/comparative) |
| Goods receiving | Purchase Officer (marks received) | **OM** inspects (accept/reject) | — | Accepted items → GRN |
| GRN | **Store In-charge** | — | — | Goods enter main store |
| Issue request (main → sub-store) | Any personnel | — | **Store In-charge** | Item issued to sub-store |
| Vendor registration | Accountant | — | — | Vendor available for procurement |
| Invoice (vendor side) | Accountant / Purchase Officer | — | — | Payment status tracked |
| Client registration | Liaison Officer | — | — | Client available |
| Test request / sample registration | Client or Liaison Officer (Lahore); direct (RYK) | — | — | Sample registered, coded Lab ID assigned |
| Sample → analyst assignment | OM (OM Portal) | — | — | Analyst can test |
| Raw data + results | Analyst (blinded) — **uploads photo of raw-data sheet + enters results** | **OM** verifies (reviews uploaded image + results) | **COO** | Report approved → decode |
| Final report release | System (on COO approval) | — | — | Decoded report shown to Liaison Officer (unique ID + QR + seal) |
| Client quotation | Liaison Officer / Sales & Marketing Officer | — | — | Quotation issued to client |
| Client invoice | Liaison Officer | — | — | Invoice issued; revenue recorded |

## 6. Authorization Model

Two tiers, both enforced server-side:

1. **Tier 1 — Role/Designation permissions:** what module/screen a user may access at all (e.g. only the Accountant registers vendors; only the LO registers clients).
2. **Tier 2 — Function capability gating:** what specific authorized **Functions** a user may perform. **Only authorized Functions render in the UI and are invokable.**

**The chain:**

```
Function ──(competence evaluation)──▶ Competence ──(COO grants)──▶ Authorization ──(aggregate)──▶ Job Description
```

- A **Function** is the pivot; technical capabilities link to it (a `TestMethod` requires Function(s); signing a final report requires a "report-signatory" Function; operating an instrument may require an equipment Function).
- **Authorization** is granted by the **COO**, tied to the user's **designation**, and carries effective/expiry validity.
- **Job Description** is *derived* from the set of a person's active Authorizations.
- **Validity is evaluated at action time and as of the test date.** A lapsed competence/authorization closes the gate and retroactively flags affected results.
- **Segregation of duty:** the testing chain enforces distinct people — Analyst (performs) → OM (verifies) → COO (approves).

See [ADR-0002](adr/0002-blinding-and-decoding.md) and module spec [04-testing-and-reporting](modules/04-testing-and-reporting.md).

## 7. Section + Facility Scoping Rules

- Every record is stamped with `facilityId` and `sectionId`.
- **Default visibility:** a user sees only their own section's data.
- **Cross-section/facility read** is an **explicit scoped capability** granted to senior roles (COO, OM) — never an implicit bypass.
- Enforcement is **centralized** in the data-access layer (a Prisma extension that injects scope from the session), with **PostgreSQL Row-Level Security (RLS)** as defense-in-depth.
- RYK is a distinct facility; Lahore Lab and Management are distinct sections within Lahore.

See [ADR-0003](adr/0003-section-and-facility-scoping.md).

## 8. Blinding & Decoding Rules

The most distinctive requirement of this system.

- On registration, every sample receives a **coded Lab ID**. The `Client ↔ Sample` identity link is **access-gated**.
- **Analysts and the OM see only** the coded Lab ID, sample type, and the parameters to test — **never** the client/customer identity.
- **Decoding** (re-attaching client identity) is **unlocked only after COO approval** of the report and is exposed to the **Liaison Officer** for client-facing release.
- Blinding is enforced in the **data-access layer**, not merely hidden in the UI. Every decode event is **audited** (who, when, which report).
- Reports where the client requested issuance "in the name of a third party" carry that third-party identity at decode time.

See [ADR-0002](adr/0002-blinding-and-decoding.md).

## 9. Global Domain Model (ERD)

Key entities and relationships (module-specific fields live in module specs).

```mermaid
erDiagram
    FACILITY ||--o{ SECTION : has
    SECTION ||--o{ USER : staffs
    USER ||--|| PERSONNEL_PROFILE : has
    USER ||--o{ AUTHORIZATION : holds
    FUNCTION ||--o{ COMPETENCE : evaluated_by
    FUNCTION ||--o{ AUTHORIZATION : grants
    USER ||--o{ COMPETENCE : assessed_in
    AUTHORIZATION }o--|| JOB_DESCRIPTION : aggregates

    CLIENT ||--o{ SAMPLE : submits
    SAMPLE ||--o{ SAMPLE_PARAMETER : tested_for
    PARAMETER ||--o{ SAMPLE_PARAMETER : measured_as
    PARAMETER ||--o{ PRICE : priced_by
    PARAMETER }o--o{ TEST_METHOD : tested_by
    TEST_METHOD ||--o{ ANALYSIS_RAW_DATA : produces
    SAMPLE_PARAMETER ||--|| ANALYSIS_RAW_DATA : has
    ANALYSIS_RAW_DATA }o--|| ATTACHMENT : raw_data_photo
    SAMPLE ||--o{ FINAL_REPORT : reported_in

    VENDOR ||--o{ PURCHASE_REQUEST : quoted_for
    PURCHASE_REQUEST ||--o{ QUOTATION : receives
    QUOTATION ||--o{ COMPARATIVE_STATEMENT : compared_in
    COMPARATIVE_STATEMENT ||--|| PURCHASE_ORDER : selects
    PURCHASE_ORDER ||--o{ GOODS_RECEIVING : fulfilled_by
    GOODS_RECEIVING ||--|| GRN : produces
    STORE ||--o{ STOCK_TRANSACTION : records
    INVENTORY_ITEM ||--o{ STOCK_TRANSACTION : moves

    EQUIPMENT ||--o{ CALIBRATION_RECORD : calibrated_by
    EQUIPMENT ||--o{ QUALIFICATION : qualified_by

    INVOICE ||--o{ PAYMENT : settled_by
    INVOICE }o--|| REVENUE : recognized_as
    PURCHASE_ORDER }o--|| EXPENSE : incurs
    PAYROLL_RECORD }o--|| EXPENSE : incurs

    AUDIT_LOG }o--|| USER : actor
    APPROVAL }o--|| USER : approver
    SIGNATURE }o--|| USER : signer
```

Cross-cutting entities attached polymorphically to most others: **`AuditLog`**, **`Attachment`**, **`Approval`/`ApprovalStep`**, **`Signature`**, **`Sequence`** (numbering), **`Notification`**.

## 10. Cross-Cutting Workflows & State Machines

**Approval routing (generic):** `Draft → Submitted → (Reviewed) → Approved | Rejected → (Rework → Submitted)`. Routing target derived from the org hierarchy and document type (most route to COO).

**Sample → Report lifecycle:**

```mermaid
stateDiagram-v2
    [*] --> Registered: LO/Client (Lahore) or direct (RYK)
    Registered --> Assigned: OM assigns analyst
    Assigned --> ResultsEntered: Analyst uploads raw-data photo + enters results
    ResultsEntered --> Verified: OM verifies (image + results)
    ResultsEntered --> Assigned: OM returns for rework
    Verified --> Approved: COO approves
    Verified --> Assigned: COO rejects
    Approved --> Decoded: identity re-attached
    Decoded --> Released: report (ID+QR+seal) to LO
    Released --> [*]
```

**Procurement (full path):**

```mermaid
stateDiagram-v2
    [*] --> PR_Submitted: any employee
    PR_Submitted --> PR_Approved: COO
    PR_Approved --> Quotations: Purchase Officer
    Quotations --> Comparative: Purchase Officer
    Comparative --> QuoteSelected: COO selects
    QuoteSelected --> PO_Issued: PO to vendor
    PO_Issued --> Received: Purchase Officer marks received
    Received --> Inspected: OM accept/reject
    Inspected --> GRN_Issued: Store In-charge (accepted)
    GRN_Issued --> Stocked: main store
    Stocked --> Issued: issue request → Store In-charge approves → sub-store
    Issued --> [*]
```

**Procurement (simplified path)** — for stationery, sanitary supplies, furniture, PPE, utilities: `Request → COO approves → PO → Received → Inspected → GRN → Stocked` (no quotations/comparative). Calibration and equipment-repair procurement reuse the **full path**.

## 11. Numbering & Identifier Standards

All identifiers are **gap-free, unique, non-reusable, section/facility-prefixed, and generated concurrency-safely** within the creating transaction (DB sequence / advisory lock).

| Entity | Format (example) | Notes |
|---|---|---|
| Lab/Sample ID | `LHR-S-2026-000123` / `RYK-S-2026-000045` | Facility prefix + type + year + counter; the **coded** ID seen by analysts |
| Final Report No | `LHR-R-2026-000123` | Carries a **QR code** encoding a verification URL/hash |
| Purchase Request | `PR-LHR-2026-00045` | |
| Purchase Order | `PO-LHR-2026-00045` | |
| GRN | `GRN-LHR-2026-00045` | |
| Vendor No | `VEN-00123` | Company-wide |
| Client No | `CLI-00123` | Company-wide |
| Invoice No | `INV-LHR-2026-00045` | |

> Counters reset per year per facility where shown. Exact prefixes to be finalized with BECS.

## 12. Global Business-Rules Catalog

Rules are numbered `BR-n` and referenced by module specs.

- **BR-1** Most controlled actions require **COO approval** (see §5).
- **BR-2** A user can perform a Function **only** if they hold a valid, non-expired **Authorization** for it (§6).
- **BR-3** Analysts and the OM operate on **blinded** samples; identity is revealed only after COO approval (decode) (§8).
- **BR-4** Reporting enforces **segregation of duty**: Analyst ≠ verifying OM ≠ approving COO.
- **BR-5** Every create/update/delete on a controlled record writes an **immutable audit-log** entry.
- **BR-6** Every record is **scoped** to a facility and section; cross-scope access requires an explicit capability (§7).
- **BR-7** Identifiers are **gap-free, unique, non-reusable** (§11).
- **BR-8** A **Final Report** is an immutable, hash-sealed snapshot; amendments create a new version linked to the superseded one.
- **BR-9** Stationery/sanitary/furniture/PPE/utilities use the **simplified procurement path** (no quotations/comparative).
- **BR-10** New stock enters the **Lahore main store**, then moves to sub-stores only via an approved **issue request**.
- **BR-11** Goods are usable only after **OM inspection (accepted)** and **GRN** issuance.
- **BR-12** A resigned employee is tagged **non-active** and retains historical records (never hard-deleted).
- **BR-13** Test traceability links each result to **method version, instrument calibration validity, and analyst authorization as of the test date**.
- **BR-14** Timestamps are **server-authoritative** (NTP-synced); client-supplied times are never trusted for signatures/results.

## 13. Non-Functional Requirements

- **Security & access:** two-tier authorization (§6), section/facility scoping + RLS (§7), least privilege, Argon2id password hashing.
- **Audit & integrity:** append-only `AuditLog` (no update/delete paths, enforced at DB privilege level); e-signatures capture signer, meaning, timestamp; records hash-sealed where sealed (reports, undertakings).
- **Traceability:** time-anchored links (BR-13); historical reports reproducible years later via stored sealed snapshots (BR-8).
- **Availability & data retention:** nightly automated backups (`pg_dump` + object-store sync); multi-year retention; deterministic, reversible migrations.
- **Performance:** server-side pagination/filtering on all list/log screens; dashboards backed by indexed queries.
- **Deployment:** on-premise-friendly via Docker Compose; offline-friendly (bundled fonts/assets, no hard CDN dependency); host NTP-synced.
- **Time:** server-authoritative timestamps only (BR-14).

## 14. Technology Stack & Architecture Summary

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Database / ORM | PostgreSQL + Prisma (extensions: `citext`, `pgcrypto`) |
| Auth | Auth.js (Credentials, Argon2id) + custom two-tier authorization |
| UI | Tailwind CSS + shadcn/ui |
| Forms / validation | React Hook Form + Zod (shared client/server schemas) |
| Tables | TanStack Table (server-side paging/filter) |
| Charts | Recharts |
| File storage | MinIO (S3-compatible) — CoA, MSDS, cal certs, quotations, raw-data photos, sealed reports |
| PDF / QR | @react-pdf/renderer + a QR library |
| Background jobs | pg-boss (Postgres-backed) |
| Deployment | Docker Compose (Next.js standalone, Postgres, MinIO, worker) behind TLS reverse proxy |

Full rationale: [ADR-0001](adr/0001-tech-stack.md).

## 15. Conventions

- **Entities:** PascalCase singular (`PurchaseOrder`); tables via Prisma mapping.
- **Identifiers:** human-facing IDs follow §11; internal PKs are UUID/cuid.
- **Files:** module docs `docs/modules/0N-kebab-name.md`; ADRs `docs/adr/NNNN-kebab-title.md`.
- **Commits:** Conventional Commits (`docs:`, `feat:`, `fix:`, scoped e.g. `docs(personnel):`).
- **Status values:** lifecycle states use the names in §10 state machines.
- **Dates/times:** stored UTC, server-authoritative; displayed in facility-local time.

## 16. Deferred-Scope Extensibility Hooks

The deferred modules attach to existing engines **without re-architecture**:

- **Training** → reuses Personnel (Competence/Authorization), Attachment (certificates), Approval, Calendar/scheduling.
- **QMS / CAPA** (Non-Compliance, Corrective Action) → a polymorphic CAPA workflow keyed on a *source* (complaint, audit finding, out-of-spec result) reusing the Approval engine and AuditLog.
- **Quality Control** (control charts, intermediate checks, interlab comparisons) → reuses Sample/Result data + a QC-rule engine and chart layer.
- **Environment & Facilities** → reuses readings/threshold + Notification + dashboard widgets.
- **Risk Assessment / Internal Audit** → reuse Approval, AuditLog, Attachment, and the CAPA workflow for findings.

The **procurement, approval, attachment, master-data, and audit** subsystems are therefore designed generic/polymorphic from day one (see module specs and ADRs).
