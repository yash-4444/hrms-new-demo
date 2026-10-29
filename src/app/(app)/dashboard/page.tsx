"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO, startOfWeek } from "date-fns";
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
  PackagePlus,
  Pin,
  Plane,
  TrendingDown,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateShort, fmtTime, hm, hms, inr, inrCompact, num, pct } from "@/lib/format";
import { menuKeyForPath } from "@/lib/nav";
import { DEMO_TODAY } from "@/mock/org";
import { PEOPLE_STATS, descendantsOf, employeeByCode, reporteesOf } from "@/mock/employees";
import {
  ATTRITION,
  ATTRITION_TREND,
  COMPLIANCE_ALERTS,
  DASH_ANNOUNCEMENTS,
  DEPT_DISTRIBUTION,
  HEADCOUNT_12M,
  PAYROLL_COST_TREND,
  THIS_MONTH,
  UPCOMING_HOLIDAYS,
  teamAttendanceToday,
  teamOnLeaveToday,
} from "@/mock/insights";
import { EXCEPTIONS, EXCEPTION_META, PAY_RUNS, RUN_STEPS, RUN_STEP_META } from "@/mock/payroll";
import { REQUISITIONS, branchLabel, candidatesForReq, deptLabel, reqAgeingDays } from "@/mock/hiring";
import { LEAVE_EMPLOYEE_CODES, LEAVE_TYPE_BY_CODE, applicationsFor, balancesFor, countryOf } from "@/mock/leave";
import { AMENDMENTS, amendmentTypeLabel, attendanceFor, settingsForCountry } from "@/mock/attendance";
import { EXPENSE_CLAIMS, TRAVEL_REQUESTS } from "@/mock/workplace";
import { APPROVAL_TYPE_META, approvalsFor, type ApprovalItem } from "@/mock/self-service";
import {
  SHIFT_TARGET_MINUTES,
  demoNowMs,
  mockAction,
  useApp,
  useDemoNow,
} from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Avatar, Badge, EmptyState, Hint, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DonutChart,
  ProgressRing,
  ShareBar,
  TrendAreaChart,
  TrendLineChart,
} from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DashboardBriefing } from "@/components/ai/embed/dashboard-briefing";
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

   Every KPI tile is clickable and drills into a pre-filtered list. Every
   figure is derived from the module fixtures (pay run, requisitions, leave
   ledger, attendance), so a number here matches the screen it links to. A
   link the persona cannot open renders as plain text, never Access denied.
   ========================================================================== */

/** The open pay run — the same object /payroll/runs/<id> renders. */
const RUN = PAY_RUNS[0];
const RUN_EXCEPTION_TYPES = [...new Set(EXCEPTIONS.filter((x) => x.runId === RUN.id).map((x) => x.type))];

const COST_NOW = PAYROLL_COST_TREND.at(-1)!;
const COST_PREV = PAYROLL_COST_TREND.at(-2)!;
const COST_DELTA = Number((((COST_NOW.ctc - COST_PREV.ctc) / Math.max(1, COST_PREV.ctc)) * 100).toFixed(1));

/** Open requisitions, oldest first — the /requisitions?status=open list. */
const OPEN_REQS = REQUISITIONS.filter((r) => r.status === "open").sort(
  (a, b) => reqAgeingDays(b) - reqAgeingDays(a),
);
const OPEN_POSITIONS = OPEN_REQS.reduce((a, r) => a + Math.max(0, r.headcount - r.filled), 0);
const AGEING_REQS = OPEN_REQS.filter((r) => reqAgeingDays(r) > 45).length;

/** Closing headcount now vs three month-ends ago. */
const HEADCOUNT_QOQ = (() => {
  const now = HEADCOUNT_12M.at(-1)!.headcount;
  const then = HEADCOUNT_12M.at(-4)!.headcount;
  return Number((((now - then) / Math.max(1, then)) * 100).toFixed(1));
})();

/** Whether the persona may open a route. A link to anything else renders as text. */
function useCanOpen() {
  const { can } = useApp();
  return React.useCallback(
    (href: string) => {
      const key = menuKeyForPath(href.split("?")[0]);
      return !key || can(key);
    },
    [can],
  );
}

