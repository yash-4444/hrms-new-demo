# 10 — Expansion plan: AI-powered HRMS (full mock)

Goal: turn the 43-screen mock into a **complete, AI-powered HRMS demo** that answers the prospect's brief
("AI-powered HRMS · streamline HR operations · automate workflows · enhance employee experience").
Source of truth for the screen list: `F:\HRMS-NEW\docs\06-UI-DESIGN.md` §5.2 (route table) and
`F:\HRMS-NEW\docs\13-MODULE-CATALOG.md`. Front-end only — no backend, no API calls.

**Out of scope:** education / school / college-specific features (timetables, substitute teachers,
academic calendars). Corporate Learning & Development (M10) stays in scope.

---

## 0. Rules every workstream follows

1. **Stay inside your lane.** Create files only under the folders listed for your workstream, plus your own
   mock file `src/mock/<stream>.ts` and your own component folder `src/components/<stream>/`.
   **Do not edit** existing shared files (`src/lib/*`, `src/components/shell/*`, `src/components/ui/*`,
   `src/components/data-table.tsx`, `src/components/charts/*`, `src/components/app-state.tsx`,
   existing `src/mock/*.ts`, existing pages) unless your workstream explicitly owns them.
   Need a new shared helper? Put it in your own component folder.
2. **Reuse the design system.** `PageHeader`, `PageBody`, `Section`, `Gated`, `useFakeLoad`,
   `TableSkeleton`, `CardsSkeleton`, `ChartSkeleton` (`components/shell/page.tsx`); `DataTable`, `NumCell`,
   `MutedCell` (`components/data-table.tsx`); `StatusBadge` (`components/ui/status-badge.tsx` — add new
   statuses only via a local map if absent); `ConfirmDialog`, `Dialog*`, `Sheet*`, `Select*`, `FilterSelect`,
   `DropdownMenu*`, `Popover*` (`components/ui/overlays.tsx`); `Badge`, `Input`, `Textarea`, `Field`,
   `Avatar`, `Switch`, `Checkbox`, `Tabs*`, `Hint`, `Alert`, `EmptyState`, `Progress`
   (`components/ui/primitives.tsx`); charts from `components/charts` (each with Table view);
   `StatTile`/`StatRow`; `PersonCell`, `EmployeeCard`, `DetailRow` (`components/people/person-cell.tsx`);
   `inr`, `inrCompact`, `num`, `pct`, `fmtDate*` (`lib/format.ts`); `useApp()` and `mockAction()`
   (`components/app-state.tsx`). Read 2–3 existing pages first and copy their structure and density.
3. **Every list** uses `DataTable` (sort, column visibility, selection + bulk bar, Export), a designed
   `EmptyState`, and a ~400 ms skeleton via `useFakeLoad`.
4. **Every mutation** → `mockAction(...)` (optimistic update + sonner toast). **Every destructive action**
   (reject, delete, revoke, erase, retire, terminate, write-off) → `ConfirmDialog`, with a required comment
   where a human decision is recorded.
5. **Forms** use React Hook Form + Zod with inline errors; dialogs warn before discarding a dirty form.
6. **Permissions are honest.** Gate create/edit/approve buttons with `can(menuKey, action)` and show the
   existing disabled-with-tooltip pattern (`Gated`). Never link a persona to a route they can't view.
7. **Data is believable and reconciles.** Use real employees from `src/mock/employees.ts` (340, codes
   `STL-0001…`), branches/departments from `src/mock/org.ts`, `DEMO_TODAY` (`src/mock/org.ts`) as "today"
   — never `new Date()` / `Date.now()` in render. INR with Indian grouping via `inr()`. Totals must add up.
   Deterministic randomness only via `mulberry32` (`lib/utils.ts`).
8. **Static export.** `next.config.ts` uses `output: "export"`. A dynamic route needs a thin server
   `page.tsx` with `generateStaticParams()` plus a client `view.tsx` (copy `app/(app)/candidates/[id]/`).
   Authenticated screens go under `src/app/(app)/`; public screens (auth, careers, offer, pre-joining) go
   directly under `src/app/` and must not render the app shell.
