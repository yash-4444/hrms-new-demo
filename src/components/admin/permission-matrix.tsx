"use client";

import * as React from "react";
import { ArrowLeftRight, Columns2, Download, RotateCcw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTIONS,
  ACTION_LABEL,
  MENU_META,
  PERSONAS,
  grantsFor,
  personaById,
  type Action,
  type MenuKey,
  type MenuMeta,
  type RoleId,
} from "@/lib/rbac";
import { mockAction } from "@/components/app-state";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Hint, Label, Switch } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";

/* ============================================================================
   The permission matrix — 42 menu keys × 6 roles × 6 action letters.

   Rows and columns are derived from MENU_META and PERSONAS; the granted
   letters come from grantsFor(). Edits live in component state only: `draft`
   holds unpublished toggles, `published` holds what has been "saved" this
   session. Nothing is persisted.
   ========================================================================== */

const HEADER_H = 78;
const ROLE_COL_W = 116;
const NAME_COL_W = 268;

const ck = (role: RoleId, key: MenuKey) => `${role}|${key}`;
const rbacStr = (role: RoleId, key: MenuKey) => grantsFor(role, key).join("");

/* ------------------------------------------------------------------- chip */

function chipClass(granted: boolean) {
  return cn(
    "flex h-4 w-[15px] items-center justify-center rounded-[3px] border font-mono text-[9px] font-bold leading-none transition-colors",
    granted
      ? "border-primary/50 bg-primary-soft text-primary-soft-foreground"
      : "border-border bg-transparent text-muted-foreground/35",
  );
}

/* ------------------------------------------------------------------- cell */

interface CellProps {
  rowIdx: number;
  colIdx: number;
  granted: string;
  baseGranted: string;
  rowHot: boolean;
  colHot: boolean;
  diff: boolean;
  dim: boolean;
  focusAct: number;
  capability: string;
  roleName: string;
  onToggle: (rowIdx: number, colIdx: number, actIdx: number) => void;
  onKey: (e: React.KeyboardEvent, rowIdx: number, colIdx: number, actIdx: number) => void;
  onHover: (rowIdx: number, colIdx: number) => void;
}

const MatrixCell = React.memo(function MatrixCell({
  rowIdx,
  colIdx,
  granted,
  baseGranted,
  rowHot,
  colHot,
  diff,
  dim,
  focusAct,
  capability,
  roleName,
  onToggle,
  onKey,
  onHover,
}: CellProps) {
  const crosshair = rowHot && colHot;
  return (
    <td
      onMouseEnter={() => onHover(rowIdx, colIdx)}
      className={cn(
        "border-b border-r border-border px-1.5 py-1 align-middle transition-colors",
        crosshair
          ? "bg-primary-soft/70"
          : diff
            ? "bg-serious-soft/70"
            : rowHot || colHot
              ? "bg-muted/60"
              : "bg-card",
        dim && "opacity-40",
      )}
    >
      <div className="flex items-center justify-center gap-px">
        {ACTIONS.map((a, ai) => {
          const on = granted.includes(a);
          const changed = on !== baseGranted.includes(a);
          return (
            <button
              key={a}
              type="button"
              id={`pm-${rowIdx}-${colIdx}-${ai}`}
              role="switch"
              aria-checked={on}
              tabIndex={focusAct === ai ? 0 : -1}
              aria-label={`${ACTION_LABEL[a]} on ${capability} for ${roleName}`}
              title={`${roleName} · ${capability} · ${ACTION_LABEL[a]}`}
              onClick={() => onToggle(rowIdx, colIdx, ai)}
              onKeyDown={(e) => onKey(e, rowIdx, colIdx, ai)}
              className={cn(
                chipClass(on),
                "hover:border-primary hover:text-primary-soft-foreground",
                changed && "ring-1 ring-warning ring-offset-1 ring-offset-card",
              )}
            >
              {a}
            </button>
          );
        })}
      </div>
    </td>
  );
});

/* ---------------------------------------------------------------- summary */

