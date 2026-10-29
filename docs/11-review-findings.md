# 11 — Review findings to fix (existing screens)

Sources: a code audit against the build brief, a coverage review against `F:\HRMS-NEW\docs\06-UI-DESIGN.md`,
and an automated Chrome walkthrough of every route × the 6 original personas (desktop 1440×900 and phone
390×844) on 28 Oct 2026. Owner: **W10**. Paths relative to `src/`.

## P1 — breaks or embarrasses a live demo
1. **Employees can't claim expenses, request travel or see their assets.** Walkthrough: `/expenses`, `/travel`,
   `/assets` show *Access denied* for the Employee persona (and Recruiter). Route keys map these to
   `workplace.*` while the employee holds `my.expenses`, `my.travel`, `my.assets`. Make each page persona-aware:
   employees land on **My claims / My trips / My assets** views (gated by `my.*`), approvers/admins see the
   queue/register tabs (gated by `workplace.*`). W0 owns `lib/nav.ts` ROUTE_KEYS — coordinate by making the
   pages work with `my.*` keys and report the ROUTE_KEYS change needed (or, if W0 is finished, make it).
2. **Dead breadcrumb links** `/admin`, `/payroll`, `/payroll/runs/<id>/employee` (`components/shell/topbar.tsx:196-209`);
   ID regex misses `PR-2026-09` (shows "PR 2026 09"). Render non-routable segments as text; widen the regex.
3. **Links that land on Access denied after a role switch**: inbox badge → `/leave/approvals` for Payroll
   Admin/Recruiter (`topbar.tsx:242`) — point it to `/approvals` (new unified inbox, built by W2); avatar menu
   "Preferences" → `/admin/settings` (`topbar.tsx:281`) — point to `/me/preferences`; dashboard "Open inbox"
   (`dashboard/page.tsx:554`) → `/approvals`; payslips "Explain every number" (`payslips/page.tsx:263`) needs
   `payroll.runs` — show an in-place explanation for self-service instead, and only offer months whose run
   page exists in the static export.
4. **Employee persona sees other people's requests as "My requests"** (`dashboard/page.tsx:540` renders
   `PENDING_APPROVALS`). Show the persona's own applications.
5. **Dashboard contradicts detail screens**: pay-run card (340 employees, ₹5,41,82,400 in `mock/insights.ts:401-414`)
   vs the real run in `mock/payroll.ts` (309 India employees) — derive from `PAY_RUNS[0]`; leave balance static
   `MY_LEAVE_BALANCE` (`insights.ts:364`) — use the per-persona balances from `mock/leave.ts`; "Open positions"
   `OPEN_POSITIONS.length + 7` (`dashboard/page.tsx:190`) with requisition codes that don't match `mock/hiring.ts` —
   derive from `REQUISITIONS`.
6. **Approval counts disagree**: sidebar badge 12 on the dashboard, 38 on `/leave/approvals`, page KPI 36; visiting
   `/leave/approvals` overwrites the cross-module count with leave-only (`leave/approvals/page.tsx:86`). One source
   of truth: count of items in the persona's unified inbox.
7. **Relative times use the real clock** (`lib/format.ts:65` `fmtAgo`) while "today" is `DEMO_TODAY`
   (`mock/org.ts:256`, 16 Sep 2026) — notifications/announcements/last-login already read "1 month ago". Compute
   against a `DEMO_NOW`. Also move `DEMO_TODAY` to **2026-10-28** *only if* every fixture date is shifted
   consistently; otherwise keep 16 Sep and make all relative labels use it.
8. **Two punch timers disagree** (dashboard anchors to real 09:42 with a 9-h target, `app-state.tsx:151`;
   `/attendance` uses the fixture with 8 h, `punch-card.tsx:22,55`); before 09:42 local the dashboard shows
   00:00:00 and negative progress (`dashboard/page.tsx:370-377`); "This month 142h 40m" is impossible by 16 Sep
   (`dashboard/page.tsx:436`). Share one anchor + target; compute month hours from attendance fixtures.