9. **AI touches** (where listed) use the components from `src/components/ai/` once available; until then,
   build a small local equivalent and label it clearly with the ✨ "AI" badge style: violet accent, "AI
   suggestion — review before use", and an explicit Accept / Edit / Dismiss.
10. **Verification:** run `npx tsc --noEmit` and fix every error **in your own files** (other workstreams
    are editing in parallel — ignore their in-progress errors). Do **not** run `next build`, `next dev` or
    `npm install`. No new npm dependencies.
11. No lorem ipsum, no "coming soon", no dead links, no `TODO`.

---

## 1. Personas (6 → 11)

Existing: `employee` Ananya Rao · `manager` Vikram Shah · `hr_admin` Priya Menon · `payroll_admin` Rahul
Desai · `recruiter` Sana Iqbal · `tenant_owner` Arjun Kapoor.

New (pick real employees from `src/mock/employees.ts` whose department fits; keep names consistent):

| id | Role label | Purpose in the demo |
|---|---|---|
| `finance_controller` | Finance Controller | **Approves** pay runs (segregation of duties: Payroll Admin builds, Finance approves), expense finance queue, travel desk, advances, loans |
| `department_head` | Department Head | Sales or Operations head: department analytics, approvals, headcount, attrition-risk for own department |
| `helpdesk_agent` | HR Operations Agent | Helpdesk agent queue, HR cases, knowledge base, onboarding tasks |
| `it_admin` | IT & Asset Admin | Asset register, licences, maintenance, asset audit, onboarding IT tasks, sessions |
| `auditor` | Internal Auditor | Read-only on everything + Export (audited). Can never create/edit/approve |

Role switcher shows all 11; `Alt+1…9`, `Alt+0` jumps to the first ten. Login page lists all 11.

Grant notation below: `E` employee · `M` manager · `H` hr_admin · `P` payroll_admin · `R` recruiter ·
`F` finance_controller · `D` department_head · `K` helpdesk_agent · `I` it_admin · `A` auditor.
Owner (`O`) gets every action on every key. Auditor gets `VX` on every key not starting with `my.`/`ai.copilot`
unless listed. Every persona inherits the self-service set. `X` = **Export** (fix the label — it is not
"Execute"); jobs/dry runs use `X` too but the tooltip reads "Export / Run".

---

## 2. Workstreams, routes and menu keys

### W0 · Foundation (runs first) — owns `src/lib/nav.ts`, `src/lib/rbac.ts`, `src/components/shell/sidebar.tsx`, `src/components/shell/topbar.tsx` (role switcher only), `src/components/app-state.tsx` (personas/approvals only), `src/app/login/page.tsx` (persona list only)
- Register **every** route below: `MenuKey` union, `MENU_META`, grants, `NAV` groups, `ROUTE_KEYS`,
  `SEGMENT_LABELS`.
- Add the 5 personas. Make sidebar groups **collapsible** (remember state per group in `localStorage`,
  wrapped in try/catch), auto-expand the active group, keep icon-rail mode working.
- New nav group order: **Home · AI · My Space · Team · People · Organization · Time · Payroll · Hiring ·
  Onboarding & Exit · Growth · Workplace · Helpdesk · Engagement · Insights · Compliance · Admin**.

### W1 · AI suite — `src/app/(app)/ai/**`, `src/app/(app)/admin/ai/**`, `src/components/ai/**`, `src/mock/ai.ts`
| Route | Label | Key | Group | Grants |
|---|---|---|---|---|
| `/ai/copilot` | AI Copilot | `ai.copilot` | AI | everyone `VC` |
| `/ai/knowledge` | Policy Knowledge Base | `ai.knowledge` | AI | everyone `V`; H,K `VCED` |
| `/ai/insights` | AI Insights | `ai.insights` | AI | H,D,F,P,A `V`; M `V` (own team only) |
| `/ai/ask` | Ask Analytics | `ai.ask` | AI | H,D,F,P,M,A `V` |
| `/ai/studio` | AI Drafting Studio | `ai.studio` | AI | H,R,M,K `VC` |
| `/admin/ai` | AI Settings & Usage | `admin.ai` | Admin | O; A `VX`; H `V` |

