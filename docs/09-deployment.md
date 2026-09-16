# 09 · Deployment (GitHub Pages)

The production deploy is a **full static export**. GitHub Pages is a file host — there is
no Node process — which is fine here, because the app has no backend anyway.

`npm run build` produces `out/`, which the Pages workflow uploads. `npm run dev` is
unaffected and still serves from `/`.

## How it is wired

| Piece | What it does |
|---|---|
| `next.config.ts` | `output: "export"`, `trailingSlash: true`, `images.unoptimized`, and `basePath` read from `NEXT_PUBLIC_BASE_PATH` |
| `.github/workflows/deploy.yml` | On push to `main`/`master`: install → typecheck → build → upload → deploy |
| `public/.nojekyll` | Stops Pages ignoring the `_next` directory |

**`basePath` is never hard-coded.** A project site is served from
`https://<user>.github.io/<repo>/`, so the build needs to know the repo name. The workflow
derives it:

```bash
REPO="${{ github.event.repository.name }}"
if [[ "$REPO" == *.github.io ]]; then export NEXT_PUBLIC_BASE_PATH=""      # user/org site
else                                   export NEXT_PUBLIC_BASE_PATH="/$REPO"; fi
```

So the repo can be renamed and the next deploy just works.

## The dynamic-route problem, and how it is solved

Static export requires every dynamic route to enumerate its paths at build time via
`generateStaticParams`. But `generateStaticParams` is a **server-side export**, and all four
of our detail screens are client components — they need `useParams`, filters, tabs and the
persona context.

The fix is a thin split. Each dynamic route is two files:

```
employees/[id]/
├── page.tsx   server shell — exports generateStaticParams, renders <View />
└── view.tsx   "use client" — the actual screen, reads useParams()
```

Applied to all four:

| Route | Shell enumerates | Pages |
|---|---|---|
| `/employees/[id]` | `EMPLOYEES` | 340 |
| `/candidates/[id]` | `CANDIDATES` | 60 |
| `/payroll/runs/[id]` | `PAY_RUNS` + `PAY_RUN_HISTORY` | 12 |
| `/payroll/runs/[id]/employee/[eid]` | `PAY_RUNS` × `RUN_POPULATION` | 618 |

### The one deliberate cap

Traced payslip breakdowns are generated for the **two live runs only** — August 2026
(paid) and September 2026 (calculated). Doing it for all twelve historical periods would be
~3,700 pages of real payroll computation for months that exist only as list context in the
demo.

Because a static export cannot fall back at request time, an un-generated path is a hard
404. So `runs/[id]/view.tsx` reads the same `PAY_RUNS` list and only renders the Breakdown
affordance when the run is covered — otherwise it shows it **disabled with a tooltip**
("Traced breakdowns are kept for the current and previous run. This period is archived.").

**This is the invariant to preserve:** if you ever widen or narrow the `generateStaticParams`
for that route, update the `hasBreakdown` check in the same commit, or the build will start
producing dead links.

## Deploying

One-time, on the account that owns the repo:

```bash
gh auth login                                  # the account that will host it
gh repo create <name> --public --source=. --remote=origin --push
```

Then in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions.**

After that every push to `main`/`master` redeploys. The workflow can also be run by hand
from the Actions tab (`workflow_dispatch`).

First deploy takes roughly 4–6 minutes — the 618 payroll pages each run the full statutory
computation.

## Gotchas

- **Don't add server-only features.** API routes, middleware, server actions, ISR and
  `next/image` optimisation all break `output: "export"`. This app uses none of them.
- **`trailingSlash: true` is load-bearing.** Pages serves `/foo/` as `/foo/index.html`;
  without it deep links 404.
- **Building locally on Git Bash** needs `MSYS_NO_PATHCONV=1`, or MSYS rewrites
  `NEXT_PUBLIC_BASE_PATH=/repo` into a Windows path and the build fails with
  *"Specified basePath has to start with a /"*. Not an issue in CI (Ubuntu).
- **Nothing persists** in the deployed build either — it is still a mock. Every visitor
  gets the same seed data.
