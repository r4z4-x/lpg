# LPG Gas Cylinder Management System — Architecture & Implementation Blueprint

> **Status:** Pre-implementation planning. No code, schemas, APIs, or components are produced here by design.
> **Stack (fixed by requirements):** React + Vite + TypeScript + Tailwind + ShadCN + TanStack Query + React Hook Form + Zod · Node + Express + TypeScript · MongoDB + Mongoose · JWT + Refresh Tokens + RBAC · MVC.
> **Author role:** Principal Architect / Senior PM / MERN + DB + Financial Systems / ERP Solution Architect.
>
> **Companion documents:**
> - [`CHART_OF_ACCOUNTS.md`](./CHART_OF_ACCOUNTS.md) — double-entry chart + posting templates per workflow (F2).
> - [`M0_FOUNDATION_TASKS.md`](./M0_FOUNDATION_TASKS.md) — foundation milestone task checklist with acceptance criteria.
> - [`DATA_MODEL.md`](./DATA_MODEL.md) — collection relationship (ER) diagram + source-of-truth rules.

---

## Phase 1 — Architecture Review (Critical)

This is the most important phase. The system manages real money, inventory, receivables, payables, and profit, so correctness beats features. The findings below are ordered by severity.

### 1.1 Blocking flaws — RESOLVED (decisions locked for implementation)

> All five blocking flaws are now resolved as binding design decisions. F1 is resolved per the client's confirmation that **"gas KG and filled cylinders are the same."** F2–F5 adopt the recommended approaches.

#### F1 — Unified Gas-Cylinder Inventory model *(RESOLVED)*
**Client decision:** gas KG and filled cylinders are the same physical thing — gas only exists inside cylinders; there is no separate bulk-gas pool. We therefore collapse the two inventories into **one valued inventory (gas, in KG) + one non-valued physical shell register (cylinder counts).**

**The model:**
- **Gas inventory (KG, WAC) is the single valued source of truth.** Inventory value = `availableKg × WAC`. This is the *only* place gas is valued.
- **A "filled cylinder" = a steel shell + its gas charge.** The gas in it is already counted in `availableKg`; the shell is counted in the shell register. **Gas is valued once (by KG); the shell is valued once (cylinder asset value). Nothing is double-counted.**
- **Cylinder counts (filled / empty / customer-held / lost / damaged) are physical-state counters of the shell register, NOT a second gas valuation.** They move in lockstep with gas but carry no gas value of their own.
- **Capacity link:** each `cylinderType` has a `capacityKg`. The filled-cylinder count is reconcilable with gas as `filledCount ≈ Σ(gasKg_for_type / capacityKg)`. For a single dominant size this is exact; mixed sizes reconcile per type. The system stores `availableKg` as primary and maintains `filled` as the operational counter.

**Consequences for the flows (now consistent):**
- **Purchase** (entered in KG @ rate/KG): `availableKg += qty`, recompute WAC; **shell register: `filled += qty/capacity`, `empty -= qty/capacity`** (vendor delivers gas in shells / company shells get filled). Net company shell count is unchanged by a purchase — only gas value and filled/empty split change.
- **Exchange sale:** customer's empty in, filled out → `availableKg -= qty`; shells: `empty += 1`, `filled -= 1`. Company shell count unchanged; only gas leaves (valued via COGS).
- **No-cylinder sale:** as above **plus a company shell leaves**: `filled -= 1`, `customerHeld += 1`; that shell's steel becomes a held asset + triggers a deposit liability (G1).
- No "decant/refill" module is needed — filled/empty is just a state flag on the same shells, and gas KG is the one valued quantity.
- **Negative-stock guard** applies to `availableKg` (the valued quantity), enforced atomically (see F4).

This eliminates the original contradiction: the filled-cylinder count can never "go negative while gas is positive," because it is derived from / moves with the same gas KG, and shells are conserved across exchange sales.

#### F2 — Adopt double-entry ledger *(RESOLVED)*
The flow models the Financial Ledger as parallel categories (Sales, COGS, Purchases, Expenses, AR, AP, Cash). Without **double-entry** (every transaction = balanced debits/credits), you cannot:
- prove the books balance,
- produce a trial balance / balance sheet that ties out,
- compute Business Worth reliably (it currently re-derives assets/liabilities ad hoc).

**Recommendation:** Implement a minimal **double-entry general ledger**: one `LedgerEntry` (journal entry) per business event, containing ≥2 balanced `lines` (account, debit, credit). Categories (Sales, COGS, AR, AP, Cash, Inventory, …) become **accounts** in a small chart of accounts. Business Worth and all reports then derive from the ledger, not from scattered counters. This is the single biggest correctness upgrade and is *not* over-engineering — it is the floor for a financial system.

#### F3 — Snapshot COGS at sale time *(RESOLVED)*
WAC changes on every purchase. If COGS/gross-profit are recomputed later using the *current* WAC, historical profit is wrong. **Each sale line must lock the WAC in effect at that instant** (`unit_cost_at_sale`) and store it immutably. Reports read the stored cost, never recompute.

#### F4 — Transactions + atomic guards for concurrency *(RESOLVED)*
WAC, gas stock, cylinder counts, customer balance, credit limit, and cylinder limit are all **mutable running totals** read-modify-written by concurrent sales/purchases. Two simultaneous operations will corrupt them.
- Use **MongoDB multi-document transactions** (requires a **replica set** — even single-node RS in dev) around any event that touches inventory + ledger + balances.
- Apply inventory/balance deltas with **atomic `$inc`** and **guarded conditional updates** (e.g., `findOneAndUpdate({stock: {$gte: qty}}, {$inc: {stock: -qty}})`) to prevent negative stock and lost updates.
- Add **idempotency keys** on create-sale / create-purchase / payment endpoints to defend against double-submit (double-click, retry) creating duplicate ledger entries.

