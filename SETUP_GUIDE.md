# Setup Guide — Run the LPG System on Another Machine (localhost)

This guide takes a fresh machine to a running app in ~10 minutes. The project has two parts:

```
sample/
  server/   ← backend API (Node + Express + TypeScript + MongoDB)
  client/   ← frontend SPA (React + Vite + TypeScript)
```

---

## 1. Prerequisites

Install these first:

| Tool | Version | Why | Get it |
|------|---------|-----|--------|
| **Node.js** | ≥ 20 (22 recommended) | runs both apps | https://nodejs.org |
| **Docker Desktop** | any recent | runs MongoDB as a replica set | https://www.docker.com/products/docker-desktop |
| **Git** | optional | to clone the repo | https://git-scm.com |

> **Why a replica set?** The system uses MongoDB multi-document transactions (so every sale/purchase is all-or-nothing). Transactions require a replica set — a plain `mongod` won't work. The included `docker compose` sets up a single-node replica set automatically. (No Docker? See **§7**.)

Verify the tooling:
```bash
node -v      # v20+ or v22+
npm -v
docker -v    # and make sure Docker Desktop is running
```

---

## 2. Get the code

Either copy the whole `sample/` folder to the new machine, or clone it:
```bash
git clone <your-repo-url> sample
cd sample
```

---

## 3. Backend — install, database, seed, run

```bash
cd server
npm install

# (optional) create a .env from the template; the defaults already work for local dev
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env

# start MongoDB (single-node replica set "rs0"); first run pulls the image
docker compose up -d

# wait ~20s until it reports healthy:
docker inspect --format "{{.State.Health.Status}}" lpg-mongo   # → healthy

# seed the database with a ready-to-demo business (recommended)
npm run seed:demo
#   or, base reference data only (no sample transactions):
#   npm run seed

# start the API (http://localhost:4000)
npm run dev
```
Leave this terminal running. Quick check (new terminal): open http://localhost:4000/health → `{"ok":true,"data":{"status":"ok"}}`.

---

## 4. Frontend — install and run

In a **second terminal**:
```bash
cd client
npm install
npm run dev
```
Vite prints the URL — usually **http://localhost:5173** (or the next free port, e.g. **5174**, if 5173 is taken). Open it in your browser.

The dev server proxies all `/api/*` calls to the backend on `:4000`, so the SPA and API are same-origin (the login refresh cookie works with no extra config).

---

## 5. Log in

| Role | Email | Password |
|------|-------|----------|
| **Owner** | `owner@example.com` | `changeme123` |
| **Operator** | `operator@example.com` | `operator123` |

(The Operator account is created by `npm run seed:demo`. With plain `npm run seed`, only the Owner exists — create staff under **Users**.)

> **Change these immediately for any real/shared deployment.** Set `OWNER_EMAIL` / `OWNER_PASSWORD` in `server/.env` **before** the first seed to choose different owner credentials.

If you ran `seed:demo`, you'll already see sample stock, a vendor + purchase, customers, a sale, and an expense — ready to present.

---

## 6. What `seed:demo` creates

- Reference data: chart of accounts, company settings, cylinder types, Cash + Bank accounts, expense categories.
- **Owner** + **Operator** users.
- **Opening balances:** 100,000 cash · 1,000 kg gas valued 250,000 (cost 250/kg) · 100 filled + 50 empty cylinders.
- **Vendor** "Sui Gas Co" + a 500 kg @ 230 purchase (blends weighted-average cost to ~246.67).
- **Customers:** Walk-in, Old Debtor (owes 10,000), New Hotel.
- A sample **exchange sale** and a **Fuel expense**.

It is **idempotent**: re-running won't duplicate the business data (it only seeds extras on a fresh database), and opening balances post only once.

---

## 7. No Docker? Two alternatives for MongoDB

The app needs a MongoDB **replica set**. If you can't use Docker:

