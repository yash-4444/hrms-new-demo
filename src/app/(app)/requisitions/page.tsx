"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  Briefcase,
  CalendarClock,
  CheckCheck,
  ClipboardList,
  ExternalLink,
  FileText,
  Hourglass,
  PauseCircle,
  Plus,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, inrCompact } from "@/lib/format";
import { DEMO_TODAY, GRADES } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import {
  PIPELINE_STAGES,
  REQUISITIONS,
  branchLabel,
  candidatesForReq,
  deptLabel,
  jobByReq,
  offerForCandidate,
  reqAgeingDays,
  type ReqStatus,
  type Requisition,
} from "@/mock/hiring";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Separator } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  CardsSkeleton,
  Gated,
  PageBody,
  PageHeader,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";
import {
  ConfirmDialog,
  FilterSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/overlays";
import { RaiseRequisitionDialog } from "@/components/hiring/requisition-dialog";

/* ============================================================================
   /requisitions — the approval-driven list of every open position.

   All state is local: approving, holding, closing and raising a requisition
   mutate the in-memory copy so the badges, the KPI row and the row count all
   move together. Nothing persists past a refresh, by design.
   ========================================================================== */

const APPROVAL_OPTIONS = [
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "on_hold", label: "On Hold" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
];

const DEPT_OPTIONS = Array.from(new Set(REQUISITIONS.map((r) => r.departmentId))).map(
  (id) => ({ value: id, label: deptLabel(id) }),
);
const BRANCH_OPTIONS = Array.from(new Set(REQUISITIONS.map((r) => r.branchId))).map(
  (id) => ({ value: id, label: branchLabel(id) }),
);

function nextReqCode(rows: Requisition[]) {
  const max = rows.reduce((a, r) => {
    const n = Number(r.code.split("-").pop());
    return Number.isFinite(n) ? Math.max(a, n) : a;
  }, 0);
  return `REQ-2026-${String(max + 1).padStart(3, "0")}`;
}

/** Only a value the filter actually offers survives a deep link; anything else is "all". */
const pickOption = (value: string | null, options: { value: string }[]) =>
  value && options.some((o) => o.value === value) ? value : "all";

export default function RequisitionsPage() {
  return (
    <React.Suspense fallback={<TableSkeleton rows={10} />}>
      <RequisitionsList />
    </React.Suspense>
  );
}

function RequisitionsList() {
  const loading = useFakeLoad();
  const searchParams = useSearchParams();
  const spKey = searchParams.toString();

  const [rows, setRows] = React.useState<Requisition[]>(() =>
    REQUISITIONS.map((r) => ({ ...r })),
  );
  const [dept, setDept] = React.useState(() => pickOption(searchParams.get("dept"), DEPT_OPTIONS));
  const [branch, setBranch] = React.useState(() => pickOption(searchParams.get("branch"), BRANCH_OPTIONS));
  const [approval, setApproval] = React.useState(() => pickOption(searchParams.get("approval"), APPROVAL_OPTIONS));
  const [status, setStatus] = React.useState(() => pickOption(searchParams.get("status"), STATUS_OPTIONS));
  const [ageingOnly, setAgeingOnly] = React.useState(() => searchParams.get("ageing") === "1");

  /* A KPI tile elsewhere (the dashboard) drills in with a query string — re-seed the filters. */
  const [seenKey, setSeenKey] = React.useState(spKey);
  if (seenKey !== spKey) {
    const p = new URLSearchParams(spKey);
    setSeenKey(spKey);
    setDept(pickOption(p.get("dept"), DEPT_OPTIONS));
    setBranch(pickOption(p.get("branch"), BRANCH_OPTIONS));
    setApproval(pickOption(p.get("approval"), APPROVAL_OPTIONS));
    setStatus(pickOption(p.get("status"), STATUS_OPTIONS));
    setAgeingOnly(p.get("ageing") === "1");
  }

  const [raiseOpen, setRaiseOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<Requisition | null>(null);
  const [closeTarget, setCloseTarget] = React.useState<{
    codes: string[];
    clear: () => void;
  } | null>(null);

  /* ------------------------------------------------------------- derived */

  const filtered = React.useMemo(
    () =>
      rows.filter((r) => {
        if (dept !== "all" && r.departmentId !== dept) return false;
        if (branch !== "all" && r.branchId !== branch) return false;
        if (approval !== "all" && r.approvalStatus !== approval) return false;
        if (status !== "all" && r.status !== status) return false;
        if (ageingOnly && !(r.status === "open" && reqAgeingDays(r) > 45)) return false;
        return true;
      }),
    [rows, dept, branch, approval, status, ageingOnly],
  );

  /* KPIs come off local state, so a bulk action visibly moves them. */
  const kpis = React.useMemo(() => {
    const open = rows.filter((r) => r.status === "open");
    const offersOut = rows.reduce(
      (a, r) =>
        a +
        candidatesForReq(r.code).filter((c) => {
          const o = offerForCandidate(c.id);
          return o?.status === "approved" || o?.status === "pending";
        }).length,
      0,
    );
    const hired = rows.flatMap((r) =>
      candidatesForReq(r.code)
        .filter((c) => c.stage === "hired")
        .map((c) => ({ c, r })),
    );
    const ttf = hired.length
      ? Math.round(
          hired.reduce(
            (a, { c, r }) =>
              a +
              Math.round(
                (Date.parse(c.stageSince) - Date.parse(r.raisedDate)) / 86400000,
              ),
            0,
          ) / hired.length,
        )
      : 0;
    return {
      openReqs: open.length,
      openPositions: open.reduce((a, r) => a + Math.max(0, r.headcount - r.filled), 0),
      pending: rows.filter((r) => r.approvalStatus === "pending").length,
      ageing: open.filter((r) => reqAgeingDays(r) > 45).length,
      offersOut,
      timeToFill: ttf,
    };
  }, [rows]);

  const clearFilters = () => {
    setDept("all");
    setBranch("all");
    setApproval("all");
    setStatus("all");
    setAgeingOnly(false);
  };

  /* ------------------------------------------------------------ mutations */

  const patch = (codes: string[], change: Partial<Requisition>) =>
    setRows((prev) =>
      prev.map((r) => (codes.includes(r.code) ? { ...r, ...change } : r)),
    );

  const approve = (codes: string[], clear: () => void) => {
    const pending = rows.filter(
      (r) => codes.includes(r.code) && r.approvalStatus === "pending",
    );
    if (!pending.length) {
      mockAction("Nothing to approve", {
        description: "Every selected requisition is already past the approval step.",
        tone: "info",
      });
      return;
    }
    patch(
      pending.map((r) => r.code),
      { approvalStatus: "approved", status: "open" },
    );
    clear();
    mockAction(`Approved ${pending.length} requisition${pending.length === 1 ? "" : "s"}`, {
      description: `${pending.map((r) => r.code).join(", ")} — the job postings can now be published.`,
    });
  };

  const hold = (codes: string[], clear: () => void) => {
    patch(codes, { status: "on_hold" });
    clear();
    mockAction(`Put ${codes.length} requisition${codes.length === 1 ? "" : "s"} on hold`, {
      description: "Candidates already in the pipeline stay where they are.",
      tone: "warning",
    });
  };

  const reopen = (code: string) => {
    patch([code], { status: "open" });
    mockAction("Requisition reopened", { description: `${code} is active again.` });
  };

  const closeReqs = (codes: string[]) => {
    patch(codes, { status: "closed" });
    mockAction(`Closed ${codes.length} requisition${codes.length === 1 ? "" : "s"}`, {
      description: "The postings are withdrawn from the careers site immediately.",
      tone: "warning",
    });
  };

  const createReq = (req: Requisition, extras?: { jobDescription?: string }) => {
    setRows((prev) => [req, ...prev]);
    clearFilters();
    mockAction("Requisition raised", {
      description: `${req.code} · ${req.role} — sent to ${
        employeeByCode(req.hiringManagerCode)?.name ?? req.hiringManagerCode
      } for approval.${extras?.jobDescription ? " The JD draft is attached and becomes the job posting once approved." : ""}`,
    });
  };

  /* -------------------------------------------------------------- columns */

  const columns = React.useMemo<ColumnDef<Requisition, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Code",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">{row.original.code}</span>
        ),
      },
      {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{row.original.role}</p>
            <p className="truncate text-muted-foreground">
              {GRADES.find((g) => g.id === row.original.gradeId)?.label ?? row.original.gradeId}
              {row.original.priority === "Critical" && " · Critical"}
            </p>
          </div>
        ),
      },
      {
        id: "department",
        accessorFn: (r) => deptLabel(r.departmentId),
        header: "Department",
      },
      {
        id: "branch",
        accessorFn: (r) => branchLabel(r.branchId),
        header: "Branch",
      },
      {
        id: "positions",
        accessorFn: (r) => r.headcount,
        header: "Positions",
        cell: ({ row }) => (
          <span className="tnum">
            <span className="font-medium">{row.original.filled}</span>
            <span className="text-muted-foreground"> / {row.original.headcount}</span>
          </span>
        ),
      },
      {
        id: "hiringManager",
        accessorFn: (r) => employeeByCode(r.hiringManagerCode)?.name ?? r.hiringManagerCode,
        header: "Hiring manager",
        cell: ({ row }) => {
          const name =
            employeeByCode(row.original.hiringManagerCode)?.name ??
            row.original.hiringManagerCode;
          return (
            <span className="flex items-center gap-1.5">
              <Avatar name={name} size={20} />
              <span className="truncate">{name}</span>
            </span>
          );
        },
      },
      {
        id: "recruiter",
        accessorFn: (r) => employeeByCode(r.recruiterCode)?.name ?? r.recruiterCode,
        header: "Recruiter",
        cell: ({ row }) => {
          const name =
            employeeByCode(row.original.recruiterCode)?.name ?? row.original.recruiterCode;
          return (
            <span className="flex items-center gap-1.5">
              <Avatar name={name} size={20} />
              <span className="truncate">{name}</span>
            </span>
          );
        },
      },
      {
        accessorKey: "approvalStatus",
        header: "Approval",
        cell: ({ row }) => <StatusBadge status={row.original.approvalStatus} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "ageing",
        accessorFn: (r) => reqAgeingDays(r),
        header: "Ageing",
        cell: ({ row }) => {
          const d = reqAgeingDays(row.original);
          const hot = d > 45 && row.original.status === "open";
          return (
            <span className={cn("tnum", hot && "font-semibold text-destructive-fg")}>
              {d}d
            </span>
          );
        },
      },
      {
        accessorKey: "raisedDate",
        header: "Raised",
        cell: ({ row }) => (
          <span className="tnum text-muted-foreground">{fmtDate(row.original.raisedDate)}</span>
        ),
      },
      {
        accessorKey: "targetCloseDate",
        header: "Target close",
        cell: ({ row }) => {
          const late = row.original.targetCloseDate < DEMO_TODAY && row.original.status === "open";
          return (
            <span className={cn("tnum", late ? "text-destructive-fg" : "text-muted-foreground")}>
              {fmtDate(row.original.targetCloseDate)}
            </span>
          );
        },
      },
      {
        id: "budget",
        accessorFn: (r) => r.budgetMaxCtc,
        header: "Budget band",
        cell: ({ row }) => (
          <span className="tnum whitespace-nowrap">
            {inrCompact(row.original.budgetMinCtc)} – {inrCompact(row.original.budgetMaxCtc)}
          </span>
        ),
      },
    ],
    [],
  );

  /* ----------------------------------------------------------------- view */

  const detailCands = detail ? candidatesForReq(detail.code) : [];
  const detailJob = detail ? jobByReq(detail.code) : undefined;

  return (
    <PageBody>
      <PageHeader
        title="Requisitions"
        description={`${kpis.openReqs} open requisitions covering ${kpis.openPositions} positions across ${DEPT_OPTIONS.length} departments. ${kpis.pending} awaiting approval.`}
        actions={
          <Gated menuKey="hiring.requisitions" action="C">
            <Button size="sm" onClick={() => setRaiseOpen(true)}>
              <Plus /> Raise requisition
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow cols={4}>
          <StatTile
            label="Open requisitions"
            value={kpis.openReqs}
            icon={ClipboardList}
            tone="accent"
            hint={`${kpis.openPositions} positions to fill`}
            onClick={() => {
              clearFilters();
              setStatus("open");
            }}
            footer={`${kpis.pending} still awaiting approval`}
          />
          <StatTile
            label="Ageing over 45 days"
            value={kpis.ageing}
            icon={Hourglass}
            tone="warning"
            hint="Open requisitions past the 45-day mark"
            onClick={() => {
              clearFilters();
              setAgeingOnly(true);
            }}
            footer="Click to filter the list to just these"
          />
          <StatTile
            label="Offers out"
            value={kpis.offersOut}
            icon={FileText}
            tone="serious"
            hint="Released or awaiting internal approval"
            href="/offers"
            footer="Opens the offer register"
          />
          <StatTile
            label="Average time to fill"
            value={`${kpis.timeToFill} days`}
            icon={Timer}
            tone="neutral"
            hint="Requisition raised → candidate marked hired"
            onClick={() => {
              clearFilters();
              setStatus("filled");
            }}
            footer="Click to see the filled requisitions"
          />
        </StatRow>
      )}

      {loading ? (
        <TableSkeleton rows={10} />
      ) : (
        <DataTable<Requisition>
          columns={columns}
          data={filtered}
          getRowId={(r) => r.code}
          searchKeys={["code", "role"]}
          searchPlaceholder="Search code or role…"
          exportName="requisitions"
          enableSelection
          onRowClick={(r) => setDetail(r)}
          emptyIcon={ClipboardList}
          emptyTitle="No requisitions match these filters"
          emptyDescription="Loosen a filter, or raise a new requisition to start hiring for a role."
          emptyAction={
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
          filters={
            <>
              <FilterSelect
                label="Dept"
                value={dept}
                onValueChange={setDept}
                options={DEPT_OPTIONS}
                allLabel="All departments"
              />
              <FilterSelect
                label="Branch"
                value={branch}
                onValueChange={setBranch}
                options={BRANCH_OPTIONS}
                allLabel="All branches"
                width="w-[140px]"
              />
              <FilterSelect
                label="Approval"
                value={approval}
                onValueChange={setApproval}
                options={APPROVAL_OPTIONS}
                allLabel="Any approval"
                width="w-[150px]"
              />
              <FilterSelect
                label="Status"
                value={status}
                onValueChange={setStatus}
                options={STATUS_OPTIONS}
                allLabel="Any status"
                width="w-[140px]"
              />
              <Button
                size="sm"
                variant={ageingOnly ? "soft" : "outline"}
                aria-pressed={ageingOnly}
                onClick={() => setAgeingOnly((v) => !v)}
              >
                <Hourglass /> Ageing &gt; 45d
              </Button>
              {(dept !== "all" ||
                branch !== "all" ||
                approval !== "all" ||
                status !== "all" ||
                ageingOnly) && (
                <Button size="sm" variant="ghost" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </>
          }
          bulkActions={(selected, clear) => {
            const codes = selected.map((r) => r.code);
            return (
              <>
                <Gated menuKey="hiring.requisitions" action="A">
                  <Button size="sm" variant="outline" onClick={() => approve(codes, clear)}>
                    <CheckCheck /> Approve
                  </Button>
                </Gated>
                <Gated menuKey="hiring.requisitions" action="E">
                  <Button size="sm" variant="outline" onClick={() => hold(codes, clear)}>
                    <PauseCircle /> Put on hold
                  </Button>
                </Gated>
                <Gated menuKey="hiring.requisitions" action="D">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setCloseTarget({ codes, clear })}
                  >
                    <Ban /> Close
                  </Button>
                </Gated>
              </>
            );
          }}
        />
      )}

      {/* ------------------------------------------------------ detail drawer */}

      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent side="right" width="sm:max-w-xl">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-6">
                  <span className="font-mono text-xs text-muted-foreground">{detail.code}</span>
                  <span className="mt-0.5 block">{detail.role}</span>
                </SheetTitle>
                <SheetDescription>
                  {deptLabel(detail.departmentId)} · {branchLabel(detail.branchId)} ·{" "}
                  {GRADES.find((g) => g.id === detail.gradeId)?.label ?? detail.gradeId}
                </SheetDescription>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={detail.approvalStatus} />
                  <StatusBadge status={detail.status} />
                  <Badge variant="muted">{detail.priority} priority</Badge>
                  <Badge variant="muted">
                    <span className="tnum">{reqAgeingDays(detail)}</span> days open
                  </Badge>
                </div>
              </SheetHeader>

              <SheetBody className="flex flex-col gap-4">
                <section>
                  <h3 className="text-xs font-semibold text-foreground">Why this role exists</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {detail.justification}
                  </p>
                  {detail.replacementFor && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Backfill for{" "}
                      <span className="font-medium text-foreground">
                        {employeeByCode(detail.replacementFor)?.name ?? detail.replacementFor}
                      </span>
                      .
                    </p>
                  )}
                </section>

                <Separator />

                <section className="grid grid-cols-2 gap-3">
                  <Fact label="Positions">
                    <span className="tnum">
                      {detail.filled} filled of {detail.headcount}
                    </span>
                  </Fact>
                  <Fact label="Budget band">
                    <span className="tnum">
                      {inr(detail.budgetMinCtc, { decimals: false })} –{" "}
                      {inr(detail.budgetMaxCtc, { decimals: false })}
                    </span>
                  </Fact>
                  <Fact label="Raised">
                    <span className="tnum">{fmtDate(detail.raisedDate)}</span>
                  </Fact>
                  <Fact label="Target close">
                    <span
                      className={cn(
                        "tnum",
                        detail.targetCloseDate < DEMO_TODAY &&
                          detail.status === "open" &&
                          "text-destructive-fg",
                      )}
                    >
                      {fmtDate(detail.targetCloseDate)}
                    </span>
                  </Fact>
                </section>

                <Separator />

                <section>
                  <h3 className="text-xs font-semibold text-foreground">Owners</h3>
                  <div className="mt-2 flex flex-col gap-2">
                    <Person code={detail.hiringManagerCode} role="Hiring manager" />
                    <Person code={detail.recruiterCode} role="Recruiter" />
                  </div>
                </section>

                <Separator />

                <section>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-foreground">
                      Pipeline · {detailCands.length} candidates
                    </h3>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/candidates?req=${detail.code}`}>
                        <Users /> Open board
                      </Link>
                    </Button>
                  </div>
                  <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {PIPELINE_STAGES.map((s) => {
                      const n = detailCands.filter((c) => c.stage === s.id).length;
                      return (
                        <li
                          key={s.id}
                          className="rounded-md border border-border bg-subtle px-2 py-1.5"
                        >
                          <p className="tnum text-sm font-semibold text-foreground">{n}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {detailJob && (
                  <>
                    <Separator />
                    <section>
                      <h3 className="text-xs font-semibold text-foreground">Job posting</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {detailJob.id} ·{" "}
                        {detailJob.published ? "Published" : "Not published"} ·{" "}
                        <span className="tnum">{detailJob.views}</span> views ·{" "}
                        {detailJob.channels.join(", ")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" asChild>
                          <Link href="/jobs">
                            <Briefcase /> Manage posting
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href="/careers" target="_blank" rel="noreferrer">
                            <ExternalLink /> Public listing
                          </a>
                        </Button>
                      </div>
                    </section>
                  </>
                )}
              </SheetBody>

              <SheetFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
                {detail.status === "on_hold" ? (
                  <Gated menuKey="hiring.requisitions" action="E">
                    <Button
                      onClick={() => {
                        reopen(detail.code);
                        setDetail((d) => (d ? { ...d, status: "open" as ReqStatus } : d));
                      }}
                    >
                      <CalendarClock /> Reopen requisition
                    </Button>
                  </Gated>
                ) : detail.approvalStatus === "pending" ? (
                  <Gated menuKey="hiring.requisitions" action="A">
                    <Button
                      onClick={() => {
                        approve([detail.code], () => {});
                        setDetail((d) => (d ? { ...d, approvalStatus: "approved" } : d));
                      }}
                    >
                      <CheckCheck /> Approve requisition
                    </Button>
                  </Gated>
                ) : (
                  <Gated menuKey="hiring.requisitions" action="E">
                    <Button
                      variant="outline"
                      onClick={() => {
                        hold([detail.code], () => {});
                        setDetail((d) => (d ? { ...d, status: "on_hold" as ReqStatus } : d));
                      }}
                    >
                      <PauseCircle /> Put on hold
                    </Button>
                  </Gated>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* --------------------------------------------------------- overlays */}

      <RaiseRequisitionDialog
        open={raiseOpen}
        onOpenChange={setRaiseOpen}
        nextCode={nextReqCode(rows)}
        onCreate={createReq}
      />

      <ConfirmDialog
        open={!!closeTarget}
        onOpenChange={(v) => !v && setCloseTarget(null)}
        destructive
        title={`Close ${closeTarget?.codes.length ?? 0} requisition${
          (closeTarget?.codes.length ?? 0) === 1 ? "" : "s"
        }?`}
        description="Closing withdraws the job posting from the careers site and stops new applications. Candidates already in the pipeline are not rejected automatically."
        confirmLabel="Close requisitions"
        onConfirm={() => {
          if (!closeTarget) return;
          closeReqs(closeTarget.codes);
          closeTarget.clear();
          setCloseTarget(null);
        }}
      />
    </PageBody>
  );
}

/* --------------------------------------------------------------- bits */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-xs text-foreground">{children}</p>
    </div>
  );
}

function Person({ code, role }: { code: string; role: string }) {
  const e = employeeByCode(code);
  return (
    <div className="flex items-center gap-2">
      <Avatar name={e?.name ?? code} size={28} />
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground">{e?.name ?? code}</p>
        <p className="truncate text-xs text-muted-foreground">
          {role} · {e?.designation ?? code}
        </p>
      </div>
      {e && (
        <Button size="sm" variant="ghost" className="ml-auto" asChild>
          <Link href={`/employees/${e.code}`} aria-label={`Open ${e.name}'s profile`}>
            Profile
          </Link>
        </Button>
      )}
    </div>
  );
}
