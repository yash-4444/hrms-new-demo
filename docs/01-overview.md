# 01 · Overview

## What this is

HRMS-NEW is a **demo build**: a navigable, visually credible front end for an enterprise
HRMS SaaS product covering the full employee lifecycle. It exists so that a presenter can
click through every module end to end, switch roles mid-demo, and toggle dark mode,
without ever hitting a dead link.

The brief prioritised **breadth of navigable screens and visual credibility over depth of
logic**. Every design decision below follows from that.

## What this is not

- **Not a prototype of the backend.** There are no API routes, no database, no auth
  provider, no network calls. `src/mock/` is the entire data layer.
- **Not persistent.** Every mutation updates React state and fires a toast. Refresh the
  page and you are back to the seed data. This is intentional: a demo that accumulates a
  presenter's test clicks gets worse every time it is shown.
- **Not a design exploration.** There is one design system, applied identically across all
  45+ screens. Per-module visual variation is a defect, not a feature.

## The product, in one paragraph

A multi-tenant HRMS for an Indian-first company with an overseas branch. It handles
attendance and leave (with country-specific work calendars and accrual policies), payroll
with full Indian statutory computation (PF, ESI, PT, TDS), the people directory and org
structure, hiring from requisition to offer, performance and learning, the workplace desk
(assets, expenses, travel, helpdesk), and tenant administration with a real RBAC matrix
and an audit trail.

## Module map

| Module | Routes | What it proves |
|---|---|---|
| **Auth** | `/login` | Persona selection, the entry point |
| **Home** | `/dashboard` | Role-awareness — the same route renders five different pages |
| **Time** | `/attendance`, `/attendance/team`, `/attendance/amendments`, `/admin/attendance-settings`, `/admin/work-calendars` | Live timers, day boards, multi-country configuration, a fail-closed resolution diagnostic |
| **Leave** | `/leave`, `/leave/approvals`, `/leave/calendar`, `/leave/admin` | Balances that reconcile, a real approval workflow, dry-run batch jobs |
| **People** | `/employees`, `/employees/[id]`, `/employees/import`, `/org-chart` | Scale (340 records), a masked-compensation permission state, a 3-step import with a dry-run report |
| **Payroll** | `/payroll/runs`, `/payroll/runs/[id]`, `/payroll/runs/[id]/employee/[eid]`, `/payroll/structures`, `/payslips` | The "explain this number" trace — the single most convincing screen in the build |
| **Hiring** | `/requisitions`, `/jobs`, `/candidates`, `/candidates/[id]`, `/interviews`, `/offers`, `/careers` | A drag-and-drop pipeline and a public careers page |
| **Growth** | `/goals`, `/reviews`, `/reviews/calibration`, `/learning` | Cascading goals, side-by-side review columns, a draggable 9-box |
| **Workplace** | `/assets`, `/expenses`, `/travel`, `/helpdesk`, `/announcements` | SLA countdowns, inline policy violations, read-acknowledgement |
| **Admin** | `/admin/users`, `/admin/roles`, `/admin/settings`, `/admin/audit`, `/admin/compliance` | `/admin/roles` is the "this is a real enterprise product" moment |
| **Insights** | `/analytics`, `/reports` | The chart system and the report library |

See [`08-screens.md`](08-screens.md) for the full route inventory with required grants.

## The four demo moments

If you only have five minutes, show these:

1. **The role switcher** (top bar) — swap persona and watch the nav, the dashboard and the
   button states change without a reload.
2. **`/payroll/runs/[id]/employee/[eid]`** — expand any component's "explain this number"
   and read the formula chain: `PF = min(Basic × 0.12, 1800) → min(2880, 1800) → 1800`.
3. **`/admin/roles`** — 42 menu keys × 6 roles × 6 action letters, live-editable.
4. **`/analytics`** — filter by branch or department and watch every chart move together,
   then hit the **Table view** button on any chart to show the same numbers without colour.

## Non-negotiables the build holds itself to

- Numbers on screen must be **plausible and must reconcile**. A demo dies the moment
  someone adds up a column and it is wrong. See [`06-mock-data.md`](06-mock-data.md).
- **No lorem ipsum** anywhere. Every string is real-sounding content.
- **No "Coming soon" screens.** Every route in the nav renders something real.
- **One visual language** across every module. See [`03-design-system.md`](03-design-system.md).
- Every click and every form **actually works** — no `href="#"`, no decorative buttons,
  no filter that renders but does not filter.
