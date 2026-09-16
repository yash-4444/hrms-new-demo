# 05 · Permissions (RBAC)

One file is the source of truth: **`src/lib/rbac.ts`**. The sidebar, the route guard, every
disabled button, and the `/admin/roles` matrix all read from it. There is no second copy.

## The model

**42 menu keys × 6 roles × 6 action letters.**

```
V  View      C  Create     E  Edit
D  Delete    X  Execute    A  Approve
```

A grant is a string of letters against a menu key, per role:

```ts
const HR_ADMIN: Grants = {
  "people.directory": "VCED",   // view, create, edit, delete — but not execute or approve
  "payroll.runs":     undefined // absent = no access at all
};
```

## The six personas

| Persona | Role | Grants | Shape of access |
|---|---|---|---|
| Ananya Rao | `employee` | 40 | Self-service only |
| Vikram Shah | `manager` | 63 | + team visibility and approvals |
| Priya Menon | `hr_admin` | 111 | + people, time, growth, admin. **No payroll.** |
| Rahul Desai | `payroll_admin` | 67 | Pay runs, structures, compensation. **No hiring or performance.** |
| Sana Iqbal | `recruiter` | 61 | Hiring end to end; read-only directory |
| Arjun Kapoor | `tenant_owner` | 252 | Everything |

The deliberate gaps are the interesting part. HR Admin *cannot* open a pay run; Payroll
Admin *cannot* open the hiring pipeline. Visiting those routes directly produces the
Access denied state, which is exactly what makes the model legible in a demo.

## Using it in a screen

Always go through `useApp()`, never import `RBAC` directly.

```tsx
const { can, why, grants, persona } = useApp();

can("payroll.runs", "X")     // boolean
grants("payroll.runs")       // ["V","C","E","D","X","A"]
why("payroll.runs", "X")     // "HR Admin has no access to Pay Runs. Required: Pay Runs · View."
```

## The three enforcement layers

### 1. Navigation — the item disappears

`Sidebar` filters `NAV` through `can(menuKey, "V")`. A group with no visible items is
dropped entirely.

### 2. Route — Access denied

`RouteGuard` (mounted once in `(app)/layout.tsx`) maps the current path to a menu key via
`menuKeyForPath()` and renders a full card naming the missing grant. It uses longest-prefix
matching, so `/attendance/team` resolves to `team.attendance`, not `my.attendance`.

### 3. Control — disabled, with the reason

```tsx
<Gated menuKey="payroll.runs" action="X">
  <Button onClick={lockRun}>Lock run</Button>
</Gated>
```

If the grant is missing, `Gated` clones the child with `disabled` and wraps it in a tooltip
carrying `denyReason(...)`.

**This is the layer that matters for the demo.** Hiding a button teaches the audience
nothing. A greyed-out button whose tooltip reads *"Recruiter can view Employee Directory
but cannot edit. Required grant: Employee Directory · Edit"* makes the permission model
visible without anyone opening the admin screen.

Pass `hide` when a control genuinely should vanish rather than grey out (rare — usually a
pin/edit affordance on a feed item).

## Adding a screen to the model

1. Add a `MenuKey` to the union in `rbac.ts`.
2. Add a `MENU_META` entry — `{ key, label, module }`. The label appears in the deny
   message and as the row label in the matrix.
3. Grant it to the roles that should have it, in the `SELF_SERVICE` / `MANAGER` /
   `HR_ADMIN` / `PAYROLL_ADMIN` / `RECRUITER` blocks. `OWNER` is generated, so the tenant
   owner gets it automatically.
4. Add a `NAV` entry in `src/lib/nav.ts` if it belongs in the sidebar.
5. Add a `ROUTE_KEYS` entry in `nav.ts` so the route guard can resolve it.
6. Wrap its mutating controls in `<Gated>`.

`/admin/roles` picks all of this up with no further work — it renders from `MENU_META`
× `PERSONAS` × `grantsFor()`.

## The matrix screen

`/admin/roles` is the brief's designated "this is a real enterprise product" moment, and
it is live: every action letter is a toggle, the per-role grant totals and per-row access
counts recompute from the edited state, and it ships search, a module filter, an "only
differences" toggle, a two-role compare mode, a row/column crosshair and arrow-key
navigation. Edits are in-memory, like everything else.

## Things that will trip you up

- **Grants are additive per role, not hierarchical.** `MANAGER` spreads `SELF_SERVICE`
  and overrides keys; there is no automatic "manager inherits everything an employee has
  plus more" beyond that spread. Check the actual object.
- **`OWNER` is computed** from `MENU_META`, so a new menu key is owner-accessible the
  moment you declare it.
- **Compensation masking is not a menu key.** `/employees/[id]` gates its Compensation tab
  on `can("people.profile", "E")` and renders a lock state otherwise. That is deliberate:
  the tab stays visible so the audience sees that the data exists and is withheld.
