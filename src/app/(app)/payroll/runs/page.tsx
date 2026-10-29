"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  BadgeIndianRupee,
  CalendarClock,
  ChevronRight,
  Plus,
  Users,
  Wallet,
} from "lucide-react";
import { fmtDate, inr, inrCompact, num } from "@/lib/format";
import {
  EXCEPTIONS,
  EXCEPTION_META,
  PAYROLL_COST_TREND,
  PAY_RUNS,
  PAY_RUN_HISTORY,
  RUN_STEPS,
  type PayRun,
} from "@/mock/payroll";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Badge } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrendAreaChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";

export default function PayRunsPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const { exceptionCount } = useApp();

  const current = PAY_RUNS[0];
  const previous = PAY_RUNS[1];

  const allRuns = React.useMemo<PayRun[]>(() => {
    const seen = new Set<string>();
    return [...PAY_RUNS, ...PAY_RUN_HISTORY].filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, []);

  const columns = React.useMemo<ColumnDef<PayRun, unknown>[]>(
    () => [
      {
        accessorKey: "code",
        header: "Run",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.label}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{row.original.code}</span>
          </span>
        ),
      },
      {
        accessorKey: "periodEnd",
        header: "Period",
        cell: ({ row }) => (
          <span className="tnum text-muted-foreground">
            {fmtDate(row.original.periodStart)} – {fmtDate(row.original.periodEnd)}
          </span>
        ),
      },
      {
        accessorKey: "payDate",
        header: "Pay date",
        cell: ({ row }) => <span className="tnum">{fmtDate(row.original.payDate)}</span>,
      },
      {
        accessorKey: "employeeCount",
        header: "Employees",
        cell: ({ row }) => <NumCell>{num(row.original.employeeCount)}</NumCell>,
      },
      {
        id: "gross",
        accessorFn: (r) => r.totals.gross,
        header: "Gross",
        cell: ({ row }) => <NumCell>{inr(row.original.totals.gross, { decimals: false })}</NumCell>,
      },
      {
        id: "deductions",
        accessorFn: (r) => r.totals.deductions,
        header: "Deductions",
        cell: ({ row }) => (
          <NumCell className="text-muted-foreground">
            {inr(row.original.totals.deductions, { decimals: false })}
          </NumCell>
        ),
      },
      {
        id: "net",
        accessorFn: (r) => r.totals.net,
        header: "Net payable",
        cell: ({ row }) => <NumCell>{inr(row.original.totals.net, { decimals: false })}</NumCell>,
      },
      {
        accessorKey: "exceptionCount",
        header: "Exceptions",
        cell: ({ row }) =>
          row.original.exceptionCount > 0 ? (
            <Badge variant="outline" className="border-destructive/30 text-destructive-fg">
              <AlertTriangle className="size-3" aria-hidden /> {row.original.exceptionCount}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "open",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <Button variant="ghost" size="icon-sm" aria-label={`Open ${row.original.label}`} asChild>
            <Link href={`/payroll/runs/${row.original.id}`}>
              <ChevronRight />
            </Link>
          </Button>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Pay runs" description="Loading payroll history…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Pay runs"
        description="Every monthly payroll cycle for Stellar Technologies. Indian payroll only — the Newark branch is processed by an external provider."
        actions={
          <Gated menuKey="payroll.runs" action="C">
            <Button
              size="sm"
              onClick={() =>
                mockAction("October 2026 run created", {
                  description: "Status: Draft. Import attendance and LOP before calculating.",
                })
              }
            >
              <Plus /> New pay run
            </Button>
          </Gated>
        }
      />

      {exceptionCount > 0 && (
        <Alert
          tone="danger"
          icon={AlertTriangle}
          title={`${exceptionCount} exception${exceptionCount === 1 ? " is" : "s are"} blocking the ${current.label} run`}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/payroll/runs/${current.id}`}>Resolve</Link>
            </Button>
          }
        >
          {EXCEPTIONS.slice(0, 3)
            .map((e) => `${e.employeeName} — ${EXCEPTION_META[e.type].label}`)
            .join(" · ")}
        </Alert>
      )}

      <StatRow cols={4}>
        <StatTile
          label="Current run"
          value={current.label}
          icon={CalendarClock}
          hint={`Pay date ${fmtDate(current.payDate)}`}
          href={`/payroll/runs/${current.id}`}
          tone="accent"
        />
        <StatTile
          label="Net payable"
          value={inrCompact(current.totals.net)}
          icon={Wallet}
          hint={`${num(current.employeeCount)} employees in scope`}
          href={`/payroll/runs/${current.id}`}
        />
        <StatTile
          label="Cost to company"
          value={inrCompact(current.totals.costToCompany)}
          icon={BadgeIndianRupee}
          hint={`Incl. employer ${inrCompact(current.totals.employerCost)}`}
          href="/analytics"
        />
        <StatTile
          label="Open exceptions"
          value={num(exceptionCount)}
          icon={AlertTriangle}
          tone={exceptionCount > 0 ? "critical" : "good"}
          hint={exceptionCount > 0 ? "Lock is blocked until cleared" : "Nothing blocking the lock"}
          href={`/payroll/runs/${current.id}`}
        />
      </StatRow>

      {/* current vs previous run cards */}
      <div className="grid gap-3 lg:grid-cols-2">
        {[current, previous].map((run) => (
          <Card key={run.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">{run.label}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {run.code} · {fmtDate(run.periodStart)} – {fmtDate(run.periodEnd)}
                </p>
              </div>
              <StatusBadge status={run.status} size="md" />
            </div>

            <ol className="mt-3 flex flex-wrap items-center gap-1">
              {RUN_STEPS.map((step, i) => {
                const idx = RUN_STEPS.indexOf(run.status);
                const done = i < idx;
                const at = i === idx;
                return (
                  <li key={step} className="flex items-center gap-1">
                    <span
                      className={[
                        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize",
                        done ? "border-success/25 bg-success-soft text-success-fg" : "",
                        at ? "border-primary/30 bg-primary-soft text-primary-soft-foreground" : "",
                        !done && !at ? "border-border bg-muted text-muted-foreground" : "",
                      ].join(" ")}
                    >
                      {done ? "✓ " : ""}
                      {step}
                    </span>
                    {i < RUN_STEPS.length - 1 && <span className="h-px w-2 bg-border" aria-hidden />}
                  </li>
                );
              })}
            </ol>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border pt-3 text-xs sm:grid-cols-4">
              {[
                ["Gross", inr(run.totals.gross, { decimals: false })],
                ["Deductions", inr(run.totals.deductions, { decimals: false })],
                ["Net", inr(run.totals.net, { decimals: false })],
                ["Employees", num(run.employeeCount)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                  <dd className="tnum mt-0.5 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            <Button size="sm" className="mt-3 w-full" asChild>
              <Link href={`/payroll/runs/${run.id}`}>Open run</Link>
            </Button>
          </Card>
        ))}
      </div>

      <Section title="All runs" description="Click any row to open the run." bodyClassName="p-0">
        <div className="p-4">
          <DataTable
            columns={columns}
            data={allRuns}
            searchKeys={["label", "code", "status"]}
            searchPlaceholder="Search runs…"
            exportName="pay-runs"
            getRowId={(r) => r.id}
            onRowClick={(r) => router.push(`/payroll/runs/${r.id}`)}
            emptyIcon={BadgeIndianRupee}
            emptyTitle="No pay runs yet"
            emptyDescription="Create the first run to begin processing payroll."
            pageSize={12}
          />
        </div>
      </Section>

      <TrendAreaChart
        title="Payroll cost trend"
        description="Employee gross and employer statutory cost across the last 12 pay periods."
        data={PAYROLL_COST_TREND.map((p) => ({
          month: p.month,
          gross: p.gross,
          employerCost: p.employer,
        }))}
        xKey="month"
        series={[
          { key: "gross", label: "Employee gross" },
          { key: "employerCost", label: "Employer cost" },
        ]}
        stacked
        valueFormat={inrCompact}
        height={240}
        footnote="Employer cost = PF 12% + ESI 3.25% where applicable + 4.81% gratuity provision."
      />
    </PageBody>
  );
}
