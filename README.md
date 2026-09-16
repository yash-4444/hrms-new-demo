# HRMS-NEW — interactive product demo

A clickable, **front-end-only** mock of an enterprise HRMS SaaS product, built for
stakeholder walkthroughs. There is no backend: every screen runs on typed, deterministic
in-memory fixtures, every action gives optimistic feedback, and nothing persists past a
page refresh. That is deliberate.

**Demo tenant:** Stellar Technologies Pvt Ltd · 340 employees · 3 staffed branches
(Bengaluru, Pune, Newark NJ) · 9 departments · Indian-first statutory model.

---

## Run it

```bash
cd hrms-new
npm install
npm run dev          # http://localhost:3000
```

Sign in at `/login` with **any** credentials, or click one of the six demo personas on
the sign-in card to jump straight in as that role.

```bash
npm run build        # production build
npm start            # serve the production build
npx tsc --noEmit     # typecheck
npm run lint         # eslint
```

Node 20.9+ required (developed on Node 22).

---

## The one feature to show first

The **role switcher** in the top bar. It swaps the logged-in persona *without a reload* —
the sidebar, the dashboard and every screen's available actions change in front of you.
Press <kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>6</kbd> to cycle personas mid-sentence.

| Persona | Role | What changes |
|---|---|---|
| Ananya Rao | Employee | Self-service only. Most of the sidebar disappears. |
| Vikram Shah | Reporting Manager | Team + approvals appear; 8 reportees. |
| Priya Menon | HR Admin | People, Time, Growth, Admin. No payroll money screens. |
| Rahul Desai | Payroll Admin | Pay runs and structures. No hiring, no performance. |
| Sana Iqbal | Recruiter | The whole hiring pipeline; read-only directory. |
| Arjun Kapoor | Tenant Owner | Everything. |

Permission differences are shown three ways: **hidden nav items**, **disabled buttons with
a tooltip that names the missing grant**, and a full **Access denied** state if you visit a
restricted route directly.

Other things worth demoing: <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> command palette,
the theme toggle (light and dark are both fully designed), and the **Table view** button on
every chart.

---

## Documentation

Read these in order — they are written for someone joining the project cold.

| Doc | What it covers |
|---|---|
| [`docs/01-overview.md`](docs/01-overview.md) | What this is, what it is not, the module map |
| [`docs/02-architecture.md`](docs/02-architecture.md) | Folder layout, rendering model, state, conventions |
| [`docs/03-design-system.md`](docs/03-design-system.md) | Tokens, typography, density, the status vocabulary |
| [`docs/04-charts.md`](docs/04-charts.md) | The chart kit, the validated colour system, the rules |
| [`docs/05-rbac.md`](docs/05-rbac.md) | The permission model and how to add a screen to it |
| [`docs/06-mock-data.md`](docs/06-mock-data.md) | Fixture design, determinism, the reconciliation rules |
| [`docs/07-demo-script.md`](docs/07-demo-script.md) | A 12-minute walkthrough that lands the product |
| [`docs/08-screens.md`](docs/08-screens.md) | Every route, what it shows, which grant it needs |
| [`docs/09-deployment.md`](docs/09-deployment.md) | Static export + GitHub Pages, and the dynamic-route split it requires |

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 (CSS-first tokens) ·
Radix UI primitives · TanStack Table v8 · Recharts 3 · React Hook Form + Zod ·
lucide-react · next-themes · sonner · date-fns · cmdk.

No API routes. No database. No auth provider. No network calls of any kind.
