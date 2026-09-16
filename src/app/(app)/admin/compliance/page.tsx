"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  IndianRupee,
  Landmark,
  ListFilter,
  Sparkles,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateShort, inr, inrCompact, num } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import {
  COMPLIANCE_BY_STATUS,
  COMPLIANCE_FILINGS,
  COMPLIANCE_STATS,
  PENALTY_RISK_LABEL,
  type ComplianceFiling,
  type ComplianceStatus,
} from "@/mock/admin";
import { mockAction } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Avatar, Badge, EmptyState, Hint } from "@/components/ui/primitives";
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
import { DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";

const MONTHS = [
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
  "2027-01",
  "2027-02",
  "2027-03",
];

export default function CompliancePage() {
  const loading = useFakeLoad();

  const [filings, setFilings] = React.useState<ComplianceFiling[]>(COMPLIANCE_FILINGS);
  const [view, setView] = React.useState<"table" | "timeline">("table");
  const [country, setCountry] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [risk, setRisk] = React.useState("all");
  const [detail, setDetail] = React.useState<ComplianceFiling | null>(null);
  const [confirm, setConfirm] = React.useState<ComplianceFiling | null>(null);

  const filtered = React.useMemo(
    () =>
      filings.filter(
        (f) =>
          (country === "all" || f.country === country) &&
          (status === "all" || f.status === status) &&
          (risk === "all" || f.penaltyRisk === risk),
      ),
    [filings, country, status, risk],
  );

  const stats = React.useMemo(
    () => ({
      overdue: filings.filter((f) => f.status === "overdue").length,
      dueSoon: filings.filter((f) => f.status === "due_soon").length,
      filed: filings.filter((f) => f.status === "filed").length,
      exposure: filings
        .filter((f) => f.status !== "filed" && f.amount)
        .reduce((a, f) => a + (f.amount ?? 0), 0),
      highRiskOpen: filings.filter((f) => f.status !== "filed" && f.penaltyRisk === "high").length,
    }),
    [filings],
  );

  const markFiled = (f: ComplianceFiling) => {
    setFilings((fs) =>
      fs.map((x) =>
        x.id === f.id
          ? {
              ...x,
              status: "filed" as ComplianceStatus,
              filedOn: "2026-09-16",
              filingRef: `ACK-${f.shortName.replace(/\s+/g, "").toUpperCase()}-2026091600${fs.indexOf(x)}`,
            }
          : x,
      ),
    );
    setDetail(null);
    mockAction(`${f.shortName} marked as filed`, {
      description: `${f.period} · ${f.authority}. An acknowledgement reference has been recorded.`,
    });
  };

  const overdue = filings.filter((f) => f.status === "overdue");

  const columns = React.useMemo<ColumnDef<ComplianceFiling, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Filing",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.shortName}</span>
            <span className="text-[10px] text-muted-foreground">{row.original.name}</span>
          </span>
        ),
      },
      {
        accessorKey: "authority",
        header: "Authority",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span>{row.original.authority}</span>
            <span className="text-[10px] text-muted-foreground">
              {row.original.country === "IN" ? "India" : "United States"} · {row.original.category}
            </span>
          </span>
        ),
      },
      { accessorKey: "period", header: "Period" },
      {
        accessorKey: "dueDate",
        header: "Due",
        cell: ({ row }) => {
          const days = Math.round(
            (new Date(row.original.dueDate).getTime() - new Date("2026-09-16").getTime()) / 86400000,
          );
          const open = row.original.status !== "filed";
          return (
            <span className="tnum flex flex-col">
              <span>{fmtDate(row.original.dueDate)}</span>
              {open && (
                <span
                  className={cn(
                    "text-[10px]",
                    days < 0 ? "text-destructive-fg" : days <= 7 ? "text-warning-fg" : "text-muted-foreground",
                  )}
                >
                  {days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`}
                </span>
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "ownerCode",
        header: "Owner",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <Avatar name={employeeName(row.original.ownerCode)} size={20} />
            <span className="truncate">{employeeName(row.original.ownerCode)}</span>
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <NumCell className={row.original.amount ? "" : "text-muted-foreground"}>
            {row.original.amount ? inr(row.original.amount, { decimals: false }) : "—"}
          </NumCell>
        ),
      },
      {
        accessorKey: "penaltyRisk",
        header: "Penalty risk",
        cell: ({ row }) => (
          <Hint text={row.original.penaltyNote}>
            <Badge
              variant="outline"
              className={cn(
                row.original.penaltyRisk === "high" && "border-destructive/30 text-destructive-fg",
                row.original.penaltyRisk === "medium" && "border-warning/30 text-warning-fg",
              )}
            >
              {PENALTY_RISK_LABEL[row.original.penaltyRisk]}
            </Badge>
          </Hint>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setDetail(row.original)}>
              Details
            </Button>
            {row.original.status !== "filed" && (
              <Gated menuKey="admin.compliance" action="E">
                <Button size="sm" onClick={() => setConfirm(row.original)}>
                  Mark filed
                </Button>
              </Gated>
            )}
          </span>
        ),
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Compliance calendar" description="Loading filings…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Compliance calendar"
        description="Every statutory obligation across India and the United States, with its due date, owner and filing status."
        actions={
          <div className="flex items-center rounded-md border border-border p-0.5">
            <Button
              variant={view === "table" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Table view"
              aria-pressed={view === "table"}
              onClick={() => setView("table")}
            >
              <Table2 />
            </Button>
            <Button
              variant={view === "timeline" ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label="Timeline view"
              aria-pressed={view === "timeline"}
              onClick={() => setView("timeline")}
            >
              <CalendarDays />
            </Button>
          </div>
        }
      />

      {overdue.length > 0 && (
        <Alert
          tone="danger"
          icon={AlertTriangle}
          title={`${overdue.length} filing${overdue.length === 1 ? " is" : "s are"} overdue`}
          action={
            <Button variant="outline" size="sm" onClick={() => setStatus("overdue")}>
              Show only overdue
            </Button>
          }
        >
          {overdue
            .map((f) => `${f.shortName} (${f.period}, due ${fmtDateShort(f.dueDate)}, ${employeeName(f.ownerCode)})`)
            .join(" · ")}
        </Alert>
      )}

      <StatRow cols={5}>
        <StatTile label="Total filings" value={num(filings.length)} icon={Landmark} hint="This financial year" />
        <StatTile
          label="Overdue"
          value={num(stats.overdue)}
          icon={AlertTriangle}
          tone={stats.overdue > 0 ? "critical" : "good"}
          onClick={() => setStatus("overdue")}
        />
        <StatTile
          label="Due within 30 days"
          value={num(COMPLIANCE_STATS.next30)}
          icon={CalendarDays}
          tone="warning"
          onClick={() => setStatus("due_soon")}
        />
        <StatTile label="Filed" value={num(stats.filed)} icon={Check} tone="good" onClick={() => setStatus("filed")} />
        <StatTile
          label="Open exposure"
          value={inrCompact(stats.exposure)}
          icon={IndianRupee}
          hint={`${stats.highRiskOpen} high-penalty filings open`}
        />
      </StatRow>

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect
          label="Country"
          value={country}
          onValueChange={setCountry}
          allLabel="Both countries"
          width="w-[175px]"
          options={[
            { value: "IN", label: "India" },
            { value: "US", label: "United States" },
          ]}
        />
        <FilterSelect
          label="Status"
          value={status}
          onValueChange={setStatus}
          allLabel="All statuses"
          width="w-[170px]"
          options={[
            { value: "filed", label: "Filed" },
            { value: "due_soon", label: "Due soon" },
            { value: "pending", label: "Pending" },
            { value: "not_started", label: "Not started" },
            { value: "overdue", label: "Overdue" },
          ]}
        />
        <FilterSelect
          label="Risk"
          value={risk}
          onValueChange={setRisk}
          allLabel="Any risk"
          width="w-[150px]"
          options={[
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
        />
        <span className="tnum ml-auto text-xs text-muted-foreground">
          {filtered.length} of {filings.length} filings
        </span>
      </div>

      {view === "table" ? (
        <Section title="Filings" bodyClassName="p-4">
          <DataTable
            columns={columns}
            data={filtered}
            searchKeys={["name", "shortName", "authority", "period"]}
            searchPlaceholder="Search filings…"
            exportName="compliance-calendar"
            getRowId={(f) => f.id}
            onRowClick={(f) => setDetail(f)}
            pageSize={15}
            emptyIcon={Landmark}
            emptyTitle="No filings match"
            emptyDescription="Clear a filter to see the rest of the calendar."
            rowTone={(f) =>
              f.status === "overdue" ? "danger" : f.status === "due_soon" ? "warning" : undefined
            }
          />
        </Section>
      ) : (
        <Section
          title="Timeline"
          description="Filings grouped by the month they fall due. Overdue items surface first."
          bodyClassName="p-0"
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nothing in this view"
              description="Clear a filter to populate the timeline."
              className="border-0"
            />
          ) : (
            <ul>
              {MONTHS.map((m) => {
                const inMonth = filtered
                  .filter((f) => f.dueDate.slice(0, 7) === m)
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
                if (inMonth.length === 0) return null;
                return (
                  <li key={m} className="border-b border-border last:border-0">
                    <div className="flex items-center gap-2 bg-subtle px-4 py-1.5">
                      <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden />
                      <span className="text-xs font-semibold">
                        {new Date(m + "-01T00:00:00").toLocaleString("en-IN", {
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <span className="tnum ml-auto text-[11px] text-muted-foreground">
                        {inMonth.length} filing{inMonth.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <ul>
                      {inMonth.map((f) => (
                        <li
                          key={f.id}
                          className={cn(
                            "flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5",
                            f.status === "overdue" && "bg-destructive-soft/30",
                            f.status === "due_soon" && "bg-warning-soft/30",
                          )}
                        >
                          <div className="flex w-11 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-card py-1">
                            <span className="tnum text-xs font-bold leading-none">
                              {f.dueDate.slice(8)}
                            </span>
                            <span className="text-[8px] uppercase leading-none text-muted-foreground">
                              {new Date(f.dueDate + "T00:00:00").toLocaleString("en-IN", {
                                month: "short",
                              })}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDetail(f)}
                            className="min-w-[200px] flex-1 text-left focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <p className="text-xs font-medium">{f.shortName}</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {f.authority} · {f.period} · {employeeName(f.ownerCode)}
                            </p>
                          </button>
                          <span className="tnum shrink-0 text-xs font-medium">
                            {f.amount ? inr(f.amount, { decimals: false }) : "—"}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0",
                              f.penaltyRisk === "high" && "border-destructive/30 text-destructive-fg",
                              f.penaltyRisk === "medium" && "border-warning/30 text-warning-fg",
                            )}
                          >
                            {PENALTY_RISK_LABEL[f.penaltyRisk]} risk
                          </Badge>
                          <StatusBadge status={f.status} />
                          {f.status !== "filed" && (
                            <Gated menuKey="admin.compliance" action="E">
                              <Button size="sm" onClick={() => setConfirm(f)}>
                                Mark filed
                              </Button>
                            </Gated>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      )}

      <DonutChart
        title="Filings by status"
        description="The whole statutory calendar at a glance."
        data={COMPLIANCE_BY_STATUS}
        centreValue={num(filings.length)}
        centreLabel="filings"
        height={250}
      />

      {/* ------------------------------------------------- detail drawer */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" width="sm:max-w-md">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.shortName}</SheetTitle>
                <SheetDescription>{detail.name}</SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-3">
                {detail.status === "overdue" && (
                  <Alert tone="danger" icon={AlertTriangle} title="Overdue">
                    {detail.penaltyNote}
                  </Alert>
                )}

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {[
                    ["Authority", detail.authority],
                    ["Country", detail.country === "IN" ? "India" : "United States"],
                    ["Category", detail.category],
                    ["Period", detail.period],
                    ["Due date", fmtDate(detail.dueDate)],
                    ["Owner", employeeName(detail.ownerCode)],
                    ["Amount", detail.amount ? inr(detail.amount) : "—"],
                    ["Penalty risk", PENALTY_RISK_LABEL[detail.penaltyRisk]],
                    ["Filed on", detail.filedOn ? fmtDate(detail.filedOn) : "Not filed"],
                    ["Reference", detail.filingRef ?? "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                      <dd className="tnum mt-0.5 break-all text-xs font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="rounded-md border border-border bg-subtle p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">{detail.notes}</p>
                </div>

                <div className="rounded-md border border-border bg-subtle p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    If this is missed
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">{detail.penaltyNote}</p>
                </div>

                <div className="mt-1 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      mockAction("Reminder sent", {
                        description: `${employeeName(detail.ownerCode)} has been reminded about ${detail.shortName} (${detail.period}).`,
                      })
                    }
                  >
                    Remind owner
                  </Button>
                  {detail.status !== "filed" && (
                    <Gated menuKey="admin.compliance" action="E">
                      <Button size="sm" className="flex-1" onClick={() => setConfirm(detail)}>
                        <Check /> Mark filed
                      </Button>
                    </Gated>
                  )}
                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Mark this filing as filed?"
        description={
          confirm
            ? `${confirm.name} for ${confirm.period} will be recorded as filed with ${confirm.authority} today. An acknowledgement reference is generated and written to the audit trail.`
            : undefined
        }
        confirmLabel="Mark filed"
        onConfirm={() => confirm && markFiled(confirm)}
      />
    </PageBody>
  );
}
