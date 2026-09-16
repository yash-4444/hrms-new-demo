"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlarmClock,
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  Briefcase,
  CalendarDays,
  CalendarOff,
  CheckCheck,
  Clock,
  Inbox,
  LogIn,
  LogOut,
  Megaphone,
  Pin,
  Plane,
  TrendingDown,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  days,
  fmtDate,
  fmtDateShort,
  fmtTime,
  hms,
  inr,
  inrCompact,
  num,
  pct,
} from "@/lib/format";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { PEOPLE_STATS, employeeByCode } from "@/mock/employees";
import {
  ATTRITION,
  ATTRITION_TREND,
  COMPLIANCE_ALERTS,
  DASH_ANNOUNCEMENTS,
  DEPT_DISTRIBUTION,
  HEADCOUNT_12M,
  MY_LEAVE_BALANCE,
  OPEN_POSITIONS,
  PAYROLL_COST_TREND,
  PAY_RUN_SNAPSHOT,
  PENDING_APPROVALS,
  TEAM_ATTENDANCE_TODAY,
  TEAM_ON_LEAVE_TODAY,
  THIS_MONTH,
  UPCOMING_HOLIDAYS,
  type ApprovalItem,
} from "@/mock/insights";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Hint,
  Progress,
  Skeleton,
} from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  BarCompareChart,
  DonutChart,
  ProgressRing,
  ShareBar,
  TrendAreaChart,
  TrendLineChart,
} from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  CardsSkeleton,
  ChartSkeleton,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";

/* ============================================================================
   /dashboard — role-aware.

   Employee sees self-service. Manager adds approvals and team. HR Admin adds
   the people KPIs, attrition and compliance. Payroll Admin adds the pay-run
   stepper and cost trend. Tenant Owner sees everything.

   Every KPI tile is clickable and drills into a pre-filtered list.
   ========================================================================== */

