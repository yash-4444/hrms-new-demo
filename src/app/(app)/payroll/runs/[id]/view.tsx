"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeIndianRupee,
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Lock,
  Receipt,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, inrCompact, num } from "@/lib/format";
import {
  EXCEPTIONS,
  EXCEPTION_META,
  PAY_RUNS,
  RUN_STEPS,
  RUN_STEP_META,
  costByDepartment,
  payRunRows,
  runById,
  verifyRun,
  type PayRunRow,
  type PayRunStatus,
  type PayrollException,
} from "@/mock/payroll";
import { DEPARTMENTS } from "@/mock/org";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Badge, EmptyState, Hint } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  FilterSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";
import { PayrollAnomalyScan } from "@/components/ai/embed/payroll-anomaly-scan";

export default function PayRunDetailPage() {
  const loading = useFakeLoad();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { setExceptionCount } = useApp();

  const runId = String(params.id);
  const run = runById(runId);
  /* Traced breakdowns are pre-rendered for the two live runs only, so archived
     periods must not offer a link that would 404 in the static build. */
  const hasBreakdown = PAY_RUNS.some((r) => r.id === runId);

  /* The run's status is local so the stepper genuinely advances in the demo. */
  const [status, setStatus] = React.useState<PayRunStatus>(run?.status ?? "draft");
  const [resolved, setResolved] = React.useState<Set<string>>(new Set());
  const [confirm, setConfirm] = React.useState<null | { to: PayRunStatus; label: string }>(null);
  const [department, setDepartment] = React.useState("all");
  const [onlyExceptions, setOnlyExceptions] = React.useState(false);
  const [detail, setDetail] = React.useState<PayrollException | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const runExceptions = React.useMemo(
    () => EXCEPTIONS.filter((e) => e.runId === runId),
    [runId],
  );
  const openExceptions = runExceptions.filter((e) => !resolved.has(e.id));

  React.useEffect(() => {
    if (run && runId === EXCEPTIONS[0]?.runId) setExceptionCount(openExceptions.length);
  }, [openExceptions.length, run, runId, setExceptionCount]);

  const rows = React.useMemo(() => (run ? payRunRows(runId) : []), [run, runId]);

  const filtered = React.useMemo(
    () =>
      rows.filter(
        (r) =>
          (department === "all" || r.departmentId === department) &&
          (!onlyExceptions || r.exceptionType !== null),
      ),
    [rows, department, onlyExceptions],
  );

  const deptCost = React.useMemo(() => (run ? costByDepartment(runId) : []), [run, runId]);
  const checks = React.useMemo(() => (run ? verifyRun(runId) : null), [run, runId]);

  const columns = React.useMemo<ColumnDef<PayRunRow, unknown>[]>(
    () => [
      {
        id: "expand",
        header: "",
        size: 28,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <button
            type="button"
            aria-label={expanded === row.original.employeeCode ? "Collapse row" : "Expand row"}
            aria-expanded={expanded === row.original.employeeCode}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((p) => (p === row.original.employeeCode ? null : row.original.employeeCode));
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded === row.original.employeeCode ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
        ),
      },
      {
        accessorKey: "name",
        header: "Employee",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {row.original.employeeCode} · {row.original.designation}
            </span>
          </span>
        ),
      },
      { accessorKey: "department", header: "Department" },
      {
        accessorKey: "payableDays",
        header: "Payable days",
        cell: ({ row }) => (
          <NumCell>
            {row.original.payableDays}
            {row.original.lopDays > 0 && (
              <span className="ml-1 text-destructive-fg">(−{row.original.lopDays} LOP)</span>
            )}
          </NumCell>
        ),
      },
      {
        accessorKey: "gross",
        header: "Gross",
        cell: ({ row }) => <NumCell>{inr(row.original.gross, { decimals: false })}</NumCell>,
      },
      {
        accessorKey: "deductions",
        header: "Deductions",
        cell: ({ row }) => (
          <NumCell className="text-muted-foreground">
            {inr(row.original.deductions, { decimals: false })}
          </NumCell>
        ),
      },
      {
        accessorKey: "net",
        header: "Net pay",
        cell: ({ row }) => (
          <NumCell className={row.original.net < 0 ? "text-destructive-fg" : undefined}>
            {inr(row.original.net, { decimals: false })}
          </NumCell>
        ),
      },
      {
        accessorKey: "exceptionType",
        header: "Flag",
        cell: ({ row }) =>
          row.original.exceptionType ? (
            <Hint text={EXCEPTION_META[row.original.exceptionType].blurb}>
              <Badge variant="outline" className="border-destructive/30 text-destructive-fg">
                <AlertTriangle className="size-3" aria-hidden />
                {EXCEPTION_META[row.original.exceptionType].label}
              </Badge>
            </Hint>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "open",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) =>
          hasBreakdown ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/payroll/runs/${runId}/employee/${row.original.employeeCode}`}>
                Breakdown
              </Link>
            </Button>
          ) : (
            <Hint text="Traced breakdowns are kept for the current and previous run. This period is archived.">
              <span className="inline-flex cursor-not-allowed">
                <Button variant="ghost" size="sm" disabled>
                  Breakdown
                </Button>
              </span>
            </Hint>
          ),
      },
    ],
    [expanded, runId, hasBreakdown],
  );

  if (!run) {
    return (
      <PageBody>
        <PageHeader title="Pay run not found" />
        <EmptyState
          icon={BadgeIndianRupee}
          title={`No run with id “${runId}”`}
          description="It may have been deleted, or the link may be wrong."
          action={
            <Button size="sm" asChild>
              <Link href="/payroll/runs">Back to pay runs</Link>
            </Button>
          }
        />
      </PageBody>
    );
  }

  if (loading) {
    return (
      <PageBody>
        <PageHeader title={run.label} description="Loading the run…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  const stepIndex = RUN_STEPS.indexOf(status);
  const nextStatus = RUN_STEPS[stepIndex + 1];
  const lockBlocked = openExceptions.length > 0;

  const advance = (to: PayRunStatus) => {
    setStatus(to);
    mockAction(`${run.label} — ${RUN_STEP_META[to].label}`, {
      description: RUN_STEP_META[to].blurb,
    });
  };

  const resolveException = (e: PayrollException) => {
    setResolved((s) => new Set(s).add(e.id));
    setDetail(null);
    mockAction(`Exception cleared — ${e.employeeName}`, {
      description: e.resolution,
    });
  };

  return (
    <PageBody>
      <PageHeader
        title={run.label}
        description={
          <>
            {run.code} · {fmtDate(run.periodStart)} – {fmtDate(run.periodEnd)} · pay date{" "}
            {fmtDate(run.payDate)} · {num(run.employeeCount)} employees · {run.fy}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/payroll/runs">
                <ArrowLeft /> All runs
              </Link>
            </Button>
            {nextStatus && (
              <Gated menuKey="payroll.runs" action={nextStatus === "approved" ? "A" : "X"}>
                {nextStatus === "locked" && lockBlocked ? (
                  <Hint
                    text={`${openExceptions.length} exception${openExceptions.length === 1 ? "" : "s"} must be cleared before this run can be locked.`}
                  >
                    <span className="inline-flex cursor-not-allowed">
                      <Button size="sm" disabled>
                        <Lock /> Lock run
                      </Button>
                    </span>
                  </Hint>
                ) : (
                  <Button
                    size="sm"
                    onClick={() =>
                      setConfirm({ to: nextStatus, label: RUN_STEP_META[nextStatus].label })
                    }
                  >
                    {nextStatus === "locked" ? <Lock /> : <Check />}
                    {RUN_STEP_META[nextStatus].label}
                  </Button>
                )}
              </Gated>
            )}
          </>
        }
      />

      {/* --------------------------------------------------------- stepper */}
      <Section
        title="Run progress"
        description={RUN_STEP_META[status].blurb}
        actions={<StatusBadge status={status} size="md" />}
      >
        <ol className="flex flex-wrap items-center gap-1">
          {RUN_STEPS.map((step, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={step} className="flex items-center gap-1">
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium",
                    done && "border-success/25 bg-success-soft text-success-fg",
                    current && "border-primary/30 bg-primary-soft text-primary-soft-foreground",
                    !done && !current && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "tnum flex size-4 items-center justify-center rounded-full text-[10px] font-bold",
                      done && "bg-success text-white",
                      current && "bg-primary text-primary-foreground",
                      !done && !current && "bg-border text-muted-foreground",
                    )}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  {RUN_STEP_META[step].label}
                </span>
                {i < RUN_STEPS.length - 1 && <span className="h-px w-4 bg-border sm:w-6" aria-hidden />}
              </li>
            );
          })}
        </ol>

        {checks && (
          <div className="mt-4 rounded-md border border-border bg-subtle p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reconciliation checks
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {checks.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-xs">
                  {c.ok ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success-fg" aria-hidden />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive-fg" aria-hidden />
                  )}
                  <span className={c.ok ? "text-muted-foreground" : "text-destructive-fg"}>
                    <span className="font-medium text-foreground">{c.label}</span> — expected{" "}
                    <span className="tnum">{inr(c.expected, { decimals: false })}</span>, got{" "}
                    <span className="tnum">{inr(c.actual, { decimals: false })}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <StatRow cols={4}>
        <StatTile label="Gross earnings" value={inr(run.totals.gross, { decimals: false })} icon={Wallet} />
        <StatTile
          label="Total deductions"
          value={inr(run.totals.deductions, { decimals: false })}
          icon={Receipt}
          hint={`Statutory ${inrCompact(run.totals.statutory)}`}
        />
        <StatTile
          label="Net payable"
          value={inr(run.totals.net, { decimals: false })}
          icon={BadgeIndianRupee}
          tone="accent"
        />
        <StatTile
          label="Open exceptions"
          value={num(openExceptions.length)}
          icon={AlertTriangle}
          tone={openExceptions.length > 0 ? "critical" : "good"}
          hint={openExceptions.length > 0 ? "Blocking the lock step" : "All cleared"}
          onClick={() => setOnlyExceptions(true)}
        />
      </StatRow>

      {/* ------------------------------------------------------ exceptions */}
      <Section
        title="Exceptions"
        description="Every one of these must be cleared before the run can be locked."
        actions={
          openExceptions.length > 0 ? (
            <Gated menuKey="payroll.runs" action="E">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setResolved(new Set(runExceptions.map((e) => e.id)));
                  mockAction(`Cleared ${openExceptions.length} exceptions`, {
                    description: "The run can now be locked.",
                  });
                }}
              >
                <CheckCheck /> Clear all
              </Button>
            </Gated>
          ) : null
        }
        bodyClassName="p-0"
      >
        {openExceptions.length === 0 ? (
          <EmptyState
            icon={CheckCheck}
            title="No open exceptions"
            description="Every employee in this run has valid bank details, a non-negative net and LOP days within the payable window."
            className="border-0"
          />
        ) : (
          <ul>
            {openExceptions.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-start gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
                    e.severity === "critical"
                      ? "bg-destructive-soft text-destructive-fg"
                      : "bg-warning-soft text-warning-fg",
                  )}
                >
                  <AlertTriangle className="size-3.5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                    {EXCEPTION_META[e.type].label}
                    <Badge variant="muted">{e.employeeName}</Badge>
                    <Badge variant="outline">{e.department}</Badge>
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{e.detail}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setDetail(e)}>
                    Details
                  </Button>
                  {hasBreakdown && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/payroll/runs/${runId}/employee/${e.employeeCode}`}>Breakdown</Link>
                    </Button>
                  )}
                  <Gated menuKey="payroll.runs" action="E">
                    <Button size="sm" onClick={() => resolveException(e)}>
                      Resolve
                    </Button>
                  </Gated>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ------------------------------------------------ AI anomaly scan */}
      <PayrollAnomalyScan runId={runId} hasBreakdown={hasBreakdown} hardExceptionCount={openExceptions.length} />

      {/* ------------------------------------------------------- employees */}
      <Section
        title="Employees in this run"
        description="Expand a row for the component summary, or open the full traced breakdown."
        bodyClassName="p-4"
      >
        <DataTable
          columns={columns}
          data={filtered}
          searchKeys={["name", "employeeCode", "department", "designation"]}
          searchPlaceholder="Search employees…"
          exportName={`${run.code}-register`}
          getRowId={(r) => r.employeeCode}
          pageSize={15}
          rowTone={(r) => (r.exceptionType ? "danger" : undefined)}
          emptyIcon={BadgeIndianRupee}
          emptyTitle="No employees match"
          emptyDescription="Clear the department filter or the exceptions-only switch."
          filters={
            <>
              <FilterSelect
                label="Dept"
                value={department}
                onValueChange={setDepartment}
                allLabel="All departments"
                width="w-[180px]"
                options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))}
              />
              <Button
                variant={onlyExceptions ? "default" : "outline"}
                size="sm"
                aria-pressed={onlyExceptions}
                onClick={() => setOnlyExceptions((v) => !v)}
              >
                <AlertTriangle /> Exceptions only
              </Button>
            </>
          }
        />

        {expanded && (
          <ExpandedRow
            row={rows.find((r) => r.employeeCode === expanded)!}
            runId={runId}
            hasBreakdown={hasBreakdown}
          />
        )}
      </Section>

      <BarCompareChart
        title="Cost by department"
        description="Gross earnings and employer statutory cost for this run."
        data={deptCost.map((d) => ({
          name: `${d.costCentre} · ${d.department}`,
          gross: d.gross,
          employer: d.employer,
        }))}
        xKey="name"
        series={[
          { key: "gross", label: "Employee gross" },
          { key: "employer", label: "Employer cost" },
        ]}
        stacked
        horizontal
        valueFormat={inrCompact}
        height={300}
        onBarClick={(r) => {
          const d = deptCost.find((x) => `${x.costCentre} · ${x.department}` === r.name);
          if (d) {
            setDepartment(d.departmentId);
            mockAction(`Filtered to ${d.department}`, {
              description: `${num(d.headcount)} employees · gross ${inr(d.gross, { decimals: false })}`,
            });
          }
        }}
      />

      {/* ------------------------------------------------- exception drawer */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" width="sm:max-w-md">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.title}</SheetTitle>
                <SheetDescription>
                  {detail.employeeName} · {detail.employeeCode} · {detail.department}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-3">
                <Alert
                  tone={detail.severity === "critical" ? "danger" : "warning"}
                  icon={AlertTriangle}
                  title={EXCEPTION_META[detail.type].label}
                >
                  {detail.detail}
                </Alert>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    How to resolve
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">{detail.resolution}</p>
                </div>
                <div className="rounded-md border border-border bg-subtle p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Amount at stake
                  </p>
                  <p className="tnum mt-0.5 text-sm font-semibold">{inr(detail.amount)}</p>
                </div>
                <div className="mt-1 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href={`/payroll/runs/${runId}/employee/${detail.employeeCode}`}>
                      Open breakdown
                    </Link>
                  </Button>
                  <Gated menuKey="payroll.runs" action="E">
                    <Button size="sm" className="flex-1" onClick={() => resolveException(detail)}>
                      Mark resolved
                    </Button>
                  </Gated>
                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? `${confirm.label}?` : ""}
        description={
          confirm
            ? `${RUN_STEP_META[confirm.to].blurb} This affects ${num(run.employeeCount)} employees and ${inr(run.totals.net, { decimals: false })} of net pay.`
            : undefined
        }
        confirmLabel={confirm?.label}
        destructive={confirm?.to === "locked" || confirm?.to === "paid"}
        onConfirm={() => confirm && advance(confirm.to)}
      />
    </PageBody>
  );
}

