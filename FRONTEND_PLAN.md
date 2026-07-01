# Frontend Implementation Plan — LPG Gas Cylinder Management System

> Companion to `ARCHITECTURE.md` (Phase 8). Planning only — no frontend code yet.
> **Stack (fixed by the prompt):** React + Vite + TypeScript + Tailwind CSS + ShadCN UI + TanStack Query (React Query) + React Hook Form + Zod.
> **Backend it talks to:** the completed API in `server/` (19 route groups, double-entry, RBAC). This plan is written against that real contract.

---

## 1. Goals & scope (V1)

A single-page app that lets a real LPG distributor run the daily cycle the backend already supports:

- **Operator workflows:** record sales (exchange / no-cylinder), purchases, expenses, customers, vendors, cylinder returns, cash movements; view stock.
- **Owner workflows:** everything above **plus** system setup, opening balances, inventory adjustments, user management, reports, dashboard, and business worth.
- **Hard rule mirrored in the UI:** Operators never see profit/cost/worth. This is enforced by the backend (fields stripped, routes 403) — the UI just hides what it won't receive.

Out of scope for V1 FE: offline mode, i18n, theming beyond light/dark, mobile-native. (Layout will be responsive.)

---

## 2. Key integration facts (from the live API)

These shape the whole client and must be handled centrally:

1. **Response envelope:** every response is `{ ok: true, data: {...} }` or `{ ok: false, error: { code, message, details? } }`. The API layer unwraps `data` and throws a typed error on `ok:false`.
2. **Auth model:**
   - `POST /auth/login` → `{ accessToken, user }` in the body **and** sets an **httpOnly refresh cookie** scoped to `/auth` (SPA cannot read it).
   - Access token is short-lived (15 min) → **store in memory only** (not localStorage), attach as `Authorization: Bearer`.
   - **Silent login / refresh:** on app boot and on any `401`, call `POST /auth/refresh` (browser sends the cookie automatically) to get a new access token, then retry once. Refresh rotates the token; reuse is detected server-side.
   - `POST /auth/logout` clears the session.
3. **Same-origin requirement:** the refresh cookie is `httpOnly; sameSite=strict; path=/auth`. To keep it working in dev without CORS/sameSite pain, **the Vite dev server proxies `/api`-style paths to the backend** so the SPA and API share an origin. (Decision D1 below.)
4. **Money & quantity:** most entity responses carry **integer minor-unit fields** (`invoiceAmountMinor`, `currentReceivableMinor`, …); a few endpoints (`/inventory/gas`, `/dashboard`) return **pre-formatted major strings**. Write inputs expect **human decimal strings** (`"5000"`, `"242.50"`). → The client needs a small money layer: `formatMinor(n)` for display and forms that submit decimal strings.
5. **RBAC:** `user.role` is `Owner | Operator`. Owner-only route groups: `/users`, `/setup/*`, `/adjustments`, `/reports/*`, `/dashboard`. The UI gates navigation and routes accordingly; the backend is the real guard.
6. **Idempotency:** create endpoints accept an `Idempotency-Key` header. The client generates a UUID per submit for sales/purchases/payments/expenses/returns to make retries safe.

---

## 3. Decisions — LOCKED (D1–D3)

- **D1 — Dev integration:** ✅ **Vite dev proxy → backend** (same-origin; keeps the httpOnly refresh cookie working with zero CORS config).
- **D2 — Build scope first pass:** ✅ **Spine first** — FE-M0 scaffold → FE-M1 auth+shell → FE-M3 dashboard/inventory → FE-M5 POS sale → FE-M4 purchases, then fan out to the rest.
- **D3 — Money display source of truth:** ✅ **Client-side formatting from minor units** everywhere, for consistency.

---

## 4. Project structure

```
client/
  index.html
  vite.config.ts            # dev proxy to backend (D1)
  tailwind.config.ts, postcss.config.js
  components.json           # ShadCN config
  src/
    main.tsx, App.tsx
    lib/
      api/
        client.ts           # fetch wrapper: envelope unwrap, auth header, 401→refresh→retry
        endpoints.ts        # typed endpoint functions grouped by domain
        types.ts            # shared API types (mirror backend DTOs)
      auth/
        AuthProvider.tsx    # access token in memory, silent refresh, login/logout
        useAuth.ts
        RequireAuth.tsx, RequireRole.tsx   # route guards
      money.ts              # formatMinor / parseMajor helpers
      query.ts              # QueryClient + key factory
      utils.ts              # cn(), date/business-day display
    components/
      ui/                   # ShadCN primitives (button, input, dialog, table, ...)
      common/               # MoneyInput, QuantityInput, ChargeRows, DataTable,
                            # PartyPicker, KpiCard, RoleGate, ConfirmDialog, PageHeader
    layouts/
      AppShell.tsx          # sidebar (role-filtered) + topbar (user, business date)
      AuthLayout.tsx
    features/               # one folder per domain: components + hooks (useX queries/mutations)
      auth/ dashboard/ users/ setup/ vendors/ purchases/ customers/ sales/
      cylinders/ expenses/ cash/ inventory/ adjustments/ reports/
    pages/                  # route components composing features
    routes.tsx              # route table with guards
    styles/index.css
```

