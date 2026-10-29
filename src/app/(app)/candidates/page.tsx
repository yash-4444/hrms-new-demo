"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  Download,
  FileText,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { inrCompact } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { FunnelChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  ChartSkeleton,
  Gated,
  PageBody,
  PageHeader,
  useFakeLoad,
} from "@/components/shell/page";
import { KanbanBoard } from "@/components/hiring/kanban-board";
import { AiHiringNote } from "@/components/ai/embed/hiring-ai-ui";
import { DEMO_TODAY } from "@/mock/org";
import {
  CANDIDATES,
  CANDIDATE_SOURCES,
  HIRING_BRANCHES,
  HIRING_DEPARTMENTS,
  HIRING_KPIS,
  PIPELINE_STAGES,
  REQ_OPTIONS,
  requisitionByCode,
  stageLabel,
  type Candidate,
  type PipelineStage,
} from "@/mock/hiring";

/* ============================================================================
   /candidates — the kanban pipeline board.

   The board is the source of truth for this screen: the funnel above it, the
   column counts and the KPI strip are all derived from the same live state,
   so a drag visibly moves every number on the page.
   ========================================================================== */

/**
 * How many candidates REACHED each stage. Mirrors the derivation in
 * src/mock/hiring.ts, but runs against live board state so it updates on a
 * drag. Rejected candidates are subtracted at the stage they dropped out of.
 */
function deriveFunnel(list: Candidate[]) {
  const order: PipelineStage[] = ["applied", "screening", "interview", "offer", "hired"];
  const out: { stage: string; value: number }[] = [];
  let reached = list.length;
  order.forEach((stage, i) => {
    out.push({ stage: stageLabel(stage), value: reached });
    if (i === order.length - 1) return;
    const stuck = list.filter((c) => c.stage === stage).length;
    const dropped = list.filter(
      (c) =>
        c.stage === "rejected" &&
        /* null / out-of-range fallback keeps the funnel reconciling */
        (c.rejectedAtStage ?? "applied") === stage,
    ).length;
    reached = Math.max(0, reached - stuck - dropped);
  });
  return out;
}

/** Rejection always records a stage the funnel can subtract at. */
function dropOutStage(from: PipelineStage): PipelineStage {
  if (from === "hired") return "offer";
  if (from === "rejected") return "applied";
  return from;
}

const LABEL_TO_STAGE = new Map(PIPELINE_STAGES.map((s) => [s.label, s.id]));

export default function CandidatesPage() {
  return (
    <React.Suspense fallback={<PipelineFallback />}>
      <CandidatePipeline />
    </React.Suspense>
  );
}

