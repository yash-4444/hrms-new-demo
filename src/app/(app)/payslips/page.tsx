"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BadgeIndianRupee,
  Calculator,
  Download,
  FileText,
  Printer,
  Wallet,
} from "lucide-react";
import { fmtDate, inr, inrCompact } from "@/lib/format";
import { TENANT } from "@/mock/org";
import { amountInWords, payslipFor, payslipsFor, type PayslipListItem } from "@/mock/payroll";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, EmptyState, Separator, Skeleton } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { PayslipExplainSheet } from "./explain-sheet";
import { PayslipExplainButton } from "@/components/ai/embed/payslip-explain-button";

const money = (n: number) => inr(n, { decimals: false });

export default function PayslipsPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

  const list = React.useMemo(() => payslipsFor(persona.employeeId), [persona.employeeId]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [explaining, setExplaining] = React.useState(false);

  /* Derived during render rather than reset in an effect: when the persona
     changes, the held id no longer matches any period in the new list, so the
     lookup falls through to the newest payslip on its own. */
  const selected = list.find((p) => p.periodId === selectedId) ?? list[0];
  const slip = selected ? payslipFor(selected.runId, persona.employeeId) : null;

  const ytd = React.useMemo(() => {
    const fy = list[0]?.fy;
    const inFy = list.filter((p) => p.fy === fy);
    return {
      fy,
      gross: inFy.reduce((a, b) => a + b.gross, 0),
      net: inFy.reduce((a, b) => a + b.net, 0),
      deductions: inFy.reduce((a, b) => a + b.deductions, 0),
      months: inFy.length,
    };
  }, [list]);

  const columns = React.useMemo<ColumnDef<PayslipListItem, unknown>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Month",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 font-medium">
            {row.original.label}
            {row.original.periodId === selected?.periodId && <Badge variant="soft">Viewing</Badge>}
          </span>
        ),
      },
      {
        accessorKey: "payDate",
        header: "Paid on",
        cell: ({ row }) => <MutedCell>{fmtDate(row.original.payDate)}</MutedCell>,
      },
      {
        accessorKey: "lopDays",
        header: "LOP days",
        cell: ({ row }) => <NumCell>{row.original.lopDays || "—"}</NumCell>,
      },
      { accessorKey: "gross", header: "Gross", cell: ({ row }) => <NumCell>{money(row.original.gross)}</NumCell> },
      {
        accessorKey: "deductions",
        header: "Deductions",
        cell: ({ row }) => <NumCell>{money(row.original.deductions)}</NumCell>,
      },
      {
        accessorKey: "net",
        header: "Net pay",
        cell: ({ row }) => <NumCell className="font-semibold">{money(row.original.net)}</NumCell>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [selected?.periodId],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="My payslips" description="Loading your pay history…" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[280px]" />
          <Skeleton className="h-[420px]" />
        </div>
      </PageBody>
    );
  }

  if (list.length === 0) {
    return (
      <PageBody>
        <PageHeader title="My payslips" description={`${persona.name} · ${persona.employeeId}`} />
        <EmptyState
          icon={FileText}
          title="No payslips on this payroll"
          description="This persona sits on the Newark payroll, which is processed by an external provider. Switch to an India-based persona from the top bar to see payslips."
        />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="My payslips"
        description={`${persona.name} · ${persona.employeeId} · ${persona.title} · ${persona.branch}`}
        actions={
          <>
            {selected && (
              <PayslipExplainButton
                periodLabel={selected.label}
                prevLabel={list[list.indexOf(selected) + 1]?.label}
                onFallback={() => setExplaining(true)}
              />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                mockAction("Salary certificate requested", {
                  description: "The People desk will issue it within two working days.",
                })
              }
            >
              <FileText /> Request salary certificate
            </Button>
          </>
        }
      />

      <StatRow cols={4}>
        <StatTile
          label={`Gross ${ytd.fy}`}
          value={inrCompact(ytd.gross)}
          icon={Wallet}
          hint={`${ytd.months} month${ytd.months === 1 ? "" : "s"} paid so far`}
        />
        <StatTile label={`Deductions ${ytd.fy}`} value={inrCompact(ytd.deductions)} icon={Calculator} />
        <StatTile label={`Net paid ${ytd.fy}`} value={inrCompact(ytd.net)} icon={BadgeIndianRupee} tone="accent" />
        <StatTile
          label="Latest net pay"
          value={inr(list[0].net, { decimals: false })}
          icon={Wallet}
          hint={`${list[0].label} · paid ${fmtDate(list[0].payDate)}`}
        />
      </StatRow>

      <Section
        title="Pay history"
        description="Newest first. Click a month to load its payslip below."
        bodyClassName="p-4"
      >
        <DataTable
          columns={columns}
          data={list}
          getRowId={(p) => p.periodId}
          searchKeys={["label", "fy"]}
          searchPlaceholder="Search month…"
          onRowClick={(p) => setSelectedId(p.periodId)}
          exportName={`payslips-${persona.employeeId}`}
          emptyIcon={FileText}
          emptyTitle="No payslips"
          pageSize={12}
        />
      </Section>

      <div className="grid gap-3 xl:grid-cols-2">
        {/* -------------------------------------------------- the preview */}
        <div className="flex flex-col gap-3">
          {slip && selected ? (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-subtle p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={slip.employee.name} size={40} />
                  <div>
                    <p className="text-sm font-semibold">{slip.employee.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {slip.employee.designation} · {slip.employee.department} · {slip.employee.branch}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge variant="muted">{slip.employee.code}</Badge>
                      <Badge variant="muted">PAN {slip.employee.pan}</Badge>
                      <Badge variant="muted">A/C ••••{slip.employee.bankAccountLast4}</Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold">Payslip · {slip.periodLabel}</p>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {TENANT.legalName}
                    <br />
                    PF {TENANT.pfCode}
                  </p>
                  <StatusBadge status={slip.status} className="mt-1.5" />
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-border p-4 sm:grid-cols-4">
                {[
                  ["Period", `${fmtDate(slip.periodStart)} – ${fmtDate(slip.periodEnd)}`],
                  ["Pay date", fmtDate(slip.payDate)],
                  ["Paid days", `${slip.paidDays} of ${slip.daysInMonth}`],
                  ["LOP days", String(slip.lopDays)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="tnum mt-0.5 text-xs font-medium">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="grid gap-0 sm:grid-cols-2">
                <div className="border-b border-border p-4 sm:border-b-0 sm:border-r">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Earnings
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {slip.earnings.map((c) => (
                      <li key={c.code} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="truncate text-muted-foreground">{c.label}</span>
                        <span className="tnum shrink-0 font-medium">
                          {inr(c.amount, { decimals: false })}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Separator className="my-2" />
                  <p className="flex items-baseline justify-between gap-3 text-xs font-semibold">
                    <span>Gross earnings</span>
                    <span className="tnum">{inr(slip.gross, { decimals: false })}</span>
                  </p>
                </div>

                <div className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Deductions
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {[...slip.statutory, ...slip.deductions].map((c) => (
                      <li key={c.code} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="truncate text-muted-foreground">{c.label}</span>
                        <span className="tnum shrink-0 font-medium">
                          {inr(c.amount, { decimals: false })}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Separator className="my-2" />
                  <p className="flex items-baseline justify-between gap-3 text-xs font-semibold">
                    <span>Total deductions</span>
                    <span className="tnum">{inr(slip.totalDeductions, { decimals: false })}</span>
                  </p>
                </div>
              </div>

              <div className="border-t border-border bg-primary-soft px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-primary-soft-foreground">Net pay</span>
                  <span className="tnum text-lg font-semibold text-primary-soft-foreground">
                    {inr(slip.net)}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] italic text-primary-soft-foreground/80">
                  {amountInWords(slip.net)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
                <Button
                  size="sm"
                  onClick={() =>
                    mockAction("Payslip download queued", {
                      description: `${slip.employee.code}-${slip.periodId}.pdf — not written to disk in the demo.`,
                    })
                  }
                >
                  <Download /> Download PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer /> Print
                </Button>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setExplaining(true)}>
                  <Calculator /> Explain every number
                </Button>
              </div>
            </Card>
          ) : (
            <EmptyState icon={FileText} title="Select a payslip" description="Pick a month from the list." />
          )}
        </div>

        <BarCompareChart
          title="Net pay by month"
          description="Your take-home across the last 12 pay periods."
          data={[...list].reverse().map((p) => ({
            month: p.shortLabel,
            gross: p.gross,
            net: p.net,
          }))}
          xKey="month"
          series={[
            { key: "gross", label: "Gross" },
            { key: "net", label: "Net pay" },
          ]}
          valueFormat={inrCompact}
          height={230}
          onBarClick={(row) => {
            const hit = list.find((p) => p.shortLabel === row.month);
            if (hit) setSelectedId(hit.periodId);
          }}
          footnote="Click any bar to load that month's payslip in the preview."
        />
      </div>

      {slip && <PayslipExplainSheet slip={slip} open={explaining} onOpenChange={setExplaining} />}
    </PageBody>
  );
}
