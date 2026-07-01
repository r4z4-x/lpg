# Chart of Accounts & Posting Templates

> Companion to `ARCHITECTURE.md`. Implements the double-entry decision (F2). Planning only — no code.
> **Conventions:** Every business event = one balanced `LedgerEntry` (Σdebit = Σcredit). Money stored as integer minor units / `Decimal128` (F5). V1 has **no tax** (Q3) — tax lines exist and post 0. Deposits are **optional** (Q2). Payment accounts are **Cash + Bank** (Q5).

---

## 1. Account ranges

| Range | Class | Normal balance |
|-------|-------|----------------|
| 1000–1999 | Assets | Debit |
| 2000–2999 | Liabilities | Credit |
| 3000–3999 | Equity | Credit |
| 4000–4999 | Income | Credit |
| 5000–5999 | Cost of Goods Sold | Debit |
| 6000–6999 | Operating Expenses | Debit |

---

## 2. The chart

### Assets (1xxx)
| Code | Account | Type | Notes |
|------|---------|------|-------|
| 1010 | Cash | Asset | Payment account "Cash" (Q5) |
| 1020 | Bank | Asset | Payment account "Bank" (Q5) |
| 1100 | Accounts Receivable | Asset | Customer balances owed to us |
| 1110 | Advances to Vendors | Asset | Prepaid to supplier (optional) |
| 1200 | Gas Inventory | Asset | **Sole valued gas store** (F1) = availableKg × WAC |
| 1300 | Cylinder Assets (shells) | Asset | Steel shells only — NOT gas (F1) |

### Liabilities (2xxx)
| Code | Account | Type | Notes |
|------|---------|------|-------|
| 2010 | Accounts Payable | Liability | Owed to vendors |
| 2100 | Cylinder Deposit Liability | Liability | Refundable deposits held (Q2, optional) |
| 2200 | Customer Advances | Liability | Customer overpayments / advance balance (G4) |
| 2300 | Tax Payable | Liability | **Unused in V1** (posts 0); reserved for future (Q3) |
| 2400 | Accrued / Outstanding Expenses | Liability | Expense incurred, not yet paid |

### Equity (3xxx)
| Code | Account | Type | Notes |
|------|---------|------|-------|
| 3010 | Owner Capital | Equity | Owner's invested capital |
| 3020 | Opening Balance Equity | Equity | Contra for all opening balances (M7) |
| 3030 | Retained Earnings | Equity | Accumulated profit (period close) |
| 3040 | Owner Drawings | Equity (contra) | Owner withdrawals |

### Income (4xxx)
| Code | Account | Type | Notes |
|------|---------|------|-------|
| 4010 | Sales Revenue — Gas | Income | Gas amount only |
| 4021 | Charges — Delivery | Income | Revenue charge |
| 4022 | Charges — Cylinder Rent | Income | Revenue charge |
| 4023 | Charges — Loading | Income | Revenue charge |
| 4025 | Charges — Other | Income | Catch-all dynamic charge |
| 4030 | Damage Recovery Income | Income | Recovered cylinder damage |
| 4040 | Cash Over | Income | Daily-closing overage (M3) |
| 4090 | Sales Discount Allowed | Income (contra) | Debit — reduces revenue |

> Dynamic charge rows map to 402x by name; unmapped names fall to **4025 Other**.

### Cost of Goods Sold (5xxx)
| Code | Account | Type | Notes |
|------|---------|------|-------|
| 5010 | Cost of Gas Sold | COGS | qty × WAC **snapshotted at sale** (F3) |
| 5020 | Inventory Loss / Shrinkage | COGS | Leakage/damage adjustments |

### Operating Expenses (6xxx)
| Code | Account | Type | Notes |
|------|---------|------|-------|
| 6010 | Salary | Expense | |
| 6020 | Labour | Expense | |
| 6030 | Fuel | Expense | |
| 6040 | Maintenance | Expense | |
| 6050 | Office | Expense | |
| 6060 | Utilities | Expense | |
| 6070 | Misc | Expense | |
| 6080 | Cash Short | Expense | Daily-closing shortage (M3) |
| 6900+ | Custom categories | Expense | Allocated dynamically from `expenseCategories` |

---

## 3. Posting templates (one balanced entry per event)

Notation: **Dr** = debit, **Cr** = credit. Amounts in minor units.