/* ------------------------------------------------------------ expanded row */

function ExpandedRow({
  row,
  runId,
  hasBreakdown,
}: {
  row: PayRunRow;
  runId: string;
  hasBreakdown: boolean;
}) {
  return (
    <Card className="mt-3 bg-subtle p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold">
          {row.name} · {row.employeeCode}
        </p>
        {hasBreakdown && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/payroll/runs/${runId}/employee/${row.employeeCode}`}>
              Full traced breakdown <ChevronRight />
            </Link>
          </Button>
        )}
      </div>
      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-6">
        {[
          ["Grade", row.gradeId],
          ["Branch", row.branch],
          ["Cost centre", row.costCentre],
          ["Payable days", `${row.payableDays}`],
          ["LOP days", `${row.lopDays}`],
          ["Gross", inr(row.gross, { decimals: false })],
          ["Statutory", inr(row.statutory, { decimals: false })],
          ["Other deductions", inr(row.otherDeductions, { decimals: false })],
          ["Net pay", inr(row.net, { decimals: false })],
          ["Employer cost", inr(row.employerCost, { decimals: false })],
          ["Bank on file", row.hasBankDetails ? "Verified" : "Missing"],
          ["Flag", row.exceptionType ? EXCEPTION_META[row.exceptionType].label : "None"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd
              className={cn(
                "tnum mt-0.5 text-xs font-medium",
                k === "Bank on file" && !row.hasBankDetails && "text-destructive-fg",
                k === "Flag" && row.exceptionType && "text-destructive-fg",
              )}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
