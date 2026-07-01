# LPG Server — M0 Foundation

Backend foundation for the LPG Gas Cylinder Management System. This milestone (M0) ships **no business modules** — only the platform every module depends on: transactions, double-entry ledger, money/quantity primitives, audit, and idempotency. See `../ARCHITECTURE.md`, `../CHART_OF_ACCOUNTS.md`, `../M0_FOUNDATION_TASKS.md`, `../DATA_MODEL.md`.

## Prerequisites
- Node >= 20
- Docker (for the local MongoDB replica set) — **or** rely on the in-memory replica set used by tests.

## Setup
```bash
npm install
cp .env.example .env          # adjust if needed
docker compose up -d          # single-node replica set rs0 (transactions need a replica set)
npm run seed                  # idempotently seed the chart of accounts
npm run dev                   # start API (http://localhost:4000/health)
```

## Scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | Run API with hot reload (tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | ESLint |
| `npm test` | Vitest (spins up an in-memory replica set automatically) |
| `npm run seed` | Seed chart of accounts |

## What's in M0
- **Money & Quantity** primitives — exact BigInt math, no float drift (`src/utils/money.ts`, `quantity.ts`).
- **Double-entry ledger** — append-only, balance-validated, immutable, reversible (`src/models/ledgerEntry.model.ts`, `src/services/ledger.service.ts`).
- **Transaction helper** — `withTransaction()` with retry on transient errors.
- **Audit trail** — records participate in the same transaction as the change.
- **Idempotency** — middleware + TTL collection; replays the stored response on retry.
- **Chart of accounts** — seeded from the documented chart.
- **Auth/RBAC scaffolding** — middleware interfaces ready for M1.

## Testing notes
Tests use `mongodb-memory-server` to start a real single-node **replica set**, so multi-document transactions work without Docker. First run downloads a mongod binary (needs network).