9. **React hydration error #418 on `/admin/work-calendars`** (all personas; seen in Chrome). Find the text that
   differs between server render and client (date/locale/random) and make it deterministic.
10. **Payroll copy bugs**: "3 exceptions **is** blocking" → "are"; the exceptions banner repeats each name
    ("Ravi Gupta — Missing bank details — Ravi Gupta").
11. **`/reports` hangs a headless screenshot for Tenant Owner** (30 s timeout once) — check for an unbounded
    render/animation loop or a huge DOM; virtualise or paginate.

## P2 — brief not met
12. Dashboard: Payroll Admin never sees the payroll-cost trend (`dashboard/page.tsx:317` requires `showPayroll && showPeople`);
    department donut only toasts (line 311) — navigate to `/employees?dept=`; only 2 of 9 KPI tiles pre-filter —
    make every tile drill into a pre-filtered list and make the targets read the query string (`/requisitions`,
    `/analytics` tabs, `/leave/calendar?month&dept` — link at `leave/leave-detail-sheet.tsx:187`).
13. Missing confirm dialogs: expense reject (`expenses/page.tsx:195`, also needs a comment), travel reject
    (`travel/page.tsx:489`), team-attendance reject (`attendance/team/page.tsx:330`), bulk asset retire/write-off
    (`assets/page.tsx` ~400). Dashboard Approve / Approve-all: add confirm or an Undo toast.
14. Forms: expense claim form is hand-rolled `useState` (`expenses/page.tsx:100-145`) and accepts zero-amount lines
    — convert to RHF + Zod; add a dirty-form guard to every form dialog (`leave/apply-leave-dialog.tsx:268`,
    `hiring/requisition-dialog.tsx:186`, `hiring/offer-drawer.tsx:152`, `workplace/asset-allocation-dialog.tsx:173`,
    `growth/goals.tsx:366`, `attendance/amendments/page.tsx:565`); review form promises an in-app prompt but only
    has `beforeunload` (`growth/review-form.tsx:147,461`).
15. Lists not on the shared DataTable (no sort/visibility/selection/bulk/Export): expenses, travel, helpdesk, jobs,
    payslips, learning, goals, announcements, payroll/structures — convert the list parts; and wire the DataTable
    `columnFilters` state into a per-column filter row (`data-table.tsx:101`).
16. Numbers that don't reconcile: duplicate `PAYROLL_COST_TREND` and `RECRUITMENT_FUNNEL` (`insights.ts:204,244`
    vs `payroll.ts:1743`, `hiring.ts:1801`) — use the derived ones everywhere; headcount trend counts joiners only
    (`insights.ts:53`) — opening + joiners − leavers must equal closing.
17. Responsive: sidebar is hidden below `lg` and full above (`sidebar.tsx:111` — W0 owns sidebar; coordinate):
    icon rail at `lg`, sheet with a hamburger at `md` and below.
18. Access-denied dead end: "View the role matrix" (`shell/page.tsx:147`) sends a denied persona to `/admin/roles`,
    which they also can't open — replace with "Request access" (dialog → `mockAction` toast) and show the button
    only when it makes sense.
19. Persona resets to HR Admin on every full page load / deep link — persist the selected role in
    `sessionStorage` (try/catch) so a refreshed or shared deep link keeps the persona during a demo
    (coordinate with W0, which owns persona parts of `app-state.tsx`).
20. Login "Forgot password?" only toasts (`login/page.tsx:121`) — link to `/forgot-password` (built by W2).

## P3 — polish
21. Blank entries in the DataTable "Columns" menu for `header: ""` action columns (`payroll/runs/page.tsx:131`,
    `reports/page.tsx:222`, `assets/page.tsx:243`, …) — `enableHiding: false`.