function RoleAccessBar({ full, partial, none }: { full: number; partial: number; none: number }) {
  const total = Math.max(1, full + partial + none);
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className="h-full bg-primary" style={{ width: `${(full / total) * 100}%` }} />
      <span className="h-full bg-primary/40" style={{ width: `${(partial / total) * 100}%` }} />
    </div>
  );
}

/* ============================================================== the matrix */

export function PermissionMatrix() {
  const [published, setPublished] = React.useState<Record<string, string>>({});
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  const [query, setQuery] = React.useState("");
  const [moduleFilter, setModuleFilter] = React.useState("all");
  const [onlyDiff, setOnlyDiff] = React.useState(false);
  const [compare, setCompare] = React.useState(false);
  const [roleA, setRoleA] = React.useState<RoleId>("manager");
  const [roleB, setRoleB] = React.useState<RoleId>("hr_admin");

  const [hover, setHover] = React.useState<{ row: number; col: number } | null>(null);
  const [focus, setFocus] = React.useState({ row: 0, col: 0, act: 0 });
  const [gridFocused, setGridFocused] = React.useState(false);
  const [discardOpen, setDiscardOpen] = React.useState(false);

  /* -------------------------------------------------------------- grants */

  const baseOf = React.useCallback(
    (role: RoleId, key: MenuKey) => published[ck(role, key)] ?? rbacStr(role, key),
    [published],
  );
  const grantOf = React.useCallback(
    (role: RoleId, key: MenuKey) => draft[ck(role, key)] ?? baseOf(role, key),
    [draft, baseOf],
  );

  /* `draft` only ever holds cells that differ from the published policy — the
     toggle handler removes a key the moment it matches again. */
  const dirtyCount = Object.keys(draft).length;

  /* ------------------------------------------------------------- filters */

  const modules = React.useMemo(() => [...new Set(MENU_META.map((m) => m.module))], []);

  const visibleRows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const diffRoles: RoleId[] = compare ? [roleA, roleB] : PERSONAS.filter((p) => p.id !== "tenant_owner").map((p) => p.id);
    return MENU_META.filter((m) => {
      if (moduleFilter !== "all" && m.module !== moduleFilter) return false;
      if (q && !`${m.label} ${m.key} ${m.module}`.toLowerCase().includes(q)) return false;
      if (onlyDiff) {
        const distinct = new Set(diffRoles.map((r) => grantOf(r, m.key)));
        if (distinct.size < 2) return false;
      }
      return true;
    });
  }, [query, moduleFilter, onlyDiff, compare, roleA, roleB, grantOf]);

  const visibleRowsRef = React.useRef<MenuMeta[]>(visibleRows);
  visibleRowsRef.current = visibleRows;

  /* Keep the roving-tabindex cursor inside the filtered grid. */
  React.useEffect(() => {
    setFocus((f) => (f.row < visibleRows.length ? f : { row: 0, col: 0, act: 0 }));
  }, [visibleRows.length]);

  const groups = React.useMemo(() => {
    const out: { module: string; rows: { meta: MenuMeta; index: number }[] }[] = [];
    visibleRows.forEach((meta, index) => {
      const last = out[out.length - 1];
      if (last && last.module === meta.module) last.rows.push({ meta, index });
      else out.push({ module: meta.module, rows: [{ meta, index }] });
    });
    return out;
  }, [visibleRows]);

  /* ------------------------------------------------------------ mutation */

  const toggle = React.useCallback(
    (rowIdx: number, colIdx: number, actIdx: number) => {
      const meta = visibleRowsRef.current[rowIdx];
      if (!meta) return;
      const role = PERSONAS[colIdx].id;
      const action = ACTIONS[actIdx];
      const key = ck(role, meta.key);

      setDraft((prev) => {
        const current = prev[key] ?? published[key] ?? rbacStr(role, meta.key);
        const has = current.includes(action);
        const nextSet = new Set(current.split(""));
        if (has) nextSet.delete(action);
        else nextSet.add(action);
        const next = ACTIONS.filter((a) => nextSet.has(a)).join("");

        const base = published[key] ?? rbacStr(role, meta.key);
        const out = { ...prev };
        if (next === base) delete out[key];
        else out[key] = next;

        mockAction(
          `${has ? "Revoked" : "Granted"} ${ACTION_LABEL[action]} on ${meta.label}`,
          {
            description: `${personaById(role).role} · ${meta.key} → "${next || "no access"}". Not published yet.`,
            tone: has ? "warning" : "success",
          },
        );
        return out;
      });
    },
    [published],
  );

  const onKey = React.useCallback(
    (e: React.KeyboardEvent, r: number, c: number, a: number) => {
      const rows = visibleRowsRef.current.length;
      const cols = PERSONAS.length;
      const acts = ACTIONS.length;
      let nr = r;
      let nc = c;
      let na = a;

      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          toggle(r, c, a);
          return;
        case "ArrowRight":
          na += 1;
          if (na >= acts) {
            na = 0;
            nc += 1;
          }
          break;
        case "ArrowLeft":
          na -= 1;
          if (na < 0) {
            na = acts - 1;
            nc -= 1;
          }
          break;
        case "ArrowDown":
          nr += 1;
          break;
        case "ArrowUp":
          nr -= 1;
          break;
        case "Home":
          nc = 0;
          na = 0;
          break;
        case "End":
          nc = cols - 1;
          na = acts - 1;
          break;
        case "PageDown":
          nr += 10;
          break;
        case "PageUp":
          nr -= 10;
          break;
        default:
          return;
      }

      e.preventDefault();
      if (nc < 0) {
        nc = cols - 1;
        nr -= 1;
      }
      if (nc >= cols) {
        nc = 0;
        nr += 1;
      }
      nr = Math.max(0, Math.min(rows - 1, nr));
      nc = Math.max(0, Math.min(cols - 1, nc));
      setFocus({ row: nr, col: nc, act: na });
      const el = document.getElementById(`pm-${nr}-${nc}-${na}`);
      el?.focus();
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
    [toggle],
  );

  const onHover = React.useCallback((row: number, col: number) => setHover({ row, col }), []);

  /* ---------------------------------------------------------- statistics */

  const columnStats = React.useMemo(
    () =>
      PERSONAS.map((p) => {
        let grants = 0;
        let full = 0;
        let partial = 0;
        let none = 0;
        for (const m of MENU_META) {
          const g = grantOf(p.id, m.key);
          grants += g.length;
          if (g.length === ACTIONS.length) full += 1;
          else if (g.length > 0) partial += 1;
          else none += 1;
        }
        return { grants, full, partial, none };
      }),
    [grantOf],
  );

  const totalGranted = columnStats.reduce((a, c) => a + c.grants, 0);
  const totalCells = MENU_META.length * PERSONAS.length * ACTIONS.length;

  const compareStats = React.useMemo(() => {
    let differing = 0;
    let onlyInA = 0;
    let onlyInB = 0;
    for (const m of MENU_META) {
      const a = grantOf(roleA, m.key);
      const b = grantOf(roleB, m.key);
      if (a !== b) differing += 1;
      for (const act of ACTIONS) {
        if (a.includes(act) && !b.includes(act)) onlyInA += 1;
        if (b.includes(act) && !a.includes(act)) onlyInB += 1;
      }
    }
    return { differing, onlyInA, onlyInB };
  }, [grantOf, roleA, roleB]);

  /* ------------------------------------------------------------- actions */

  const publish = () => {
    const n = Object.keys(draft).length;
    setPublished((p) => ({ ...p, ...draft }));
    setDraft({});
    mockAction(`Published ${n} permission change${n === 1 ? "" : "s"}`, {
      description: "Every affected user picks up the new grants on their next page load. Written to the audit log.",
    });
  };

  const discard = () => {
    const n = Object.keys(draft).length;
    setDraft({});
    mockAction(`Discarded ${n} unpublished change${n === 1 ? "" : "s"}`, {
      description: "The matrix has been reverted to the last published state.",
      tone: "info",
    });
  };

  const resetFilters = () => {
    setQuery("");
    setModuleFilter("all");
    setOnlyDiff(false);
  };

  const filtersActive = query.trim() !== "" || moduleFilter !== "all" || onlyDiff;

  const onHeaderClick = (role: RoleId) => {
    if (!compare) {
      setCompare(true);
      setRoleA(role);
      setRoleB(PERSONAS.find((p) => p.id !== role)!.id);
      return;
    }
    if (role === roleA) {
      setRoleA(roleB);
      setRoleB(roleA);
      return;
    }
    setRoleB(role);
  };

  const focusRow = gridFocused ? focus.row : -1;
  const focusCol = gridFocused ? focus.col : -1;

  /* ---------------------------------------------------------------- view */

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      {/* ------------------------------------------------------- toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu key, capability or module…"
            aria-label="Search the permission matrix"
            className="h-7 w-[260px] rounded-md border border-input bg-card pl-7 pr-6 text-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger size="sm" className="w-[168px]" aria-label="Filter by module">
            <span className="truncate">
              <span className="text-muted-foreground">Module: </span>
              {moduleFilter === "all" ? "All modules" : moduleFilter}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Hint
          text={
            compare
              ? "Show only capabilities where the two compared roles differ."
              : "Show only capabilities where the five operational roles differ. Tenant Owner is excluded — it is the unrestricted baseline."
          }
        >
          <div className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
            <Switch id="only-diff" checked={onlyDiff} onCheckedChange={setOnlyDiff} />
            <Label htmlFor="only-diff" className="cursor-pointer text-xs">
              Only differences
            </Label>
          </div>
        </Hint>

        <Button
          variant={compare ? "soft" : "outline"}
          size="sm"
          aria-pressed={compare}
          onClick={() => setCompare((v) => !v)}
        >
          <Columns2 /> Compare two roles
        </Button>

        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw /> Reset filters
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="tnum text-xs text-muted-foreground">
            {visibleRows.length} of {MENU_META.length} capabilities · {totalGranted} of {totalCells} grants
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              mockAction("Exported the permission matrix", {
                description: `role-matrix.csv — ${MENU_META.length} capabilities × ${PERSONAS.length} roles × ${ACTIONS.length} actions. In the demo the file is not written to disk.`,
              })
            }
          >
            <Download /> Export
          </Button>
        </div>
      </div>

      {/* -------------------------------------------------- compare strip */}
      {compare && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary-soft/40 px-3 py-2 text-xs">
          <span className="font-medium text-foreground">Comparing</span>
          <Select value={roleA} onValueChange={(v) => setRoleA(v as RoleId)}>
            <SelectTrigger size="sm" className="w-[168px]" aria-label="First role to compare">
              <span className="truncate">{personaById(roleA).role}</span>
            </SelectTrigger>
            <SelectContent>
              {PERSONAS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Swap the compared roles"
            onClick={() => {
              setRoleA(roleB);
              setRoleB(roleA);
            }}
          >
            <ArrowLeftRight />
          </Button>
          <Select value={roleB} onValueChange={(v) => setRoleB(v as RoleId)}>
            <SelectTrigger size="sm" className="w-[168px]" aria-label="Second role to compare">
              <span className="truncate">{personaById(roleB).role}</span>
            </SelectTrigger>
            <SelectContent>
              {PERSONAS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="tnum ml-1 text-muted-foreground">
            <span className="font-semibold text-foreground">{compareStats.differing}</span> of {MENU_META.length}{" "}
            capabilities differ ·{" "}
            <span className="font-semibold text-foreground">{compareStats.onlyInA}</span> grants only{" "}
            {personaById(roleA).role} has ·{" "}
            <span className="font-semibold text-foreground">{compareStats.onlyInB}</span> grants only{" "}
            {personaById(roleB).role} has
          </span>

          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setCompare(false)}>
            <X /> Exit compare
          </Button>
        </div>
      )}

      {/* --------------------------------------------------------- legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border bg-subtle px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Action letters
        </span>
        {ACTIONS.map((a) => (
          <span key={a} className="flex items-center gap-1.5">
            <span className={chipClass(true)} aria-hidden>
              {a}
            </span>
            <span className="text-[11px] text-muted-foreground">{ACTION_LABEL[a]}</span>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={chipClass(true)} aria-hidden>
              V
            </span>
            granted
          </span>
          <span className="flex items-center gap-1.5">
            <span className={chipClass(false)} aria-hidden>
              V
            </span>
            not granted
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn(chipClass(true), "ring-1 ring-warning")} aria-hidden>
              V
            </span>
            edited
          </span>
        </span>
      </div>

      {/* --------------------------------------------------------- matrix */}
      <div
        className="scrollbar-thin relative max-h-[min(66vh,760px)] overflow-auto"
        onMouseLeave={() => setHover(null)}
        onFocusCapture={() => setGridFocused(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setGridFocused(false);
        }}
      >
        <table
          className="border-separate border-spacing-0 text-xs"
          aria-label="Role permission matrix — menu keys by role"
        >
          <colgroup>
            <col style={{ width: NAME_COL_W }} />
            {PERSONAS.map((p) => (
              <col key={p.id} style={{ width: ROLE_COL_W }} />
            ))}
          </colgroup>

          <thead>
            <tr style={{ height: HEADER_H }}>
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 border-b border-r border-border bg-card px-2.5 text-left align-bottom"
              >
                <div className="pb-2">
                  <p className="text-[11px] font-semibold text-foreground">Capability</p>
                  <p className="font-mono text-[10px] text-muted-foreground">menu key · access by role</p>
                </div>
              </th>
              {PERSONAS.map((p, ci) => {
                const st = columnStats[ci];
                const inCompare = compare && (p.id === roleA || p.id === roleB);
                return (
                  <th
                    key={p.id}
                    scope="col"
                    className={cn(
                      "sticky top-0 z-20 border-b border-r border-border p-0 align-top",
                      inCompare ? "bg-primary-soft/60" : "bg-card",
                      compare && !inCompare && "opacity-45",
                      focusCol === ci && "bg-muted",
                    )}
                  >
                    <Hint
                      side="bottom"
                      text={
                        <span className="block">
                          <span className="block font-semibold">{p.name} · {p.role}</span>
                          <span className="mt-0.5 block">{p.description}</span>
                          <span className="mt-1 block">
                            {st.full} full access · {st.partial} partial · {st.none} no access
                          </span>
                          <span className="mt-1 block italic">Click to compare this role.</span>
                        </span>
                      }
                    >
                      <button
                        type="button"
                        onClick={() => onHeaderClick(p.id)}
                        className="flex h-full w-full flex-col justify-between gap-1 px-2 py-2 text-left hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
                        style={{ height: HEADER_H }}
                      >
                        <span className="block min-w-0">
                          <span className="block truncate text-[11.5px] font-semibold leading-tight text-foreground">
                            {p.role}
                          </span>
                          <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                            {p.shortName}
                          </span>
                        </span>
                        <span className="block">
                          <RoleAccessBar full={st.full} partial={st.partial} none={st.none} />
                          <span className="mt-1 flex items-baseline justify-between">
                            <span className="tnum text-[10px] font-semibold text-foreground">{st.grants}</span>
                            <span className="text-[9px] text-muted-foreground">grants</span>
                          </span>
                        </span>
                      </button>
                    </Hint>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.module}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={PERSONAS.length + 1}
                    className="sticky z-[15] border-b border-border bg-subtle p-0 text-left"
                    style={{ top: HEADER_H }}
                  >
                    <div className="sticky left-0 flex w-fit items-center gap-2 px-2.5 py-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.module}
                      </span>
                      <span className="tnum rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground">
                        {group.rows.length}
                      </span>
                    </div>
                  </th>
                </tr>

                {group.rows.map(({ meta, index }) => {
                  const rowHot = hover?.row === index || focusRow === index;
                  const rolesWithAccess = PERSONAS.filter((p) => grantOf(p.id, meta.key).length > 0).length;
                  return (
                    <tr key={meta.key}>
                      <th
                        scope="row"
                        onMouseEnter={() => setHover({ row: index, col: -1 })}
                        className={cn(
                          "sticky left-0 z-10 border-b border-r border-border px-2.5 py-1 text-left align-middle font-normal transition-colors",
                          rowHot ? "bg-muted" : "bg-card",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11.5px] font-medium leading-[14px] text-foreground">
                              {meta.label}
                            </div>
                            <div className="truncate font-mono text-[10px] leading-[13px] text-muted-foreground">
                              {meta.key}
                            </div>
                          </div>
                          <Hint text={`${rolesWithAccess} of ${PERSONAS.length} roles have at least one grant on ${meta.label}.`}>
                            <span
                              className={cn(
                                "tnum shrink-0 rounded border px-1 py-px text-[9.5px] font-medium",
                                rolesWithAccess === 0
                                  ? "border-border text-muted-foreground/60"
                                  : rolesWithAccess === PERSONAS.length
                                    ? "border-primary/40 bg-primary-soft text-primary-soft-foreground"
                                    : "border-border text-muted-foreground",
                              )}
                            >
                              {rolesWithAccess}/{PERSONAS.length}
                            </span>
                          </Hint>
                        </div>
                      </th>

                      {PERSONAS.map((p, ci) => {
                        const g = grantOf(p.id, meta.key);
                        const inCompare = p.id === roleA || p.id === roleB;
                        const isDiff =
                          compare && inCompare && grantOf(roleA, meta.key) !== grantOf(roleB, meta.key);
                        return (
                          <MatrixCell
                            key={p.id}
                            rowIdx={index}
                            colIdx={ci}
                            granted={g}
                            baseGranted={baseOf(p.id, meta.key)}
                            rowHot={rowHot}
                            colHot={hover?.col === ci || focusCol === ci}
                            diff={isDiff}
                            dim={compare && !inCompare}
                            focusAct={focus.row === index && focus.col === ci ? focus.act : -1}
                            capability={meta.label}
                            roleName={p.role}
                            onToggle={toggle}
                            onKey={onKey}
                            onHover={onHover}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}

            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={PERSONAS.length + 1} className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-foreground">No capability matches these filters</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {onlyDiff
                      ? "Every remaining capability grants the same actions to the compared roles."
                      : "Try a different module or clear the search."}
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={resetFilters}>
                    <RotateCcw /> Reset filters
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --------------------------------------------------------- footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-subtle px-3 py-2">
        <p className="text-[11px] text-muted-foreground">
          Arrow keys move between action letters · Space or Enter toggles · Home / End jump to the first or last role.
        </p>
        <div className="ml-auto flex items-center gap-2">
          {dirtyCount > 0 ? (
            <>
              <span className="tnum rounded-md border border-warning/30 bg-warning-soft px-2 py-1 text-[11px] font-medium text-warning-fg">
                {dirtyCount} unpublished change{dirtyCount === 1 ? "" : "s"}
              </span>
              <Button variant="outline" size="sm" onClick={() => setDiscardOpen(true)}>
                <RotateCcw /> Discard
              </Button>
              <Gated menuKey="admin.roles" action="E">
                <Button size="sm" onClick={publish}>
                  Publish changes
                </Button>
              </Gated>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              No pending changes — the matrix matches the published policy.
            </span>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        destructive
        title="Discard unpublished permission changes?"
        description={`${dirtyCount} edited cell${dirtyCount === 1 ? "" : "s"} will revert to the last published policy. This cannot be undone.`}
        confirmLabel="Discard changes"
        onConfirm={discard}
      />
    </div>
  );
}
