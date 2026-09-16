# 02 · Architecture

## Folder layout

```
src/
├── app/
│   ├── layout.tsx              root: fonts, ThemeProvider, AppStateProvider, Toaster
│   ├── globals.css             ALL design tokens (Tailwind 4, CSS-first)
│   ├── page.tsx                redirects to /login
│   ├── login/page.tsx          public — no app chrome
│   ├── careers/page.tsx        public — no app chrome
│   └── (app)/                  route group: everything behind the app shell
│       ├── layout.tsx          Sidebar + Topbar + Breadcrumbs + RouteGuard
│       ├── dashboard/
│       ├── attendance/  leave/  employees/  org-chart/
│       ├── payroll/  payslips/
│       ├── requisitions/  jobs/  candidates/  interviews/  offers/
│       ├── goals/  reviews/  learning/
│       ├── assets/  expenses/  travel/  helpdesk/  announcements/
│       ├── admin/
│       └── analytics/  reports/
├── components/
│   ├── app-state.tsx           the demo's nervous system (persona, counts, punch clock)
│   ├── data-table.tsx          the ONE data table used product-wide
│   ├── ui/                     design-system primitives
│   │   ├── button.tsx  card.tsx
│   │   ├── status-badge.tsx    the single status vocabulary
│   │   ├── primitives.tsx      Badge Input Label Field Avatar Switch Checkbox Tabs
│   │   │                       Tooltip Progress Skeleton Alert EmptyState Kbd …
│   │   └── overlays.tsx        Dialog Sheet DropdownMenu Popover Select Confirm …
│   ├── charts/
│   │   ├── palette.ts          the only place a chart colour is chosen
│   │   ├── chart-frame.tsx     the frame: legend, table view, tooltip
│   │   ├── index.tsx           the chart components
│   │   └── stat-tile.tsx       KPI tiles and the KPI row
│   ├── shell/
│   │   ├── sidebar.tsx         grouped, collapsible, permission-filtered nav
│   │   ├── topbar.tsx          search, notifications, approvals, theme, role switcher
│   │   ├── command-palette.tsx ⌘K fuzzy search over people, screens and actions
│   │   └── page.tsx            PageHeader/PageBody/Section, Gated, RouteGuard, skeletons
│   └── <module>/               components private to one module
├── lib/
│   ├── utils.ts                cn(), mulberry32() seeded RNG, small helpers
│   ├── format.ts               inr(), inrCompact(), num(), dates, hms(), fyLabel()
│   ├── rbac.ts                 personas, menu keys, the grant matrix, denyReason()
│   └── nav.ts                  the sidebar tree and route → menu-key mapping
└── mock/
    ├── org.ts                  tenant, branches, departments, grades, holidays, DEMO_TODAY
    ├── employees.ts            340 generated employees + the org hierarchy
    ├── insights.ts             aggregates for /dashboard, /analytics, /reports
    └── <module>.ts             one fixture file per module
```

## Rendering model

**Every page is a client component.** The app is a demo with no server data, so there is
nothing to gain from server components and a lot to lose (the role switcher, the live
punch timer, drag-and-drop and every filter need client state). Pages start with
`"use client"`.

Two consequences to know:

1. **Route params.** In Next.js 16 the `params` prop is a `Promise`. Client pages read
   params with `useParams()` from `next/navigation` instead.
2. **Search params.** Anything calling `useSearchParams()` must sit inside a `<Suspense>`
   boundary or the production build will fail on prerender.

## State

There is no store library. State lives in exactly two places:

### `AppStateProvider` (`src/components/app-state.tsx`)

Everything global to the demo:

- `role` / `persona` / `setRole` — the role switcher. Changing it re-renders the whole
  tree; no reload, no route change.
- `can(menuKey, action)` / `grants(menuKey)` / `why(menuKey, action)` — the permission
  API every screen uses.
- `notifications`, `approvalCount`, `exceptionCount`, `ticketCount` — the top-bar and
  sidebar badges. Screens mutate these so the chrome stays in sync (resolving a payroll
  exception decrements the sidebar badge).
- `punchedIn` / `punchedInAt` / `punchIn()` / `punchOut()` — the shared punch clock, so
  the dashboard card and `/attendance` agree.