Components exported from `src/components/ai/` (mounted globally later): `CopilotPanel` (slide-over, same
engine as `/ai/copilot`), `CopilotLauncher` (top-bar button), `AiBadge`, `AiSuggestionCard`
(Accept/Edit/Dismiss), `AiDraftBanner`, `AiExplainButton` (popover: "why this number / why this flag",
drivers listed), `AiConfirmCard` (proposed action → Confirm/Cancel), `AiCitation`.

### W2 · Self-service, inbox & auth — `src/app/(app)/approvals/**`, `src/app/(app)/notifications/**`, `src/app/(app)/me/**`, public `src/app/{forgot-password,reset-password,mfa,register,select-tenant,accept-invite,force-password-change}/**`, `src/mock/self-service.ts`
| Route | Label | Key | Group | Grants |
|---|---|---|---|---|
| `/approvals` | Approvals Inbox | `team.approvals` | Home | M,H,P,R,F,D,K,I `VA`; A `V` |
| `/notifications` | Notifications | `my.notifications` | Home | everyone |
| `/me` | My Profile | `my.profile` | My Space | everyone `VE` |
| `/me/documents` | My Documents | `my.documents` | My Space | everyone `VC` |
| `/me/team` | My Team | `my.team` | Team | M,D,H `V` |
| `/me/security` | Security & Sessions | `my.security` | My Space | everyone `VE` |
| `/me/preferences` | Preferences | `my.preferences` | My Space | everyone `VE` |
| `/me/tax` | Tax Declaration | `my.tax` | My Space | everyone `VCE` |
| `/me/onboarding` | My Onboarding | `my.onboarding` | My Space | everyone `V` |
Public (no key): `/forgot-password`, `/reset-password`, `/mfa`, `/register`, `/select-tenant`,
`/accept-invite`, `/force-password-change`.

### W3 · Core HR & Organization masters — `src/app/(app)/employees/{lifecycle,documents}/**`, `src/app/(app)/letters/**`, `src/app/(app)/org/**`, `src/components/org/**`, `src/mock/masters.ts`
| Route | Label | Key | Group | Grants |
|---|---|---|---|---|
| `/employees/lifecycle` | Lifecycle Events | `people.lifecycle` | People | H `VCEA`; D `V` |
| `/employees/documents` | Document Register | `people.documents` | People | H `VCEA`; K `VE` |
| `/letters` | Letters | `people.letters` | People | H `VCX`; K `VC` |
| `/letters/templates` | Letter Templates | `people.letter_templates` | People | H `VCED` |
| `/org/companies` | Companies | `org.companies` | Organization | H `V` |
| `/org/branches` | Branches | `org.branches` | Organization | H `VCE` |
| `/org/departments` | Departments | `org.departments` | Organization | H `VCE`; D `V` |
| `/org/designations` | Designations | `org.designations` | Organization | H `VCE` |
| `/org/grades` | Grades & Bands | `org.grades` | Organization | H `VCE`; P,F `V` |
| `/org/teams` | Teams | `org.teams` | Organization | H `VCE`; M,D `V` |
| `/org/cost-centres` | Cost Centres | `org.cost_centres` | Organization | H `VCE`; F,P `V` |
| `/org/employment-types` | Employment Types | `org.employment_types` | Organization | H `VCE` |
| `/org/work-locations` | Work Locations | `org.work_locations` | Organization | H `VCE` |
| `/org/holidays` | Holiday Master | `org.holidays` | Organization | H `VCED`; everyone else `V` |
| `/org/shifts` | Shifts | `org.shifts` | Organization | H `VCE`; M `V` |
| `/org/shift-groups` | Shift Groups | `org.shift_groups` | Organization | H `VCE` |
| `/org/rosters` | Roster Board | `org.rosters` | Organization | H `VCEA`; M `VEA` |
| `/org/rosters/templates` | Roster Templates | `org.roster_templates` | Organization | H `VCE` |

