# M0 — Foundation Milestone: Task Checklist

> Companion to `ARCHITECTURE.md` (Phase 9). M0 builds the financial/technical bedrock every other module depends on. **No business modules** are built here — only the platform: transactions, ledger, costing primitives, audit, money utils.
> Planning artifact — describes *what to build and how to verify*, not the code itself.
> Legend: complexity ⬤ low ◑ medium ⬛ high. Each task lists **deliverable**, **depends on**, **acceptance criteria (AC)**.

---

## Ordered tasks

### M0.1 — Repo, tooling & TypeScript baseline ⬤
- **Deliverable:** Monorepo or two-package layout (`/server`, `/client`); TS strict configs; ESLint + Prettier; npm scripts; `.env.example`.
- **Depends on:** —
- **AC:** `npm run build` + `npm run lint` pass clean on an empty skeleton; strict mode on.

### M0.2 — MongoDB replica set (dev + all envs) ⬛
- **Deliverable:** Local single-node replica set (Docker), connection string, documented setup. Mandatory for transactions (F4).
- **Depends on:** M0.1
- **AC:** A scripted multi-document transaction commits and rolls back successfully against the dev DB.

### M0.3 — Config, env loading & secrets ⬤
- **Deliverable:** `config/` with validated env (Zod-validated env schema), DB connector with pooling, graceful shutdown.
- **Depends on:** M0.1, M0.2
- **AC:** App refuses to boot on missing/invalid env; connects to the replica set; clean shutdown closes the pool.

### M0.4 — Money & quantity primitives (F5) ⬛
- **Deliverable:** `utils/money` (integer minor units or Decimal128 wrapper) + `utils/quantity` (KG, fixed precision) + central rounding policy.
- **Depends on:** M0.1
- **AC:** Unit tests prove no float drift over add/sub/mul/divide; rounding rule deterministic; serialization round-trips losslessly.

### M0.5 — Business-day & timezone helpers (M2) ◑
- **Deliverable:** `utils/businessDay` — UTC storage, business-TZ (e.g. Asia/Karachi) day/month bucketing for "today"/"monthly".
- **Depends on:** M0.3
- **AC:** Tests confirm a sale at 23:30 local lands in the correct business day; month boundaries correct across DST-free TZ.

### M0.6 — Error handling, logging & response envelope ◑
- **Deliverable:** Typed `AppError` hierarchy, central error middleware, structured logger, standard success/error response shape.
- **Depends on:** M0.1
- **AC:** Thrown domain errors map to correct HTTP codes + consistent JSON; unhandled errors logged with correlation id, never leak stack to client.

### M0.7 — Chart of Accounts model + seed (F2) ◑
- **Deliverable:** `Account` model + seed loader for `CHART_OF_ACCOUNTS.md` (codes, names, type, normal side); idempotent re-seed.
- **Depends on:** M0.3
- **AC:** Seeding twice yields no duplicates; every account from the chart exists with correct class/normal-side.

### M0.8 — Transaction helper (session wrapper) ⬛
- **Deliverable:** `withTransaction(fn)` utility opening a Mongoose session, retrying on transient transaction errors, committing/aborting.
- **Depends on:** M0.2, M0.6
- **AC:** Helper aborts and surfaces error on failure; retries on `TransientTransactionError`; no partial writes on abort (verified by test).

### M0.9 — Ledger model + `ledgerService.post()` (F2, F3) ⬛
- **Deliverable:** Append-only `LedgerEntry` model (lines: account, debit, credit, party); `post(entry, session)` that **validates Σdebit == Σcredit** before commit; entry numbering; `reversalOf` support.
- **Depends on:** M0.4, M0.7, M0.8
- **AC:** Unbalanced entry is rejected; balanced entry persists atomically within a session; reversal posts a mirror entry; entries are immutable (update attempts blocked).

### M0.10 — Audit service + middleware (Audit Trail) ◑
- **Deliverable:** `auditService.record(user, action, entity, old, new)` + hook usable from write services; `auditTrail` collection.
- **Depends on:** M0.3, M0.8
- **AC:** A simulated write records user/action/timestamp/old/new; audit write participates in the same transaction (no audit without the change, no change without audit).

### M0.11 — Idempotency middleware (F4) ◑
- **Deliverable:** `idempotency` middleware + `idempotencyKeys` collection (TTL); replays stored response for a repeated key.
- **Depends on:** M0.3, M0.6
- **AC:** Two identical create requests with the same key produce exactly one persisted effect and identical responses; different payload + same key → conflict error.

### M0.12 — Auth scaffolding placeholder hooks ⬤
- **Deliverable:** Auth/RBAC **middleware interfaces** + `req.user` typing (real auth implemented in M1) so M0 services can assume an acting user.
- **Depends on:** M0.6
- **AC:** A stub user is attachable in tests; RBAC middleware signature stable for M1 to fill.

### M0.13 — Test harness & CI ◑
- **Deliverable:** Test runner (Vitest/Jest), in-memory/replica-set test DB bootstrap, transaction-aware test utilities, CI pipeline (lint + test + build).
- **Depends on:** M0.2, M0.8
- **AC:** `npm test` runs green in CI against a real replica set; ledger/money/idempotency suites included.

---

## Dependency graph (M0)
```
M0.1 ──► M0.2 ──► M0.3 ──► M0.5
  │        │        ├──► M0.7 ──┐
  ├──► M0.4 ───────────────────┤
  ├──► M0.6 ──► M0.12           │
  │        └──► M0.11           ▼
  M0.2 + M0.6 ──► M0.8 ──► M0.9 (needs M0.4, M0.7)
  M0.8 ──► M0.10
  M0.2 + M0.8 ──► M0.13
```

## Definition of Done for M0
1. A throwaway integration test can, **in one transaction**: deduct gas, post a balanced ledger entry, and write an audit record — and roll all three back together on forced failure.
2. Trial balance utility returns Σdebit == Σcredit on the seeded chart.
3. Money/quantity suites prove zero precision loss.
4. Idempotent create proven (single effect on retry).
5. CI green (lint + build + tests) against a replica set.

> Only after M0's DoD is met should M1 (Auth) and the financial modules (M3 Costing, M4 Purchases, M5 Sales) begin — they all post through `ledgerService` and run inside `withTransaction`.
