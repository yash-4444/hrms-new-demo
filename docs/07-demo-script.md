# 07 · Demo script

A 12-minute walkthrough that lands the product. Timings are generous; the whole thing
compresses to 5 minutes if you cut sections 5–7.

**Before you start:** `npm run dev`, open `/login`, set the theme to light, and make the
browser window wide enough that the sidebar is expanded. Have `⌥1`–`⌥6` in muscle memory —
that is the persona switcher and it is the spine of the demo.

---

## 0 · Sign in (30s)

Land on `/login`. Point at the demo-persona card.

> "There's no backend here — any credentials work. What matters is *who* you sign in as.
> Six personas, and the product is genuinely different for each one."

Click **Priya Menon (HR Admin)**.

---

## 1 · The dashboard is role-aware (90s)

You're on `/dashboard` as HR Admin: headcount KPIs, attrition, compliance alert, joiners,
open positions.

> "This is the HR Admin's dashboard. Same route, same code — watch what it becomes."

Press **⌥1** (Ananya Rao, Employee).

> "Employee. The sidebar just lost two-thirds of its items. No headcount KPIs, no
> compliance, no attrition — she gets her punch card, her leave balance, her requests."

Press **⌥2** (Vikram Shah, Manager).

> "Manager. Team attendance and an approvals queue appear. Eight reportees."

Press **⌥4** (Rahul Desai, Payroll Admin).

> "Payroll. Pay-run stepper, cost trend, and an exceptions counter — note the red badge in
> the sidebar."

**The point to make:** no reload, no route change, no second codebase. One permission model
driving nav, dashboard composition and every button state.

---

## 2 · The money shot (2 min)

Still as Rahul: **Pay Runs** → open **September 2026** → click any employee's
**Breakdown**.

Walk the layout: net-pay hero with the amount in words, earnings and deductions in two
columns, statutory separate, employer contributions separate.

Now expand **Provident Fund (employee)**.

> "Every number explains itself."

```
rule  PF = min(Basic × 12%, ₹1,800)
   =  min(₹39,333.00 × 12%, ₹1,800.00) = min(₹4,720.00, ₹1,800.00)
   =  ₹1,800.00
```

> "The rule, the same rule with every input resolved, and the result. Plus the resolved
> inputs and why it capped. That's on every single component — hit *Explain every number*
> and they all open at once."

Go **back to the run** and show the **Exceptions** panel.

> "Three exceptions: a missing bank account, a negative net, and 31 LOP days in a 30-day
> month. The Lock button is disabled and the tooltip says why. Clear them —"

Click **Clear all**, then **Lock run**.

> "— and now it locks. The sidebar badge cleared too."

---

## 3 · Permissions are visible, not theoretical (90s)

Press **⌥3** (Priya, HR Admin) while still on the payroll screen.

> "HR Admin. Access denied — and it names the exact grant she's missing: Payroll › Pay
> Runs · View."

Press **⌥6** (Arjun Kapoor, Tenant Owner) → **Admin › Roles & Permissions**.

> "This is the model itself. 42 capabilities, 6 roles, 6 action letters — view, create,
> edit, delete, execute, approve. 594 grants out of a possible 1,512."

Toggle a couple of letters; show the per-role totals move. Flip **Only differences**, then
**Compare two roles**.

> "Everything you just watched — the nav, the disabled buttons, the access-denied screen —
> is driven by this one grid."

---

## 4 · Numbers that reconcile (90s)

**Leave** (⌥3, HR Admin) → open the **Ledger** tab.

> "Balance cards on top, and every transaction below with a running balance. Available =
> Opening + Accrued − Used + Adjusted + Carry-forward − Encashed − Lapsed. It's asserted in
> code — if it ever didn't add up, the fixture would throw."

Open **Apply for leave**, pick a range spanning a weekend.

> "Live preview: three and a half days will be deducted. It excludes weekends and public
> holidays, and the document dropzone only appears above three days."

**Leave Administration → Jobs → Run Accrual → Dry run.**

> "Batch jobs always dry-run first. Here's exactly what would change, per employee, before
> anything is written."

---

## 5 · The charts (90s)

**Analytics.** Change the **Branch** filter to Pune.

> "Every chart moves together — one filter, one scope line at the top."

Hit the **Table** button on any chart.

> "Every chart ships a table view. That's not a nicety: three of our light-mode series
> colours sit below the 3:1 contrast threshold, so the palette obliges a non-colour path to
> the same numbers. The whole palette is machine-validated for colour-blind separation in
> both themes."

Toggle **dark mode** in the top bar.

> "Dark isn't an inverted light theme — the chart colours are a separately chosen and
> separately validated set."

---

## 6 · Breadth (2 min)

Move fast; the point is that nothing is a dead end.

- **Candidates** — drag a card between pipeline stages; the funnel above updates.
- **Calibration** — drag a chip in the 9-box; the histogram beside it moves live.
- **Helpdesk** — SLA countdown chips, and internal notes visually distinct from replies.
- **Expenses** — open a claim with a policy breach; the warning sits on the offending line
  with the cap and the excess.
- **Org chart** — zoom, collapse, expand.
- **Work Calendars → Resolve work context** — pick the Hyderabad employee.

> "That branch has no country configured, so the resolution chain fails closed with a 422
> rather than guessing a default. That's the behaviour you want in payroll-adjacent code."

---

## 7 · The details that sell it (60s)

- **⌘K** — fuzzy search across employees, screens and actions. Type a name, jump to them.
- **Notification bell** and **approvals inbox** — both live counts.
- Navigate anywhere and point at the **~400ms skeleton**.

> "That's deliberate. Real apps fetch; an instant render feels like a mock."

- Resize the window down to tablet width — sidebar collapses to icons, then to a sheet.

---

## Closing

> "Forty-three routes, six personas, zero backend. Every number on screen reconciles, every
> control does something, and the whole thing runs on typed fixtures — so when the API is
> ready, this is the contract it has to satisfy."

---

## Questions you will get

**"Is any of this real?"**
The UI and the calculations are real; the data is seeded fixtures and nothing persists past
a refresh. The payroll engine genuinely computes PF, ESI, PT and TDS.

**"How long to make it real?"**
The front end is the deliverable here. `src/mock/` is effectively the API contract — every
fixture is typed, so swapping it for fetch calls is mechanical.

**"Can it do <X> country?"**
The work-calendar and accrual-config resolution chains are already multi-country and
fail closed. Adding a country is configuration, not code.

**"Why does it reset when I refresh?"**
On purpose. A demo that accumulates everyone's test clicks gets worse every time it's
shown.
