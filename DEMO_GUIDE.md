# LPG Gas Cylinder Management System — Demo & Usage Guide

A client-facing walkthrough of the working system. Follow the **Guided Demo** for a smooth 12–15 minute end-to-end story; use the **exact values** given so the numbers come out clean.

---

## 1. What you're showing

A complete LPG distribution management system that runs the full daily business cycle:

- **Buy gas** from vendors (cash / credit), with automatic cost averaging.
- **Sell gas** to customers — both *exchange* (customer brings an empty) and *no-cylinder* (you issue a company cylinder on deposit).
- **Track cylinders** — filled, empty, with customers, lost, damaged — and **deposits**.
- **Money** — customer receivables, vendor payables, expenses, cash, daily cash closing.
- **Owner intelligence** — live dashboard, profit & loss, business net worth, full reports.
- **Controls** — every transaction is double-entry balanced and audited; staff (Operators) cannot see profit or cost.

> **One-line pitch:** "Every sale, purchase, payment, and cylinder move is recorded with proper double-entry accounting, so the owner always knows exact stock, cash, profit, and business worth — in real time."

---

## 2. Before the demo (5 minutes earlier)

Both apps should already be running (database + backend + frontend). To confirm:

| Check | Expected |
|-------|----------|
| Frontend | **http://localhost:5174** shows the "LPG Console" sign-in (note: 5174, since 5173 was busy) |
| Backend | http://localhost:4000/health → `{"ok":true,...}` |
| Database | Docker container `lpg-mongo` healthy |

**Login (Owner):**
- Email: `owner@example.com`
- Password: `changeme123`

> **The database is pre-populated** (via `npm run seed:demo`): opening balances, a vendor + purchase (so weighted-average cost is already blended to ~246.67), three customers, a sample sale, and an expense. You can present the existing data immediately, or **reset for a live "set up from scratch" demo** — see **§7**.

### UI orientation (read this once before presenting)
- **Sidebar is grouped** into collapsible sections (Overview, Sales & Customers, Purchasing, Finance, Administration). Click a section header to expand/collapse. Owner sees all groups; Operators see only their allowed ones.
- **Every create/action is a button** (e.g. "+ New sale", "+ Add customer", "Record payment") that opens a **dialog** with the form. Submitting shows a **notification in the top-right corner** (green = success, red = error).
- **Tables have search + pagination**; transaction screens (Sales, Purchases, Expenses) also have a **date-range filter**.
- **Amounts are colored** — negative in **red**, positive in **green** — across the whole app, so shortfalls/debts stand out at a glance.

---

## 3. Roles to mention

- **Owner** — sees everything: dashboard, profit, reports, business worth, setup, users.
- **Operator** — front-desk staff: can record sales, purchases, expenses, customers — **but cannot see profit, cost, reports, or business worth.** (We prove this live at the end.)

---

## 4. Guided demo (do these in order)

### Act 1 — "Set up the business" (Owner)

**4.1 Open the books with Opening Balances** — *Setup → System setup → Opening balances*

This establishes starting cash, gas stock (which sets the starting cost), and cylinders, all in one balanced entry.
- Cash/bank account: **Cash** — Opening amount: **100000**
- Opening gas (kg): **1000** — Opening gas value: **250000**  → *(starting cost = 250.00 / kg)*
- Cylinder type: **Commercial** (or any) — Filled: **100**, Empty: **50**, Shell value: **50000**
- Click **Post opening balances**.

> Talking point: "We just told the system we're starting with 1,000 kg of gas worth 250,000, 100 filled and 50 empty cylinders, and 100,000 cash — and it recorded a balanced opening entry automatically."

**4.2 (Optional) Add a cylinder type with a deposit** — *Setup → Cylinder types*
- Name: **Domestic 11.8kg (deposit)**, Capacity kg: **11.8**, Tare kg: **15.5**, Deposit: **2000** → **Add**

> We'll use the deposit later. (If you'd rather keep it simple, skip this and use the existing types — deposits just won't appear.)

### Act 2 — "Buy gas" (Owner or Operator)

**4.3 Add a vendor** — *Vendors → Add vendor*
- Name: **Sui Gas Co** → **Add vendor**

**4.4 Record a purchase** — *Purchases → New purchase*
- Vendor: **Sui Gas Co**, Quantity (kg): **500**, Rate/kg: **230**, Transport: **5000**, Payment: **Full**, Account: **Cash** → **Record purchase**