- `commandOpen`, `sidebarCollapsed`.
- Global keyboard handling: <kbd>⌘K</kbd> and <kbd>Alt</kbd>+<kbd>1..6</kbd>.

> **Hydration rule:** the punch-in time is set in a `useEffect`, not in the initial state.
> Anything derived from `Date.now()` at render time will mismatch between the server pass
> and the client pass. See [`06-mock-data.md`](06-mock-data.md).

### Local component state

Everything else. Filters, dialogs, selections, optimistic row edits. A screen owns its own
data copy (`const [rows, setRows] = useState(FIXTURE)`) and mutates that copy. Because
nothing persists, there is no cache to invalidate and no sync problem to solve.

## Mutations

Every mutation goes through one helper:

```ts
import { mockAction } from "@/components/app-state";

setRows(rows.filter(r => r.id !== id));         // optimistic, instant
mockAction("Leave approved", {                   // and a toast
  description: "Kavya Iyer · 12–14 Oct · 3 days",
});
```

Rules:

- Update local state **first**, then toast. It must feel instant.
- Destructive actions go through `<ConfirmDialog>` from `ui/overlays.tsx` first.
- Nothing ever reverts — this is a mock, and a rollback animation would confuse the
  audience.

## Page anatomy

Every screen follows the same shape:

```tsx
"use client";

export default function SomethingPage() {
  const loading = useFakeLoad();                 // ~400 ms skeleton, so it feels real
  if (loading) return <PageBody><PageHeader …/><TableSkeleton/></PageBody>;

  return (
    <PageBody>
      <PageHeader title="…" description="…" actions={<Button…/>} />
      <StatRow>…</StatRow>
      <Section title="…">…</Section>
    </PageBody>
  );
}
```

`PageHeader`, `PageBody`, `Section`, `Gated`, `RouteGuard`, `useFakeLoad`,
`TableSkeleton`, `CardsSkeleton` and `ChartSkeleton` all come from
`@/components/shell/page`.

## Permission enforcement, in three layers

| Layer | Component | Effect |
|---|---|---|
| Navigation | `Sidebar` filters `NAV` through `can(menuKey, "V")` | The item is not in the menu |
| Route | `RouteGuard` in `(app)/layout.tsx` maps the path to a menu key | A full **Access denied** card naming the required grant |
| Control | `<Gated menuKey="…" action="E">` | The button renders **disabled** with a tooltip explaining exactly which grant is missing |

`Gated` is the important one for the demo: hiding a button teaches nothing, but a disabled
button that says *"Recruiter can view Employee Directory but cannot edit. Required grant:
Employee Directory · Edit"* makes the permission model visible.

Details in [`05-rbac.md`](05-rbac.md).

## Shared components you must not fork

| Need | Use | Never |
|---|---|---|
| Any list of records | `DataTable` | A hand-rolled `<table>` |
| Any status | `<StatusBadge status="approved" />` | A coloured `<span>` |
| Any chart | `@/components/charts` | Recharts directly, or a raw hex colour |
| Any KPI | `<StatTile>` / `<StatRow>` | A bespoke card |
| Any money | `inr()` / `inrCompact()` | `toLocaleString()` or template strings |
| Any permission-sensitive control | `<Gated>` | A manual `can()` check that hides it |

`DataTable` already gives you sorting, a filter row, free-text search, column visibility,
pagination, row selection with a sticky bulk-action bar, keyboard row navigation, an
Export button, a skeleton state and a designed empty state. Forking it is how a product
ends up with five inconsistent grids.

## Conventions

- **Forms**: React Hook Form + Zod via `@hookform/resolvers/zod`, rendered through the
  `Field` component so labels, errors and hints are consistent. Long forms get an
  unsaved-changes guard.
- **Icons**: `lucide-react`, `size-3.5` or `size-4`. Icon-only buttons need an `aria-label`.
- **Numbers**: any column of figures gets `className="tnum"` or `data-numeric` so tabular
  numerals line up.
- **Density**: this is an enterprise product. Rows are compact, `text-xs`/`text-sm`,
  `h-7`/`h-8` controls. Marketing whitespace is wrong here.
- **Dates**: all through `src/lib/format.ts`. "Today" is the fixed constant `DEMO_TODAY`,
  never the wall clock.