### 3.1 Opening balances (System Setup, posts once, then locked)
| Item | Dr | Cr |
|------|----|----|
| Opening cash | 1010 Cash | 3020 Opening Balance Equity |
| Opening bank | 1020 Bank | 3020 |
| Opening gas stock | 1200 Gas Inventory | 3020 |
| Opening cylinder shells | 1300 Cylinder Assets | 3020 |
| Opening customer receivables | 1100 AR | 3020 |
| Opening vendor payables | 3020 | 2010 AP |
| (optional) reclassify net | 3020 | 3010 Owner Capital |

### 3.2 Gas purchase (landed cost = gas + transport + misc)
| Scenario | Dr | Cr |
|----------|----|----|
| Paid in full | 1200 Gas Inventory (landed) | 1010/1020 (landed) |
| Partial | 1200 Gas Inventory (landed) | 1010/1020 (paid) **+** 2010 AP (remainder) |
| Credit | 1200 Gas Inventory (landed) | 2010 AP (landed) |

*Shell register (counts only, no ledger value): `empty → filled` by `qty/capacity`.*

### 3.3 Vendor payment (standalone)
`Dr 2010 AP` / `Cr 1010 Cash` or `1020 Bank`.

### 3.4 Sale — revenue recognition (Entry A)
| Dr | Cr |
|----|----|
| 1100 Accounts Receivable = invoiceAmount | 4010 Sales Gas = gasAmount |
| 4090 Sales Discount = discount | 402x Charges = Σcharges |
|  | 2300 Tax Payable = tax (0 in V1) |

Balance check: `AR + discount = gas + charges + tax` ✓ (since `invoice = gas + charges − discount + tax`).

### 3.5 Sale — cash receipt (Entry B, same transaction)
`Dr 1010/1020 (totalReceived)` / `Cr 1100 AR (totalReceived)`.
- `totalReceived = invoice portion paid + previous-balance recovery`.
- **Revenue is untouched by recovery** — recovery only reduces AR (key accounting rule). ✓
- Overpayment beyond AR → `Cr 2200 Customer Advances` for the surplus (G4).

### 3.6 COGS on sale (Entry C, same transaction)
`Dr 5010 Cost of Gas Sold` / `Cr 1200 Gas Inventory` = `qty × WAC_snapshot` (F3).

### 3.7 No-cylinder sale — deposit (optional, Q2)
If deposit collected: `Dr 1010/1020 (deposit)` / `Cr 2100 Cylinder Deposit Liability`. If 0 → no entry. *Shell register: `filled → customerHeld`.*

### 3.8 Cylinder return
- Deposit refund (good condition): `Dr 2100 Deposit Liability` / `Cr 1010/1020`.
- Damaged/lost: `Cr 4030 Damage Recovery` (Dr Cash/AR) and/or forfeit deposit (`Dr 2100` / `Cr 4030`); shell register `customerHeld → empty | damaged | lost`; valuation loss if shell written off (`Dr 5020` / `Cr 1300`).

### 3.9 Expense
| Scenario | Dr | Cr |
|----------|----|----|
| Paid | 60xx Expense | 1010/1020 |
| Unpaid (accrued) | 60xx Expense | 2400 Accrued Expenses |
| Pay accrued later | 2400 Accrued Expenses | 1010/1020 |

### 3.10 Inventory adjustment (leakage/damage/correction)
`Dr 5020 Inventory Loss` / `Cr 1200 Gas Inventory` (gas) and/or `Cr 1300 Cylinder Assets` (shell). Manual correction up: reverse sides. Owner-only, fully audited.

### 3.11 Daily cash closing variance
| Variance | Dr | Cr |
|----------|----|----|
| Shortage (actual < expected) | 6080 Cash Short | 1010 Cash |
| Overage (actual > expected) | 1010 Cash | 4040 Cash Over |

### 3.12 Reversal (corrections — never edit posted entries, G5)
Post a mirror entry with swapped Dr/Cr referencing `reversalOf`, then re-post the correct entry. Original stays immutable for audit.

---

## 4. Derived statements (read-only)
- **Trial balance:** Σ all account debits = Σ all account credits (always true if every entry balanced).
- **P&L:** Income (4xxx) − COGS (5xxx) − Expenses (6xxx) = Net Profit. Gross Profit = Income(sales+charges) − COGS.
- **Balance sheet / Business Worth:** Assets (1xxx) − Liabilities (2xxx) = Equity (3xxx) → reconciles the Business Worth engine to the ledger.