> Talking point: "Landed cost was 120,000 for 500 kg. Notice the **weighted average cost** updated automatically — it blended the old 250 with the new ~240 to about **246.67 / kg**. We never guess the cost; profit is always based on this average." (Check it on **Inventory** or the **Dashboard**.)

### Act 3 — "Sell gas" (the core)

**4.5 Add a customer** — *Customers → Add customer*
- Name: **Walk-in Customer** → **Add customer**

**4.6 Exchange sale (customer brings an empty)** — *Sales → New sale*
- Customer: **Walk-in Customer**, Type: **Exchange**, Cylinder type: *(your filled type)*, Count: **1**
- Gas qty (kg): **50**, Sale rate/kg: **300**
- Add charge → **Delivery / 200**; Discount: **100**; Payment: **Full**, Account: **Cash**
- Watch the **Invoice preview** update to **15,100.00** → **Record sale**

> Talking points: "Invoice = gas 15,000 + delivery 200 − discount 100 = **15,100**. Behind the scenes it also recorded the cost of goods sold and swapped a filled cylinder for an empty. As the Owner I can see the **COGS** column; an Operator cannot."

**4.7 Show the key accounting rule — previous-balance recovery**
- *Customers → Add customer* → Name: **Old Debtor**, **Opening receivable: 10000** → Add (this customer already owes 10,000).
- *Sales → New sale*: Customer **Old Debtor**, Exchange, qty **25**, rate **200**, Payment **Full**, **Previous balance recovery: 10000**, Account: **Cash** → Record.

> Talking point (important): "The customer paid 15,000 — 5,000 for today's gas and 10,000 toward their old balance. The system records **only 5,000 as revenue**; the 10,000 just clears their old debt. This is a rule many systems get wrong — paying off old debt is **not** new income."

**4.8 No-cylinder sale with a deposit** — *Sales → New sale*
- *Customers → Add customer* → **New Hotel** → Add.
- New sale: Customer **New Hotel**, Type: **No cylinder**, Cylinder type: **Domestic 11.8kg (deposit)**, Count: **2**, qty **23.6**, rate **300**, Payment **Full**, Account **Cash**, ✅ **Collect cylinder deposit** → Record.

> Talking point: "We issued 2 company cylinders and collected a refundable deposit (2 × 2,000 = 4,000). The deposit is held as a **liability**, not revenue — we owe it back when they return the cylinders."

### Act 4 — "Cylinders come back"

**4.9 Return cylinders** — *Cylinders*
- See **New Hotel** in *pending returns*. In **Return cylinders**: Customer **New Hotel**, type **Domestic 11.8kg (deposit)**, Qty **1**, Condition **Good**, ✅ **Refund deposit**, Account **Cash** → **Process return**.

> Talking point: "One cylinder came back in good condition, so we refunded 2,000 of the deposit. If it were **lost or damaged**, the deposit is forfeited and booked as income — try it with Qty 1 / Lost."

### Act 5 — "Money management"

**4.10 Record an expense** — *Expenses*
- Category **Fuel**, Amount **5000**, Account **Cash** → **Record expense**.

**4.11 Daily cash closing** — *Cash*
- See the live **Cash** balance. In **Daily cash closing**: Account **Cash**, Business date *(today)*, Counted cash: enter a figure slightly different from the shown balance → **Close day**.

> Talking point: "At day end the cashier counts the drawer. Any shortage or overage is recorded automatically — nothing is swept under the rug."

### Act 6 — "Owner intelligence"

**4.12 Dashboard** — *Dashboard* — point out live gas stock & average cost, cylinder positions, cash, receivables/payables, today/month sales & expenses, and **gross/net profit**.

**4.13 Reports** — *Reports*
- **Profit & Loss** (leave dates as-is for all-time): revenue, COGS, gross profit, expenses, net profit.
- **Business worth**: Assets − Liabilities = Net worth, with **"Balanced ✓"** — proving the books tie out.
- **Receivables / Payables** lists.

**4.14 Inventory adjustment (leakage)** — *Adjustments*
- Type **Leakage**, Reason **tank leak**, Gas qty **10**, Direction **Decrease** → Record. Show stock + value drop on **Inventory**.

### Act 7 — "Controls & staff access"

**4.15 Create an Operator** — *Users → Add user*
- Name **Front Desk**, Email **operator@example.com**, Password **operator123**, Role **Operator** → Create.

