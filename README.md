# BECS Analytics LIMS

A Laboratory Management System (LIMS) web application for **BECS Analytics**, covering two facilities — **Lahore (Parent Lab)** and **Rahimyar Khan (on-site QC Sub-Lab)** — across three sections: **Lahore Lab**, **RYK Lab**, and **Management**.

This repository is currently in the **specification phase**. All work here is documentation: a single source of truth (SSOT) plus per-module specifications. No application code has been written yet.

## Scope

Six in-scope modules:

1. **Personnel** — HR profiles, functions, competence, authorization, attendance, leave, undertakings.
2. **Inventory & Procurement** — stores, procurement workflow, vendors, utilities.
3. **Samples & Client** — client/sample registration, blinding, parameters & prices, quotations, invoices, complaints.
4. **Testing & Reporting** — test methods, raw-data capture, verification, approval, final reports.
5. **Equipment & Traceability** — calibration, equipment repair/qualification, chemicals, glassware, lab supplies.
6. **Finance & Payroll** — revenue, expenses, payments, payroll.

Deferred (extensibility hooks only, not built in this phase): staff Training, QMS/CAPA, Quality Control, Environment & Facilities, Risk Assessment, Internal Audit.

## Documentation Index

| Document | Description | Status |
|---|---|---|
| [docs/SSOT.md](docs/SSOT.md) | Single source of truth — glossary, roles, authorization, blinding, ERD, workflows, numbering, NFRs, conventions | ✅ Complete |
| [docs/adr/0001-tech-stack.md](docs/adr/0001-tech-stack.md) | Architecture Decision Record — technology stack | ✅ Complete |
| [docs/adr/0002-blinding-and-decoding.md](docs/adr/0002-blinding-and-decoding.md) | ADR — sample blinding & decoding | ✅ Complete |
| [docs/adr/0003-section-and-facility-scoping.md](docs/adr/0003-section-and-facility-scoping.md) | ADR — section & facility data scoping | ✅ Complete |
| [docs/modules/01-personnel.md](docs/modules/01-personnel.md) | Module spec — Personnel | ✅ Complete |
| [docs/modules/02-inventory-and-procurement.md](docs/modules/02-inventory-and-procurement.md) | Module spec — Inventory & Procurement | ✅ Complete |
| [docs/modules/03-samples-and-client.md](docs/modules/03-samples-and-client.md) | Module spec — Samples & Client | ✅ Complete |
| [docs/modules/04-testing-and-reporting.md](docs/modules/04-testing-and-reporting.md) | Module spec — Testing & Reporting | ✅ Complete |
| [docs/modules/05-equipment-and-traceability.md](docs/modules/05-equipment-and-traceability.md) | Module spec — Equipment & Traceability | ✅ Complete |
| [docs/modules/06-finance-and-payroll.md](docs/modules/06-finance-and-payroll.md) | Module spec — Finance & Payroll | ✅ Complete |

## Planned Technology Stack

Next.js (App Router, TypeScript) · PostgreSQL + Prisma · Auth.js + custom authorization · Tailwind + shadcn/ui · React Hook Form + Zod · TanStack Table · Recharts · MinIO (S3-compatible) · pg-boss · @react-pdf/renderer + QR. Deployed on-premise via Docker Compose. See [docs/adr/0001-tech-stack.md](docs/adr/0001-tech-stack.md).