**Convention:** each feature owns its TanStack Query hooks (`useSales()`, `useCreateSale()`) wrapping `endpoints.ts`, plus its forms/tables. Pages compose features. No business logic in pages.

---

## 5. Cross-cutting architecture

- **API client (`lib/api/client.ts`):** single `request()` that injects the bearer token, unwraps `{ok,data}`, throws `ApiError(code,message,details,status)`. A response interceptor catches `401`, calls `/auth/refresh` **once** (dedup concurrent refreshes via a shared promise), retries, and on failure routes to `/login`.
- **Auth (`AuthProvider`):** holds `accessToken` + `user` in React state/memory. On mount runs silent `refresh()`; exposes `login()`, `logout()`, `user`, `isOwner`. Guards: `RequireAuth` (redirects unauthenticated) and `RequireRole role="Owner"` (renders 403 page for Operators).
- **Server state:** **TanStack Query** for everything from the API. Query-key factory (`qk.sales.list(filters)`, `qk.customer(id)`). Mutations invalidate the relevant keys (e.g., creating a sale invalidates `inventory`, `customer`, `dashboard`). Optimistic updates only for the fast POS path.
- **Forms:** **React Hook Form + Zod**. Zod schemas mirror the backend validators (money/qty as decimal-string fields, enums for `paymentType`, `customerType`, etc.). A shared `MoneyInput`/`QuantityInput` keep decimal strings exact (no float coercion). On submit, attach a generated `Idempotency-Key`.
- **Money layer (`lib/money.ts`):** `formatMinor(minor, currency)` → display; forms submit decimal strings the API parses. Centralizes rounding/precision so the UI never does float math.
- **UI/design system:** Tailwind + ShadCN. Shared primitives + composite components: `DataTable` (server pagination/sort/date-range/export), `MoneyInput`, `QuantityInput`, `ChargeRows` (dynamic add/remove revenue charges), `PartyPicker` (async customer/vendor search), `KpiCard`, `RoleGate`, `ConfirmDialog`.
- **Feedback:** toast on mutation success/error (maps `ApiError.code` → friendly message), skeleton loaders on queries, empty states, and a global error boundary.

---

## 6. Routing, layout & navigation

- **AuthLayout:** `/login`.
- **AppShell** (authenticated): left sidebar filtered by role, topbar with business date + user menu (logout / logout-all).
- **Routes** (guarded):

| Path | Page | Access |
|------|------|--------|
| `/login` | Login | public |
| `/` | Dashboard (Owner) / Operator home | auth; Owner sees full KPIs |
| `/sales`, `/sales/new` | Sales list + **POS sale form** | auth (profit hidden for Operator) |
| `/purchases`, `/purchases/new` | Purchases list + form | auth |
| `/customers`, `/customers/:id` | Customers + detail (ledger, holdings) | auth |
| `/vendors`, `/vendors/:id` | Vendors + detail (ledger, aging, pay) | auth |
| `/cylinders` | Pending cylinders + **return form** | auth |
| `/expenses` | Expenses list + form | auth |
| `/cash` | Cash movements + **daily closing** | auth |
| `/inventory` | Gas + cylinder stock | auth |
| `/adjustments` | Inventory adjustments | **Owner** |
| `/reports/*` | P&L, sales, purchases, expenses, receivables, payables, business worth | **Owner** |
| `/setup/*` | Settings, cylinder types, payment accounts, **opening balances** | **Owner** |
| `/users` | User management | **Owner** |

---

## 7. Screen-by-screen (mapped to real endpoints)

