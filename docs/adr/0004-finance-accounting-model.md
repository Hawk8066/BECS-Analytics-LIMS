# ADR-0004: Finance Accounting Model

- **Status:** Accepted
- **Date:** 2026-06-26
- **Deciders:** BECS Analytics (management), engineering
- **Related:** [SSOT §12 BR-16](../SSOT.md#12-global-business-rules-catalog), [Module 06](../modules/06-finance-and-payroll.md)

## Context

The Finance & Payroll module must be the authoritative accounting system for BECS Analytics — there is no external accounting package it must defer to. Stakeholders confirmed they want rigorous, auditable financials (trial balance, balance sheet, P&L), a real billing relationship for the RYK QC lab, and single-currency operation.

## Decision

- **Full double-entry general ledger.** Every financial event (client invoice, vendor/utility bill, payment, payroll) posts a **balanced journal entry** (Σ debits = Σ credits) against a **chart of accounts**. The system produces trial balance, balance sheet, and P&L. This module is the **system of record** — no external accounting software integration is required.
- **Append-only ledger.** Posted journal entries are immutable; corrections are made via **reversing entries**, never edits. Accounting **periods are closed and locked** (BR-16, [SSOT §13](../SSOT.md#13-non-functional-requirements)).
- **RYK revenue.** The RYK on-site QC lab bills **Bio Tech Fertilizers (Pvt) Ltd** a **monthly consolidated invoice** covering all RYK testing for the period; this is recognized as revenue.
- **Single currency: PKR.** All monetary amounts are stored as **integer minor units (paisa)** to avoid floating-point error.
- **Tax captured, not computed (for now).** Invoice tax fields (NTN/STN, tax amounts) are recorded but not auto-computed until BECS confirms rates/rules ([SSOT BR-16 note], Module 06 open questions).
- **Approvals.** **Every** outgoing payment (vendor, utility, payroll) requires **COO approval** (BR-15). Client (incoming) payments may be recorded by the **Accountant or the Liaison Officer**.
- **Payroll.** Monthly runs; gross = basic + named allowances; statutory deductions (income-tax slabs, EOBI, Provident Fund) and advances/loans; each run posts to the GL and requires COO approval.

## Consequences

- **Positive:** audit-grade financials; correct, reconcilable books; no dependency on third-party accounting software; immutable ledger aligns with the system-wide audit/traceability posture.
- **Negative / trade-offs:** materially more to build than a lightweight revenue/expense tracker — chart of accounts, balanced posting, period close, statutory payroll, and financial statements. Requires careful accounting design and review. Tax automation is deferred, so some manual entry remains until rules are confirmed.
- **Operational:** a defined fiscal calendar, period-close ownership, and (later) bank reconciliation are needed; these are flagged as open questions in Module 06.

## Alternatives Considered

- **Lightweight revenue/expense ledger** (originally proposed) — rejected by stakeholders in favor of a full GL for audit-grade reporting.
- **Feeder/export to external accounting software** — rejected; no such package is in use, and this module is to be the system of record.
- **Multi-currency** — rejected; operations are PKR-only.
