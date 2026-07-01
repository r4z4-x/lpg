# LPG Client — Frontend

React SPA for the LPG Gas Cylinder Management System. See `../FRONTEND_PLAN.md` for the full plan and `../ARCHITECTURE.md` (Phase 8). This is **FE-M0 (scaffold)**: toolchain, API client, money layer, and base UI — no feature screens yet.

## Stack
React 18 · Vite · TypeScript · Tailwind · ShadCN-style UI · TanStack Query · React Hook Form + Zod.

## Prerequisites
- Node >= 20
- The backend running (see `../server`): `npm run dev` on port 4000.

## Setup
```bash
npm install
npm run dev     # http://localhost:5173
```
The Vite dev server proxies `/api/*` → backend `http://localhost:4000` (stripping the prefix) and rewrites the refresh-cookie path to `/api/auth`, so the SPA and API stay same-origin and the httpOnly refresh cookie works without CORS config.

## Scripts
| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check + production build |
| `npm run typecheck` | Type-check only |
| `npm run lint` | ESLint |
| `npm test` | Vitest (jsdom) |

## What's in FE-M0
- `lib/api/client.ts` — fetch wrapper: `{ok,data}` unwrap, in-memory bearer token, transparent 401 → refresh → retry.
- `lib/money.ts` — format minor units for display; submit decimal strings to the API.
- `lib/query.ts` — TanStack Query client + key factory.
- `components/ui/*` — ShadCN-style Button/Input/Card primitives.
- Tests: money formatting, API client (envelope + 401-refresh-retry), and a render smoke test.
