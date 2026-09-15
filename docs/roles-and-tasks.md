# BECS Analytics LIMS — Roles & Tasks

> **Derived from the code, not the spec.** Every entry below was read off the implementation:
> the capability definitions in [`src/lib/auth/perms.ts`](../src/lib/auth/perms.ts), the guard on
> each server action in [`src/lib/actions/`](../src/lib/actions/), the page-level guards in
> `src/app/app/**/page.tsx`, the sidebar in [`src/app/app/layout.tsx`](../src/app/app/layout.tsx),
> and the blinding rule in [`src/lib/samples/blinding.ts`](../src/lib/samples/blinding.ts).
> Cross-reference: [SSOT §5 (approval matrix)](SSOT.md) and [SSOT §6 (authorization model)](SSOT.md).

## How access actually works

Access is decided in **two tiers**, both server-side:

1. **Tier 1 — designation capability.** `User.designation` (an enum column on the `User` table) is
   fed to small predicate functions in `perms.ts` (`canViewFinance`, `canManageStore`, …). Those
   predicates read the **capability matrix** in
   [`capabilities.ts`](../src/lib/auth/capabilities.ts): each capability has a built-in default
   designation set (the sets listed throughout this document), which the super-admin can override
   per designation from **Admin › Roles**. Overrides are stored in `CapabilityGrant` — a row exists
   only for a capability that has been changed, so "no row" always means "use the default".
   `ADMIN` passes every capability implicitly and `canAdminister` is hard-wired to ADMIN, so the
   super-admin cannot be locked out. *(The older `Role`/`Permission`/`RolePermission`/`UserRole`
   tables are still empty and unused — superseded by `CapabilityGrant`.)*
2. **Tier 2 — per-Function authorization.** The `Authorization` table grants a specific user a
   specific `Function` (e.g. "run method TM-014"), COO-granted, with a validity window — checked by
   `isAuthorizedForFunction()`.

**`ADMIN` is included in *every* Tier-1 capability**, so it is omitted from the lists below to avoid
noise. Read every capability as "…plus `ADMIN`".

### Legend

| Mark | Meaning |
|---|---|
| **A** | Approves / final authority |
| **V** | Verifies / reviews |
| **I** | Initiates / performs |
| *(self)* | Acts only on their own record |

---

# 1. Designation-wise

## 1.1 `ADMIN` — Application super-admin

Sits **outside** the SSOT role matrix. Bypasses every Tier-1 gate so it can view/edit/delete
anything; **every action is still written to the immutable audit log**.

- **Exclusive:** generic Admin data panel — browse/create/edit/delete **any** model
  (`/app/admin`, `/app/admin/[model]`), gated by `canAdminister` (ADMIN only).
- **Exclusive:** Excel/bulk **import** into any model (`importExcel`).
- Inherits every capability of every role below.
- Not a lab/management designation; never part of an approval chain.

## 1.2 `COO` — Chief Operating Officer

The top approving authority; present in essentially every capability. In practice the COO is
**the approver of last resort** and can also perform the initiating work.

**Sole approver (nobody else but ADMIN):**

| Approval | Capability |
|---|---|
| Personnel profile approval (activates the account) | `canApproveProfile` |
| Function approval | `canApproveFunction` |
| Grant / revoke Authorizations | `canGrantAuthorization` |
| Sample result approval → report release | `canApproveSample` |
| Purchase Request approval | `canApprovePR` |
| Winning-quotation selection (comparative) | `canSelectQuotation` |
| Test-parameter approval | `canApproveParameter` |
| Payroll run approval → posts to GL | `canApprovePayroll` |

**Shared:** production-QC lot approval (with RYK Lab Manager), competence evaluation, leave
approval, testing coordination, PR verification, goods inspection, store/GRN, equipment,
materials, parameters/standards, all finance, all procurement.

## 1.3 `OPERATIONS_MANAGER` (OM) — Lahore operational coordinator

The primary coordinator at Lahore. Broadest non-COO role.

