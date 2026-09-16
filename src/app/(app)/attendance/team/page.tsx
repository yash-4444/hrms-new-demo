"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BellRing,
  CheckCheck,
  ClipboardCheck,
  Clock,
  Lock,
  LockOpen,
  Plane,
  TimerOff,
  TriangleAlert,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import { fmtDate, fmtTime, hm, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Avatar, Alert, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { mockAction, useApp } from "@/components/app-state";
import {
  CardsSkeleton,
  ChartSkeleton,
  Gated,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { BarCompareChart } from "@/components/charts";
import { DayDetailSheet, type DayDetail } from "@/components/attendance/day-detail-sheet";
import {
  AMENDMENTS,
  DEPT_PUNCTUALITY_30D,
  FINALISATION_ROWS,
  OVERTIME_REPORT_30D,
  TEAM_DAY_BOARD,
  amendmentTypeLabel,
  attendanceOn,
  type Amendment,
  type FinalisationRow,
  type FinalisationStatus,
  type OvertimeRow,
  type TeamDayRow,
} from "@/mock/attendance";
import { DEMO_TODAY, DEPARTMENTS } from "@/mock/org";
import { reporteesOf } from "@/mock/employees";

const SHORT_DEPT: Record<string, string> = {
  "Customer Success": "Cust. Success",
  "Human Resources": "Human Res.",
  "IT & Operations": "IT & Ops",
};

const STATE_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "overtime", label: "Overtime" },
  { value: "half_day", label: "Half day" },
  { value: "absent", label: "Absent" },
  { value: "leave", label: "On leave" },
  { value: "late", label: "Late arrivals" },
];