export default function DashboardPage() {
  const loading = useFakeLoad();
  const { persona, role, can, approvalCount, setApprovalCount, exceptionCount } = useApp();

  const showTeam = can("team.attendance", "V") || can("team.leave_approvals", "V");
  const showPeople = can("people.directory", "E") || role === "tenant_owner";
  const showPayroll = can("payroll.runs", "V");
  const showHiring = can("hiring.requisitions", "V");

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Dashboard" description="Loading your workspace…" />
        <CardsSkeleton count={4} />
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-[220px] lg:col-span-2" />
          <Skeleton className="h-[220px]" />
        </div>
        <ChartSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title={`${greeting()}, ${persona.shortName}`}
        description={
          <>
            {persona.title} · {persona.branch} · viewing as{" "}
            <span className="font-medium text-foreground">{persona.role}</span>. Today is{" "}
            {fmtDate(DEMO_TODAY)}.
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/leave?apply=1">
                <CalendarDays /> Apply for leave
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/helpdesk">
                <Inbox /> Raise a request
              </Link>
            </Button>
          </>
        }
      />

      {/* --------------------------------------------- HR / owner KPI row */}
      {showPeople && (
        <StatRow cols={5}>
          <StatTile
            label="Total headcount"
            value={num(PEOPLE_STATS.headcount)}
            deltaValue={4.3}
            deltaLabel="vs last quarter"
            goodDirection="up"
            icon={Users}
            spark={HEADCOUNT_12M.map((p) => ({ value: p.headcount }))}
            href="/employees"
          />
          <StatTile
            label="Joiners this month"
            value={num(THIS_MONTH.joiners.length)}
            icon={UserPlus}
            tone="good"
            hint={THIS_MONTH.joiners[0] ? `Latest: ${THIS_MONTH.joiners.at(-1)!.name}` : "None yet"}
            href="/employees?joined=this-month"
          />
          <StatTile
            label="On notice period"
            value={num(PEOPLE_STATS.onNotice)}
            icon={TrendingDown}
            tone={PEOPLE_STATS.onNotice > 10 ? "warning" : "neutral"}
            hint="Exit dates confirmed"
            href="/employees?status=notice"
          />
          <StatTile
            label="Attrition (12m)"
            value={pct(ATTRITION.rate)}
            deltaValue={ATTRITION.delta}
            deltaLabel="vs prior year"
            goodDirection="down"
            icon={TrendingDown}
            href="/analytics"
          />
          <StatTile
            label="Open positions"
            value={num(OPEN_POSITIONS.length + 7)}
            icon={Briefcase}
            hint={`${OPEN_POSITIONS.filter((p) => p.ageDays > 45).length} ageing past 45 days`}
            tone={OPEN_POSITIONS.some((p) => p.ageDays > 45) ? "warning" : "neutral"}
            href="/requisitions"
          />
        </StatRow>
      )}

      {/* --------------------------------------- payroll admin KPI row */}
      {showPayroll && !showPeople && (
        <StatRow cols={4}>
          <StatTile
            label="Current pay run"
            value={PAY_RUN_SNAPSHOT.period}
            icon={BadgeIndianRupee}
            hint={`Cut-off ${fmtDateShort(PAY_RUN_SNAPSHOT.cutoff)} · pay ${fmtDateShort(PAY_RUN_SNAPSHOT.payDate)}`}
            href={`/payroll/runs/${PAY_RUN_SNAPSHOT.id}`}
          />
          <StatTile
            label="Net payable"
            value={inrCompact(PAY_RUN_SNAPSHOT.net)}
            icon={Wallet}
            hint={`${num(PAY_RUN_SNAPSHOT.employees)} employees`}
            href={`/payroll/runs/${PAY_RUN_SNAPSHOT.id}`}
          />
          <StatTile
            label="Exceptions"
            value={num(exceptionCount)}
            icon={AlertTriangle}
            tone={exceptionCount > 0 ? "critical" : "good"}
            hint={exceptionCount > 0 ? "Blocking the lock step" : "Nothing blocking"}
            href={`/payroll/runs/${PAY_RUN_SNAPSHOT.id}`}
          />
          <StatTile
            label="Cost vs last month"
            value={inrCompact(PAYROLL_COST_TREND.at(-1)!.total)}
            deltaValue={2.1}
            deltaLabel="month on month"
            goodDirection="none"
            icon={Wallet}
            href="/analytics"
          />
        </StatRow>
      )}

      {/* ---------------------------------------- compliance alert strip */}
      {showPeople && COMPLIANCE_ALERTS.some((c) => c.status === "overdue") && (
        <Alert
          tone="danger"
          icon={AlertTriangle}
          title={`${COMPLIANCE_ALERTS.filter((c) => c.status === "overdue").length} compliance filing is overdue`}
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/compliance">Open calendar</Link>
            </Button>
          }
        >
          {COMPLIANCE_ALERTS.filter((c) => c.status === "overdue")
            .map((c) => `${c.title} (due ${fmtDateShort(c.due)}, owner ${c.owner})`)
            .join(" · ")}
        </Alert>
      )}

      {/* ------------------------------------------------ main grid row 1 */}
      <div className="grid gap-3 lg:grid-cols-3">
        <PunchCard />
        <LeaveBalances />
      </div>

      {/* ------------------------------------------------ approvals + team */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ApprovalsQueue
            canApprove={showTeam}
            count={approvalCount}
            onDecide={() => setApprovalCount((c) => Math.max(0, c - 1))}
          />
        </div>
        <div className="flex flex-col gap-3">
          {showTeam && <TeamAttendanceToday />}
          <TeamOnLeave />
        </div>
      </div>

      {/* ---------------------------------------------------- pay run card */}
      {showPayroll && <PayRunStepper />}

      {/* ------------------------------------------------------- charts */}
      {showPeople && (
        <div className="grid gap-3 lg:grid-cols-2">
          <TrendAreaChart
            title="Headcount trend"
            description="Closing headcount at the end of each month, last 12 months."
            data={HEADCOUNT_12M.map((p) => ({ month: p.month, headcount: p.headcount }))}
            xKey="month"
            series={[{ key: "headcount", label: "Headcount" }]}
            height={220}
          />
          <TrendLineChart
            title="Attrition trend"
            description="Annualised monthly attrition against the 12 % board target."
            data={ATTRITION_TREND.map((p) => ({ month: p.month, attrition: p.attrition }))}
            xKey="month"
            series={[{ key: "attrition", label: "Attrition rate" }]}
            valueFormat={(v) => `${v.toFixed(1)}%`}
            height={220}
            referenceLine={{ value: 12, label: "Target 12%" }}
          />
        </div>
      )}

      {showPeople && (
        <div className="grid gap-3 lg:grid-cols-2">
          <DonutChart
            title="Headcount by department"
            description="Click a slice to open that department in the directory."
            data={DEPT_DISTRIBUTION.map((d) => ({ name: d.name, value: d.value, id: d.id }))}
            centreValue={num(PEOPLE_STATS.headcount)}
            centreLabel="employees"
            height={240}
            onSliceClick={(row) => mockAction(`Opening ${row.name}`, { description: "Directory filtered to that department." })}
          />
          <OpenPositions />
        </div>
      )}

      {showPayroll && showPeople && (
        <TrendAreaChart
          title="Payroll cost trend"
          description="Employee gross and employer statutory cost, month by month."
          data={PAYROLL_COST_TREND.map((p) => ({
            month: p.month,
            gross: p.gross,
            employerCost: p.employerCost,
          }))}
          xKey="month"
          series={[
            { key: "gross", label: "Employee gross" },
            { key: "employerCost", label: "Employer cost" },
          ]}
          stacked
          valueFormat={inrCompact}
          height={230}
        />
      )}

      {/* ----------------------------------------- announcements + holidays */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Announcements />
        </div>
        <div className="flex flex-col gap-3">
          <UpcomingHolidays />
          {showHiring && !showPeople && <OpenPositions compact />}
          {showPeople && <ComplianceCalendarCard />}
        </div>
      </div>
    </PageBody>
  );
}