| Area | Tasks |
|---|---|
| Personnel | **I** Create profile shells; manage Functions; evaluate competence; **A** approve leave |
| Testing | **I** Assign sample parameters to analysts/outsource labs; **V** verify entered results |
| Procurement | **V** Verify Purchase Requests; **V** inspect delivered goods (accept/reject) |
| Equipment | Register equipment; record calibrations & qualifications; issue gate pass; receive repaired equipment |
| Materials | Register chemicals/CRM/glassware/lab supplies + certificate intake |
| Master data | Manage test parameters, prices, packages; manage conformity standards |
| Outsourcing | Register outsource labs; set their per-test prices |
| Production QC | Book/assign QC lots, set product specs, submit results |
| Finance | **View only** (`canViewFinance`) — ledger, statements, dashboard, payables/receivables |

**Cannot:** approve anything the COO reserves; manage payroll; register clients/vendors; see client
identity (works blinded).

## 1.4 `LAB_MANAGER_RYK` — Lab Manager, Rahim Yar Khan

The RYK counterpart of the OM (there is no LO or OM step at RYK), plus QC authority.

| Area | Tasks |
|---|---|
| Samples | **I** Register samples directly (RYK has no LO) |
| Testing | **I** Assign parameters; **V** verify results |
| Procurement | **V** Verify PRs; **V** inspect goods |
| Equipment / Materials | Same as OM (register, calibrate, qualify, gate pass, receive repair, materials) |
| Master data | Parameters, prices, packages, standards |
| Outsourcing | Register outsource labs; set prices |
| Production QC | **I** Book/assign lots + specs; submit results; **A** **approve QC lots** |
| Personnel | Evaluate competence; **A** approve leave |

**Cannot:** create personnel shells (OM/COO only); **no finance visibility**; no payroll.

## 1.5 `ANALYST` (Lahore) and `ANALYST_RYK` (Rahim Yar Khan)

The bench roles — deliberately narrow and **blinded**. `ANALYST_RYK` is the Rahim Yar Khan
counterpart of `ANALYST` and carries an **identical** capability set; the two are separated so the
RYK on-site QC lab has its own analyst pool. Which of them appears in an assignment picker is
decided by the facility/section scope on the query, not by the designation. Both are members of
`ANALYST_DESIGNATIONS` in [`perms.ts`](../src/lib/auth/perms.ts) — always filter assignment
queries on that list, never on `"ANALYST"` alone.

- **Enter results only for parameters assigned to them.** Enforced by ownership, not designation:
  `enterResult` rejects with *"Only the analyst assigned to this parameter can enter its result."*
- Upload the raw-data sheet photo alongside the result.
- Production QC: access the QC portal and **submit** QC results (`canSubmitResult`).
- Works on **coded Lab IDs only** — never sees client identity.
- Plus the baseline every-user tasks (§3).

## 1.6 `LIAISON_OFFICER` (LO) — client-facing / front office

| Area | Tasks |
|---|---|
| Clients | **I** Register & edit clients; manage client portal logins; manage third parties |
| Samples | **I** Register samples (Lahore) |
| Sales | **I** Create/manage client quotations; set quotation status |
| Billing | **I** Issue client invoices; **I** record incoming client payments |
| Master data | Manage parameters/prices/packages and conformity standards |
| Outsourcing | Register outsource labs |
| **Blinding** | **The only designation that may see client identity** (`canSeeClientIdentity` returns true for `LIAISON_OFFICER` alone) — the decode/client-facing release role |

**Cannot:** view the finance ledger (`canViewFinance` excludes LO); approve anything.

## 1.7 `ACCOUNTANT` — finance

| Area | Tasks |
|---|---|
| Vendors | **I** Register & edit vendors; manage vendor portal logins |
| Payables | **I** Record vendor bills; record external-lab (outsource) bills; record utilities & expenses |
| Payments | **I** Record vendor payments, outsource payments, and incoming client payments |
| Receivables | **I** Issue client invoices; manage client quotations |
| Payroll | **I** Set salary structures; **I** prepare the monthly payroll run (COO approves) |
| Outsourcing | Set outsource-lab per-test prices |
| Visibility | Full finance: ledger, statements, dashboard, payroll, per-counterparty balances |

