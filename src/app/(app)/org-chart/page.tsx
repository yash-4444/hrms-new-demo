"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  Maximize2,
  Minimize2,
  Search,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { DEPARTMENTS, deptName } from "@/mock/org";
import { EMPLOYEES, PEOPLE_STATS, managerChain, type Employee } from "@/mock/employees";
import { Button } from "@/components/ui/button";
import { Avatar, Hint, Input } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterSelect } from "@/components/ui/overlays";
import { ChartSkeleton, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { PersonCell } from "@/components/people/person-cell";

/* ============================================================================
   /org-chart — the real 4-level hierarchy for all 340 employees.

   Rendering 340 nodes at once is the thing that kills a demo, so the tree is
   lazy in two ways: collapsed subtrees are never rendered (not rendered-then-
   hidden), and the children index + descendant counts are computed once for
   the whole company rather than per node.
   ========================================================================== */

const ROOT_CODE = EMPLOYEES.find((e) => e.managerCode === null)?.code ?? "STL-0001";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;

interface OrgIndex {
  childrenOf: Map<string, Employee[]>;
  descendants: Map<string, number>;
  byCode: Map<string, Employee>;
}

/** One pass to bucket children, one post-order pass for subtree sizes. */
function buildIndex(): OrgIndex {
  const childrenOf = new Map<string, Employee[]>();
  const byCode = new Map<string, Employee>();

  for (const e of EMPLOYEES) {
    byCode.set(e.code, e);
    if (!e.managerCode) continue;
    const bucket = childrenOf.get(e.managerCode);
    if (bucket) bucket.push(e);
    else childrenOf.set(e.managerCode, [e]);
  }

  /* Siblings read best grouped by seniority, then alphabetically. */
  for (const bucket of childrenOf.values()) {
    bucket.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }

  const descendants = new Map<string, number>();
  const visit = (code: string): number => {
    const cached = descendants.get(code);
    if (cached !== undefined) return cached;
    let total = 0;
    for (const child of childrenOf.get(code) ?? []) total += 1 + visit(child.code);
    descendants.set(code, total);
    return total;
  };
  for (const e of EMPLOYEES) visit(e.code);

  return { childrenOf, descendants, byCode };
}

/** Levels 0 and 1 open on first paint; everything deeper starts collapsed. */
function initialExpanded(index: OrgIndex): Set<string> {
  const open = new Set<string>([ROOT_CODE]);
  for (const child of index.childrenOf.get(ROOT_CODE) ?? []) open.add(child.code);
  return open;
}

/* ------------------------------------------------------------------- node */

interface NodeProps {
  employee: Employee;
  index: OrgIndex;
  expanded: Set<string>;
  onToggle: (code: string) => void;
  departmentFilter: string;
  focusCode: string | null;
  focusRef: React.RefObject<HTMLDivElement | null>;
  /** Connector geometry — the root has no rail above it. */
  isRoot?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

function OrgNode({
  employee,
  index,
  expanded,
  onToggle,
  departmentFilter,
  focusCode,
  focusRef,
  isRoot,
  isFirst,
  isLast,
}: NodeProps) {
  const children = index.childrenOf.get(employee.code) ?? [];
  const directs = children.length;
  const total = index.descendants.get(employee.code) ?? 0;
  const isOpen = expanded.has(employee.code);
  const isFocused = focusCode === employee.code;
  const dimmed = departmentFilter !== "all" && employee.departmentId !== departmentFilter;

  return (
    <li className={cn("relative flex flex-col items-center px-2", !isRoot && "pt-7")}>
      {/* connectors into this card: the sibling rail, then a vertical stub */}
      {!isRoot && (
        <>
          <span
            aria-hidden
            className="absolute top-0 h-px bg-border"
            style={{ left: isFirst ? "50%" : 0, right: isLast ? "50%" : 0 }}
          />
          <span aria-hidden className="absolute left-1/2 top-0 h-7 w-px bg-border" />
        </>
      )}

      <div
        ref={isFocused ? focusRef : undefined}
        className={cn(
          "relative z-10 w-[188px] rounded-md border border-border bg-card shadow-xs transition-opacity",
          dimmed && "opacity-40",
          isFocused && "bg-primary-soft ring-2 ring-ring",
        )}
      >
        <Link
          href={`/employees/${employee.code}`}
          className="flex items-start gap-2 rounded-md p-2 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar name={employee.name} size={34} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-foreground">{employee.name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{employee.designation}</span>
            <span className="tnum mt-0.5 block truncate text-[10px] text-muted-foreground">
              {employee.code} · {deptName(employee.departmentId)}
            </span>
          </span>
        </Link>

        {(directs > 0 || employee.status !== "active") && (
          <div className="flex items-center justify-between gap-1.5 border-t border-border px-2 py-1">
            {directs > 0 ? (
              <span className="tnum truncate text-[10px] text-muted-foreground">
                {directs} direct{total !== directs ? ` · ${total} total` : ""}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">Individual contributor</span>
            )}
            {employee.status !== "active" && <StatusBadge status={employee.status} />}
          </div>
        )}

        {directs > 0 && (
          <button
            type="button"
            aria-label={isOpen ? `Collapse ${employee.name}'s team` : `Expand ${employee.name}'s team`}
            aria-expanded={isOpen}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle(employee.code);
            }}
            className="absolute -bottom-2.5 left-1/2 z-20 flex size-5 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        )}
      </div>

      {/* A collapsed subtree is not rendered at all — that is what keeps 340
          nodes affordable. */}
      {directs > 0 && isOpen && (
        <ul className="relative flex items-start justify-center pt-7">
          <span aria-hidden className="absolute left-1/2 top-0 h-7 w-px bg-border" />
          {children.map((child, i) => (
            <OrgNode
              key={child.code}
              employee={child}
              index={index}
              expanded={expanded}
              onToggle={onToggle}
              departmentFilter={departmentFilter}
              focusCode={focusCode}
              focusRef={focusRef}
              isFirst={i === 0}
              isLast={i === children.length - 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------- page */

function OrgChart() {
  const loading = useFakeLoad();
  const searchParams = useSearchParams();
  const index = React.useMemo(buildIndex, []);

  const [expanded, setExpanded] = React.useState<Set<string>>(() => initialExpanded(index));
  const [zoom, setZoom] = React.useState(1);
  const [department, setDepartment] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [focusCode, setFocusCode] = React.useState<string | null>(null);
  const focusRef = React.useRef<HTMLDivElement | null>(null);
  const treeRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const centred = React.useRef(false);
  const [natural, setNatural] = React.useState({ w: 0, h: 0 });

  const root = index.byCode.get(ROOT_CODE);

  /* Expand the chain to a person and park the viewport on them. */
  const revealPerson = React.useCallback((code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const ancestor of managerChain(code)) next.add(ancestor);
      next.add(code);
      return next;
    });
    setFocusCode(code);
  }, []);

  /* The profile page deep-links here with ?focus=STL-0142. */
  const focusParam = searchParams.get("focus");
  React.useEffect(() => {
    if (focusParam && index.byCode.has(focusParam)) revealPerson(focusParam);
  }, [focusParam, index, revealPerson]);

  React.useEffect(() => {
    if (!focusCode || loading) return;
    const t = setTimeout(() => {
      focusRef.current?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [focusCode, loading]);

  /**
   * A CSS `scale()` does not change the element's layout box, so the scroll
   * container would never let you reach the edges of a zoomed-in tree. Measure
   * the tree at its natural size and give the wrapper the scaled dimensions,
   * so the scrollable area always matches what is actually on screen.
   */
  React.useEffect(() => {
    if (loading) return;
    const el = treeRef.current;
    if (!el) return;
    setNatural({ w: el.offsetWidth, h: el.offsetHeight });

    /* The tree is far wider than the canvas, and the CEO sits at its centre —
       so park the viewport on the root instead of the far-left leaf. */
    const canvas = canvasRef.current;
    if (canvas && !centred.current && el.offsetWidth > canvas.clientWidth) {
      canvas.scrollLeft = (el.offsetWidth - canvas.clientWidth) / 2;
      centred.current = true;
    }
  }, [loading, expanded, department]);

  /* Choosing a department opens the paths down to everyone in it. */
  React.useEffect(() => {
    if (department === "all") return;
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const e of EMPLOYEES) {
        if (e.departmentId !== department) continue;
        for (const ancestor of managerChain(e.code)) next.add(ancestor);
      }
      return next;
    });
  }, [department]);

  const toggle = React.useCallback((code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  /* Expanding all four levels paints 340 cards — cap it at level 2 so the
     canvas stays interactive, and let the user open the leaf teams by hand. */
  const expandToLevelThree = () =>
    setExpanded(new Set(EMPLOYEES.filter((e) => e.level <= 1).map((e) => e.code)));

  const collapseAll = () => {
    setExpanded(new Set([ROOT_CODE]));
    setFocusCode(null);
  };

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return EMPLOYEES.filter(
      (e) => e.name.toLowerCase().includes(q) || e.code.toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query]);

  const matchingInDept =
    department === "all" ? 0 : EMPLOYEES.filter((e) => e.departmentId === department).length;

  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={expandToLevelThree}>
        <Maximize2 /> Expand to level 3
      </Button>
      <Button variant="outline" size="sm" onClick={collapseAll}>
        <Minimize2 /> Collapse all
      </Button>
      <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
        <Hint text="Zoom out">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_MIN + 0.001}
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10))}
          >
            <ZoomOut />
          </Button>
        </Hint>
        <span className="tnum w-11 text-center text-xs text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Hint text="Zoom in">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX - 0.001}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10))}
          >
            <ZoomIn />
          </Button>
        </Hint>
        <Hint text="Reset zoom to 100%">
          <Button variant="ghost" size="icon-sm" aria-label="Reset zoom" onClick={() => setZoom(1)}>
            <Crosshair />
          </Button>
        </Hint>
      </div>
    </>
  );

  return (
    <PageBody>
      <PageHeader
        title="Org chart"
        description="The live reporting hierarchy, four levels deep. Click a card to open the profile, or use the chevron under a card to open that person's team."
        actions={actions}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Headcount", value: num(PEOPLE_STATS.headcount) },
          { label: "People managers", value: num(PEOPLE_STATS.managers) },
          { label: "Avg. span of control", value: PEOPLE_STATS.spanOfControl.toFixed(1) },
          { label: "Levels deep", value: "4" },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-border bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="tnum mt-0.5 text-base font-semibold tracking-tight text-foreground">{s.value}</dd>
          </div>
        ))}
      </dl>

      <Section bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
          <FilterSelect
            label="Department"
            value={department}
            onValueChange={setDepartment}
            options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))}
            allLabel="All departments"
            width="w-[190px]"
          />

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a person…"
              aria-label="Find a person in the org chart"
              className="h-7 w-[230px] pl-7 pr-6 text-xs"
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
            {matches.length > 0 && (
              <ul
                role="listbox"
                aria-label="Matching people"
                className="absolute left-0 top-8 z-40 w-[290px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md"
              >
                {matches.map((m) => (
                  <li key={m.code} role="option" aria-selected={focusCode === m.code}>
                    <button
                      type="button"
                      onClick={() => {
                        revealPerson(m.code);
                        setQuery("");
                      }}
                      className="flex w-full items-center rounded-sm px-1.5 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <PersonCell
                        name={m.name}
                        size={22}
                        subtitle={`${m.code} · ${m.designation}`}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {focusCode && (
            <span className="flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary-soft px-2 py-1 text-xs text-primary-soft-foreground">
              <Crosshair className="size-3" aria-hidden />
              Focused on {index.byCode.get(focusCode)?.name ?? focusCode}
              <button
                type="button"
                aria-label="Clear focused person"
                onClick={() => setFocusCode(null)}
                className="rounded hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          <p className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5" aria-hidden />
            {department === "all" ? (
              <>Showing every department</>
            ) : (
              <>
                <span className="tnum font-medium text-foreground">{matchingInDept}</span> in{" "}
                {deptName(department)} — everyone else is dimmed so the reporting lines stay intact
              </>
            )}
          </p>
        </div>

        {loading ? (
          <div className="p-4">
            <ChartSkeleton height={420} />
          </div>
        ) : (
          <div
            ref={canvasRef}
            className="scrollbar-thin h-[calc(100vh-24rem)] min-h-[420px] overflow-auto bg-subtle p-6"
          >
            {/* sizer: carries the SCALED footprint so the canvas scrolls correctly */}
            <div
              className="mx-auto"
              style={
                natural.w
                  ? { width: natural.w * zoom, height: natural.h * zoom }
                  : undefined
              }
            >
              <div
                ref={treeRef}
                className="w-fit"
                style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
              >
                <ul className="flex justify-center">
                  {root && (
                    <OrgNode
                      employee={root}
                      index={index}
                      expanded={expanded}
                      onToggle={toggle}
                      departmentFilter={department}
                      focusCode={focusCode}
                      focusRef={focusRef}
                      isRoot
                    />
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Section>

    </PageBody>
  );
}

export default function OrgChartPage() {
  return (
    <React.Suspense fallback={<ChartSkeleton height={420} />}>
      <OrgChart />
    </React.Suspense>
  );
}
