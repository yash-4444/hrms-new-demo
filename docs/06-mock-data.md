# 06 · Mock data

`src/mock/` is the entire data layer. It is not throwaway — a demo dies the moment someone
adds up a column and it is wrong, so these fixtures are built to reconcile.

## Two hard rules

### 1. Deterministic — no exceptions

Every fixture is generated from a **fixed seed** through `mulberry32` in `src/lib/utils.ts`.

```ts
const rng = mulberry32(20260916);   // same seed -> same 340 employees, every time
```

**Never** use at module scope:

- `Math.random()`
- `new Date()` with no argument, or `Date.now()`

Both would produce different values on the server pass and the client pass, and React
would throw a hydration mismatch. "Today" is the constant `DEMO_TODAY = "2026-09-16"` (and
`DEMO_NOW` for times) exported from `src/mock/org.ts`. Anything genuinely live — the punch
timer — is started inside a `useEffect`, never during render.

### 2. Numbers reconcile

Each module fixture ships an executable check:

| Module | Invariant | Checker |
|---|---|---|
| Leave | `Available = Opening + Accrued − Used + Adjusted + CarryForward − Encashed − Lapsed`, and the ledger's running balance lands on it | `verifyLedger()` |
| Payroll | `Gross − Deductions = Net` per employee; run totals = sum of rows; the traced payslip agrees with the row | `verifyRun(runId)` |
| Growth | Every employee's goal weightages sum to 100 | `GOAL_WEIGHT_CHECK` |
| People | Department and branch headcounts match `DEPARTMENTS` / `BRANCHES` exactly | asserted at generation |

Verified on the current build:

```
leave.verifyLedger  -> { ok: true, balances: 187, transactions: 628 }
PR-2026-09  309 rows  gross − deductions === net ✓
PR-2026-08  309 rows  gross − deductions === net ✓
goal weightages      -> every owner totals 100 ✓
```

## The files

| File | Contains |
|---|---|
| `org.ts` | Tenant, 4 branches, 9 departments, 7 grades, designations, holidays, `DEMO_TODAY` |
| `employees.ts` | 340 employees + the org hierarchy and its helpers |
| `insights.ts` | Aggregates for `/dashboard`, `/analytics`, `/reports` |
| `attendance.ts` | 90 days × 40 employees of punch data |
| `leave.ts` | Types, balances, ledger, applications, accrual configs, runs, the 13 policy rules |
| `payroll.ts` | The salary engine, statutory computation, pay runs, traced payslips |
| `hiring.ts` | 12 requisitions, 60 candidates, interviews, scorecards, offers |
| `growth.ts` | Goals, review cycles and forms, the 9-box, courses, compliance training |
| `workplace.ts` | 180 assets, 50 expense claims, 18 travel requests, 40 tickets, 14 announcements |
| `admin.ts` | 64 users, 220 audit entries, 32 compliance filings, tenant settings |
| `people-extras.ts` | Documents, lifecycle timeline, compensation history for the profile tabs |

## The employee generator

`employees.ts` is the spine — most other fixtures key off employee codes.

Guarantees it enforces at generation time:

- Codes `STL-0001` … `STL-0340`, no gaps.
- Department headcounts match `DEPARTMENTS[].headcount` **exactly** (128 Engineering,
  52 Sales, …). Branch headcounts likewise (214 Bengaluru, 92 Pune, 31 Newark, 3 Hyderabad).
- A reporting hierarchy **exactly 4 levels deep (0–3) with no cycles** — a manager is
  always drawn from a strictly lower level index. `managerChain()` walks to the CEO with a
  `seen` set as a belt-and-braces guard.
- The six demo personas occupy reserved codes with hand-authored attributes.
- **Vikram Shah has exactly 8 reportees**, because his persona blurb says so. He is held in
  a `CLOSED_MANAGERS` set so the generator cannot hang extra reports off him.
- No duplicate names.
- Exactly 3 employees with `hasBankDetails: false` — these are the source of the payroll
  bank-detail exception.
- Joining dates spread over 8 years, weighted toward recent hires.

Useful exports: `employeeByCode`, `employeeName`, `reporteesOf`, `descendantsOf`,
`managerChain`, `PEOPLE_STATS`, `ATTENDANCE_SUBSET`, `VIKRAM_TEAM_CODES`.

## The payroll engine

The most load-bearing fixture. It computes rather than hard-codes, and every component
carries a three-line trace so `/payroll/runs/[id]/employee/[eid]` can explain itself:

```
rule  PF = min(Basic × 12%, ₹1,800)
   =  min(₹39,333.00 × 12%, ₹1,800.00) = min(₹4,720.00, ₹1,800.00)
   =  ₹1,800.00
```

Earnings: Basic 40% of CTC, HRA 50% of Basic, Conveyance ₹1,600, Medical ₹1,250,
LTA 8.33% of Basic, performance pay by grade, **Special Allowance as the balancing
figure** — which is what makes `gross + employer cost === monthly CTC` hold no matter how
the builder is edited.

Statutory: PF `min(Basic × 0.12, 1800)`; ESI 0.75% when gross ≤ ₹21,000; Professional Tax
by state slab; TDS on the new-regime slabs with standard deduction, 87A rebate and cess.
Employer side: PF 12%, ESI 3.25%, gratuity 4.81% of Basic.

Two runs exist: **August 2026 (paid)** and **September 2026 (calculated)** with exactly
three exceptions — a missing bank account, a negative net from a mis-keyed advance
recovery, and 31 LOP days against a 30-day month.

## Adding a fixture

1. One file per module, `src/mock/<module>.ts`.
2. Seed `mulberry32` with a fixed number. Derive dates from `DEMO_TODAY`.
3. Reuse employee codes from `employees.ts` — never invent a person.
4. Use only status strings that already exist in `STATUS_MAP`
   (`src/components/ui/status-badge.tsx`). If you need a new one, add it there first.
5. Export a `verify…()` that asserts whatever must add up, and run it once with
   `npx tsx` before you rely on it.
6. Write real content. No lorem ipsum, no "Item 1 / Item 2" — real Indian cities, real
   ticket subjects, real review feedback.
