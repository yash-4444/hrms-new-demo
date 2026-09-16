# 08 · Screen inventory

43 routes. Every one renders real content — there are no placeholders and no dead links.

**Grant column** = the menu key and action the route guard requires (`V` = View).
Roles: E = Employee · M = Manager · H = HR Admin · P = Payroll Admin · R = Recruiter ·
O = Tenant Owner.

## Public

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/login` | — | all | Email + password, SSO button, forgot-password, and a card listing the six demo personas. Any credentials work. |
| `/careers` | — | all | Public careers page: hero, open roles filterable by department and location, Apply dialog. No app chrome. |
| `/` | — | all | Redirects to `/login`. |

## Home

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/dashboard` | `dashboard·V` | all | Role-aware. Punch card with a live ticking timer, leave balances with progress rings, approvals queue, team on leave, announcements, upcoming holidays. HR adds headcount KPIs, attrition trend, joiners, open positions and compliance alerts; Payroll adds the pay-run stepper, cost trend and exception count. Every KPI tile drills into a pre-filtered list. |

## Time & attendance

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/attendance` | `my.attendance·V` | all | Large punch card with a live elapsed timer, punch in/out, today's pairs, a last-7-days strip, and a month calendar with colour-coded day cells + legend. Clicking a day opens a detail drawer. |
| `/attendance/team` | `team.attendance·V` | M H O | Manager day board: employee rows × status, department and status filters, bulk approve with a sticky action bar, and a 3-tab panel (Approval Queue / Admin Finalization / Overtime Report). |
| `/attendance/amendments` | `time.amendments·V` | all | Regularisation requests, a New Request dialog (missed punch-in/out, correction, manual entry) with a 10-character minimum reason and live counter, a status timeline per row, Edit/Cancel where allowed. |
| `/admin/attendance-settings` | `time.settings·V` | H O | Per-country settings cards: shift times, late threshold + grace, and the three minute-bands. Amber banner: "2 of 3 countries are running on defaults." |
| `/admin/work-calendars` | `time.calendars·V` | H O | Calendars per country with the 7-day week as pill toggles, FY start month, timezone. Plus the **Resolve work context** diagnostic — step-by-step resolution with a **fail-closed 422** for the Hyderabad branch, which has no country. |

## Leave

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/leave` | `my.leave·V` | all | Balance cards per type (big Available, small Accrued/Used/Carried, progress ring), my applications, and a **Ledger** tab with a running balance that reconciles to the cards. Apply dialog opens on `?apply=1`. |
| `/leave/approvals` | `team.leave_approvals·V` | M H O | Manager queue with status/department/type/date filters, bulk approve, and a decision dialog offering Approve / Reject / Send Back / Cancel — **Reject and Send Back require a comment**. |
| `/leave/calendar` | `leave.calendar·V` | all | Month grid, one row per employee, one cell per day. Colour-coded for leave/holiday/weekend, and every marked cell carries the leave type's letter so it never reads by colour alone. |
| `/leave/admin` | `leave.admin·V` | H O | 4 tabs — **Jobs** (country picker, run ledger, Run Accrual / Run Year-End with a **DRY RUN** preview table), **Leave Types**, **Accrual Configs** (with the "which config resolves and why" diagnostic), **Policies** (a **13-rule** editor with an unsaved-changes guard). |

## People

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/employees` | `people.directory·V` | all | Directory with a card-grid ⇄ table toggle, filters for department/branch/designation/status, bulk actions, Add Employee and Bulk Import. |
| `/employees/[id]` | `people.profile·V` | all | Profile header + 9 tabs: Overview, Job & Org, **Compensation (masked behind `people.profile·E` — lock state for Employee, Manager and Recruiter)**, Documents, Attendance, Leave, Performance, Assets, Timeline. |
| `/employees/import` | `people.import·V` | H O | 3-step wizard: upload → mapping preview → **dry-run validation report** listing rows that would be created, updated and rejected, each rejection with a concrete reason. |
| `/org-chart` | `people.org_chart·V` | all | Interactive, zoomable, collapsible tree with avatar nodes over the real 340-person hierarchy. Find-a-person expands the path to them. |

## Payroll

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/payroll/runs` | `payroll.runs·V` | P O | Pay-run list with a status pill per run, current-vs-previous cards with inline steppers, and the 12-month cost trend. |
| `/payroll/runs/[id]` | `payroll.runs·V` | P O | Stepper (Draft → Calculated → Locked → Approved → Paid) that genuinely advances, employee table with gross/deductions/net, expandable rows, reconciliation checks, and an **EXCEPTIONS panel that blocks locking** until cleared. |
| `/payroll/runs/[id]/employee/[eid]` | `payroll.runs·V` | P O | **The money shot.** Full salary breakdown with an "explain this number" trace per component — formula → resolved inputs → output. Earnings and deductions in two columns, statutory and employer contributions separate, YTD figures. |
| `/payroll/structures` | `payroll.structures·V` | P O | Salary templates by grade with a component builder and a **live CTC breakup preview** that recalculates as you type. Special Allowance balances, so the total always reconciles. |
| `/payslips` | `my.payslips·V` | all | 12 months of payslips with a rendered preview panel, amount in words, and a Download button. |