#### F5 — Money & quantity precision policy *(RESOLVED)*
JavaScript floats will silently lose precision on currency and KG. Define a policy now:
- Store **money as integer minor units** (paisa) or `Decimal128`. Never `Number` for currency.
- Store gas KG with a **fixed precision** (e.g., `Decimal128`, 3 dp) and a defined rounding rule.
- Define rounding for invoice totals and WAC (banker's vs. half-up) **once**, centrally.

### 1.2 High-severity gaps

- **G1 — Cylinder deposit (RESOLVED: optional).** Deposit is configurable per cylinder type and may be 0/skipped (Q2). When collected on issue → **liability** (Dr Cash/Bank, Cr Cylinder Deposit Liability); refunded on return → liability reduction. When 0/absent → no deposit posting. Never revenue.
- **G2 — Tax / GST (RESOLVED: none in V1).** No tax charged in V1 (Q3). Invoice and ledger still carry a `tax` line **defaulted to 0** and a `taxConfig` in settings, so tax can be enabled later with no schema change.
- **G3 — Cylinder procurement / valuation missing.** The flow shows "Cylinder Purchase History" and "Cylinder Asset Value," but the purchase flow only buys gas. Cylinders are capital assets — model how they enter inventory and how they're valued (cost, depreciation optional).
- **G4 — Overpayment / customer advances not modeled.** If a customer pays more than invoice + old balance, the surplus is a **customer advance (liability)**, not negative receivable handled implicitly. Model it.
- **G5 — Sale corrections via edit, not reversal.** Owner "edits transactions." Editing a posted financial event breaks audit and re-derivation. Use **reversing entries + re-post** (and soft-delete), never destructive edits/deletes on financial records.
- **G6 — Negative inventory unguarded.** Selling more gas than on hand corrupts WAC (division by zero / negative cost). Hard-block at the service layer (see F4).
- **G7 — Payment accounts (RESOLVED: cash + bank).** "Cash" is generalized to **payment accounts**; V1 ships a **Cash** and a **Bank** account (Q5). Every receipt/payment/expense selects an account, enabling per-account reconciliation. Wallet is a future account type — no schema change needed to add one.

### 1.3 Medium-severity issues

- **M1 — Cylinder sizes/types (RESOLVED: seeded catalog).** A `cylinderTypes` catalog ships pre-seeded with sample sizes (§1.6) and is fully editable by the owner (Q6). Each type carries `capacityKg` (drives F1 reconciliation), `tareKg`, and optional `depositAmount`. All cylinder counts and gas reconciliation are per-type.
- **M2 — Business day & timezone undefined.** "Today's sales," "Daily Cash Closing," "monthly" need an explicit business-day boundary and a fixed timezone (e.g., Asia/Karachi). Store timestamps in UTC; compute day buckets in business TZ.
- **M3 — Cash variance disposition undefined.** Daily closing computes expected vs. actual cash → variance. Where does variance go (shortage expense / over income / owner suspense)? Define the posting.
- **M4 — Credit-limit & cylinder-limit enforcement is a race.** Enforce inside the same transaction as the sale, with conditional checks.
- **M5 — Reporting performance / re-aggregation cost.** Dashboard metrics (gross profit, inventory value, AR/AP) computed by scanning a growing ledger won't scale. Plan **periodic snapshots / pre-aggregated daily rollups** and indexed queries.
- **M6 — RBAC field-level leakage.** Operators "can't view profit" but *create* sales that compute COGS/profit. Profit fields must be **stripped from responses** at the serializer/authorization layer, not just hidden in the UI.
- **M7 — Opening balances need balancing entries.** Opening cash/receivables/payables/stock must post against an **Opening Balance Equity** account so the ledger starts balanced. Otherwise the trial balance is off from day one.
- **M8 — Refresh-token lifecycle.** Define rotation, reuse-detection, revocation, and storage (httpOnly cookie vs. DB allowlist). Plan logout-all and per-device sessions.

### 1.4 Lower-severity / future

- Multi-branch / multi-warehouse (single location assumed in V1 — document it).
- Soft-delete + retention policy across all financial collections.
- Backup/restore & point-in-time recovery plan (financial data).
- Localization / multi-currency (likely single-currency V1 — document it).
- Notifications (low stock, credit-limit breach, overdue receivables) — future.

### 1.5 Client decisions — ALL ANSWERED (scope locked for V1)
1. **Inventory model** — gas KG and filled cylinders are the same → **Unified Inventory model** (F1).
2. **Cylinder deposit** — **optional**. Deposit amount is a *configurable, nullable* field per cylinder type (may be 0 / skipped). When collected it posts as a **liability**, not revenue (G1). When 0/absent, no deposit entry is created.
3. **Tax** — **no tax in V1.** Invoice/ledger nonetheless carry a `tax` line **defaulted to 0** so tax can be switched on later without a data-model change (G2).
4. **Locations** — **single location in V1.** Multi-branch/warehouse is explicitly **out of scope** for V1 (no `locationId` dimension shipped; documented for future).
5. **Payment methods** — **cash + bank.** `paymentAccounts` ships seeded with a Cash account and a Bank account; every cash/receipt/payment selects an account (G7). Wallets remain a future account type.
6. **Cylinder types** — **seed with sample sizes, fully editable later.** A `cylinderTypes` catalog ships pre-seeded (see §1.6) with `capacityKg`, `tareKg`, and optional `depositAmount`; the owner can add/edit/deactivate types. `capacityKg` drives the F1 gas↔filled reconciliation.

### 1.6 Seed cylinder types (samples — editable in System Setup)
> Indicative LPG sizes; adjust to the distributor's actual fleet. `capacityKg` = gas charge used for the F1 reconciliation; `tareKg` = empty shell weight; `depositAmount` is optional (Q2).

| Type | capacityKg | tareKg | depositAmount (optional) | Typical use |
|------|-----------|--------|--------------------------|-------------|
| Domestic Small | 6 | ~8 | configurable / 0 | household |
| Domestic Standard | 11.8 | ~15.5 | configurable / 0 | household (most common) |
| Commercial | 45.4 | ~36 | configurable / 0 | shops, restaurants |

These are starting values only — the owner edits capacities, tare, and deposits at any time; changing `capacityKg` affects only *future* reconciliation (historical sales keep their recorded quantities).

---

## Phase 2 — System Architecture Blueprint

### 2.1 High-level architecture
```
┌──────────────────────────────────────────────────────────────┐
│                     Browser (SPA)                              │
│   React + Vite + TS + Tailwind + ShadCN                        │
│   TanStack Query (server state) · RHF + Zod (forms)            │
└───────────────▲───────────────────────────────┬───────────────┘
                │  HTTPS / JSON (JWT access)     │  refresh (httpOnly cookie)
┌───────────────┴───────────────────────────────▼───────────────┐
│                  Express API (Node + TS, MVC)                  │
│  Routes → Middleware(auth, RBAC, validate, idempotency, error) │
│         → Controllers (I/O only) → Services (business logic)   │
│         → Models (Mongoose) → MongoDB                          │
│  Cross-cutting: Ledger service, Costing engine, Audit hook     │
└───────────────────────────────┬───────────────────────────────┘
                                 │  Mongoose / transactions
┌───────────────────────────────▼───────────────────────────────┐
│        MongoDB (replica set — required for transactions)       │
│  Operational collections + immutable LedgerEntry + Audit       │
│  + daily rollup snapshots for reporting                        │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Module boundaries & dependency direction
Lower layers must not depend on higher layers. The **Ledger**, **Costing**, and **Audit** services are cross-cutting and called by transactional modules.

```
Auth/Users ─┐
            ├─► (used by every module via middleware)
System Setup ┘

Vendor ──► Purchase ──► Costing Engine ──► Gas Inventory
                   └──► Ledger ◄── Sales ◄── Customer
                                    │
Cylinder Inventory ◄── Cylinder Pending ◄── Sales
                                    │
Expense ──► Ledger        Cash/Payment Accounts ──► Ledger
                                    │
Inventory Adjustment ──► Inventory + Ledger
                                    ▼
                 Ledger (double-entry, source of truth)
                                    ▼
        Reports · Dashboard · Business Worth (read-only derivations)

Audit Trail: invoked by all write services (event sourcing of changes)
```

**Responsibilities at a glance:** transactional modules *produce* balanced ledger entries + inventory deltas inside a DB transaction; reporting/dashboard/business-worth modules *only read* (ledger + snapshots).

### 2.3 Frontend architecture
- **Routing:** React Router with role-guarded routes (Owner vs Operator).
- **Server state:** TanStack Query (caching, invalidation, optimistic updates for fast cashier flows).
- **Forms:** React Hook Form + Zod (schemas shared/mirrored with backend validators).
- **UI:** Tailwind + ShadCN component library; a shared design system (tokens, data tables, money/quantity inputs).
- **API layer:** a typed client (one module per domain) wrapping fetch/axios with auth + refresh interceptor.
- **Authorization in UI:** route guards + field-level visibility derived from the user's permissions (never the only line of defense — backend enforces).

### 2.4 Backend MVC architecture
As specified: `controllers` (I/O only) → `services` (all business logic, ledger/inventory/transactions) → `models` (Mongoose). `routes` register endpoints; `validators` (Zod) validate input; `middlewares` handle auth, RBAC, validation, idempotency, error handling. No business logic in controllers; no direct DB access in controllers.

### 2.5 Database architecture
- MongoDB **replica set** (transactions are mandatory for correctness).
- **Immutable** `LedgerEntry` (append-only; corrections via reversing entries).
- Operational collections hold current state + running totals maintained atomically.
- **Daily rollup** collection for reporting/dashboard performance.
- Indexing tuned per access pattern (see Phase 4).

---

## Phase 3 — Module Analysis

For each module: **Purpose · Responsibilities · Features · Dependencies · Future · Risks.**

### 3.1 Authentication & Authorization
- **Purpose:** Secure access; identify the acting user for audit.
- **Responsibilities:** Login, JWT access + refresh issuance/rotation, RBAC enforcement, session revocation.
- **Features:** Owner/Operator roles, permission map, refresh-token reuse detection, logout-all.
- **Dependencies:** Users.
- **Future:** More roles (accountant, manager), 2FA, per-permission granularity.
- **Risks:** Token leakage, missing field-level authorization (profit fields), refresh reuse.

### 3.2 User Management
- **Purpose:** CRUD users, assign roles.
- **Responsibilities:** Create/disable users, reset passwords, role assignment.
- **Risks:** Privilege escalation; deleting a user referenced by audit (use soft-disable, never hard delete).

### 3.3 System Setup (Opening Balances & Company Settings)
- **Purpose:** Initialize the system: opening cash, gas KG, filled/empty cylinders, customer receivables, vendor payables; default sale rate, company info, tax/deposit config.
- **Responsibilities:** One-time (lockable) opening entries → must post to **Opening Balance Equity** (M7); store global settings.
- **Risks:** Opening balances editable after transactions begin (lock them; corrections via adjustment + audit). Initial WAC must be set with opening gas value.

### 3.4 Vendor Management
- **Purpose:** Supplier master + payables.
- **Responsibilities:** Vendor profile, vendor ledger, aging.
- **Dependencies:** Purchases, Ledger, Payments.
- **Risks:** Aging accuracy depends on correct AP postings.

### 3.5 Purchase Management
- **Purpose:** Record gas purchases (and cylinder purchases per G3).
- **Responsibilities:** Capture vendor, qty KG, rate, transport, misc → total cost; increase gas inventory; recompute WAC; post ledger (Inventory/Cash/AP); update vendor ledger; support full/partial/credit.
- **Risks:** WAC recomputation must be transactional (F4); transport/misc must be **capitalized into inventory cost** (they raise WAC), not expensed — confirm this is intended (it usually is for landed cost).

### 3.6 Inventory Cost Engine (Costing)
- **Purpose:** Maintain weighted average cost & inventory valuation.
- **Responsibilities:** On purchase: `new_WAC = (existing_value + purchase_landed_cost) / (existing_kg + purchased_kg)`. Provide current WAC to sales for COGS snapshot (F3).
- **Risks:** Zero/negative stock; concurrency; landed-cost inclusion policy.

### 3.7 Customer Management
- **Purpose:** Customer master, ledger, credit limit, cylinder limit, pending-cylinder history.
- **Responsibilities:** Profile, AR ledger, limit enforcement, advance balances (G4).
- **Risks:** Limit enforcement races (M4); merging duplicate customers.

### 3.8 Sales Management
- **Purpose:** Core revenue event (exchange & no-cylinder customers).
- **Responsibilities:** Compute invoice (gas + charges − discount [+ tax]); snapshot COGS; handle payment type; **separate revenue from previous-balance recovery** (key rule); cylinder movements; post balanced ledger; audit.
- **Risks:** The previous-balance-recovery rule (must not inflate revenue); negative stock; cylinder liability creation; overpayment → advance.

### 3.9 Cylinder Pending Management
- **Purpose:** Track company cylinders held by customers.
- **Responsibilities:** On issue → create liability/holding + (optional) deposit; on return → reduce pending, move filled→ used path, refund deposit, record condition (good/damaged/lost → adjustments + possible damage recovery revenue).
- **Risks:** Reconciling held counts with cylinder inventory; lost/damaged accounting.

### 3.10 Expense Management
- **Purpose:** Operating expenses.
- **Responsibilities:** Categorized + custom categories; affects cash/payment account, expense ledger, net profit.
- **Risks:** Mixing capital vs. operating expense; cash vs. bank source.

### 3.11 Cash / Payment Account Management
- **Purpose:** Track cash (and bank/wallet — G7) movements and daily closing.
- **Responsibilities:** Cash in/out, daily closing (expected vs actual), variance posting (M3).
- **Risks:** Variance disposition undefined; multi-account reconciliation.

### 3.12 Financial Ledger (General Ledger)
- **Purpose:** Single source of financial truth (double-entry — F2).
- **Responsibilities:** Append-only balanced entries; account balances; trial balance; feed reports/worth.
- **Risks:** Unbalanced entries (validate debits==credits before commit); immutability discipline.

### 3.13 Inventory Adjustment
- **Purpose:** Leakage, damage, manual correction.
- **Responsibilities:** Adjust gas KG and/or cylinder counts; post valuation loss to ledger; fully audited.
- **Risks:** Backdoor to alter inventory without trace — must be tightly audited and Owner-only (or approval).

### 3.14 Audit Trail
- **Purpose:** Who changed what, when, old→new.
- **Responsibilities:** Capture create/update/reverse on sales, purchases, expenses, customers, inventory adjustments.
- **Risks:** Performance (write amplification); storage growth; PII.

### 3.15 Reports
- **Purpose:** Sales, purchase, expense, gas stock, cylinder, customer/vendor balances, gross/net profit.
- **Responsibilities:** Read-only; derive from ledger + snapshots; date-range, business-day aware.
- **Risks:** Performance (M5); profit reports gated from operators (M6).

### 3.16 Dashboard
- **Purpose:** Owner KPIs (stock, WAC, inventory value, cylinder positions, cash, AR/AP, today/monthly sales & expenses, gross/net profit).
- **Risks:** Live aggregation cost — back with daily rollups + cheap deltas for "today."

### 3.17 Business Worth Engine
- **Purpose:** Net worth = assets − liabilities.
- **Responsibilities:** Assets (cash, gas stock value, cylinder asset value, receivables, advances given) − liabilities (payables, outstanding expenses, customer advances, cylinder deposits). Derive from ledger.
- **Risks:** Cylinder asset valuation (G3); double-counting gas (F1); must tie to trial balance.

---

## Phase 4 — Database Planning

> Planning only — no schema code. Money = integer minor units or `Decimal128`; KG = `Decimal128`. Every transactional write occurs in a DB transaction with a matching `LedgerEntry`.

### Collections

**users** — auth principals.
- Fields: name, email/username (unique), passwordHash, role(Owner|Operator), isActive, createdAt.
- Relationships: referenced by audit, transactions (createdBy).
- Indexes: unique(email/username), role.

**refreshTokens** — session/rotation allowlist.
- Fields: userId, tokenHash, family, expiresAt, revokedAt, replacedBy, device/ip.
- Indexes: userId, tokenHash(unique), TTL on expiresAt.

**companySettings** — singleton.
- Fields: companyInfo, currency, businessTimezone, defaultSaleRate, taxConfig, cylinderDepositConfig, openingLocked(bool).
- Indexes: none (singleton).

**chartOfAccounts** — accounts for double-entry.
- Fields: code, name, type(Asset|Liability|Equity|Income|Expense), isSystem, normalSide.
- Indexes: unique(code), type.

**ledgerEntries** — append-only journal (source of truth).
- Fields: entryNo, date(business day), sourceType(Sale|Purchase|Expense|Payment|Adjustment|Opening|Closing|Reversal), sourceId, memo, lines:[{accountCode, debit, credit, partyType, partyId}], reversalOf, createdBy, createdAt.
- Invariant: Σdebit == Σcredit.
- Indexes: entryNo(unique), date, sourceType+sourceId, lines.accountCode, lines.partyId.

**vendors** — supplier master + running payable.
- Fields: name, contact, openingBalance, currentPayable, isActive.
- Indexes: name(text), isActive.

**purchases** — gas (and cylinder) purchases.
- Fields: vendorId, date, lines(gas: qtyKg, ratePerKg), transportCost, miscCost, landedCost, totalCost, paymentType, amountPaid, paymentAccountId, ledgerEntryId, createdBy, status(active|reversed).
- Indexes: vendorId, date, status.

**gasInventory** — singleton running state. **(F1: the single valued gas inventory — source of truth.)**
- Fields: availableKg, weightedAvgCost, inventoryValue (= availableKg × WAC), updatedAt.
- Indexes: singleton.
- Note: gas is valued *only* here. Cylinder counts below carry no gas value (no double-count).

**purchaseLots** (optional, recommended) — audit trail of WAC inputs.
- Fields: purchaseId, qtyKg, landedCostPerKg, runningWacAfter, date.
- Indexes: date, purchaseId.

**cylinderTypes** — size catalog (M1).
- Fields: name, capacityKg, tareKg, depositAmount, isActive.
- Indexes: unique(name).

**cylinderInventory** — physical shell register per type/state. **(F1: counts only — NOT a second gas valuation.)**
- Fields: cylinderTypeId, filled, empty, customerHeld, lost, damaged, shellAssetValue (steel only).
- Invariant: `filled` reconciles with gas via `Σ(availableKg_for_type / capacityKg)`. `filled` moves in lockstep with gas KG; shells are conserved across exchange sales.
- Indexes: cylinderTypeId(unique).

**customers** — customer master + balances + limits.
- Fields: name, contact, openingReceivable, currentReceivable, advanceBalance, creditLimit, cylinderLimit, isActive.
- Indexes: name(text), isActive.

**customerCylinderHoldings** — pending cylinders (issue/return).
- Fields: customerId, cylinderTypeId, qty, issueDate, returnDate, returnCondition, depositCollected, status(held|returned|lost).
- Indexes: customerId, status.

**sales** — invoices.
- Fields: invoiceNo, customerId, customerType(Exchange|NoCylinder), date, gasQtyKg, saleRatePerKg, gasAmount, charges:[{name, amount}], discount, tax, invoiceAmount, unitCostAtSale(snapshot), cogs, previousBalanceRecovery, totalReceived, paymentType, paymentAccountId, cylinderIssued, cylinderReceived, ledgerEntryId, createdBy, status.
- Indexes: invoiceNo(unique), customerId, date, status.

**payments** — customer receipts & vendor payments (decoupled from invoice).
- Fields: partyType(Customer|Vendor), partyId, date, amount, paymentAccountId, appliedTo:[{type,id,amount}], ledgerEntryId, createdBy.
- Indexes: partyType+partyId, date.

**expenses** — operating expenses.
- Fields: category, customCategory, amount, date, paymentAccountId, note, ledgerEntryId, createdBy, status.
- Indexes: category, date, status.

**expenseCategories** — custom category catalog.
- Fields: name, isSystem, isActive. Indexes: unique(name).

**paymentAccounts** — cash/bank/wallet (G7).
- Fields: name, type(Cash|Bank|Wallet), openingBalance, currentBalance, isActive.
- Indexes: unique(name).

**cashClosings** — daily closing.
- Fields: businessDate, expectedCash, actualCash, variance, variancePostingEntryId, closedBy.
- Indexes: unique(businessDate).

**inventoryAdjustments** — leakage/damage/correction.
- Fields: type, gasKgDelta, cylinderDeltas:[{typeId, state, qty}], valuationImpact, reason, ledgerEntryId, createdBy.
- Indexes: type, date.

**auditTrail** — change log.
- Fields: userId, action, entity, entityId, oldValue, newValue, timestamp, ip.
- Indexes: entity+entityId, userId, timestamp.

**dailyRollups** — pre-aggregated reporting (M5).
- Fields: businessDate, sales, cogs, grossProfit, expenses, netProfit, cashIn, cashOut, arBalance, apBalance, gasKg, gasValue, cylinderPositions.
- Indexes: unique(businessDate).

**idempotencyKeys** — dedupe writes (F4).
- Fields: key, endpoint, requestHash, responseSnapshot, createdAt(TTL).
- Indexes: unique(key), TTL.

---

## Phase 5 — Workflow Analysis

Each workflow runs **inside one DB transaction**, emitting one balanced `LedgerEntry` + inventory/balance deltas + audit record. (Accounts named per the double-entry recommendation, F2.)

### 5.1 Purchase Flow
1. Validate vendor, qty, rate; compute `landedCost = gasCost + transport + misc`.
2. **Gas inventory (valued):** `gasInventory.availableKg += qty`; recompute WAC `= (oldValue + landedCost)/(oldKg + qty)`; update value.
3. **Shell register (counts only, F1):** `filled += qty/capacity`, `empty -= qty/capacity` — gas fills empty shells. Net company shell count unchanged; no gas value recorded here.
4. **Ledger:** Dr Gas Inventory (landedCost); Cr Cash/Bank (amountPaid) and/or Cr Accounts Payable (remainder).
5. Update vendor payable; write purchase + lot; audit. Commit.
- *Inventory impact:* +gas KG (valued), WAC change, empty→filled shell split (counts). *Ledger impact:* inventory asset up; cash down / AP up.

### 5.2 Sales Flow (Exchange Customer)
1. Validate stock (`availableKg ≥ qty`, guarded $inc), credit limit, cylinder availability.
2. Compute `gasAmount = qty*rate`; `invoiceAmount = gasAmount + Σcharges − discount + tax`.
3. **Snapshot** `unitCostAtSale = current WAC`; `cogs = qty * unitCostAtSale` (F3).
4. **Inventory:** `availableKg -= qty`; recompute value; cylinder: empty +1 (received), filled −1 (issued).
5. **Split payment:** revenue = invoiceAmount; previous-balance-recovery handled separately (5.5).
6. **Ledger:** Dr Cash/Bank + Dr AR (unpaid portion); Cr Sales Revenue (invoiceAmount, split into gas/charges as needed), Cr Tax Payable; Dr COGS, Cr Gas Inventory (cogs).
7. Update customer receivable; write sale; audit. Commit.

### 5.3 Sales Flow (No-Cylinder Customer)
- As 5.2 **plus**: register/verify customer, check cylinder limit, **issue company cylinder** → create `customerCylinderHoldings` (qty, deposit). 
- **Cylinder inventory:** filled −1, customerHeld +1. 
- **Deposit (G1):** Dr Cash/Bank, Cr Cylinder Deposit Liability (not revenue).

### 5.4 Credit Sale Flow
- Invoice posted; `amountPaid = 0`. **Ledger:** Dr AR (invoiceAmount), Cr Sales (+ tax). COGS posted as usual. Customer receivable += invoiceAmount. Enforce credit limit pre-commit.

### 5.5 Partial Payment & Receivable Recovery Flow
- **Partial:** Dr Cash (paid), Dr AR (unpaid); Cr Sales. AR += unpaid.
- **Previous-balance recovery (key rule):** the recovery portion of cash is **Dr Cash, Cr Accounts Receivable** — it **reduces AR, never touches Sales/Revenue**. `totalReceived = invoiceAmount(paid part) + previousBalanceRecovery`. Overpayment beyond AR → Cr Customer Advance liability (G4).

### 5.6 Vendor Payment Flow
- Standalone payment against payable: Dr Accounts Payable, Cr Cash/Bank. Vendor payable −= amount; update aging. Full or partial.

### 5.7 Cylinder Issue Flow
- Triggered within no-cylinder sale (or standalone). Create holding; cylinderHeld +1, filled −1; collect deposit → liability; audit.

### 5.8 Cylinder Return Flow
1. Find customer holding. 
2. Receive empty: customerHeld −1, empty +1 (or damaged/lost path). 
3. Reduce pending count; set returnDate/condition. 
4. **Deposit refund:** Dr Cylinder Deposit Liability, Cr Cash/Bank (if good). Damaged/lost → damage recovery revenue and/or forfeit deposit; cylinder inventory damaged/lost +1; valuation adjustment. Audit. Commit.

### 5.9 Inventory Adjustment Flow
- Leakage/damage/correction: apply gas KG and/or cylinder deltas; **valuation loss:** Dr Inventory Loss (expense), Cr Gas Inventory (or cylinder asset). Owner-only; fully audited.

### 5.10 Expense Flow
- Dr Expense (category), Cr Cash/Bank (or AP if unpaid). Reduces net profit; reduces payment account balance.

### 5.11 Profit Calculation Flow
- **Gross Profit** = Sales Revenue − COGS (both from posted ledger / sale snapshots, period-bounded). 
- **Net Profit** = Gross Profit − Operating Expenses. 
- Revenue **excludes** previous-balance recovery and deposits by construction (5.5, 5.3). Derived read-only; cached via daily rollups.

### 5.12 Business Worth Flow
- **Assets** = cash/bank balances + gas inventory value (WAC×KG) + cylinder asset value + customer receivables + advances paid. 
- **Liabilities** = vendor payables + outstanding unpaid expenses + customer advances + cylinder deposits held. 
- **Worth** = Assets − Liabilities, reconciled against ledger equity (trial balance). Read-only.

---

## Phase 6 — Financial Engine Design

### 6.1 Accounts (minimal chart)
Assets: Cash, Bank, Accounts Receivable, Gas Inventory, Cylinder Assets, Advances to Vendors.
Liabilities: Accounts Payable, Cylinder Deposit Liability, Customer Advances, Tax Payable, Accrued Expenses.
Equity: Owner Equity, Opening Balance Equity, Retained Earnings.
Income: Sales Revenue (gas), Charges Revenue, Damage Recovery, Cash Over.
Expense: COGS, Operating Expenses (by category), Inventory Loss, Cash Short.

### 6.2 Formulas
- **Landed purchase cost** = (qtyKg × ratePerKg) + transport + misc.
- **Weighted Average Cost (post-purchase)** = (prevValue + landedCost) / (prevKg + qtyKg).
- **Inventory Value** = availableKg × WAC.
- **COGS (per sale)** = qtyKg × WAC_at_sale (snapshotted).
- **Invoice Amount** = gasAmount + Σcharges − discount + tax.
- **Total Received** = (invoice portion paid) + previousBalanceRecovery.
- **Gross Profit** = Σ(Sales Revenue + Charges Revenue) − ΣCOGS.
- **Net Profit** = Gross Profit − ΣOperating Expenses − Inventory Loss.
- **AR** = ΣInvoices − ΣReceipts (applied) ; **AP** = ΣPurchasesCredit − ΣVendorPayments.
- **Business Worth** = ΣAssets − ΣLiabilities.

### 6.3 Worked transaction examples
**A. Purchase** 1000 KG @ 250 + 5,000 transport (prev: 0 KG / 0 value):
- landedCost = 250,000 + 5,000 = 255,000; WAC = 255 /KG.
- Ledger: Dr Gas Inventory 255,000 / Cr Cash 255,000 (if paid).

**B. Second purchase** 1000 KG @ 230 (prev 1000 KG @ 255):
- newValue = 255,000 + 230,000 = 485,000; newKg = 2000; **WAC = 242.5**.

**C. Sale** (exchange) 50 KG @ 300, delivery 200, discount 100, no tax; WAC 242.5:
- gasAmount = 15,000; invoice = 15,000 + 200 − 100 = 15,100; cogs = 50×242.5 = 12,125.
- Customer pays 15,100 cash: Dr Cash 15,100 / Cr Sales(gas) 15,000, Cr Charges 200, *less discount handled as contra/Cr net 15,100* ; Dr COGS 12,125 / Cr Gas Inventory 12,125.
- Gross profit on sale = (15,100 − 12,125) = 2,975 (charges included, discount net).

**D. Receivable recovery** customer owes 10,000, new sale 5,000, pays 15,000:
- Revenue = 5,000; Recovery = 10,000.
- Ledger: Dr Cash 15,000 / Cr Sales 5,000, Cr Accounts Receivable 10,000. **Revenue is only 5,000.**

**E. No-cylinder issue** deposit 2,000:
- Dr Cash 2,000 / Cr Cylinder Deposit Liability 2,000. (Not revenue.)

---

## Phase 7 — Backend Planning

### 7.1 Folder structure
```
src/
  config/        env, db (replica set), logger, constants
  controllers/   thin: parse req → call service → format res
  services/      business logic: sales, purchase, costing, ledger,
                 payment, cylinder, expense, cash, adjustment,
                 report, worth, audit, auth
  models/        Mongoose schemas (one per collection, Phase 4)
  routes/        endpoint registration per domain
  middlewares/   auth, rbac, validate(zod), idempotency, error, audit
  validators/    zod schemas per request
  utils/         money/decimal helpers, businessDay/tz, errors, ledger builder
  constants/     account codes, roles, permissions, enums
  types/         shared TS types/interfaces
  app.ts         express bootstrap
```

### 7.2 Responsibilities & interactions
- **Controllers** never touch DB or business rules; they call exactly one service method.
- **Services** own transactions: open session → mutate inventory/balances (guarded $inc) → build & post balanced LedgerEntry via **ledgerService** → write audit via **auditService** → commit. A **costingService** is the only writer of WAC. A **ledgerService.post()** validates Σdebit==Σcredit before commit.
- **Middlewares:** `auth` (verify access token) → `rbac` (permission per route) → `validate` (Zod) → `idempotency` (for create/payment) → handler → `error` (central). `audit` middleware/service captures old→new on writes.
- **Reporting/worth services** are read-only (ledger + rollups).

### 7.3 Representative endpoints (planning, not code)
Auth: login, refresh, logout, logout-all. Users CRUD. Setup: opening balances (lockable), settings. Vendors CRUD + ledger + aging. Purchases create/list/reverse. Customers CRUD + ledger + holdings. Sales create/list/reverse. Payments (customer/vendor) create. Cylinder issue/return. Expenses CRUD. Cash in/out + daily closing. Adjustments create. Reports (per type). Dashboard summary. Business worth.

---

## Phase 8 — Frontend Planning

### 8.1 Pages
Login · Dashboard (Owner) · Operator home · Vendors (list/detail/ledger/aging) · Purchases (list/new) · Customers (list/detail/ledger/holdings) · Sales/POS (new sale — the most-used screen) · Payments · Cylinder issue/return · Expenses · Cash & daily closing · Inventory (gas + cylinders) · Inventory adjustments · Reports hub · System setup · Users · Audit log.

### 8.2 Layouts
- App shell: sidebar nav (role-filtered) + top bar (user, business date, quick actions). 
- Auth layout (login). 
- Print layout (invoices, reports).

### 8.3 Forms (RHF + Zod)
- Sale form: customer picker, type toggle (exchange/no-cylinder), gas qty/rate, **dynamic charge rows (add/remove)**, discount, tax, payment type, previous-balance-recovery field (clearly separated from revenue), cylinder in/out. 
- Purchase form: vendor, qty, rate, transport, misc, live total, payment. 
- Expense, payment, adjustment, cylinder return forms.
- Zod schemas mirror backend validators; money/qty use dedicated decimal-safe inputs.

### 8.4 Tables
Reusable ShadCN data table (server pagination, sort, date-range, export). Used for ledgers, lists, reports, audit.

### 8.5 Components
Money/quantity inputs, charge-row repeater, customer/vendor async pickers, KPI cards, stock badges, role-gated wrapper, confirm dialogs, print/invoice view.

### 8.6 Dashboard design
KPI grid: gas stock + WAC + inventory value · filled/empty/customer-held · cash + AR + AP · today/monthly sales & expenses · gross/net profit. Fed by `/dashboard/summary` (daily rollups + live "today" delta). **Profit/worth cards hidden + server-stripped for operators.**

### 8.7 State & API strategy
- **TanStack Query** for all server state: query keys per domain, invalidation on mutations, optimistic updates for the sale flow.
- Typed API client per domain; axios interceptor attaches access token and transparently refreshes (httpOnly refresh cookie).
- Local UI state via component state/Zustand only where needed (form wizards). No global redux.

---

## Phase 9 — Development Roadmap

Ordered by dependency; each milestone is shippable/testable.

**M0 — Foundations (high complexity).** Repo, TS configs, MongoDB **replica set**, env/config, logger, error middleware, money/decimal + business-day utils, base test harness, **chart of accounts + ledgerService (double-entry) + auditService** (these are prerequisites for everything financial). *Resolve F1 with client first.*

**M1 — Auth & Users (medium).** JWT + refresh rotation, RBAC middleware, users CRUD, route guards (FE). 

**M2 — System Setup (medium).** Company settings, cylinder types, payment accounts, opening balances (lockable, posted to Opening Balance Equity).

**M3 — Costing & Inventory core (high).** gasInventory + costingService (WAC), cylinder inventory, guarded $inc, transactions. 

**M4 — Vendors & Purchases (high).** Purchase flow → inventory + WAC + ledger + payables; vendor ledger/aging; vendor payments. 

**M5 — Customers & Sales (highest).** Both customer types, dynamic charges, discount, tax, COGS snapshot, payment types, **previous-balance recovery**, AR, advances. The core revenue engine. 

**M6 — Cylinder pending & deposits (medium).** Issue/return, deposit liability, conditions, damage/lost. 

**M7 — Expenses & Cash (medium).** Expense flow, payment accounts, daily closing + variance posting. 

**M8 — Inventory adjustments (medium).** Leakage/damage/correction + valuation + audit. 

**M9 — Reports & Dashboard (high).** Daily rollups job, report queries, dashboard summary, role gating. 

**M10 — Business Worth + final hardening (medium).** Worth engine reconciled to trial balance, idempotency everywhere, soft-delete/reversal review, performance/indexing pass, backup plan.

**Suggested order:** M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10.
**Complexity hotspots:** M0 (ledger), M3 (costing/concurrency), M5 (sales rules). Budget extra time there.

---

## Phase 10 — Final Architecture Review

### Weak points / bottlenecks
- **Live aggregation** for dashboard/reports over a growing ledger → mitigate with **daily rollups** + indexed period queries (already planned).
- **Single-node Mongo** would block transactions → **replica set is mandatory**, not optional.
- **Hot running totals** (WAC, stock, balances) are contention points → guarded atomic updates + transactions.

### Future problems
- Scaling beyond one branch/warehouse (design leaves room via account/location dimension — document as out-of-scope V1).
- Tax regime changes (carry a tax line from day one — G2).
- Cylinder fleet valuation/depreciation (G3) will grow in importance.

### Missing reports/controls to add before launch
- **Trial balance / balance sheet / P&L** (fall out of double-entry — high value, low cost).
- **Cylinder reconciliation report** (owned vs at-customer vs lost/damaged) — critical given F1/G1.
- **Receivable & payable aging** (vendor aging exists; add customer aging).
- **Deposit liability report** and **cash/bank reconciliation**.
- **Audit/exception report** (reversed transactions, large discounts, adjustments).

### Accounting concerns (recap)
- Enforce **double-entry** (F2); **revenue vs. previous-balance recovery** separation (5.5); **deposits as liabilities** (G1); **COGS snapshot** (F3); **opening balance equity** (M7); **money precision** (F5); corrections via **reversal not edit** (G5).

### Inventory concerns (recap)
- **F1 resolved → Unified Inventory model:** gas valued once in KG (WAC); cylinder counts are a non-valued shell register that moves in lockstep with gas. Confirm **`capacityKg` per cylinder type** so `filled` reconciles with gas KG. Guard **negative stock** on `availableKg` (G6). Decide **landed-cost capitalization** (3.5). Track **cylinder types** (M1) and **shell asset value** (G3).

### Final recommendations before coding
1. **Blocking flaws F1–F5 are resolved** (see §1.1). Remaining open items are the Phase-1.5 questions Q2–Q6 (deposit, tax, location, payment methods, cylinder sizes/capacity) — confirm before the modules that depend on them.
2. **Build the ledger + costing + audit core (M0/M3) first**; everything financial depends on them.
3. **Stand up a MongoDB replica set** in every environment.
4. **Lock money/quantity/rounding/timezone policies** centrally on day one.
5. **Treat ledger entries as immutable**; corrections are reversing entries.
6. Keep it lean: a small double-entry core + snapshots is the right amount of rigor — not full accounting-suite over-engineering.

---

*End of blueprint. No implementation code, schemas, APIs, or components were produced, per the planning mandate. Resolve the Phase-1 blocking items (especially F1) before development begins.*