function PipelineFallback() {
  return (
    <PageBody>
      <PageHeader
        title="Candidate pipeline"
        description="Drag a candidate between stages, or use the Move to… menu on any card."
      />
      <ChartSkeleton height={180} />
    </PageBody>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {PIPELINE_STAGES.map((s) => (
        <div key={s.id} className="w-[272px] shrink-0 rounded-md border border-border bg-subtle p-2">
          <Skeleton className="h-5 w-24" />
          <div className="mt-2 flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px] w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CandidatePipeline() {
  const searchParams = useSearchParams();
  const loading = useFakeLoad();

  /* The board IS the state. Nothing is persisted — by design. */
  const [board, setBoard] = React.useState<Candidate[]>(() =>
    CANDIDATES.map((c) => ({ ...c })),
  );

  const [reqFilter, setReqFilter] = React.useState(
    () => searchParams.get("req") ?? "all",
  );
  const [deptFilter, setDeptFilter] = React.useState("all");
  const [branchFilter, setBranchFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [query, setQuery] = React.useState("");
  const [focusStage, setFocusStage] = React.useState<PipelineStage | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const [pendingReject, setPendingReject] = React.useState<{
    id: string;
    name: string;
    from: PipelineStage;
  } | null>(null);

  const filtersActive =
    reqFilter !== "all" ||
    deptFilter !== "all" ||
    branchFilter !== "all" ||
    sourceFilter !== "all" ||
    query.trim() !== "";

  const clearFilters = () => {
    setReqFilter("all");
    setDeptFilter("all");
    setBranchFilter("all");
    setSourceFilter("all");
    setQuery("");
    setFocusStage(null);
  };

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return board.filter(
      (c) =>
        (reqFilter === "all" || c.reqCode === reqFilter) &&
        (deptFilter === "all" || c.departmentId === deptFilter) &&
        (branchFilter === "all" || c.branchId === branchFilter) &&
        (sourceFilter === "all" || c.source === sourceFilter) &&
        (!q ||
          c.name.toLowerCase().includes(q) ||
          c.currentCompany.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q)),
    );
  }, [board, reqFilter, deptFilter, branchFilter, sourceFilter, query]);

  const funnel = React.useMemo(() => deriveFunnel(filtered), [filtered]);

  /* ------------------------------------------------------------- mutation */

  const applyMove = React.useCallback(
    (id: string, to: PipelineStage) => {
      const current = board.find((c) => c.id === id);
      if (!current || current.stage === to) return;
      const from = current.stage;
      const req = requisitionByCode(current.reqCode);

      setBoard((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                stage: to,
                rejectedAtStage: to === "rejected" ? dropOutStage(from) : null,
                rejectionReason:
                  to === "rejected"
                    ? (c.rejectionReason ??
                      `Closed out from the pipeline board at ${stageLabel(from)}.`)
                    : null,
                stageSince: DEMO_TODAY,
                stageAgeDays: 0,
              }
            : c,
        ),
      );

      setAnnouncement(
        `${current.name} moved from ${stageLabel(from)} to ${stageLabel(to)}.`,
      );
      mockAction(`Moved ${current.name} to ${stageLabel(to)}`, {
        description: `${stageLabel(from)} → ${stageLabel(to)} · ${req?.code ?? current.reqCode} ${current.role}. Stage age reset to 0 days.`,
        tone: to === "rejected" ? "warning" : "success",
      });
    },
    [board],
  );

  /** The one entry point for BOTH drag-and-drop and the keyboard menu. */
  const requestMove = React.useCallback(
    (id: string, to: PipelineStage) => {
      const current = board.find((c) => c.id === id);
      if (!current || current.stage === to) return; // same column = no-op, no toast
      if (to === "rejected") {
        setPendingReject({ id, name: current.name, from: current.stage });
        return;
      }
      applyMove(id, to);
    },
    [board, applyMove],
  );

  const resetBoard = () => {
    setBoard(CANDIDATES.map((c) => ({ ...c })));
    setAnnouncement("Pipeline reset to the seeded state.");
    mockAction("Pipeline reset", {
      description: `All ${CANDIDATES.length} candidates returned to their seeded stage. Nothing was persisted — this is a demo board.`,
      tone: "info",
    });
  };

  const activeCount = board.filter(
    (c) => c.stage !== "hired" && c.stage !== "rejected",
  ).length;
  const shownPipelineValue = filtered.reduce((a, c) => a + c.expectedCtc, 0);

  return (
    <PageBody>
      <PageHeader
        title="Candidate pipeline"
        description={`${board.length} candidates across ${REQ_OPTIONS.length} live requisitions. Drag a card between columns, or use the Move to… menu — both do exactly the same thing.`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/interviews">
                <CalendarDays /> Interview calendar
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/offers">
                <FileText /> Offers
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                mockAction(`Exported ${filtered.length} candidates`, {
                  description:
                    "candidate-pipeline.csv — name, requisition, stage, stage age, source, expected CTC. In the demo the file is not written to disk.",
                })
              }
            >
              <Download /> Export
            </Button>
            <Gated menuKey="hiring.candidates" action="E">
              <Button variant="soft" size="sm" onClick={resetBoard}>
                <RotateCcw /> Reset board
              </Button>
            </Gated>
          </>
        }
      />

      <StatRow cols={4}>
        <StatTile
          label="Active candidates"
          value={activeCount}
          icon={Users}
          tone="accent"
          hint={filtersActive ? "Clear all filters" : "Everything not hired or rejected"}
          onClick={clearFilters}
        />
        <StatTile
          label="Offers out"
          value={HIRING_KPIS.offersOut}
          icon={FileText}
          hint={`${HIRING_KPIS.offersPending} more awaiting approval`}
          href="/offers"
        />
        <StatTile
          label="Interviews this week"
          value={HIRING_KPIS.interviewsThisWeek}
          icon={CalendarDays}
          hint="Scheduled in the next 7 days"
          href="/interviews"
        />
        <StatTile
          label="Average time to fill"
          value={`${HIRING_KPIS.timeToFillDays} days`}
          icon={RotateCcw}
          hint={`${HIRING_KPIS.ageingOver45} open requisitions ageing past 45 days`}
          href="/requisitions"
        />
      </StatRow>

      {loading ? (
        <ChartSkeleton height={180} />
      ) : (
        <FunnelChart
          title="Recruitment funnel"
          description={
            filtersActive
              ? "Candidates who reached each stage, for the current filter. Each step subtracts the candidates still sitting in the previous stage and those rejected out of it."
              : "Candidates who reached each stage across every live requisition. Each step subtracts the candidates still sitting in the previous stage and those rejected out of it."
          }
          stages={funnel}
          onStageClick={(s) => {
            const id = LABEL_TO_STAGE.get(s.stage) ?? null;
            setFocusStage(id);
            if (id) {
              mockAction(`Jumped to ${s.stage}`, {
                description: `${s.value} candidates reached ${s.stage}. The column is highlighted on the board below.`,
                tone: "info",
              });
            }
          }}
          footnote={
            <span className="flex flex-wrap items-center gap-2">
              <span>
                Conversion is stage-to-stage. Pipeline value in view:{" "}
                <span className="tnum font-medium text-foreground">
                  {inrCompact(shownPipelineValue)}
                </span>{" "}
                of expected CTC.
              </span>
              {focusStage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFocusStage(null)}
                  aria-label="Clear the highlighted stage"
                >
                  <X /> Clear highlight
                </Button>
              )}
            </span>
          }
        />
      )}

      <Card className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company or role…"
              aria-label="Search candidates by name, company or role"
              className="h-7 w-[230px] rounded-md border border-input bg-card pl-7 pr-6 text-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
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

          <FilterSelect
            label="Requisition"
            value={reqFilter}
            onValueChange={setReqFilter}
            options={REQ_OPTIONS}
            allLabel="All requisitions"
            width="w-[230px]"
          />
          <FilterSelect
            label="Department"
            value={deptFilter}
            onValueChange={setDeptFilter}
            options={HIRING_DEPARTMENTS}
            allLabel="All departments"
          />
          <FilterSelect
            label="Location"
            value={branchFilter}
            onValueChange={setBranchFilter}
            options={HIRING_BRANCHES}
            allLabel="All locations"
            width="w-[140px]"
          />
          <FilterSelect
            label="Source"
            value={sourceFilter}
            onValueChange={setSourceFilter}
            options={CANDIDATE_SOURCES.map((s) => ({ value: s, label: s }))}
            allLabel="All sources"
            width="w-[150px]"
          />

          <div className="ml-auto flex items-center gap-2">
            <span className="tnum text-xs text-muted-foreground">
              {filtered.length} of {board.length} candidates
            </span>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X /> Clear filters
              </Button>
            )}
          </div>
        </div>

        {filtersActive && (
          <div className="flex flex-wrap items-center gap-1.5">
            {reqFilter !== "all" && (
              <Badge variant="soft">
                {requisitionByCode(reqFilter)?.role ?? reqFilter}
              </Badge>
            )}
            {deptFilter !== "all" && (
              <Badge variant="muted">
                {HIRING_DEPARTMENTS.find((d) => d.value === deptFilter)?.label}
              </Badge>
            )}
            {branchFilter !== "all" && (
              <Badge variant="muted">
                {HIRING_BRANCHES.find((b) => b.value === branchFilter)?.label}
              </Badge>
            )}
            {sourceFilter !== "all" && <Badge variant="muted">{sourceFilter}</Badge>}
          </div>
        )}

        {loading ? (
          <BoardSkeleton />
        ) : (
          <KanbanBoard candidates={filtered} onMove={requestMove} focusStage={focusStage} />
        )}

        <p className="text-[11px] text-muted-foreground">
          Cards are keyboard reachable — Tab to a card, Enter opens the profile, and the
          Move to… menu does everything a drag does. The ✨ match chip compares each resume with its
          requisition&apos;s must-have skills, experience band and budget.
        </p>
        <AiHiringNote />
      </Card>

      <p className="sr-only" aria-live="polite" role="status">
        {announcement}
      </p>

      <ConfirmDialog
        open={pendingReject !== null}
        onOpenChange={(v) => {
          if (!v) setPendingReject(null);
        }}
        title="Reject this candidate?"
        description={
          pendingReject
            ? `${pendingReject.name} will be moved out of ${stageLabel(
                pendingReject.from,
              )} and into Rejected. The funnel will record the drop-out at ${stageLabel(
                dropOutStage(pendingReject.from),
              )}. You can drag the card back at any time.`
            : undefined
        }
        confirmLabel="Reject candidate"
        destructive
        onConfirm={() => {
          if (pendingReject) applyMove(pendingReject.id, "rejected");
        }}
      />
    </PageBody>
  );
}