### W4 · Platform admin, compliance & reports — `src/app/(app)/admin/{subscription,domains,permission-overrides,sessions,login-history,access-review,notification-templates,jobs,health,lookups,geo,currencies}/**`, `src/app/(app)/compliance/**`, `src/app/(app)/reports/scheduled/**`, `src/mock/platform.ts`
| Route | Label | Key | Group | Grants |
|---|---|---|---|---|
| `/admin/subscription` | Plan & Seats | `admin.subscription` | Admin | O only |
| `/admin/domains` | Custom Domains | `admin.domains` | Admin | O; I `V` |
| `/admin/permission-overrides` | Permission Overrides | `admin.overrides` | Admin | H `VCE` |
| `/admin/sessions` | Active Sessions | `admin.sessions` | Admin | I,H `VD` |
| `/admin/login-history` | Login History | `admin.login_history` | Admin | I,H `VX` |
| `/admin/access-review` | Access Review | `admin.access_review` | Admin | H `VCEA` |
| `/admin/notification-templates` | Notification Templates | `admin.notification_templates` | Admin | H `VCE` |
| `/admin/jobs` | Background Jobs | `admin.jobs` | Admin | H,P,I `VX` |
| `/admin/health` | System Health | `admin.health` | Admin | I `V` |
| `/admin/lookups` | Lookups | `admin.lookups` | Admin | H `VCED` |
| `/admin/geo` | Geography | `admin.geo` | Admin | H `VCE` |
| `/admin/currencies` | Currencies & FX | `admin.currencies` | Admin | F,P `VCE` |
| `/compliance/registers` | Statutory Registers | `compliance.registers` | Compliance | H,P `VX` |
| `/compliance/posh` | POSH Register | `compliance.posh` | Compliance | H `VCE` (restricted) |
| `/compliance/dpdp` | Data-Subject Requests | `compliance.dpdp` | Compliance | H `VCEX` |
| `/compliance/retention` | Retention Policies | `compliance.retention` | Compliance | H `VE` |
| `/compliance/consent` | Consent Register | `compliance.consent` | Compliance | H `VX` |
| `/reports/scheduled` | Scheduled Reports | `reports.scheduled` | Insights | H,P,F,D `VCE` |
Move `/admin/compliance` (existing) under the Compliance group with label "Compliance Calendar".

### W5 · Time, payroll & finance — `src/app/(app)/attendance/{reports,devices}/**`, `src/app/(app)/leave/reports/**`, `src/app/(app)/payroll/{components,salary,inputs,loans,benefits,payslips,registers,bank-advice,statutory,returns}/**`, `src/app/(app)/expenses/{approvals,finance,policies}/**`, `src/app/(app)/travel/{desk,advances}/**`, `src/components/finance/**`, `src/mock/finance.ts`
| Route | Label | Key | Group | Grants |
|---|---|---|---|---|
| `/attendance/reports` | Attendance Reports | `time.reports` | Time | H `VX`; M,D `VX` (team) |
| `/attendance/devices` | Biometric Devices | `time.devices` | Time | H,I `VCE` |
| `/leave/reports` | Leave Reports | `leave.reports` | Time | H `VX`; M,D,F `V` |
| `/payroll/components` | Salary Components | `payroll.components` | Payroll | P `VCED`; F `V` |
| `/payroll/salary` | Salary Assignments & Revisions | `payroll.salary` | Payroll | P `VCE`; F `VA` |
| `/payroll/inputs` | Payroll Inputs & LOP | `payroll.inputs` | Payroll | P `VCE` |
| `/payroll/loans` | Loans & Advances | `payroll.loans` | Payroll | P,F `VCEA` |
| `/payroll/benefits` | Flexible Benefits | `payroll.benefits` | Payroll | P `VCEA` |
| `/payroll/payslips` | Payslip Register | `payroll.payslips` | Payroll | P `VX`; F `V` |
| `/payroll/registers` | Payroll Registers | `payroll.registers` | Payroll | P,F `VX` |
| `/payroll/bank-advice` | Bank Advice | `payroll.bank_advice` | Payroll | P `VX`; F `VXA` |
| `/payroll/statutory` | Statutory Setup | `payroll.statutory` | Payroll | P `VE` |
| `/payroll/returns` | Returns & Forms | `payroll.returns` | Payroll | P `VX` (ECR, ESI, PT, 24Q, Form 16, 12BA) |
| `/expenses/approvals` | Expense Approvals | `workplace.expense_approvals` | Workplace | M,D `VA`; F `VA` |
| `/expenses/finance` | Finance Review | `workplace.expense_finance` | Workplace | F `VEA`; P `V` |
| `/expenses/policies` | Expense Policies | `workplace.expense_policies` | Workplace | F,H `VCE` |
| `/travel/desk` | Travel Desk | `workplace.travel_desk` | Workplace | F `VCE`; H `V` |
| `/travel/advances` | Travel Advances | `workplace.travel_advances` | Workplace | F `VCEA` |
Payroll segregation of duties: on `/payroll/runs/[id]` the **Approve** step needs `payroll.runs:A`, held by
`finance_controller` (and owner), **not** `payroll_admin` (W0 changes the grant; W10 adjusts the screen).