- **Login** → `POST /auth/login`; silent boot via `POST /auth/refresh`.
- **Dashboard (Owner)** → `GET /dashboard`: KPI cards (gas stock/WAC/value, filled/empty/held cylinders, cash, AR, AP, today/month sales & expenses, gross/net profit MTD). Operator home: stock + quick actions only.
- **POS Sale** (`/sales/new`, highest-value screen) → `POST /sales`: customer picker, exchange/no-cylinder toggle, cylinder type + count, qty/rate, **dynamic charge rows**, discount, payment type (full/partial/credit), **previous-balance recovery field clearly separated from the invoice total**, optional deposit (no-cylinder), payment account. Live invoice preview. Profit/COGS never shown to Operators (and not returned to them).
- **Purchase** (`/purchases/new`) → `POST /purchases`: vendor, qty, rate, transport, misc, live landed-cost total, payment type + account.
- **Customers** → `GET/POST /customers`, detail pulls `GET /customers/:id`, `/ledger`, `/cylinders`.
- **Vendors** → `GET/POST /vendors`, detail pulls `/ledger`, `/aging`, and a **Pay vendor** dialog → `POST /vendors/:id/payments`.
- **Cylinder returns** (`/cylinders`) → `GET /cylinders/pending` + `POST /cylinders/returns` (good/damaged/lost, refund toggle).
- **Expenses** → `GET/POST /expenses`, categories via `/expenses/categories`.
- **Cash** → `POST /cash/movements`, `POST /cash/closings` (daily closing shows expected vs counted → variance).
- **Inventory** → `GET /inventory/gas`, `GET /inventory/cylinders`.
- **Adjustments** (Owner) → `GET/POST /adjustments`.
- **Reports** (Owner) → the `/reports/*` group + `/reports/business-worth`, each with date-range pickers and export.
- **Setup** (Owner) → `/setup/settings`, `/setup/cylinder-types`, `/setup/payment-accounts`, `/setup/opening-balances` (one-time, lockable wizard).
- **Users** (Owner) → `/users` CRUD + reset password.

---

## 8. Frontend milestone roadmap (mirrors the backend, ships incrementally)

| FE milestone | Contents | Depends on |
|--------------|----------|-----------|
| **FE-M0 Scaffold** | Vite+TS+Tailwind+ShadCN init, dev proxy (D1), API client + envelope/error handling, money layer, QueryClient, base UI primitives, test harness | — |
| **FE-M1 Auth & shell** | AuthProvider (in-memory token + silent refresh + 401 retry), login page, AppShell, role guards, logout | FE-M0 |
| **FE-M2 Setup & Users** | Settings, cylinder types, payment accounts, opening-balances wizard, user management (Owner) | FE-M1 |
| **FE-M3 Inventory + Dashboard** | Stock screens, dashboard KPIs, KpiCard, DataTable | FE-M1 |
| **FE-M4 Vendors & Purchases** | Vendor CRUD/detail/aging/pay, purchase form | FE-M3 |
| **FE-M5 Customers & Sales** | Customer CRUD/detail, **POS sale** with charges/recovery/limits, profit-hiding | FE-M3 |
| **FE-M6 Cylinders & Deposits** | Pending list, return flow | FE-M5 |
| **FE-M7 Expenses & Cash** | Expense form/list, cash movements, daily closing | FE-M3 |
| **FE-M8 Adjustments** | Owner adjustment form/list | FE-M3 |
| **FE-M9 Reports** | P&L, sales/purchase/expense, receivables/payables, business worth, exports | FE-M3 |
| **FE-M10 Polish** | Empty/error states, optimistic POS, a11y, responsive, e2e smoke | all |

*Recommended first slice (per D2): FE-M0 → FE-M1 → FE-M3 (dashboard+inventory) → FE-M5 (POS) → FE-M4 (purchases) → then fan out.*

---

## 9. Testing & tooling

- **Unit/component:** Vitest + React Testing Library (money formatting, form validation, role gating, API client envelope/refresh logic with mocked fetch).
- **E2E (optional, FE-M10):** Playwright smoke — login → record a sale → see it on dashboard — against the dev server proxied to a seeded backend.
- **Tooling:** ESLint + Prettier (match backend config style), TypeScript strict, `npm run dev/build/test/lint`. Vite env (`VITE_API_BASE` if not proxying).

---

## 10. Risks / notes

- **R1 (cookie/CORS):** mitigated by D1 (Vite proxy → same origin). If a split origin is ever required, the backend needs CORS-with-credentials and `sameSite` revisited.
- **R2 (money consistency):** the backend mixes minor-unit numbers and pre-formatted strings; D3 normalizes on the client. (A future backend cleanup could standardize responses.)
- **R3 (Operator data hiding):** the UI must never assume profit fields exist — render defensively (`field ?? hidden`), since the backend strips them.
- **R4 (idempotency UX):** generate the key when the form mounts (not per click) so genuine retries dedupe but distinct submissions don't collide.

---

*End of plan. No frontend code produced. On approval, the first step is **FE-M0 (scaffold)** under `client/`, validated the same way as the backend (typecheck + lint + tests green) before building features.*