/** A link when the persona can open the target, plain text otherwise. */
function SafeLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const canOpen = useCanOpen();
  if (!canOpen(href)) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function DashboardPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const canOpen = useCanOpen();
  const { persona, role, can, approvalCount, exceptionCount } = useApp();
  /* Minute resolution is plenty for the greeting. */
  const now = useDemoNow(60_000);

  const showTeam = can("team.attendance", "V") || can("team.leave_approvals", "V");
  const showPeople = can("people.directory", "E") || role === "tenant_owner";
  const showPayroll = can("payroll.runs", "V");
  const showHiring = can("hiring.requisitions", "V");
  const canApprove = can("team.approvals", "A");

  /** Drill-down href for a tile, or nothing when the persona can't open it. */
  const drill = (href: string) => (canOpen(href) ? href : undefined);

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
        title={`${greeting(now)}, ${persona.shortName}`}
        description={
          <>
            {persona.title} · {persona.branch} · viewing as{" "}
            <span className="font-medium text-foreground">{persona.role}</span>. Today is{" "}
            {fmtDate(DEMO_TODAY)}.
          </>
        }
        actions={
          <>
            {canOpen("/leave") && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/leave?apply=1">
                  <CalendarDays /> Apply for leave
                </Link>
              </Button>
            )}
            {canOpen("/assets/requests") && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/assets/requests">
                  <PackagePlus /> Request equipment
                </Link>
              </Button>
            )}
            {canOpen("/helpdesk") && (
              <Button size="sm" asChild>
                <Link href="/helpdesk">
                  <Inbox /> Raise a request
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* ------------------------------------------------- ✨ AI briefing */}
      <DashboardBriefing />

      {/* --------------------------------------------- HR / owner KPI row */}
      {showPeople && (
        <StatRow cols={5}>
          <StatTile
            label="Total headcount"
            value={num(PEOPLE_STATS.headcount)}
            deltaValue={HEADCOUNT_QOQ}
            deltaLabel="vs last quarter"
            goodDirection="up"
            icon={Users}
            spark={HEADCOUNT_12M.map((p) => ({ value: p.headcount }))}
            href={drill("/employees")}
          />
          <StatTile
            label="Joiners this month"
            value={num(THIS_MONTH.joiners.length)}
            icon={UserPlus}
            tone="good"
            hint={THIS_MONTH.joiners[0] ? `Latest: ${THIS_MONTH.joiners.at(-1)!.name}` : "None yet"}
            href={drill("/employees?joined=this-month")}
          />
          <StatTile
            label="On notice period"
            value={num(PEOPLE_STATS.onNotice)}
            icon={TrendingDown}
            tone={PEOPLE_STATS.onNotice > 10 ? "warning" : "neutral"}
            hint="Exit dates confirmed"
            href={drill("/employees?status=notice")}
          />
          <StatTile
            label="Attrition (12m)"
            value={pct(ATTRITION.rate)}
            deltaValue={ATTRITION.delta}
            deltaLabel="vs prior year"
            goodDirection="down"
            icon={TrendingDown}
            href={drill("/analytics?tab=workforce")}
          />
          <StatTile
            label="Open positions"
            value={num(OPEN_POSITIONS)}
            icon={Briefcase}
            hint={`${OPEN_REQS.length} requisitions · ${AGEING_REQS} ageing past 45 days`}
            tone={AGEING_REQS > 0 ? "warning" : "neutral"}
            href={drill("/requisitions?status=open")}
          />
        </StatRow>
      )}

      {/* --------------------------------------- payroll admin KPI row */}
      {showPayroll && !showPeople && (
        <StatRow cols={4}>
          <StatTile
            label="Current pay run"
            value={RUN.label}
            icon={BadgeIndianRupee}
            hint={`${RUN_STEP_META[RUN.status].label} · pay date ${fmtDateShort(RUN.payDate)}`}
            href={drill(`/payroll/runs/${RUN.id}`)}
          />
          <StatTile
            label="Net payable"
            value={inrCompact(RUN.totals.net)}
            icon={Wallet}
            hint={`${num(RUN.employeeCount)} employees · ${RUN.country}`}
            href={drill(`/payroll/runs/${RUN.id}`)}
          />
          <StatTile
            label="Exceptions"
            value={num(exceptionCount)}
            icon={AlertTriangle}
            tone={exceptionCount > 0 ? "critical" : "good"}
            hint={exceptionCount > 0 ? "Blocking the lock step" : "Nothing blocking"}
            href={drill(`/payroll/runs/${RUN.id}`)}
          />
          <StatTile
            label="Cost vs last month"
            value={inrCompact(COST_NOW.ctc)}
            deltaValue={COST_DELTA}
            deltaLabel="month on month"
            goodDirection="none"
            icon={Wallet}
            href={drill("/analytics?tab=cost") ?? drill("/payroll/runs")}
          />
        </StatRow>
      )}

      {/* ----------------------------------------- approvals KPI (approvers) */}
      {canApprove && !showPeople && !showPayroll && (
        <StatRow cols={2}>
          <StatTile
            label="Waiting on you"
            value={num(approvalCount)}
            icon={Inbox}
            tone={approvalCount > 0 ? "warning" : "good"}
            hint="Across every module, in one inbox"
            href={drill("/approvals")}
          />
          {showHiring && (
            <StatTile
              label="Open positions"
              value={num(OPEN_POSITIONS)}
              icon={Briefcase}
              hint={`${AGEING_REQS} ageing past 45 days`}
              href={drill("/requisitions?status=open")}
            />
          )}
        </StatRow>
      )}

      {/* ---------------------------------------- compliance alert strip */}
      {showPeople && COMPLIANCE_ALERTS.some((c) => c.status === "overdue") && (
        <OverdueComplianceAlert canOpenCalendar={canOpen("/admin/compliance")} />
      )}

      {/* ------------------------------------------------ main grid row 1 */}
      <div className="grid gap-3 lg:grid-cols-3">
        <PunchCard />
        <LeaveBalances />
      </div>

      {/* ------------------------------------------------ approvals + team */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {canApprove ? <ApprovalsQueue key={role} /> : <MyRequests key={role} />}
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
            description="Closing headcount at the end of each month: opening + joiners − leavers."
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
            description={
              canOpen("/employees")
                ? "Click a slice to open that department in the directory."
                : "Current roster by department."
            }
            data={DEPT_DISTRIBUTION.map((d) => ({ name: d.name, value: d.value, id: d.id }))}
            centreValue={num(PEOPLE_STATS.headcount)}
            centreLabel="employees"
            height={240}
            onSliceClick={
              canOpen("/employees")
                ? (row) => router.push(`/employees?dept=${encodeURIComponent(String(row.id))}`)
                : undefined
            }
          />
          <OpenPositions />
        </div>
      )}

      {showPayroll && (
        <TrendAreaChart
          title="Payroll cost trend"
          description={`${RUN.country} payroll — employee gross and employer statutory cost, month by month. The last two points are the ${PAY_RUNS[1].label} and ${RUN.label} runs.`}
          data={PAYROLL_COST_TREND.map((p) => ({
            month: p.month,
            gross: p.gross,
            employer: p.employer,
          }))}
          xKey="month"
          series={[
            { key: "gross", label: "Employee gross" },
            { key: "employer", label: "Employer cost" },
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

/** Derived from the demo clock, not the wall clock, so SSR matches the client. */
function greeting(nowMs: number) {
  const hour = new Date(nowMs).getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/* -------------------------------------------------------- compliance strip */

function OverdueComplianceAlert({ canOpenCalendar }: { canOpenCalendar: boolean }) {
  const overdue = COMPLIANCE_ALERTS.filter((c) => c.status === "overdue");
  return (
    <Alert
      tone="danger"
      icon={AlertTriangle}
      title={`${overdue.length} compliance filing${overdue.length === 1 ? " is" : "s are"} overdue`}
      action={
        canOpenCalendar ? (
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/compliance">Open calendar</Link>
          </Button>
        ) : undefined
      }
    >
      {overdue.map((c) => `${c.title} (due ${fmtDateShort(c.due)}, owner ${c.owner})`).join(" · ")}
    </Alert>
  );
}

/* ------------------------------------------------------------ punch card */

const clockMinutes = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
const clockLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(Math.round(minutes) % 60).padStart(2, "0")}`;

/**
 * Week and month figures for the persona: every finalised day before today
 * comes from their attendance records; today is the live punch, so the numbers
 * tick with the timer instead of contradicting it.
 */
function shiftStats(code: string, todayMinutes: number, todayIn: Date | null) {
  const past = attendanceFor(code).filter(
    (d) => d.date < DEMO_TODAY && d.date >= `${DEMO_TODAY.slice(0, 7)}-01`,
  );
  const weekStart = format(startOfWeek(parseISO(DEMO_TODAY), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const worked = (from: string) =>
    past.filter((d) => d.date >= from).reduce((a, d) => a + d.workedMinutes, 0) + todayMinutes;

  const settings = settingsForCountry(countryOf(code));
  const [lh, lm] = settings.lateThreshold.split(":").map(Number);
  const lateAfter = lh * 60 + lm + settings.graceMinutes;
  const ins = past.filter((d) => d.firstIn).map((d) => clockMinutes(d.firstIn!));
  const todayClock = todayIn ? todayIn.getHours() * 60 + todayIn.getMinutes() : null;
  if (todayClock !== null) ins.push(todayClock);

  return {
    week: hm(worked(weekStart)),
    month: hm(worked(`${DEMO_TODAY.slice(0, 7)}-01`)),
    avgIn: ins.length ? clockLabel(ins.reduce((a, b) => a + b, 0) / ins.length) : "—",
    late: past.filter((d) => d.late).length + (todayClock !== null && todayClock > lateAfter ? 1 : 0),
  };
}

function PunchCard() {
  const { persona, punchedIn, punchedInAt, punchIn, punchOut } = useApp();
  const now = useDemoNow();
  /* Punching out freezes the timer at the moment of the punch. */
  const [outAt, setOutAt] = React.useState<number | null>(null);

  const elapsed =
    punchedInAt && (punchedIn || outAt)
      ? Math.max(0, ((punchedIn ? now : outAt!) - punchedInAt.getTime()) / 1000)
      : 0;
  const target = SHIFT_TARGET_MINUTES * 60;
  const progress = Math.min(100, Math.max(0, (elapsed / target) * 100));
  const stats = shiftStats(persona.employeeId, elapsed / 60, punchedInAt);

  return (
    <Card className="flex flex-col p-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Today&apos;s shift</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            General shift · 09:30 – 18:30 IST · {SHIFT_TARGET_MINUTES / 60} h target
          </p>
        </div>
        <StatusBadge status={punchedIn || outAt ? "present" : "not_marked"} size="md" />
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
              {punchedIn ? "Elapsed today" : "Worked today"}
            </p>
            <p className="tnum text-lg font-semibold tabular-nums">{hms(elapsed)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {punchedInAt && punchedIn
                ? `Punched in at ${fmtTime(punchedInAt)}`
                : punchedInAt && outAt
                  ? `Punched out at ${fmtTime(new Date(outAt))}`
                  : "Not punched in yet"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {punchedIn ? (
            <Button
              variant="destructive"
              onClick={() => {
                setOutAt(demoNowMs());
                punchOut();
              }}
            >
              <LogOut /> Punch out
            </Button>
          ) : (
            <Button
              onClick={() => {
                setOutAt(null);
                punchIn();
              }}
            >
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
          ["This week", stats.week],
          ["This month", stats.month],
          ["Avg. in-time", stats.avgIn],
          ["Late marks (mo)", String(stats.late)],
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
  const { persona } = useApp();
  const canOpen = useCanOpen();
  /* Same cards as /leave: every balance-tracked type, plus any type already used. */
  const balances = balancesFor(persona.employeeId).filter(
    (b) => LEAVE_TYPE_BY_CODE[b.typeCode]?.showOnCards || b.used > 0,
  );
  const leaveHref = canOpen("/leave") ? "/leave" : null;

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Leave balance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">FY 2026-27 · as on {fmtDateShort(DEMO_TODAY)}</p>
        </div>
        {leaveHref && (
          <Button variant="ghost" size="icon-sm" aria-label="Open leave" asChild>
            <Link href={leaveHref}>
              <ArrowRight />
            </Link>
          </Button>
        )}
      </div>

      {balances.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No leave balances on record for this FY yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {balances.map((b) => {
            const credited = b.opening + b.carryForward + b.accrued + b.adjusted;
            return (
              <li key={b.typeCode}>
                <SafeLink
                  href="/leave"
                  className="flex items-center gap-3 rounded-md p-1 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ProgressRing
                    value={b.available}
                    max={Math.max(credited, b.available, 1)}
                    size={40}
                    thickness={5}
                    label={String(b.available)}
                    tone={credited > 0 && b.available / credited < 0.25 ? "warning" : "accent"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{LEAVE_TYPE_BY_CODE[b.typeCode]?.name ?? b.typeCode}</p>
                    <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
                      Credited {credited} · Used {b.used}
                      {b.carryForward ? ` · Carried ${b.carryForward}` : ""}
                      {b.pending ? ` · Pending ${b.pending}` : ""}
                    </p>
                  </div>
                  <span className="tnum shrink-0 text-right">
                    <span className="block text-sm font-semibold">{b.available}</span>
                    <span className="block text-[10px] text-muted-foreground">available</span>
                  </span>
                </SafeLink>
              </li>
            );
          })}
        </ul>
      )}

      {leaveHref && (
        <Button size="sm" className="mt-3 w-full" asChild>
          <Link href="/leave?apply=1">
            <CalendarDays /> Apply for leave
          </Link>
        </Button>
      )}
    </Card>
  );
}

/* ------------------------------------------------------- approvals queue */

/** How many inbox items the widget lists; the rest live on /approvals. */
const QUEUE_PREVIEW = 6;

/**
 * The persona's unified inbox — the same items /approvals lists and the
 * sidebar badge counts. Deciding here decrements that one shared count.
 */
function ApprovalsQueue() {
  const { role, persona, approvalCount, decidedApprovals, markDecided } = useApp();
  const canOpen = useCanOpen();
  const seed = React.useMemo(
    () => approvalsFor(role, persona.employeeId, persona.name),
    [role, persona.employeeId, persona.name],
  );
  /* Items already decided in /approvals this session stay decided here. */
  const [items, setItems] = React.useState<ApprovalItem[]>(() => seed.filter((s) => !decidedApprovals.has(s.id)));
  const [rejecting, setRejecting] = React.useState<ApprovalItem | null>(null);
  const [confirmAll, setConfirmAll] = React.useState(false);

  const shown = items.slice(0, QUEUE_PREVIEW);
  const inboxHref = canOpen("/approvals") ? "/approvals" : null;

  const remove = (ids: string[]) => {
    setItems((xs) => xs.filter((x) => !ids.includes(x.id)));
    markDecided(ids);
  };

  const approve = (item: ApprovalItem) => {
    remove([item.id]);
    mockAction(`Approved — ${APPROVAL_TYPE_META[item.type].label}`, {
      description: `${item.requesterName}: ${item.title}`,
      undo: () => {
        /* Put it back where it was in the queue. */
        setItems((xs) => seed.filter((s) => s.id === item.id || xs.some((x) => x.id === s.id)));
        markDecided([item.id], false);
      },
    });
  };

  const reject = (item: ApprovalItem, comment: string) => {
    remove([item.id]);
    mockAction(`Rejected — ${APPROVAL_TYPE_META[item.type].label}`, {
      description: `${item.requesterName} has been notified: “${comment}”`,
      tone: "warning",
    });
  };

  const approveShown = (comment: string) => {
    const n = shown.length;
    remove(shown.map((x) => x.id));
    mockAction(`Approved ${n} request${n === 1 ? "" : "s"}`, {
      description: comment ? `Every requester has been notified: “${comment}”` : "Every requester has been notified.",
    });
  };

  return (
    <Section
      title="Waiting on you"
      description="Approvals across leave, expenses, travel, regularisation, hiring and payroll."
      actions={
        <>
          {shown.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setConfirmAll(true)}>
              <CheckCheck /> Approve {shown.length === items.length ? "all" : `these ${shown.length}`}
            </Button>
          )}
          {inboxHref && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={inboxHref}>
                Open inbox <ArrowRight />
              </Link>
            </Button>
          )}
        </>
      }
      bodyClassName="p-0"
    >
      {shown.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="Inbox zero"
          description="Nothing is waiting on you right now. New requests will appear here the moment they are raised."
          className="border-0"
        />
      ) : (
        <ul>
          {shown.map((item) => {
            const emp = employeeByCode(item.requesterCode);
            const ageDays = Math.floor(item.ageHours / 24);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5 last:border-0 hover:bg-muted/50"
              >
                <Avatar name={item.requesterName} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs">
                    {emp ? (
                      <SafeLink href={`/employees/${emp.code}`} className="font-medium hover:underline">
                        {item.requesterName}
                      </SafeLink>
                    ) : (
                      <span className="font-medium">{item.requesterName}</span>
                    )}
                    <Badge variant="muted">{APPROVAL_TYPE_META[item.type].label}</Badge>
                    {item.slaState === "breached" && (
                      <Hint text={`Waiting ${ageDays} day${ageDays === 1 ? "" : "s"} — past the ${Math.round(item.slaHours / 24)}-day SLA`}>
                        <Badge variant="outline" className="border-warning/30 text-warning-fg">
                          <AlarmClock className="size-3" aria-hidden /> {ageDays}d
                        </Badge>
                      </Hint>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {item.title} · {item.department}
                    {item.amount ? ` · ${inr(item.amount, { decimals: false })}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {inboxHref && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={inboxHref}>View</Link>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setRejecting(item)}>
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => approve(item)}>
                    Approve
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject this request?"
        description={
          rejecting
            ? `${rejecting.requesterName} will be notified that their ${APPROVAL_TYPE_META[rejecting.type].label.toLowerCase()} request was rejected, with your reason.`
            : undefined
        }
        comment={{ label: "Reason for rejecting", placeholder: "Shared with the requester" }}
        confirmLabel="Reject"
        destructive
        onConfirm={(comment) => {
          if (rejecting) reject(rejecting, comment);
          setRejecting(null);
        }}
      />
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={`Approve ${shown.length} request${shown.length === 1 ? "" : "s"}?`}
        description={`${[...new Set(shown.map((x) => APPROVAL_TYPE_META[x.type].label))].join(", ")} — each requester is notified and the items leave your inbox. This cannot be undone from the dashboard.`}
        comment={{ label: "Note to requesters", placeholder: "Optional", required: false }}
        confirmLabel="Approve all"
        onConfirm={(comment) => {
          approveShown(comment);
          setConfirmAll(false);
        }}
      />
      {approvalCount > shown.length && (
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          Showing {shown.length} of {approvalCount} open items.{" "}
          {inboxHref && (
            <Link href={inboxHref} className="text-primary hover:underline">
              See all
            </Link>
          )}
        </p>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ my requests */

interface MyRequest {
  id: string;
  kind: string;
  title: string;
  detail: string;
  status: string;
  href: string;
  at: string;
}

/** Everything the persona has raised that is still waiting on someone. */
function myRequestsFor(code: string): MyRequest[] {
  const open = (s: string) => s === "pending" || s === "submitted" || s === "sent_back";
  const out: MyRequest[] = [
    ...applicationsFor(code)
      .filter((a) => open(a.status))
      .map((a) => ({
        id: `leave:${a.id}`,
        kind: "Leave",
        title: `${a.typeName} · ${a.days} day${a.days === 1 ? "" : "s"}`,
        detail: `${fmtDateShort(a.fromDate)} – ${fmtDateShort(a.toDate)} · with ${a.approverName}`,
        status: a.status,
        href: "/leave",
        at: a.appliedOn,
      })),
    ...AMENDMENTS.filter((a) => a.code === code && open(a.status)).map((a) => ({
      id: `reg:${a.id}`,
      kind: "Regularisation",
      title: `${amendmentTypeLabel(a.type)} · ${fmtDateShort(a.date)}`,
      detail: `with ${a.approver}`,
      status: a.status,
      href: "/attendance/amendments",
      at: a.raisedAt.slice(0, 10),
    })),
    ...EXPENSE_CLAIMS.filter((c) => c.employeeCode === code && open(c.status)).map((c) => ({
      id: `exp:${c.id}`,
      kind: "Expense",
      title: c.purpose,
      detail: `${c.claimNo} · ${inr(c.total, { decimals: false })} · with ${c.approverName}`,
      status: c.status,
      href: "/expenses",
      at: c.submittedOn ?? DEMO_TODAY,
    })),
    ...TRAVEL_REQUESTS.filter((t) => t.employeeCode === code && open(t.status)).map((t) => ({
      id: `trv:${t.id}`,
      kind: "Travel",
      title: t.purpose,
      detail: `${t.requestNo} · departs ${fmtDateShort(t.startDate)} · with ${t.approverName}`,
      status: t.status,
      href: "/travel",
      at: t.submittedOn ?? DEMO_TODAY,
    })),
  ];
  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

/** Self-service view of the same slot: the persona's own requests in flight. */
function MyRequests() {
  const { persona } = useApp();
  const canOpen = useCanOpen();
  const items = React.useMemo(() => myRequestsFor(persona.employeeId), [persona.employeeId]);

  return (
    <Section
      title="My requests"
      description="Requests you have raised that are still waiting on someone."
      bodyClassName="p-0"
    >
      {items.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          title="Nothing in flight"
          description="Every leave, regularisation, expense and travel request you raised has been decided."
          className="border-0"
        />
      ) : (
        <ul>
          {items.slice(0, QUEUE_PREVIEW).map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5 last:border-0 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-medium">{r.title}</span>
                  <Badge variant="muted">{r.kind}</Badge>
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {r.detail} · raised {fmtDateShort(r.at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusBadge status={r.status} />
                {canOpen(r.href) && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={r.href}>View</Link>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > QUEUE_PREVIEW && (
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          Showing the {QUEUE_PREVIEW} most recent of {items.length} open requests.
        </p>
      )}
    </Section>
  );
}

/* ------------------------------------------------------ visibility scope */

/**
 * The people a persona's "team" cards cover: a manager's reportees, a
 * department head's whole tree, HR / owner / auditor org-wide (the employees
 * with full leave history), and everyone else their own team of peers.
 */
function useTeamScope(): { codes: string[]; label: string } {
  const { role, persona } = useApp();
  return React.useMemo(() => {
    const me = persona.employeeId;
    if (role === "hr_admin" || role === "tenant_owner" || role === "auditor") {
      return { codes: LEAVE_EMPLOYEE_CODES, label: "Across the organisation" };
    }
    if (role === "department_head") {
      return { codes: descendantsOf(me).map((e) => e.code), label: `Across ${persona.department}` };
    }
    const reportees = reporteesOf(me).map((e) => e.code);
    if (reportees.length) return { codes: reportees, label: "Your direct reportees" };
    const mgr = employeeByCode(me)?.managerCode;
    const peers = mgr ? reporteesOf(mgr).map((e) => e.code).filter((c) => c !== me) : [];
    return { codes: peers, label: "Your team" };
  }, [role, persona]);
}

/* --------------------------------------------------- team attendance card */

function TeamAttendanceToday() {
  const scope = useTeamScope();
  const t = React.useMemo(() => teamAttendanceToday(scope.codes), [scope.codes]);
  const canOpen = useCanOpen();
  const boardHref = canOpen("/attendance/team") ? "/attendance/team" : null;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Team today</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtDate(DEMO_TODAY)} · {scope.label.toLowerCase()}
          </p>
        </div>
        {boardHref && (
          <Button variant="ghost" size="icon-sm" aria-label="Open team attendance" asChild>
            <Link href={boardHref}>
              <ArrowRight />
            </Link>
          </Button>
        )}
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
        {t.present + t.late} of {t.total} in today
        {boardHref && (
          <>
            {" · "}
            <Link href={boardHref} className="text-primary hover:underline">
              review the day board
            </Link>
          </>
        )}
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------ team leave */

function TeamOnLeave() {
  const canOpen = useCanOpen();
  const scope = useTeamScope();
  const onLeave = React.useMemo(() => teamOnLeaveToday(scope.codes), [scope.codes]);
  const calendarHref = `/leave/calendar?month=${DEMO_TODAY.slice(0, 7)}`;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">On leave today</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{scope.label}</p>
        </div>
        {canOpen(calendarHref) && (
          <Button variant="ghost" size="icon-sm" aria-label="Open leave calendar" asChild>
            <Link href={calendarHref}>
              <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
      {onLeave.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Everyone is in today.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {onLeave.map((m) => (
            <li key={m.code}>
              <SafeLink
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
                    {m.until === DEMO_TODAY ? "today only" : `till ${fmtDateShort(m.until)}`}
                  </span>
                </span>
              </SafeLink>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------- pay run stepper */

/** The open run from the payroll fixtures — headcount, totals and status match /payroll/runs/<id>. */
function PayRunStepper() {
  const { exceptionCount } = useApp();
  const canOpen = useCanOpen();
  const runHref = canOpen(`/payroll/runs/${RUN.id}`) ? `/payroll/runs/${RUN.id}` : null;
  const currentStep = RUN_STEPS.indexOf(RUN.status);
  return (
    <Section
      title={`Pay run · ${RUN.label}`}
      description={`${RUN.id} · ${fmtDateShort(RUN.periodStart)} – ${fmtDate(RUN.periodEnd)} · pay date ${fmtDate(RUN.payDate)} · ${num(RUN.employeeCount)} employees on the ${RUN.country} payroll`}
      actions={
        runHref ? (
          <Button size="sm" asChild>
            <Link href={runHref}>
              Open run <ArrowRight />
            </Link>
          </Button>
        ) : undefined
      }
    >
      <ol className="flex flex-wrap items-center gap-1">
        {RUN_STEPS.map((step, i) => {
          const done = i < currentStep;
          const current = i === currentStep;
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
              {i < RUN_STEPS.length - 1 && (
                <span className="h-px w-4 bg-border sm:w-6" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Gross", inr(RUN.totals.gross, { decimals: false })],
          ["Deductions", inr(RUN.totals.deductions, { decimals: false })],
          ["Net payable", inr(RUN.totals.net, { decimals: false })],
          ["Employees", num(RUN.employeeCount)],
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
            runHref ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={runHref}>Resolve</Link>
              </Button>
            ) : undefined
          }
        >
          {RUN_EXCEPTION_TYPES.map((t) => EXCEPTION_META[t].label).join(" · ")}
        </Alert>
      )}
    </Section>
  );
}

/* --------------------------------------------------------- open positions */

/** Open requisitions from the hiring fixtures — the /requisitions?status=open list. */
function OpenPositions({ compact }: { compact?: boolean }) {
  const canOpen = useCanOpen();
  const listHref = "/requisitions?status=open";
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Open positions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {num(OPEN_POSITIONS)} positions across {OPEN_REQS.length} open requisitions · oldest first
          </p>
        </div>
        {canOpen(listHref) && (
          <Button variant="ghost" size="icon-sm" aria-label="Open requisitions" asChild>
            <Link href={listHref}>
              <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
      <ul className="mt-2.5 flex flex-col">
        {OPEN_REQS.slice(0, compact ? 3 : 5).map((r) => {
          const age = reqAgeingDays(r);
          const inPlay = candidatesForReq(r.code).filter(
            (c) => c.stage !== "rejected" && c.stage !== "hired",
          ).length;
          return (
            <li key={r.code} className="border-b border-border last:border-0">
              <SafeLink
                href={listHref}
                className="flex items-center gap-2.5 py-2 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{r.role}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {r.code} · {deptLabel(r.departmentId)} · {branchLabel(r.branchId)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <StatusBadge status={r.approvalStatus === "pending" ? "pending" : r.status} />
                  <p
                    className={cn(
                      "tnum mt-0.5 text-[10px]",
                      age > 45 ? "text-warning-fg" : "text-muted-foreground",
                    )}
                  >
                    {age}d open · {r.filled}/{r.headcount} filled · {inPlay} in play
                  </p>
                </div>
              </SafeLink>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------------------------------------------------------- announcements */

function Announcements() {
  const canOpen = useCanOpen();
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
        canOpen("/announcements") ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/announcements">
              All announcements <ArrowRight />
            </Link>
          </Button>
        ) : undefined
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
  const canOpen = useCanOpen();
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Compliance calendar</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Next filings due</p>
        </div>
        {canOpen("/admin/compliance") && (
          <Button variant="ghost" size="icon-sm" aria-label="Open compliance calendar" asChild>
            <Link href="/admin/compliance">
              <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
      <ul className="mt-2.5 flex flex-col">
        {COMPLIANCE_ALERTS.map((c) => (
          <li key={c.id} className="border-b border-border py-2 last:border-0">
            <SafeLink
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
            </SafeLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}