/* -------------------------------------------------------------- greeting */

function greeting() {
  // Derived from the demo clock, not the wall clock, so SSR matches the client.
  const hour = 14;
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/* ------------------------------------------------------------ punch card */

function PunchCard() {
  const { punchedIn, punchedInAt, punchIn, punchOut } = useApp();
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!punchedIn || !punchedInAt) return;
    const tick = () => setElapsed((Date.now() - punchedInAt.getTime()) / 1000);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [punchedIn, punchedInAt]);

  const target = 9 * 3600;
  const progress = Math.min(100, (elapsed / target) * 100);

  return (
    <Card className="flex flex-col p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Today&apos;s shift</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            General shift · 09:30 – 18:30 IST · 9 hour target
          </p>
        </div>
        <StatusBadge status={punchedIn ? "present" : "not_marked"} size="md" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-4">
          <ProgressRing
            value={progress}
            size={72}
            thickness={7}
            tone={progress >= 100 ? "good" : "accent"}
            label={`${Math.round(progress)}%`}
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Elapsed today
            </p>
            <p className="tnum text-lg font-semibold tabular-nums">
              {punchedIn && punchedInAt ? hms(elapsed) : "00:00:00"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {punchedIn && punchedInAt
                ? `Punched in at ${fmtTime(punchedInAt)}`
                : "Not punched in yet"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {punchedIn ? (
            <Button variant="destructive" onClick={punchOut}>
              <LogOut /> Punch out
            </Button>
          ) : (
            <Button onClick={punchIn}>
              <LogIn /> Punch in
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/attendance">
              <Clock /> Open attendance
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
        {[
          ["This week", "38h 12m"],
          ["This month", "142h 40m"],
          ["Avg. in-time", "09:34"],
          ["Late marks (mo)", "2"],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="tnum mt-0.5 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* --------------------------------------------------------- leave balances */

function LeaveBalances() {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Leave balance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">FY 2026-27 · as on {fmtDateShort(DEMO_TODAY)}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Open leave" asChild>
          <Link href="/leave">
            <ArrowRight />
          </Link>
        </Button>
      </div>

      <ul className="mt-3 flex flex-col gap-2.5">
        {MY_LEAVE_BALANCE.map((b) => (
          <li key={b.code}>
            <Link
              href="/leave"
              className="flex items-center gap-3 rounded-md p-1 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ProgressRing
                value={b.available}
                max={b.entitlement}
                size={40}
                thickness={5}
                label={String(b.available)}
                tone={b.available / b.entitlement < 0.25 ? "warning" : "accent"}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{b.name}</p>
                <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
                  Accrued {b.accrued} · Used {b.used} · Carried {b.carried}
                </p>
              </div>
              <span className="tnum shrink-0 text-right">
                <span className="block text-sm font-semibold">{b.available}</span>
                <span className="block text-[10px] text-muted-foreground">available</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Button size="sm" className="mt-3 w-full" asChild>
        <Link href="/leave?apply=1">
          <CalendarDays /> Apply for leave
        </Link>
      </Button>
    </Card>
  );
}

/* ------------------------------------------------------- approvals queue */

function ApprovalsQueue({
  canApprove,
  count,
  onDecide,
}: {
  canApprove: boolean;
  count: number;
  onDecide: () => void;
}) {
  const [items, setItems] = React.useState<ApprovalItem[]>(PENDING_APPROVALS);
  const [confirm, setConfirm] = React.useState<{ item: ApprovalItem; approve: boolean } | null>(null);

  const decide = (item: ApprovalItem, approve: boolean) => {
    setItems((xs) => xs.filter((x) => x.id !== item.id));
    onDecide();
    mockAction(approve ? `Approved — ${item.kind}` : `Rejected — ${item.kind}`, {
      description: `${item.requester}: ${item.summary}`,
      tone: approve ? "success" : "warning",
    });
  };

  const approveAll = () => {
    const n = items.length;
    setItems([]);
    for (let i = 0; i < n; i++) onDecide();
    mockAction(`Approved ${n} request${n === 1 ? "" : "s"}`, {
      description: "Every requester has been notified.",
    });
  };

  return (
    <Section
      title={canApprove ? "Waiting on you" : "My requests"}
      description={
        canApprove
          ? "Approvals across leave, expenses, travel, regularisation and hiring."
          : "Requests you have raised that are still in flight."
      }
      actions={
        <>
          {items.length > 0 && canApprove && (
            <Button variant="outline" size="sm" onClick={approveAll}>
              <CheckCheck /> Approve all
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/leave/approvals">
              Open inbox <ArrowRight />
            </Link>
          </Button>
        </>
      }
      bodyClassName="p-0"
    >
      {items.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="Inbox zero"
          description="Nothing is waiting on you right now. New requests will appear here the moment they are raised."
          className="border-0"
        />
      ) : (
        <ul>
          {items.map((item) => {
            const emp = employeeByCode(item.requesterCode);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5 last:border-0 hover:bg-muted/50"
              >
                <Avatar name={item.requester} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Link
                      href={`/employees/${item.requesterCode}`}
                      className="font-medium hover:underline"
                    >
                      {item.requester}
                    </Link>
                    <Badge variant="muted">{item.kind}</Badge>
                    {item.ageDays >= 5 && (
                      <Hint text={`Raised ${item.ageDays} days ago — past the 4-day SLA`}>
                        <Badge variant="outline" className="border-warning/30 text-warning-fg">
                          <AlarmClock className="size-3" aria-hidden /> {item.ageDays}d
                        </Badge>
                      </Hint>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {item.summary}
                    {emp ? ` · ${deptName(emp.departmentId)}` : ""}
                    {item.amount ? ` · ${inr(item.amount, { decimals: false })}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={item.href}>View</Link>
                  </Button>
                  {canApprove ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirm({ item, approve: false })}
                      >
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => decide(item, true)}>
                        Approve
                      </Button>
                    </>
                  ) : (
                    <StatusBadge status="pending" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Reject this request?"
        description={
          confirm
            ? `${confirm.item.requester} will be notified that their ${confirm.item.kind.toLowerCase()} request was rejected. You can add a comment from the full inbox.`
            : undefined
        }
        confirmLabel="Reject"
        destructive
        onConfirm={() => confirm && decide(confirm.item, false)}
      />
      {count > items.length && (
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          Showing the {items.length} most recent of {count} open items.{" "}
          <Link href="/leave/approvals" className="text-primary hover:underline">
            See all
          </Link>
        </p>
      )}
    </Section>
  );
}

/* --------------------------------------------------- team attendance card */

function TeamAttendanceToday() {
  const t = TEAM_ATTENDANCE_TODAY;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Team today</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(DEMO_TODAY)}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Open team attendance" asChild>
          <Link href="/attendance/team">
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="mt-3">
        <ShareBar
          segments={[
            { key: "present", label: "Present", value: t.present, status: "good" },
            { key: "late", label: "Late", value: t.late, status: "warning" },
            { key: "leave", label: "On leave", value: t.onLeave, status: "serious" },
            { key: "absent", label: "Absent", value: t.absent, status: "critical" },
          ]}
          total={t.total}
          height={10}
        />
      </div>
      <p className="tnum mt-3 border-t border-border pt-2.5 text-xs text-muted-foreground">
        {t.present + t.late} of {t.total} reportees marked ·{" "}
        <Link href="/attendance/team" className="text-primary hover:underline">
          review the day board
        </Link>
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------ team leave */

function TeamOnLeave() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">On leave today</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Across your visibility scope</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Open leave calendar" asChild>
          <Link href="/leave/calendar">
            <ArrowRight />
          </Link>
        </Button>
      </div>
      {TEAM_ON_LEAVE_TODAY.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Everyone is in today.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {TEAM_ON_LEAVE_TODAY.map((m) => (
            <li key={m.code}>
              <Link
                href={`/employees/${m.code}`}
                className="flex items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar name={m.name} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{m.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{m.designation}</p>
                </div>
                <span className="shrink-0 text-right">
                  <Badge variant="muted">
                    <Plane className="size-3" aria-hidden /> {m.type}
                  </Badge>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    back {fmtDateShort(m.until)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------- pay run stepper */

function PayRunStepper() {
  const { exceptionCount } = useApp();
  const s = PAY_RUN_SNAPSHOT;
  return (
    <Section
      title={`Pay run · ${s.period}`}
      description={`Cut-off ${fmtDate(s.cutoff)} · pay date ${fmtDate(s.payDate)} · ${num(s.employees)} employees`}
      actions={
        <Button size="sm" asChild>
          <Link href={`/payroll/runs/${s.id}`}>
            Open run <ArrowRight />
          </Link>
        </Button>
      }
    >
      <ol className="flex flex-wrap items-center gap-1">
        {s.steps.map((step, i) => {
          const done = i < s.currentStep;
          const current = i === s.currentStep;
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
                {step}
              </span>
              {i < s.steps.length - 1 && (
                <span className="h-px w-4 bg-border sm:w-6" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Gross", inr(s.gross, { decimals: false })],
          ["Deductions", inr(s.deductions, { decimals: false })],
          ["Net payable", inr(s.net, { decimals: false })],
          ["Employees", num(s.employees)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-subtle p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="tnum mt-0.5 text-sm font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {exceptionCount > 0 && (
        <Alert
          tone="danger"
          icon={AlertTriangle}
          title={`${exceptionCount} exception${exceptionCount === 1 ? "" : "s"} must be cleared before this run can be locked`}
          className="mt-3"
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/payroll/runs/${s.id}`}>Resolve</Link>
            </Button>
          }
        >
          Missing bank details, a negative net, and LOP days exceeding payable days.
        </Alert>
      )}
    </Section>
  );
}

/* --------------------------------------------------------- open positions */

function OpenPositions({ compact }: { compact?: boolean }) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Open positions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Requisitions actively being worked</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Open requisitions" asChild>
          <Link href="/requisitions">
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <ul className="mt-2.5 flex flex-col">
        {OPEN_POSITIONS.slice(0, compact ? 3 : 5).map((p) => (
          <li key={p.code} className="border-b border-border last:border-0">
            <Link
              href="/requisitions"
              className="flex items-center gap-2.5 py-2 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{p.role}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {p.code} · {p.dept} · {p.branch}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <StatusBadge status={p.stage.toLowerCase()} />
                <p
                  className={cn(
                    "tnum mt-0.5 text-[10px]",
                    p.ageDays > 45 ? "text-warning-fg" : "text-muted-foreground",
                  )}
                >
                  {p.ageDays}d open · {p.candidates} in play
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------------------------------------------------- announcements */

function Announcements() {
  const [acked, setAcked] = React.useState<Set<string>>(new Set());
  const sorted = React.useMemo(
    () => [...DASH_ANNOUNCEMENTS].sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    [],
  );

  return (
    <Section
      title="Announcements"
      description="Pinned items stay at the top until they are withdrawn."
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link href="/announcements">
            All announcements <ArrowRight />
          </Link>
        </Button>
      }
      bodyClassName="p-0"
    >
      <ul>
        {sorted.map((a) => {
          const isAcked = acked.has(a.id);
          return (
            <li key={a.id} className="border-b border-border px-4 py-3 last:border-0">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {a.pinned ? <Pin className="size-3" aria-hidden /> : <Megaphone className="size-3" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                    {a.title}
                    {a.pinned && <Badge variant="soft">Pinned</Badge>}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{a.body}</p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {a.author} · {fmtDate(a.date)}
                  </p>
                </div>
                <Button
                  variant={isAcked ? "ghost" : "outline"}
                  size="sm"
                  className="shrink-0"
                  disabled={isAcked}
                  onClick={() => {
                    setAcked((s) => new Set(s).add(a.id));
                    mockAction("Acknowledged", { description: a.title });
                  }}
                >
                  {isAcked ? (
                    <>
                      <CheckCheck /> Acknowledged
                    </>
                  ) : (
                    "Acknowledge"
                  )}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------- holidays */

function UpcomingHolidays() {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold tracking-tight">Upcoming holidays</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">India calendar · 2026</p>
      <ul className="mt-2.5 flex flex-col">
        {UPCOMING_HOLIDAYS.map((h) => (
          <li
            key={`${h.date}-${h.name}`}
            className="flex items-center gap-2.5 border-b border-border py-2 last:border-0"
          >
            <div className="flex size-8 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-subtle">
              <span className="tnum text-[11px] font-bold leading-none">{h.date.slice(8)}</span>
              <span className="text-[8px] uppercase leading-none text-muted-foreground">
                {new Date(h.date + "T00:00:00").toLocaleString("en-IN", { month: "short" })}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{h.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {h.optional ? "Optional / restricted holiday" : "Company holiday"}
              </p>
            </div>
            {h.optional && (
              <Badge variant="outline">
                <CalendarOff className="size-3" aria-hidden /> Optional
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------ compliance */

function ComplianceCalendarCard() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Compliance calendar</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Next filings due</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Open compliance calendar" asChild>
          <Link href="/admin/compliance">
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <ul className="mt-2.5 flex flex-col">
        {COMPLIANCE_ALERTS.map((c) => (
          <li key={c.id} className="border-b border-border py-2 last:border-0">
            <Link
              href="/admin/compliance"
              className="flex items-center gap-2 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{c.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  Due {fmtDate(c.due)} · {c.owner} · {c.country}
                </p>
              </div>
              <StatusBadge status={c.status} />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