**Cannot:** approve payroll (COO); approve payments (COO approves every outgoing payment, BR-15).

## 1.8 `PURCHASE_OFFICER`

- **I** Record vendor quotations against an approved PR (`canRecordQuotation`).
- **I** Generate the Purchase Order (`canGeneratePO`).
- **I** Mark goods received against a PO (`canMarkReceived`).
- **I** Receive repaired equipment back (`canReceiveRepair`).

**Cannot:** select the winning quotation (COO), inspect/accept goods (OM/Lab Manager), issue the GRN
(Store In-charge).

## 1.9 `STORE_INCHARGE`

| Area | Tasks |
|---|---|
| Receiving | **I** Issue the **GRN** after accepted inspection — goods enter the Main Store |
| Stores | **A** **Approve/reject issue requests** (approval moves the balance to the sub-store) |
| Inventory | **I** Add inventory items; **I** set per-item reorder thresholds |
| Materials | Register materials + certificates |
| Equipment | Issue **gate pass** (controls what physically leaves the premises) |

## 1.10 `SALES_MARKETING_OFFICER`

- **I** Create and manage **client quotations** only (`canManageQuotations`).
- Plus the baseline every-user tasks (§3). No other Tier-1 capability.

## 1.11 `IT_OFFICER`, `LAB_ASSISTANT`, `LAB_ATTENDANT`

**No Tier-1 capability is granted to these designations anywhere in `perms.ts`.** They are
baseline users: dashboard, own attendance/leave/profile/undertaking, raise a PR, raise an issue
request, and read samples within their own section (blinded). Any real capability must come via a
**Tier-2 Function authorization** granted by the COO.

## 1.12 External portal logins — `CLIENT`, `VENDOR`, `OUTSOURCE_LAB`

Users with logins but **not staff**; the app layout redirects them out of `/app` into their portal
and they are excluded from personnel/payroll/competence rosters.

| Designation | Portal | Sees / does |
|---|---|---|
| `CLIENT` | `/portal` | Own samples & released reports only |
| `VENDOR` | `/vendor` | Own POs and quotation requests |
| `OUTSOURCE_LAB` | `/outsource` | Enters results for the parameters outsourced to them |

---

# 2. Overall — task-wise

Every task, with the guard that enforces it and who may perform it. **`ADMIN` may do all of them.**

## 2.1 Personnel & authorization

| Task | Capability | Who |
|---|---|---|
| Create personnel profile shell | `canManagePersonnel` | OM, COO |
| Complete / edit own profile, education, experience, trainings, publications, photo | *(self)* | Any user (own record) |
| Approve profile → activate account | `canApproveProfile` | **COO** |
| Create / edit Functions | `canManageFunctions` | OM, COO |
| Approve a Function | `canApproveFunction` | **COO** |
| Record competence evaluation (single & bulk) | `canEvaluateCompetence` | OM, Lab Manager RYK, COO |
| Grant / revoke Authorization | `canGrantAuthorization` | **COO** |
| Check in / check out | *(none — self)* | Any active user |
| Apply for leave | *(none — self)* | Any active user |
| Approve / reject leave | `canApproveLeave` | OM, Lab Manager RYK, COO |
| Sign yearly impartiality undertaking | *(none — self)* | Any active user |

## 2.2 Clients, samples & testing

