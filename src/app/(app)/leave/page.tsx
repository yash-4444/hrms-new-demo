"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarPlus, CalendarRange, Inbox, Plane, RotateCcw, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateShort } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import {
  LEAVE_FY,
  LEAVE_TYPES,
  LEAVE_TYPE_BY_CODE,
  LEDGER_KIND_LABEL,
  applicationsFor,
  balancesFor,
  leaveMarkOn,
  ledgerFor,
  LEAVE_EMPLOYEE_CODES,
  type LeaveApplication,
  type LeaveBalance,
  type LeaveLedgerRow,
} from "@/mock/leave";
import { mockAction } from "@/components/app-state";
import { useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { DonutChart, ProgressRing } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert, Badge, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import {
  CardsSkeleton,
  ChartSkeleton,
  Gated,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";
import { ApplyLeaveDialog } from "@/components/leave/apply-leave-dialog";
import { LeaveDetailSheet } from "@/components/leave/leave-detail-sheet";

/* ============================================================================
   /leave — my balances, my applications and the ledger they are derived from.
   ========================================================================== */

export default function MyLeavePage() {
  return (
    <React.Suspense fallback={<LeaveFallback />}>
      <MyLeaveScreen />
    </React.Suspense>
  );
}

function LeaveFallback() {
  return (
    <PageBody>
      <PageHeader title="My Leave" description={`Balances, applications and the full transaction ledger for ${LEAVE_FY}.`} />
      <CardsSkeleton count={4} height={132} />
      <TableSkeleton />
    </PageBody>
  );
}

function MyLeaveScreen() {
  const search = useSearchParams();
  const { persona } = useApp();
  const loading = useFakeLoad();

  /* The persona switcher changes who "me" is without a reload. */
  const employeeCode = LEAVE_EMPLOYEE_CODES.includes(persona.employeeId)
    ? persona.employeeId
    : LEAVE_EMPLOYEE_CODES[0];

  const [applications, setApplications] = React.useState<LeaveApplication[]>([]);
  const [tab, setTab] = React.useState("applications");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [ledgerType, setLedgerType] = React.useState("all");
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [prefill, setPrefill] = React.useState<Record<string, unknown> | null>(null);
  const [detail, setDetail] = React.useState<LeaveApplication | null>(null);
  const [withdrawing, setWithdrawing] = React.useState<LeaveApplication | null>(null);

  React.useEffect(() => {
    setApplications(applicationsFor(employeeCode));
    setStatusFilter("all");
    setLedgerType("all");
  }, [employeeCode]);

  /* The command palette links to /leave?apply=1 — open straight into the form. */
  React.useEffect(() => {
    if (search.get("apply") === "1") setApplyOpen(true);
  }, [search]);

  const baseBalances = React.useMemo(() => balancesFor(employeeCode), [employeeCode]);
  const ledger = React.useMemo(() => ledgerFor(employeeCode), [employeeCode]);

  /* Pending days come from live state so a request raised in the demo shows up
     on the balance card immediately. */
  const balances: LeaveBalance[] = React.useMemo(
    () =>
      baseBalances.map((b) => ({
        ...b,
        pending:
          Math.round(
            applications
              .filter((a) => a.status === "pending" && a.typeCode === b.typeCode)
              .reduce((acc, a) => acc + a.days, 0) * 100,
          ) / 100,
      })),
    [baseBalances, applications],
  );

  const cards = balances.filter((b) => LEAVE_TYPE_BY_CODE[b.typeCode]?.showOnCards || b.used > 0);

  const takenByType = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const a of applications) {
      if (a.status !== "approved") continue;
      map.set(a.typeName, Math.round(((map.get(a.typeName) ?? 0) + a.days) * 100) / 100);
    }
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [applications]);

  const daysTaken = takenByType.reduce((a, b) => a + b.value, 0);
  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const elBalance = balances.find((b) => b.typeCode === "EL");
  const onLeaveToday = LEAVE_EMPLOYEE_CODES.filter(
    (c) => c !== employeeCode && leaveMarkOn(c, DEMO_TODAY)?.status === "approved",
  ).length;
  const nextLeave = applications
    .filter((a) => (a.status === "approved" || a.status === "pending") && a.fromDate >= DEMO_TODAY)
    .sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1))[0];

  const visibleApplications = React.useMemo(
    () => (statusFilter === "all" ? applications : applications.filter((a) => a.status === statusFilter)),
    [applications, statusFilter],
  );

  const visibleLedger = React.useMemo(
    () => (ledgerType === "all" ? ledger : ledger.filter((r) => r.typeCode === ledgerType)),
    [ledger, ledgerType],
  );

  const openLedgerFor = (typeCode: string) => {
    setLedgerType(typeCode);
    setTab("ledger");
  };

  const withdraw = (app: LeaveApplication) => {
    setApplications((prev) =>
      prev.map((a) =>
        a.id === app.id
          ? { ...a, status: "withdrawn", decidedOn: DEMO_TODAY, decisionComment: "Withdrawn by the applicant." }
          : a,
      ),
    );
    setDetail(null);
    mockAction("Request withdrawn", {
      description: `${app.id} · ${app.days} day${app.days === 1 ? "" : "s"} of ${app.typeName} released back to your balance.`,
    });
  };

  const reapply = (app: LeaveApplication) => {
    setPrefill({
      typeCode: app.typeCode,
      fromDate: app.fromDate,
      toDate: app.toDate,
      reason: app.reason,
      halfDayFirst: app.halfDayFirst,
      halfDaySecond: app.halfDaySecond,
      halfDaySession: app.halfDaySession ?? "first_half",
      documentName: app.documentName ?? "",
      contactNumber: app.contactNumber,
    });
    setDetail(null);
    setApplyOpen(true);
  };

  const appColumns = React.useMemo<ColumnDef<LeaveApplication, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Reference",
        cell: ({ row }) => <span className="font-medium">{row.original.id}</span>,
      },
      {
        accessorKey: "typeName",
        header: "Type",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <Badge variant="muted">{row.original.typeCode}</Badge>
            {row.original.typeName}
          </span>
        ),
      },
      {
        id: "dates",
        header: "Dates",
        accessorFn: (r) => r.fromDate,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {fmtDateShort(row.original.fromDate)} → {fmtDate(row.original.toDate)}
          </span>
        ),
      },
      {
        accessorKey: "days",
        header: "Days",
        cell: ({ row }) => <NumCell>{row.original.days}</NumCell>,
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="block max-w-[260px] truncate text-muted-foreground" title={row.original.reason}>
            {row.original.reason}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "appliedOn",
        header: "Applied",
        cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{fmtDate(row.original.appliedOn)}</span>,
      },
      {
        accessorKey: "approverName",
        header: "Approver",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.approverName}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {a.status === "pending" && (
                <Gated menuKey="my.leave" action="D">
                  <Button variant="ghost" size="sm" onClick={() => setWithdrawing(a)}>
                    <Undo2 /> Withdraw
                  </Button>
                </Gated>
              )}
              {(a.status === "sent_back" || a.status === "rejected") && (
                <Gated menuKey="my.leave" action="C">
                  <Button variant="ghost" size="sm" onClick={() => reapply(a)}>
                    <RotateCcw /> Reapply
                  </Button>
                </Gated>
              )}
              <Button variant="ghost" size="sm" onClick={() => setDetail(a)}>
                View
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const ledgerColumns = React.useMemo<ColumnDef<LeaveLedgerRow, unknown>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => <span className="whitespace-nowrap">{fmtDate(row.original.date)}</span>,
      },
      {
        accessorKey: "typeCode",
        header: "Type",
        cell: ({ row }) => <Badge variant="muted">{row.original.typeCode}</Badge>,
      },
      {
        accessorKey: "kind",
        header: "Transaction",
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-medium">{LEDGER_KIND_LABEL[row.original.kind]}</span>
        ),
      },
      {
        accessorKey: "narrative",
        header: "Narrative",
        cell: ({ row }) => (
          <span className="block max-w-[340px] truncate text-muted-foreground" title={row.original.narrative}>
            {row.original.narrative}
          </span>
        ),
      },
      {
        accessorKey: "reference",
        header: "Reference",
        cell: ({ row }) => <span className="font-mono text-[11px] text-muted-foreground">{row.original.reference}</span>,
      },
      {
        accessorKey: "credit",
        header: "Credit",
        cell: ({ row }) => (
          <NumCell className={row.original.credit ? "text-success-fg" : "text-muted-foreground"}>
            {row.original.credit ? `+${row.original.credit}` : "—"}
          </NumCell>
        ),
      },
      {
        accessorKey: "debit",
        header: "Debit",
        cell: ({ row }) => (
          <NumCell className={row.original.debit ? "text-destructive-fg" : "text-muted-foreground"}>
            {row.original.debit ? `−${row.original.debit}` : "—"}
          </NumCell>
        ),
      },
      {
        accessorKey: "balance",
        header: "Balance",
        cell: ({ row }) => <NumCell className="font-semibold">{row.original.balance}</NumCell>,
      },
    ],
    [],
  );

  const employee = employeeByCode(employeeCode);

  return (
    <PageBody>
      <PageHeader
        title="My Leave"
        description={
          <>
            {employee?.name ?? persona.name} · {LEAVE_FY} · balances as on {fmtDate(DEMO_TODAY)}. Every figure
            below is derived from the ledger, so the cards and the running balance always agree.
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/leave/calendar">
                <CalendarRange /> Team calendar
              </Link>
            </Button>
            <Gated menuKey="my.leave" action="C">
              <Button
                size="sm"
                onClick={() => {
                  setPrefill(null);
                  setApplyOpen(true);
                }}
              >
                <CalendarPlus /> Apply for leave
              </Button>
            </Gated>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton count={4} height={132} />
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile
              label="Days taken this FY"
              value={<span className="tnum">{daysTaken}</span>}
              hint={`${applications.filter((a) => a.status === "approved").length} approved requests`}
              icon={Plane}
              tone="accent"
              onClick={() => openLedgerFor("all")}
            />
            <StatTile
              label="Awaiting approval"
              value={<span className="tnum">{pendingCount}</span>}
              hint={pendingCount ? "Sitting with your reporting manager" : "Nothing in the queue"}
              icon={Inbox}
              tone={pendingCount ? "warning" : "neutral"}
              onClick={() => {
                setTab("applications");
                setStatusFilter("pending");
              }}
            />
            <StatTile
              label="Earned Leave available"
              value={<span className="tnum">{elBalance?.available ?? 0}</span>}
              hint={`Accrues ${LEAVE_TYPE_BY_CODE.EL.accrualPerMonth} days a month`}
              icon={CalendarPlus}
              tone="neutral"
              onClick={() => openLedgerFor("EL")}
            />
            <StatTile
              label="Colleagues on leave today"
              value={<span className="tnum">{onLeaveToday}</span>}
              hint={nextLeave ? `Your next leave: ${fmtDate(nextLeave.fromDate)}` : "No upcoming leave booked"}
              icon={CalendarRange}
              tone="neutral"
              href="/leave/calendar"
            />
          </StatRow>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((b) => (
              <BalanceCard key={b.typeCode} balance={b} onOpenLedger={() => openLedgerFor(b.typeCode)} />
            ))}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Section
            title="My requests and ledger"
            description="Applications you have raised, and every transaction that moved a balance this year."
            bodyClassName="pt-3"
            actions={
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="applications">Applications</TabsTrigger>
                  <TabsTrigger value="ledger">Ledger</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          >
            <Tabs value={tab} onValueChange={setTab}>
              <TabsContent value="applications" className="mt-0">
                {loading ? (
                  <TableSkeleton />
                ) : (
                  <DataTable<LeaveApplication>
                    columns={appColumns}
                    data={visibleApplications}
                    getRowId={(r) => r.id}
                    searchKeys={["id", "typeName", "reason"]}
                    searchPlaceholder="Search reference or reason…"
                    exportName="my-leave-applications"
                    pageSize={10}
                    dense
                    onRowClick={(r) => setDetail(r)}
                    emptyIcon={Inbox}
                    emptyTitle={statusFilter === "all" ? "No leave applied for yet" : "Nothing with that status"}
                    emptyDescription={
                      statusFilter === "all"
                        ? "Apply for your first leave of the year — balances update the moment it is approved."
                        : "Clear the status filter to see the rest of your requests."
                    }
                    emptyAction={
                      <Button size="sm" onClick={() => (statusFilter === "all" ? setApplyOpen(true) : setStatusFilter("all"))}>
                        {statusFilter === "all" ? "Apply for leave" : "Clear filter"}
                      </Button>
                    }
                    filters={
                      <FilterSelect
                        label="Status"
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                        allLabel="All statuses"
                        options={[
                          { value: "pending", label: "Pending" },
                          { value: "approved", label: "Approved" },
                          { value: "rejected", label: "Rejected" },
                          { value: "sent_back", label: "Sent back" },
                          { value: "cancelled", label: "Cancelled" },
                          { value: "withdrawn", label: "Withdrawn" },
                        ]}
                      />
                    }
                  />
                )}
              </TabsContent>

              <TabsContent value="ledger" className="mt-0">
                {loading ? (
                  <TableSkeleton />
                ) : (
                  <div className="flex flex-col gap-2">
                    <DataTable<LeaveLedgerRow>
                      columns={ledgerColumns}
                      data={visibleLedger}
                      getRowId={(r) => r.id}
                      searchKeys={["narrative", "reference"]}
                      searchPlaceholder="Search narrative or reference…"
                      exportName="my-leave-ledger"
                      pageSize={15}
                      dense
                      emptyIcon={Inbox}
                      emptyTitle="No transactions for this leave type"
                      emptyDescription="Switch the type filter — accruals, grants, applications, adjustments and lapses all land here."
                      filters={
                        <FilterSelect
                          label="Type"
                          value={ledgerType}
                          onValueChange={setLedgerType}
                          allLabel="All types"
                          options={LEAVE_TYPES.filter((t) =>
                            ledger.some((r) => r.typeCode === t.code),
                          ).map((t) => ({ value: t.code, label: t.name }))}
                        />
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      The running balance is kept per leave type. With “All types” selected the rows are grouped
                      by type and then ordered by date, so each type’s last row equals the Available figure on
                      its card above.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Section>
        </div>

        <div className="flex flex-col gap-3">
          {loading ? (
            <ChartSkeleton height={200} />
          ) : takenByType.length ? (
            <DonutChart
              title="Leave taken by type"
              description={`Approved days across ${LEAVE_FY}, split by leave type.`}
              data={takenByType}
              height={210}
              valueFormat={(v) => `${v} d`}
              centreValue={String(daysTaken)}
              centreLabel="days taken"
              onSliceClick={(row) => {
                const code = LEAVE_TYPES.find((t) => t.name === row.name)?.code;
                if (code) openLedgerFor(code);
              }}
              footnote="Click a slice to open that type's ledger."
            />
          ) : (
            <Card className="p-4">
              <EmptyState
                icon={Plane}
                title="No leave taken yet this year"
                description="Once a request is approved it appears here, split by leave type."
                className="border-0 py-6"
              />
            </Card>
          )}

          <Section title="How your balance is built" bodyClassName="p-0">
            <ul className="divide-y divide-border text-xs">
              {[
                ["Opening", "Annual Casual and Sick Leave entitlement, credited on 01 Apr."],
                ["Carry forward", `Earned Leave brought in from FY 2025-26, capped at ${LEAVE_TYPE_BY_CODE.EL.maxCarryForward} days.`],
                ["Accrued", `${LEAVE_TYPE_BY_CODE.EL.accrualPerMonth} days of Earned Leave for every completed month.`],
                ["Used", "Days debited by approved applications only — pending requests do not reduce the balance."],
                ["Adjusted", "HR corrections, both ways, always with a narrative."],
                ["Encashed / lapsed", "Paid out with payroll, or expired under the carry-forward and comp-off rules."],
              ].map(([k, v]) => (
                <li key={k} className="flex gap-3 px-4 py-2">
                  <span className="w-28 shrink-0 font-medium">{k}</span>
                  <span className="text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      {!loading && cards.length === 0 && (
        <Alert tone="info">No leave plan is mapped to this employee yet. Ask HR to assign a leave policy.</Alert>
      )}

      <ApplyLeaveDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        employeeCode={employeeCode}
        prefill={prefill as never}
        onSubmitted={(app) => {
          setApplications((prev) => [app, ...prev]);
          setTab("applications");
          setStatusFilter("all");
        }}
      />

      <LeaveDetailSheet
        application={detail}
        onOpenChange={(v) => !v && setDetail(null)}
        actions={(app) =>
          app.status === "pending" ? (
            <Gated menuKey="my.leave" action="D">
              <Button size="sm" variant="destructive" onClick={() => setWithdrawing(app)}>
                <Undo2 /> Withdraw
              </Button>
            </Gated>
          ) : app.status === "sent_back" || app.status === "rejected" ? (
            <Gated menuKey="my.leave" action="C">
              <Button size="sm" onClick={() => reapply(app)}>
                <RotateCcw /> Reapply
              </Button>
            </Gated>
          ) : null
        }
      />

      <ConfirmDialog
        open={!!withdrawing}
        onOpenChange={(v) => !v && setWithdrawing(null)}
        title="Withdraw this leave request?"
        description={
          withdrawing
            ? `${withdrawing.id} · ${withdrawing.days} day${withdrawing.days === 1 ? "" : "s"} of ${withdrawing.typeName}, ${fmtDate(withdrawing.fromDate)} to ${fmtDate(withdrawing.toDate)}. ${withdrawing.approverName} will be notified and the days stay in your balance.`
            : undefined
        }
        confirmLabel="Withdraw request"
        destructive
        onConfirm={() => {
          if (withdrawing) withdraw(withdrawing);
          setWithdrawing(null);
        }}
      />
    </PageBody>
  );
}

/* ---------------------------------------------------------- balance card */

function BalanceCard({ balance, onOpenLedger }: { balance: LeaveBalance; onOpenLedger: () => void }) {
  const type = LEAVE_TYPE_BY_CODE[balance.typeCode];
  const credited = Math.round((balance.opening + balance.accrued + balance.carryForward + Math.max(0, balance.adjusted)) * 100) / 100;
  const ringMax = credited || type?.annualQuota || 1;
  const tone = balance.available <= 1 ? "critical" : balance.available <= 3 ? "warning" : "accent";

  return (
    <button
      type="button"
      onClick={onOpenLedger}
      className={cn(
        "group flex flex-col rounded-md border border-border bg-card p-3 text-left transition-colors",
        "hover:border-primary/40 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      aria-label={`${type?.name ?? balance.typeCode} — ${balance.available} days available. Open the ledger.`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Badge variant="muted">{balance.typeCode}</Badge>
            <span className="truncate">{type?.name ?? balance.typeCode}</span>
          </p>
          <p className="tnum mt-1.5 text-2xl font-semibold leading-none tracking-tight">{balance.available}</p>
          <p className="mt-1 text-xs text-muted-foreground">days available</p>
        </div>
        <ProgressRing
          value={balance.used}
          max={ringMax}
          size={54}
          thickness={6}
          tone={tone}
          label={<span className="tnum">{balance.used}</span>}
          sublabel="used"
        />
      </div>

      <dl className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border pt-2.5">
        {[
          ["Accrued", balance.accrued + balance.opening],
          ["Used", balance.used],
          ["Carried", balance.carryForward],
        ].map(([k, v]) => (
          <div key={k as string}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="tnum text-xs font-semibold">{v as number}</dd>
          </div>
        ))}
      </dl>

      {(balance.pending > 0 || balance.encashed > 0 || balance.lapsed > 0) && (
        <p className="mt-2 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
          {balance.pending > 0 && <span className="text-warning-fg">{balance.pending} awaiting approval</span>}
          {balance.encashed > 0 && <span>{balance.encashed} encashed</span>}
          {balance.lapsed > 0 && <span>{balance.lapsed} lapsed</span>}
        </p>
      )}
    </button>
  );
}
