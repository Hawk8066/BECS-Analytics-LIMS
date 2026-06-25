# ADR-0002: Sample Blinding & Decoding

- **Status:** Accepted
- **Date:** 2026-06-26
- **Deciders:** BECS Analytics (lab management), engineering
- **Related:** [SSOT §8](../SSOT.md#8-blinding--decoding-rules), [Module 03](../modules/03-samples-and-client.md), [Module 04](../modules/04-testing-and-reporting.md)

## Context

To protect impartiality and confidentiality, analysts and the Operations Manager must test samples **without knowing the client/customer identity**. Identity is re-attached ("decoded") only after the COO approves the report, for client-facing release by the Liaison Officer. A UI-only hide is insufficient — blinding must hold even against direct data access.

## Decision

- On sample registration, generate a **coded Lab ID** (per [SSOT §11](../SSOT.md#11-numbering--identifier-standards)). The `Client ↔ Sample` identity association is stored such that it is **not readable** by analyst/OM roles.
- Enforce blinding in the **data-access layer** (server): queries executed in analyst/OM context return the coded sample, sample type, and parameters — **never** client identity fields. Back this with **PostgreSQL Row-Level Security** as defense-in-depth.
- **Decode** is a privileged operation **unlocked by COO report approval**; it re-attaches identity (including any client-requested third-party name) and exposes it to the **Liaison Officer**.
- Every decode is **audit-logged** (actor, timestamp, report, sample). Decoding cannot occur before approval.

## Consequences

- **Positive:** impartiality enforced structurally, not by convention; auditable; aligns with accreditation expectations.
- **Negative / trade-offs:** added complexity in the data layer and in test fixtures; some "convenience" cross-joins are intentionally unavailable to analyst/OM contexts; reporting code must request decode explicitly.
- **Testing:** a dedicated blinding test asserts analyst/OM queries never return identity, and that identity appears only post-approval.

## Alternatives Considered

- **UI-only masking** — rejected; not robust against API/DB access.
- **Separate physical database for identities** — rejected as over-engineered for current scale; RLS + access-gated link achieves the requirement with one database.