### W6 · Hiring extensions + Onboarding & Exit — `src/app/(app)/hiring/**`, `src/app/(app)/{onboarding,probation,separations,fnf,exit-interviews,alumni}/**`, public `src/app/careers/{jobs,apply,track}/**`, `src/app/{offer,pre-joining}/**`, `src/components/lifecycle/**`, `src/mock/lifecycle.ts`
| Route | Label | Key | Group | Grants |
|---|---|---|---|---|
| `/hiring/referrals` | Referrals | `hiring.referrals` | Hiring | everyone `VC`; R,H `VCEA` |
| `/hiring/talent-pool` | Talent Pool | `hiring.talent_pool` | Hiring | R `VCE` |
| `/hiring/vendors` | Agencies | `hiring.vendors` | Hiring | R `VCE`; F `V` |
| `/hiring/analytics` | Recruitment Analytics | `hiring.analytics` | Hiring | R,H,D `V` |
| `/onboarding` | Onboarding | `lifecycle.onboarding` | Onboarding & Exit | H,K `VCEA`; I `VE`; M `V` |
| `/onboarding/templates` | Checklist Templates | `lifecycle.templates` | Onboarding & Exit | H `VCED` |
| `/probation` | Probation & Confirmation | `lifecycle.probation` | Onboarding & Exit | H `VEA`; M `VEA` |
| `/separations` | Separations | `lifecycle.separations` | Onboarding & Exit | H `VCEA`; M `VA` |
| `/separations/[id]` | Clearance | `lifecycle.separations` | (detail) | H,I,F,P,K sign-off per row |
| `/fnf` + `/fnf/[id]` | Full & Final | `lifecycle.fnf` | Onboarding & Exit | P `VCE`; F `VA`; H `V` |
| `/exit-interviews` | Exit Interviews | `lifecycle.exit_interviews` | Onboarding & Exit | H `VCE` |
| `/alumni` | Alumni | `lifecycle.alumni` | Onboarding & Exit | H,R `V` |
Public: `/careers/jobs/[slug]` (job detail), `/careers/apply/[slug]` (application with resume upload +
**AI resume auto-fill**), `/careers/track` (candidate tracker), `/offer` (offer accept / decline /
e-sign), `/pre-joining` (pre-joining wizard: personal, documents, bank, nominees, declarations).