**4.16 Log in as the Operator** (use a private/incognito window, or log out)
- Sign in as `operator@example.com` / `operator123`.
- **Show:** the sidebar has **no** Dashboard, Reports, Setup, Users, or Adjustments. Open **Sales** — the **COGS column is gone**. Operators run the front desk without ever seeing profit or cost.

> Talking point: "Staff get exactly what they need to serve customers — and nothing that exposes your margins or lets them alter the books."

---

## 5. Headline talking points (the "why it's solid")

- **Real double-entry accounting** — every transaction posts a balanced ledger entry; the trial balance and business worth always reconcile.
- **Weighted-average costing** — purchase costs blend automatically; profit uses true average cost, never a guess or the latest price.
- **Cost of goods locked at sale time** — historical profit never shifts when new stock arrives.
- **Deposits handled correctly** — held as a liability, refunded on return, forfeited (to income) if lost/damaged.
- **Receivable recovery ≠ revenue** — old-balance payments clear debt, they don't inflate sales.
- **Role-based access** — Operators can't see profit, reports, or worth.
- **Audit trail** — who did what, when, with before/after values.
- **Safe under retries** — duplicate submissions (double-click / flaky network) can't create duplicate sales.

---

## 6. Suggested timing (≈12 min)

| Min | Segment |
|-----|---------|
| 0–2 | Login + Opening balances ("set up the business") |
| 2–4 | Vendor + purchase (show WAC blending) |
| 4–8 | Exchange sale, previous-balance recovery, no-cylinder + deposit |
| 8–9 | Cylinder return (deposit refund) |
| 9–10 | Expense + cash closing |
| 10–12 | Dashboard, Reports, Business worth, then Operator login |

---

## 7. Reset to a clean slate (optional, before a fresh run)

From `D:\sample\server`:
```bash
docker compose down -v      # wipes the database volume
docker compose up -d        # fresh replica set
npm run seed                # re-create accounts, owner, settings, cylinder types, accounts, categories
```
Then refresh the browser and log in again. (Opening balances can be posted once per fresh database.)

---

## 8. Start / stop the system

**Start (two terminals):**
```bash
# Terminal 1 — backend
cd D:\sample\server
docker compose up -d        # database
npm run dev                 # API on :4000

# Terminal 2 — frontend
cd D:\sample\client
npm run dev                 # SPA (opens on :5173 or next free port, e.g. :5174)
```

**Stop:** Ctrl-C each dev server; `docker compose stop` (keeps data) or `docker compose down` (removes container, keeps volume).

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Frontend opens a *different* app | Another Vite app holds 5173 — use the port Vite prints (e.g. **5174**). |
| Login fails / "Invalid credentials" | Database not seeded — run `npm run seed`. Default owner: `owner@example.com` / `changeme123`. |
| Spinner / "Failed to load" everywhere | Backend not running, or DB unhealthy — check `docker ps` and that `:4000/health` responds. |
| "Insufficient gas stock" on a sale | Buy gas (Purchases) and ensure filled cylinders exist (Opening balances / Adjustment add filled). |
| "Opening balances already posted" | They're one-time per database. Reset (§7) to redo, or just proceed — stock can be topped up via Purchases + Adjustments. |
| Can't sell an *exchange* / *no-cylinder* order | You need **filled cylinders** of that type in stock (set via Opening balances or an Adjustment `filled +N`). Bulk purchases add gas value, not filled shells. |

---

## 10. What's been built (for the technical conversation)

- **Backend:** Node + Express + TypeScript, MongoDB (replica set), double-entry ledger, weighted-average costing engine, JWT auth with refresh-token rotation, RBAC, idempotency, full audit trail. **79 automated tests.**
- **Frontend:** React + Vite + TypeScript + Tailwind + ShadCN + TanStack Query. Role-aware UI, 13 screens across the full workflow. Production build verified.
- **Coverage:** Auth/Users, System Setup, Inventory & Costing, Vendors & Purchases, Customers & Sales, Cylinders & Deposits, Expenses & Cash, Adjustments, Reports, Dashboard, Business Worth.
- **Documented:** architecture blueprint, chart of accounts, data model, and milestone plans (see `ARCHITECTURE.md`, `CHART_OF_ACCOUNTS.md`, `DATA_MODEL.md`, `FRONTEND_PLAN.md`).

> **Roadmap items intentionally deferred** (good to mention as "phase 2"): customer advance/overpayment handling, transaction reversal screens, automatic cylinder-filling on purchase, pre-aggregated reporting for very large datasets, and mobile-optimized navigation.