**(a) MongoDB Atlas (free cloud cluster)** — Atlas clusters are replica sets by default.
1. Create a free cluster at https://www.mongodb.com/atlas, add a DB user, allow your IP.
2. Put the connection string in `server/.env`:
   ```
   MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/lpg_dev?retryWrites=true&w=majority
   ```
3. Skip `docker compose`; just `npm run seed:demo` and `npm run dev`.

**(b) Local MongoDB as a single-node replica set**
1. Install MongoDB Community Server.
2. Start it with a replica set name: `mongod --replSet rs0 --dbpath <data-dir>`
3. Initiate once in `mongosh`: `rs.initiate()`
4. Keep the default `MONGODB_URI` (it points at `127.0.0.1:27017?replicaSet=rs0&directConnection=true`).

---

## 8. Environment variables (`server/.env`)

All have working local defaults; override for real deployments.

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `4000` | API port |
| `MONGODB_URI` | local replica set | point at Docker / Atlas / local mongod |
| `BUSINESS_TIMEZONE` | `Asia/Karachi` | day/month bucketing for reports |
| `JWT_ACCESS_SECRET` | dev default | **set a strong secret for real use** |
| `JWT_REFRESH_SECRET` | dev default | **set a strong secret for real use** |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | refresh token lifetime |
| `OWNER_NAME` / `OWNER_EMAIL` / `OWNER_PASSWORD` | Owner / owner@example.com / changeme123 | bootstrap owner; set **before** first seed |

The frontend needs no env for local dev (it uses the Vite proxy). If you change the backend port, update the proxy target in `client/vite.config.ts`.

---

## 9. Daily start / stop

**Start** (two terminals):
```bash
# Terminal 1
cd server && docker compose up -d && npm run dev
# Terminal 2
cd client && npm run dev
```

**Stop:** Ctrl-C both dev servers. Then:
- `docker compose stop` — stop DB, **keep data**
- `docker compose down` — remove container, keep data volume
- `docker compose down -v` — remove container **and wipe all data** (fresh start; re-seed afterwards)

---

## 10. Verify the install is healthy

```bash
# backend tests (spin up their own in-memory replica set; Docker not required for tests)
cd server && npm test          # → 79 passing

# frontend checks
cd client && npm test          # → passing
cd client && npm run build     # → production build succeeds
```

> **Note on `server` tests:** each test file launches its own in-memory MongoDB **replica set**, which is RAM/CPU-heavy. Run them on a machine that isn't already running Docker Desktop **and** both dev servers, or you may see files fail to start their replica set (a resource timeout, not a code failure). On a quiet machine the suite is green (79/79). The frontend tests are lightweight and unaffected.

---

## 11. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `docker compose` fails: "cannot connect to the Docker API" | Docker Desktop isn't running — start it, wait for the whale icon, retry. |
| Backend exits: connection / transaction errors | Mongo isn't a replica set, or not healthy yet. Confirm `docker inspect ... lpg-mongo` is `healthy`, or use Atlas (§7a). |
| Login fails / "Invalid credentials" | Database not seeded — run `npm run seed:demo`. Use the exact owner credentials (or your `.env` overrides). |
| Frontend shows a different app | Port 5173 was busy — use the port Vite printed (e.g. 5174). |
| Frontend loads but every call fails | Backend not running on :4000, or proxy target wrong in `vite.config.ts`. |
| "Insufficient gas stock" / can't sell | Run `seed:demo` (loads stock), or buy gas + ensure filled cylinders exist (Opening balances / Adjustment). |
| Port 4000 already in use | Set `PORT` in `server/.env` and update the proxy target in `client/vite.config.ts`. |

---

## 12. Reference docs in this repo

- `DEMO_GUIDE.md` — step-by-step client demo script.
- `ARCHITECTURE.md` — full system blueprint and design decisions.
- `CHART_OF_ACCOUNTS.md` · `DATA_MODEL.md` · `FRONTEND_PLAN.md` — accounting, data, and UI plans.
- `server/README.md` · `client/README.md` — per-app notes.