### W7 · Growth & Engagement — `src/app/(app)/performance/**`, `src/app/(app)/reviews/cycles/**`, `src/app/(app)/learning/{sessions,enrollments,certifications,skill-gap,budget,courses}/**`, `src/app/(app)/{feed,policies,surveys,recognition,celebrations,ideas}/**`, `src/components/engage/**`, `src/mock/engage.ts`
| Route | Label | Key | Group | Grants |
|---|---|---|---|---|
| `/performance/feedback` | Feedback & 360 | `growth.feedback` | Growth | everyone `VC`; H `VCE` |
| `/performance/one-on-ones` | One-on-Ones | `growth.one_on_ones` | Growth | everyone `VC`; M,D `VCE` |
| `/performance/pip` | Improvement Plans | `growth.pip` | Growth | H `VCE`; M `VCE` (own team) |
| `/performance/succession` | Succession | `growth.succession` | Growth | H,D `VCE` |
| `/reviews/cycles` | Review Cycle Admin | `growth.cycles` | Growth | H `VCE` |
| `/learning/courses/[id]` | Course Detail | `growth.learning` | (detail) | — |
| `/learning/sessions` | Training Sessions | `growth.sessions` | Growth | H `VCE`; everyone `V` |
| `/learning/enrollments` | Enrollments | `growth.enrollments` | Growth | H `VCEA`; M `VA` |
| `/learning/certifications` | Certifications | `growth.certifications` | Growth | H `VCE`; everyone `V` |
| `/learning/skill-gap` | Skill Gap | `growth.skill_gap` | Growth | H,D,M `V` |
| `/learning/budget` | Training Budget | `growth.budget` | Growth | H `VE`; F `V` |
| `/feed` | Company Feed | `engage.feed` | Engagement | everyone `VC` |
| `/policies` | Policy Documents | `engage.policies` | Engagement | everyone `V`; H `VCE` |
| `/surveys` + `/surveys/[id]` | Surveys & Pulse | `engage.surveys` | Engagement | everyone `V`; H `VCE` |
| `/recognition` | Recognition & Rewards | `engage.recognition` | Engagement | everyone `VC`; H `VCEA` |
| `/celebrations` | Celebrations | `engage.celebrations` | Engagement | everyone `V` |
| `/ideas` | Idea Box | `engage.ideas` | Engagement | everyone `VC`; H `VCEA` |

### W8 · Assets & Helpdesk — `src/app/(app)/assets/{[id],categories,maintenance,requests,licences,audit}/**`, `src/app/(app)/helpdesk/{queue,categories,sla,kb,cases,analytics}/**`, `src/components/service/**`, `src/mock/service.ts`
| Route | Label | Key | Group | Grants |
|---|---|---|---|---|
| `/assets/[id]` | Asset Detail | `workplace.assets` | (detail) | — |
| `/assets/categories` | Asset Categories | `workplace.asset_categories` | Workplace | I,H `VCE` |
| `/assets/maintenance` | Maintenance | `workplace.asset_maintenance` | Workplace | I `VCE` |
| `/assets/requests` | Asset Requests | `workplace.asset_requests` | Workplace | everyone `VC`; I `VCEA`; M `VA` |
| `/assets/licences` | Software Licences | `workplace.licences` | Workplace | I `VCE`; F `V` |
| `/assets/audit` | Asset Verification | `workplace.asset_audit` | Workplace | I `VCEA`; F,A `V` |
| `/helpdesk/queue` | Agent Queue | `helpdesk.queue` | Helpdesk | K,H `VCEA` |
| `/helpdesk/categories` | Ticket Categories | `helpdesk.categories` | Helpdesk | H,K `VCE` |
| `/helpdesk/sla` | SLA Policies | `helpdesk.sla` | Helpdesk | H `VCE` |
| `/helpdesk/kb` | Knowledge Base | `helpdesk.kb` | Helpdesk | everyone `V`; K,H `VCE` |
| `/helpdesk/cases` | HR Cases | `helpdesk.cases` | Helpdesk | H `VCEA`; K `VCE` (restricted) |
| `/helpdesk/analytics` | Helpdesk Analytics | `helpdesk.analytics` | Helpdesk | H,K `V` |
Move existing `/helpdesk` into the Helpdesk group as "My Tickets".

### W10 · Fix existing screens — owns all **existing** pages and shared components not owned by W0
Fix every finding in `docs/11-review-findings.md` (written from the code review + browser walkthrough).

### Phase C (after W1–W10) · AI everywhere — embeds AI into existing and new screens
Mount `CopilotPanel` + `CopilotLauncher` in the shell; dashboard "AI briefing" card; AI on helpdesk ticket
(category/priority/suggested reply), candidate (resume parse, match summary, JD writer on requisitions),
reviews (feedback summary, AI draft), payroll run (AI anomaly flags + explain), expenses (receipt OCR,
duplicate detection), analytics (Ask box), leave (smart suggestions, conflict warning), attendance
(anomaly flags), announcements (AI draft), letters (AI draft), onboarding (AI-generated checklist),
exit interviews (AI theme summary), surveys (AI sentiment themes).