| Task | Capability | Who |
|---|---|---|
| Register / edit client; client portal login | `canRegisterClient` | LO, COO |
| Create / edit third party (report in another's name) | `canRegisterClient` | LO, COO |
| Register a sample | `canRegisterSample` | LO, **Lab Manager RYK**, COO |
| Assign parameters to analyst / outsource lab | `canCoordinateTesting` | OM, Lab Manager RYK, COO |
| Enter a test result + raw-data photo | *(assignment-based)* | **Only the assigned analyst** |
| Enter an outsourced result | *(assignment-based)* | Outsource-lab portal user / assignee |
| Verify results | `canCoordinateTesting` | OM, Lab Manager RYK, COO |
| Approve sample → release report | `canApproveSample` | **COO** |
| See client identity (decode) | `canSeeClientIdentity` | **LO only** |
| View sample performance dashboard | `canCoordinateTesting` | OM, Lab Manager RYK, COO |

## 2.3 Master data

| Task | Capability | Who |
|---|---|---|
| Create parameters, set prices, packages | `canManageParameters` | OM, LO, Lab Manager RYK, COO |
| Approve parameter(s) | `canApproveParameter` | **COO** |
| Manage conformity standards & limits | `canManageStandards` | OM, LO, Lab Manager RYK, COO |

## 2.4 Procurement

| Task | Capability | Who |
|---|---|---|
| Raise a Purchase Request | *(none)* | **Any employee** |
| Verify / reject a PR | `canVerifyPR` | OM, Lab Manager RYK, COO |
| Approve a PR | `canApprovePR` | **COO** |
| Record vendor quotations | `canRecordQuotation` | Purchase Officer, COO |
| Select winning quote (comparative) | `canSelectQuotation` | **COO** |
| Generate Purchase Order | `canGeneratePO` | Purchase Officer, COO |
| Mark goods received | `canMarkReceived` | Purchase Officer, COO |
| Inspect goods (accept / reject) | `canInspectGoods` | OM, Lab Manager RYK, COO |
| Issue GRN | `canManageStore` | **Store In-charge**, COO |
| Register / edit vendor + vendor portal | `canRegisterVendor` | Accountant, COO |

## 2.5 Stores & inventory

| Task | Capability | Who |
|---|---|---|
| Add inventory item (Main Store) | `canManageStore` | Store In-charge, COO |
| Set per-item reorder thresholds | `canManageStore` | Store In-charge, COO |
| Raise an issue request (Main → sub-store) | *(none)* | **Any personnel** |
| Approve / reject an issue request (moves stock) | `canManageStore` | **Store In-charge**, COO |
| Generate a PR from low stock | *(none)* | Any employee |
| Register materials + CoA/MSDS/certificates | `canManageMaterials` | OM, Lab Manager RYK, **Store In-charge**, COO |

## 2.6 Equipment & traceability

| Task | Capability | Who |
|---|---|---|
| Register equipment | `canManageEquipment` | OM, Lab Manager RYK, COO |
| Record calibration | `canManageEquipment` | OM, Lab Manager RYK, COO |
| Record qualification (IQ/OQ/PQ) | `canManageEquipment` | OM, Lab Manager RYK, COO |
| Raise a repair / maintenance request | `canManageEquipment` | OM, Lab Manager RYK, COO |
| Issue gate pass (equipment leaves site) | `canIssueGatePass` | Store In-charge, OM, Lab Manager RYK, COO |
| Receive repaired equipment | `canReceiveRepair` | Purchase Officer, OM, Lab Manager RYK, COO |
| Inspect a repair (accept / reject) | `canInspectGoods` | OM, Lab Manager RYK, COO |
| Return equipment to service | `canManageEquipment` | OM, Lab Manager RYK, COO |
| Cancel a repair request | `canManageEquipment` | OM, Lab Manager RYK, COO |

> These six are enforced in [`lib/equipment/repair.ts`](../src/lib/equipment/repair.ts) (next to the
> business logic), not in the action wrapper — see §4.1.

## 2.7 Finance

| Task | Capability | Who |
|---|---|---|
| View ledger, statements, finance dashboard | `canViewFinance` | Accountant, **OM**, COO |
| Create client quotation; set its status | `canManageQuotations` | LO, Accountant, **Sales & Marketing Officer**, COO |
| Issue client invoice | `canIssueInvoice` | LO, Accountant, COO |
| Record incoming client payment | `canRecordPayment` | Accountant, LO, COO |
| Record vendor bill | `canManageOutsourceBilling` | Accountant, COO |
| Record vendor payment | `canRecordPayment` | Accountant, LO, COO |
| Record external-lab (outsource) bill | `canManageOutsourceBilling` | Accountant, COO |
| Record outsource payment | `canRecordPayment` | Accountant, LO, COO |
| Record utilities / expenses | `canManageOutsourceBilling` | Accountant, COO |
| Register outsource lab | `canRegisterOutsourceLab` | OM, Lab Manager RYK, LO, COO |
| Set outsource-lab test prices | `canSetOutsourcePrice` | OM, Lab Manager RYK, LO, **Accountant**, COO |
| View per-counterparty billed/paid/outstanding | `canViewFinance` | Accountant, OM, COO |

## 2.8 Payroll

| Task | Capability | Who |
|---|---|---|
| Set salary structures | `canManagePayroll` | Accountant, COO |
| Prepare monthly payroll run | `canManagePayroll` | Accountant, COO |
| Approve payroll run → posts to GL | `canApprovePayroll` | **COO** |

## 2.9 Production QC (BTF portal)

| Task | Capability | Who |
|---|---|---|
| Access the QC portal | `canAccessProductionQc` | COO, OM, Lab Manager RYK, **Analyst** |
| Book / reassign lots, set product specs | `canManageProductionQc` | Lab Manager RYK, OM, COO |
| Submit a QC result | `canSubmitResult` | Analyst, Lab Manager RYK, OM, COO |
| Approve / reject a QC lot | `canApproveLot` | **Lab Manager RYK**, COO |

## 2.10 Administration

| Task | Capability | Who |
|---|---|---|
| Generic data panel: view/edit/delete any record | `canAdminister` | **ADMIN only** |
| Excel/bulk import into any model | `canAdminister` | **ADMIN only** |

---

# 3. Baseline — what every active staff user can do

No capability required beyond an active account:

- View the dashboard and the activity log.
- Check in / check out (e-signed attendance).
- Apply for leave.
- Complete and maintain their own personnel profile (education, experience, trainings,
  publications, profile photo).
- Sign the yearly impartiality undertaking (enforced by a gate before any other app usage).
- **Raise a Purchase Request** (SSOT: "any employee").
- **Raise an issue request** for stock from the Main Store.
- Read samples within their own section — **blinded** (coded Lab IDs, no client identity).

---

# 4. Findings worth noting

1. **Equipment-repair guards sit one layer down — not missing, just relocated.** The action
   wrappers in [`equipment-repair.ts`](../src/lib/actions/equipment-repair.ts) only call
   `requireUser()`, which reads as an unguarded action. They delegate to
   [`lib/equipment/repair.ts`](../src/lib/equipment/repair.ts), where **every** core function
   enforces the designation itself — `openRepairCase` → `canManageEquipment`, `issueGatePassFor` →
   `canIssueGatePass`, `receiveRepairedEquipment` → `canReceiveRepair`, `inspectRepair` →
   `canInspectGoods`, `closeRepair` / `cancelRepair` → `canManageEquipment` — plus a facility-scope
   check ("That equipment belongs to another lab"). So these actions **are** fully protected
   server-side. Guarding beside the business logic is arguably the better pattern, but it is the
   only module that does it this way, so a reader scanning the action files will wrongly conclude
   the actions are open. Worth a one-line comment in the wrapper pointing at the core guard.
2. **Three designations have no capability at all** — `IT_OFFICER`, `LAB_ASSISTANT`,
   `LAB_ATTENDANT`. If they are meant to do anything beyond the baseline, it must be granted as a
   Tier-2 Function authorization, or `perms.ts` needs updating.
3. **The old RBAC tables are now redundant.** `Role`, `Permission`, `RolePermission`, `UserRole`
   are defined and wired to a `hasPermission()` helper but contain **0 rows** and drive nothing.
   Configurability is now served by `CapabilityGrant` + Admin › Roles, so these four should be
   dropped to avoid a misleading second source of truth.
4. **`canViewFinance` includes the OM but excludes the LO** — the OM can read the ledger and all
   payables/receivables; the Liaison Officer, who issues invoices and records client payments,
   cannot open the finance section.
5. **Blinding is currently coarse.** `canSeeClientIdentity` hard-codes `LIAISON_OFFICER` and does
   not yet key off COO approval ("until full decode-on-approval is wired" — the code says so), so
   identity visibility is role-based rather than state-based.
6. **`ADMIN` bypasses every Tier-1 gate** by design. It is safe only because every action is
   audited — worth keeping the audit log immutable and reviewed.