22. Row focus is `outline-none` with only a tint (`data-table.tsx:324`) — add a visible ring.
23. Greeting hard-coded "Good afternoon" (`dashboard/page.tsx:356`) — derive from demo time.
24. Login says "3 countries" (`login/page.tsx:51`) but fixtures have IN + US; "Cost by branch" says "three
    staffed locations" but includes Hyderabad (`analytics/page.tsx:513`); analytics attrition ignores the
    branch/department filter.
25. Lint: unused expression `command-palette.tsx:88`; unused `Bell` in `lib/nav.ts:6` (W0 file); unused
    `shiftStart` `mock/attendance.ts:329`.
26. Static export prefetch 404s: the client requests `…/__next.!KGFwcCk.dashboard.__PAGE__.txt` but the export
    writes `…/__next.!KGFwcCk/dashboard/__PAGE__.txt` (≈6,000 console 404s in a full walk; navigation still
    works via fallback). Investigate a Next config fix (e.g. disable prefetch on sidebar `Link`s with
    `prefetch={false}` if no config fix exists) so the console is clean in a demo.

## Integration items reported by the new-screen workstreams
27. Login "Forgot password?" → `/forgot-password` (W2 built it); optionally route Sign in → `/mfa` for the demo.
28. Seed the approvals badge from the real inbox: `approvalsFor(role, persona.employeeId, persona.name).length`
    from `src/mock/self-service.ts` instead of `APPROVALS_BY_ROLE` in `app-state.tsx`.
29. Top bar: bell "View all" → `/notifications`; Inbox button → `/approvals`; avatar menu → `/me`, `/me/security`,
    `/me/preferences`; dashboard approval widgets → `/approvals`.
30. Command palette footer says ⌥1–⌥6 → ⌥1–⌥0 (`command-palette.tsx` ~236); `mock/employees.ts` comment
    "six demo personas" → eleven.
31. Employee profile (`employees/[id]/view.tsx`): add "Record lifecycle event" (gated `people.lifecycle` C) →
    `/employees/lifecycle?employee=<code>` and make `employees/lifecycle/page.tsx` read `?employee=` and pass it as
    the wizard's initial employee; add "Documents" → `/employees/documents` and "Letters" → `/letters` links.
32. "Initiate exit" on the profile → `/separations` (W6) instead of a toast.
33. Mount the AI Copilot globally: `<CopilotProvider>` inside `AppStateProvider` and `<CopilotLauncher/>` in the
    top bar (from `@/components/ai`).
34. `DataTable` always renders its own Export button — gate it: add an `exportable`/`canExport` prop and have pages
    pass `can(key, "X")` so view-only personas can't export (W5 report).
35. `src/mock/payroll.ts` `rowsForPeriod` has no joining-date filter → runs pay employees for months before they
    joined. Filter by DOJ (pro-rate the joining month) — then re-check that W5's reconciliation strips still hold
    (`src/mock/finance-*.ts` derive from the runs).
36. Existing `/expenses` reads `EXPENSE_CLAIMS`; W5 added `EXP_ALL_CLAIMS` (EXP-2026-0051…0060) in
    `mock/finance-expense.ts` — make `/expenses` read the combined list. Workplace fixture: some expense lines dated
    17–18 Sep (after DEMO_TODAY) and future trips showing 35% advance already settled — fix the dates/settlement.
37. Attendance fixture marks too many days late (101 of 106 employees late in August) — make lateness realistic
    (~10–20% of employees), keeping dashboard/attendance numbers consistent.
38. Existing `/learning` catalogue cards → link to `/learning/courses/<id>` (W7 built detail pages).
39. Grants (rbac.ts): `hr_admin` → `"engage.feed": "VCE"` (moderation), `"engage.celebrations": "VE"` (auto-wishes);
    `hr_admin` and `it_admin` → add `E` on `admin.login_history` and gate Unlock on `E` (in
    `src/app/(app)/admin/login-history`); `hr_admin` → add `X` on `admin.access_review` (export evidence).
40. Move existing `/admin/compliance` content label to "Compliance Calendar" (page title) to match the nav.