## Hiring

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/requisitions` | `hiring.requisitions·V` | M H R O | Requisition list with approval status, ageing, and a Raise Requisition dialog. |
| `/jobs` | `hiring.jobs·V` | R O | Job postings, channel chips, applicant counts, and a link to the public careers page. |
| `/candidates` | `hiring.candidates·V` | M H R O | **Kanban pipeline** with drag-and-drop between stages (Applied → Screening → Interview → Offer → Hired/Rejected). Cards show avatar, role, source and stage age. A "Move to…" menu gives keyboard parity. |
| `/candidates/[id]` | `hiring.candidates·V` | M H R O | Profile, resume preview pane, interview scorecards, activity timeline. |
| `/interviews` | `hiring.interviews·V` | M H R O | Calendar of scheduled interviews with panel avatars and a day detail drawer. |
| `/offers` | `hiring.offers·V` | H R O | Offer list and detail with a CTC breakup preview. |

## Growth

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/goals` | `my.goals·V` | all | My goals with progress rings, weightage, key results, and a cascade indicator showing which parent goal each rolls up to. |
| `/reviews` | `growth.reviews·V` | all | Cycle list with per-stage progress, and a review form with **self / manager / peer columns side by side**, a clickable 1–5 scale with named anchors, and a divergence cue where self and manager differ by ≥2. |
| `/reviews/calibration` | `growth.calibration·V` | M H O | **9-box grid with draggable employee chips** and a live distribution histogram beside it. Boxes are filled from the sequential ramp; each shows count, target share and delta. |
| `/learning` | `growth.learning·V` | all | Course catalogue with filters, My learning with progress, and a **compliance-training panel with expiry warnings** — expired, expiring within 30 days, never completed, valid. |

## Workplace

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/assets` | `workplace.assets·V` | H O | Asset register (180 items), allocation dialog with a handover acknowledgement, and a **My assets** tab. |
| `/expenses` | `workplace.expenses·V` | M H P O | Claim list, a multi-line claim form with a live running total, and an approval queue. **Policy violations are flagged inline on the offending line** with the cap and the excess. |
| `/travel` | `workplace.travel·V` | M H P O | Travel requests with an **itinerary card** rendered as a vertical journey, and an **advance balance** panel (requested / disbursed / settled / outstanding). |
| `/helpdesk` | `workplace.helpdesk·V` | all | Ticket list with **SLA countdown chips** (green/amber/red, always icon + text), and a ticket detail whose **internal notes are visually distinct from replies**. |
| `/announcements` | `workplace.announcements·V` | all | Feed with pinned items and **read-acknowledgement**, including an acknowledged-count progress bar. |

## Admin

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/admin/users` | `admin.users·V` | H O | 64 platform users with role chips, status, last login and MFA. Invite dialog, bulk role assignment, suspend. |
| `/admin/roles` | `admin.roles·V` | O | **The RBAC matrix** — 42 menu keys × 6 roles, cells showing granted action letters as live toggles. Search, module filter, only-differences, compare-two-roles, crosshair hover, keyboard navigation. |
| `/admin/settings` | `admin.settings·V` | O | Tenant settings: branding, default country, timezone, **financial year start month with a live FY-label preview**, locale, date format, currency. Sticky save bar that appears only when dirty. |
| `/admin/audit` | `admin.audit·V` | H P O | 220 audit entries with actor, action, entity, timestamp, IP and device. Filters, an activity chart, and a **detail drawer showing old vs new values side by side** with changed fields highlighted. |
| `/admin/compliance` | `admin.compliance·V` | H P O | 32 statutory filings across India and the US with due dates, owners, penalty risk and status. **Table and timeline views**, overdue alert, Mark-filed action. |

## Insights

| Route | Grant | Roles | What it shows |
|---|---|---|---|
| `/analytics` | `analytics·V` | H P O | Headcount trend, attrition, joiners/leavers, department and grade distribution, tenure mix, gender diversity (including a department × grade-band heatmap), span of control, payroll cost by cost centre and branch, recruitment funnel, source mix, time to fill, leave utilisation. Period + branch + department selectors move every chart together; clicking a mark drills down. |
| `/reports` | `reports·V` | M H P R O | A library of 24 operational and statutory reports. Each is runnable with parameters (period, branch, department, format) and lands in the Run History tab. Plus schedules and a run-activity chart. |