export default function TeamAttendancePage() {
  const loading = useFakeLoad();
  const { persona, role } = useApp();

  const scoped = role === "manager" || role === "employee";
  const [scope, setScope] = React.useState<"team" | "all">(scoped ? "team" : "all");
  const [dept, setDept] = React.useState("all");
  const [branch, setBranch] = React.useState("all");
  const [state, setState] = React.useState("all");
  const [detail, setDetail] = React.useState<DayDetail | null>(null);
  const [finaliseOpen, setFinaliseOpen] = React.useState(false);

  /* In-memory overrides — bulk approve and per-row actions land here. */
  const [approvals, setApprovals] = React.useState<Record<string, FinalisationStatus>>({});
  const [queue, setQueue] = React.useState<Amendment[]>([]);
  const [finalisation, setFinalisation] = React.useState<FinalisationRow[]>(FINALISATION_ROWS);
  const [otApproved, setOtApproved] = React.useState<Record<string, boolean>>({});

  const reporteeCodes = React.useMemo(
    () => new Set(reporteesOf(persona.employeeId).map((e) => e.code)),
    [persona.employeeId],
  );

  React.useEffect(() => {
    const pending = AMENDMENTS.filter((a) => a.status === "pending");
    setQueue(
      role === "manager"
        ? pending.filter((a) => a.approverCode === persona.employeeId)
        : pending,
    );
  }, [role, persona.employeeId]);

  const board: TeamDayRow[] = React.useMemo(() => {
    const base =
      scope === "team"
        ? TEAM_DAY_BOARD.filter((r) => reporteeCodes.has(r.code))
        : TEAM_DAY_BOARD;
    return base.map((r) => ({ ...r, approval: approvals[r.code] ?? r.approval }));
  }, [scope, reporteeCodes, approvals]);

  const rows = React.useMemo(
    () =>
      board.filter((r) => {
        if (dept !== "all" && r.departmentId !== dept) return false;
        if (branch !== "all" && r.branchId !== branch) return false;
        if (state === "late") return r.late;
        if (state !== "all" && r.state !== state) return false;
        return true;
      }),
    [board, dept, branch, state],
  );

  const totals = React.useMemo(() => {
    const t = { present: 0, late: 0, absent: 0, leave: 0, pending: 0, overtime: 0 };
    for (const r of board) {
      if (r.state === "present" || r.state === "overtime") t.present += 1;
      if (r.state === "overtime") t.overtime += 1;
      if (r.late) t.late += 1;
      if (r.state === "absent") t.absent += 1;
      if (r.state === "leave") t.leave += 1;
      if (r.approval === "pending") t.pending += 1;
    }
    return t;
  }, [board]);

  const deptChart = React.useMemo(() => {
    const visible = new Set(board.map((r) => r.department));
    return DEPT_PUNCTUALITY_30D.filter((d) => visible.has(String(d.department)));
  }, [board]);

  const branches = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const r of TEAM_DAY_BOARD) m.set(r.branchId, r.branch);
    return [...m].map(([value, label]) => ({ value, label }));
  }, []);

  const openRow = (r: TeamDayRow) =>
    setDetail({
      date: DEMO_TODAY,
      state: r.state,
      record: attendanceOn(r.code, DEMO_TODAY),
      employeeName: r.name,
      employeeCode: r.code,
    });

  const approveCodes = (codes: string[], label: string) => {
    setApprovals((a) => ({ ...a, ...Object.fromEntries(codes.map((c) => [c, "approved" as const])) }));
    mockAction(`${codes.length} ${label} approved`, {
      description: `${fmtDate(DEMO_TODAY)} · approved by ${persona.name}. Nothing is persisted in the demo.`,
    });
  };

  const boardColumns = React.useMemo<ColumnDef<TeamDayRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Employee",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={row.original.name} size={22} />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.original.name}</p>
              <p className="tnum truncate text-[11px] text-muted-foreground">
                {row.original.code} · {row.original.designation}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => <MutedCell>{row.original.department}</MutedCell>,
      },
      {
        accessorKey: "branch",
        header: "Branch",
        cell: ({ row }) => <MutedCell>{row.original.branch}</MutedCell>,
      },
      {
        accessorKey: "state",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-1">
            <StatusBadge status={row.original.state} />
            {row.original.late && (
              <StatusBadge status="late" label={`+${row.original.lateByMinutes}m`} />
            )}
          </div>
        ),
      },
      {
        id: "in",
        header: "In",
        accessorFn: (r) => (r.firstIn ? fmtTime(r.firstIn) : "—"),
        cell: ({ row }) => (
          <span className="tnum">{row.original.firstIn ? fmtTime(row.original.firstIn) : "—"}</span>
        ),
      },
      {
        id: "out",
        header: "Out",
        accessorFn: (r) => (r.lastOut ? fmtTime(r.lastOut) : r.inProgress ? "running" : "—"),
        cell: ({ row }) => (
          <span className="tnum">
            {row.original.lastOut
              ? fmtTime(row.original.lastOut)
              : row.original.inProgress
                ? "running"
                : "—"}
          </span>
        ),
      },
      {
        accessorKey: "workedMinutes",
        header: "Worked",
        cell: ({ row }) => <NumCell>{hm(row.original.workedMinutes)}</NumCell>,
      },
      {
        accessorKey: "approval",
        header: "Approval",
        cell: ({ row }) => <StatusBadge status={row.original.approval} />,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Gated menuKey="team.attendance" action="A">
              <Button
                variant="outline"
                size="sm"
                disabled={row.original.approval === "approved"}
                onClick={(e) => {
                  e.stopPropagation();
                  approveCodes([row.original.code], "day record");
                }}
              >
                Approve
              </Button>
            </Gated>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                openRow(row.original);
              }}
            >
              View
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persona.name],
  );

  const queueColumns = React.useMemo<ColumnDef<Amendment, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Request", cell: ({ row }) => <span className="tnum font-medium">{row.original.id}</span> },
      {
        accessorKey: "employeeName",
        header: "Employee",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar name={row.original.employeeName} size={20} />
            <span className="font-medium">{row.original.employeeName}</span>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <MutedCell>{amendmentTypeLabel(row.original.type)}</MutedCell>,
      },
      { id: "date", header: "For date", accessorFn: (a) => a.date, cell: ({ row }) => <span className="tnum">{fmtDate(row.original.date)}</span> },
      {
        id: "proposed",
        header: "Proposed",
        accessorFn: (a) => a.proposedIn ?? "",
        cell: ({ row }) => (
          <span className="tnum">
            {row.original.proposedIn ? fmtTime(row.original.proposedIn) : "—"} –{" "}
            {row.original.proposedOut ? fmtTime(row.original.proposedOut) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-[280px] text-muted-foreground">{row.original.reason}</span>
        ),
      },
      {
        id: "decide",
        header: "Decision",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Gated menuKey="team.attendance" action="A">
              <Button
                size="sm"
                onClick={() => {
                  setQueue((q) => q.filter((a) => a.id !== row.original.id));
                  mockAction(`${row.original.id} approved`, {
                    description: `${row.original.employeeName} · ${fmtDate(row.original.date)} · the punch pair has been written to the day record.`,
                  });
                }}
              >
                Approve
              </Button>
            </Gated>
            <Gated menuKey="team.attendance" action="A">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQueue((q) => q.filter((a) => a.id !== row.original.id));
                  mockAction(`${row.original.id} rejected`, {
                    tone: "warning",
                    description: "The employee has been notified and can raise a fresh request.",
                  });
                }}
              >
                Reject
              </Button>
            </Gated>
          </div>
        ),
      },
    ],
    [],
  );

  const finalisationColumns = React.useMemo<ColumnDef<FinalisationRow, unknown>[]>(
    () => [
      { accessorKey: "label", header: "Date", cell: ({ row }) => <span className="font-medium">{row.original.label}</span> },
      { accessorKey: "headcount", header: "In scope", cell: ({ row }) => <NumCell>{num(row.original.headcount)}</NumCell> },
      { accessorKey: "marked", header: "Marked", cell: ({ row }) => <NumCell>{num(row.original.marked)}</NumCell> },
      {
        accessorKey: "exceptions",
        header: "Exceptions",
        cell: ({ row }) => (
          <NumCell className={row.original.exceptions > 0 ? "text-destructive-fg" : undefined}>
            {num(row.original.exceptions)}
          </NumCell>
        ),
      },
      { accessorKey: "overtimeHours", header: "OT hours", cell: ({ row }) => <NumCell>{row.original.overtimeHours.toFixed(1)}</NumCell> },
      { accessorKey: "finalisedBy", header: "Finalised by", cell: ({ row }) => <MutedCell>{row.original.finalisedBy}</MutedCell> },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={String(row.original.status)} /> },
      {
        id: "act",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          /* pending -> approved -> locked -> (reopen) -> pending */
          const next: "pending" | "approved" | "locked" =
            r.status === "pending" ? "approved" : r.status === "approved" ? "locked" : "pending";
          const label = r.status === "pending" ? "Finalise" : r.status === "approved" ? "Lock" : "Reopen";
          const Icon = r.status === "locked" ? LockOpen : Lock;
          return (
            <Gated menuKey="team.attendance" action="X">
              <Button
                variant={r.status === "locked" ? "outline" : "default"}
                size="sm"
                onClick={() => {
                  setFinalisation((rowsv) =>
                    rowsv.map((x) =>
                      x.date === r.date
                        ? { ...x, status: next, finalisedBy: next === "pending" ? "—" : persona.name }
                        : x,
                    ),
                  );
                  mockAction(`${r.label} — ${label.toLowerCase()}d`, {
                    description:
                      next === "locked"
                        ? "The day is locked; payroll can now consume it."
                        : next === "approved"
                          ? `${r.exceptions} exception${r.exceptions === 1 ? "" : "s"} carried forward as loss of pay.`
                          : "Reopened for corrections.",
                  });
                }}
              >
                <Icon /> {label}
              </Button>
            </Gated>
          );
        },
      },
    ],
    [persona.name],
  );

  const overtimeColumns = React.useMemo<ColumnDef<OvertimeRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Employee",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar name={String(row.original.name)} size={20} />
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="tnum text-[11px] text-muted-foreground">{row.original.code}</p>
            </div>
          </div>
        ),
      },
      { accessorKey: "department", header: "Department", cell: ({ row }) => <MutedCell>{row.original.department}</MutedCell> },
      { accessorKey: "branch", header: "Branch", cell: ({ row }) => <MutedCell>{row.original.branch}</MutedCell> },
      { accessorKey: "otDays", header: "OT days", cell: ({ row }) => <NumCell>{num(Number(row.original.otDays))}</NumCell> },
      { accessorKey: "otHours", header: "OT hours", cell: ({ row }) => <NumCell>{Number(row.original.otHours).toFixed(1)}</NumCell> },
      { accessorKey: "avgDailyHours", header: "Avg day", cell: ({ row }) => <NumCell>{Number(row.original.avgDailyHours).toFixed(1)} h</NumCell> },
      { accessorKey: "lateDays", header: "Late days", cell: ({ row }) => <NumCell>{num(Number(row.original.lateDays))}</NumCell> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={otApproved[String(row.original.code)] ? "approved" : String(row.original.status)} />
        ),
      },
      {
        id: "act",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const code = String(row.original.code);
          const done = otApproved[code] || row.original.status === "approved";
          return (
            <Gated menuKey="team.attendance" action="A">
              <Button
                variant="outline"
                size="sm"
                disabled={done}
                onClick={() => {
                  setOtApproved((s) => ({ ...s, [code]: true }));
                  mockAction(`Overtime approved for ${row.original.name}`, {
                    description: `${Number(row.original.otHours).toFixed(1)} h across ${row.original.otDays} days — released to the September pay run.`,
                  });
                }}
              >
                Approve OT
              </Button>
            </Gated>
          );
        },
      },
    ],
    [otApproved],
  );

  const scopeLabel = scope === "team" ? `${persona.name}’s 8 reportees` : "every employee with punch data";

  return (
    <PageBody>
      <PageHeader
        title="Team Attendance"
        description={`Day board for ${fmtDate(DEMO_TODAY)} — ${scopeLabel}. Statuses update live as the day progresses.`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                mockAction("Reminder sent", {
                  description: `${totals.absent} employee${totals.absent === 1 ? "" : "s"} with no punch were nudged on email and Slack.`,
                })
              }
            >
              <BellRing /> Nudge unmarked
            </Button>
            <Gated menuKey="team.attendance" action="X">
              <Button size="sm" onClick={() => setFinaliseOpen(true)}>
                <Lock /> Finalise the day
              </Button>
            </Gated>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton count={5} />
      ) : (
        <StatRow cols={5}>
          <StatTile
            label="Present today"
            value={`${totals.present} / ${board.length}`}
            icon={UserRoundCheck}
            tone="good"
            hint="Includes overtime and half days in progress"
            onClick={() => setState(state === "present" ? "all" : "present")}
          />
          <StatTile
            label="Late arrivals"
            value={totals.late}
            icon={Clock}
            tone={totals.late > 0 ? "warning" : "neutral"}
            hint="Past 09:30 plus the 10-minute grace"
            onClick={() => setState(state === "late" ? "all" : "late")}
          />
          <StatTile
            label="Absent"
            value={totals.absent}
            icon={TriangleAlert}
            tone={totals.absent > 0 ? "critical" : "good"}
            hint="No punch and no approved leave"
            onClick={() => setState(state === "absent" ? "all" : "absent")}
          />
          <StatTile
            label="On leave"
            value={totals.leave}
            icon={Plane}
            tone="neutral"
            hint="Approved leave for today"
            onClick={() => setState(state === "leave" ? "all" : "leave")}
          />
          <StatTile
            label="Awaiting approval"
            value={totals.pending}
            icon={ClipboardCheck}
            tone={totals.pending > 0 ? "warning" : "good"}
            hint="Day records not yet signed off"
            onClick={() => setState("all")}
          />
        </StatRow>
      )}

      {loading ? (
        <ChartSkeleton />
      ) : (
        <BarCompareChart
          title="On-time, late and absent by department"
          description="Marked days over the last 30 days of the punch window. Click a bar to filter the day board."
          data={deptChart}
          xKey="department"
          series={[
            { key: "onTime", label: "On time" },
            { key: "late", label: "Late" },
            { key: "absent", label: "Absent" },
          ]}
          stacked
          horizontal
          height={Math.max(180, deptChart.length * 34 + 40)}
          valueFormat={(v) => `${num(v)} days`}
          tickFormat={(v) => num(v)}
          xLabelFormat={(v) => SHORT_DEPT[v] ?? v}
          onBarClick={(r) => {
            const hit = DEPARTMENTS.find((d) => d.name === String(r.department));
            if (hit) {
              setDept(hit.id);
              mockAction(`Filtered to ${hit.name}`, { tone: "info", description: "The day board below now shows this department only." });
            }
          }}
          footnote="Attendance is generated for a 106-employee demo cohort, weighted toward Engineering — so Engineering's bar is the longest by headcount, not by behaviour."
        />
      )}

      <Section
        title="Day board"
        description={`${rows.length} of ${board.length} employees shown. Select rows to approve in bulk.`}
        actions={
          dept !== "all" || branch !== "all" || state !== "all" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDept("all");
                setBranch("all");
                setState("all");
              }}
            >
              <X /> Clear filters
            </Button>
          ) : null
        }
      >
        <DataTable
          columns={boardColumns}
          data={rows}
          loading={loading}
          getRowId={(r) => r.code}
          searchKeys={["name", "code", "designation"]}
          searchPlaceholder="Search name or code…"
          onRowClick={openRow}
          exportName={`team-attendance-${DEMO_TODAY}`}
          emptyIcon={Users}
          emptyTitle="No employees match these filters"
          emptyDescription="Widen the department, branch or status filter to bring rows back."
          filters={
            <>
              <FilterSelect
                label="Scope"
                value={scope}
                onValueChange={(v) => setScope(v as "team" | "all")}
                allLabel="All employees"
                options={[
                  { value: "team", label: "My reportees" },
                  { value: "all", label: "All employees" },
                ]}
                width="w-[170px]"
              />
              <FilterSelect
                label="Dept"
                value={dept}
                onValueChange={setDept}
                options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))}
                width="w-[180px]"
              />
              <FilterSelect
                label="Branch"
                value={branch}
                onValueChange={setBranch}
                options={branches}
                width="w-[160px]"
              />
              <FilterSelect
                label="Status"
                value={state}
                onValueChange={setState}
                options={STATE_OPTIONS}
                width="w-[170px]"
              />
            </>
          }
          enableSelection
          bulkActions={(selected, clear) => (
            <>
              <Gated menuKey="team.attendance" action="A">
                <Button
                  size="sm"
                  onClick={() => {
                    approveCodes(selected.map((s) => s.code), "day records");
                    clear();
                  }}
                >
                  <CheckCheck /> Approve day
                </Button>
              </Gated>
              <Gated menuKey="team.attendance" action="E">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    mockAction(`${selected.length} employees marked present`, {
                      description: "Manual override recorded against your user for the audit log.",
                    });
                    setApprovals((a) => ({
                      ...a,
                      ...Object.fromEntries(selected.map((s) => [s.code, "approved" as const])),
                    }));
                    clear();
                  }}
                >
                  Mark present
                </Button>
              </Gated>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  mockAction(`Reminder sent to ${selected.length} employees`, {
                    tone: "info",
                    description: "Asked them to regularise today's punch before finalisation.",
                  });
                  clear();
                }}
              >
                <BellRing /> Remind
              </Button>
            </>
          )}
        />
      </Section>

      <Section title="Time administration" description="Everything a manager signs off before payroll consumes the month.">
        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue">
              <ClipboardCheck /> Approval Queue ({queue.length})
            </TabsTrigger>
            <TabsTrigger value="final">
              <Lock /> Admin Finalization
            </TabsTrigger>
            <TabsTrigger value="ot">
              <TimerOff /> Overtime Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue">
            <div className="flex flex-col gap-3">
              <Alert tone="info" icon={ClipboardCheck} title="Regularisations waiting on you">
                Approving writes the proposed punch pair onto the day record and clears the
                exception. Rejecting notifies the employee, who can raise a fresh request inside the
                7-day window.
              </Alert>
              <DataTable
                columns={queueColumns}
                data={queue}
                loading={loading}
                getRowId={(a) => a.id}
                searchKeys={["employeeName", "id", "reason"]}
                searchPlaceholder="Search employee or reason…"
                exportName="regularisation-queue"
                emptyIcon={CheckCheck}
                emptyTitle="Queue is clear"
                emptyDescription="Every regularisation routed to you has been decided."
                pageSize={10}
              />
            </div>
          </TabsContent>

          <TabsContent value="final">
            <div className="flex flex-col gap-3">
              <Alert tone="warning" icon={Lock} title="Finalisation closes a day for edits">
                A locked day is what payroll reads. Reopen a day only if a regularisation was
                approved after it was locked — every reopen lands in the audit log.
              </Alert>
              <DataTable
                columns={finalisationColumns}
                data={finalisation}
                loading={loading}
                getRowId={(r) => r.date}
                searchKeys={["label", "status"]}
                searchPlaceholder="Search a date…"
                exportName="attendance-finalisation"
                emptyIcon={Lock}
                emptyTitle="No days in the finalisation window"
                pageSize={10}
              />
            </div>
          </TabsContent>

          <TabsContent value="ot">
            <div className="flex flex-col gap-3">
              <Alert tone="info" icon={TimerOff} title="Overtime over the last 30 days">
                Only hours past the 9h band count. Approved overtime is released to the September
                pay run as an earning line.
              </Alert>
              <DataTable
                columns={overtimeColumns}
                data={OVERTIME_REPORT_30D.filter(
                  (r) => scope === "all" || reporteeCodes.has(String(r.code)),
                )}
                loading={loading}
                getRowId={(r) => String(r.code)}
                searchKeys={["name", "code", "department"]}
                searchPlaceholder="Search employee…"
                exportName="overtime-report-30d"
                emptyIcon={TimerOff}
                emptyTitle="No overtime recorded"
                emptyDescription="Nobody in this scope crossed the 9h band in the last 30 days."
                pageSize={10}
              />
            </div>
          </TabsContent>
        </Tabs>
      </Section>

      <ConfirmDialog
        open={finaliseOpen}
        onOpenChange={setFinaliseOpen}
        title={`Finalise ${fmtDate(DEMO_TODAY)}?`}
        description={`${board.length} employees in scope · ${totals.absent} absent · ${totals.pending} records still awaiting approval. Finalising marks unresolved absences as loss of pay and closes the day for edits.`}
        confirmLabel="Finalise the day"
        onConfirm={() => {
          setFinalisation((rowsv) =>
            rowsv.map((x) =>
              x.date === DEMO_TODAY ? { ...x, status: "approved", finalisedBy: persona.name } : x,
            ),
          );
          setApprovals((a) => ({
            ...a,
            ...Object.fromEntries(board.map((r) => [r.code, "approved" as const])),
          }));
          mockAction(`${fmtDate(DEMO_TODAY)} finalised`, {
            description: `${board.length} day records closed by ${persona.name}. ${totals.absent} marked as loss of pay.`,
          });
        }}
      />

      <DayDetailSheet detail={detail} onOpenChange={(o) => !o && setDetail(null)} />
    </PageBody>
  );
}
