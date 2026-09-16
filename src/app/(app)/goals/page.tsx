"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ChevronsDownUp,
  ChevronsUpDown,
  GitFork,
  Plus,
  ShieldCheck,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { pct } from "@/lib/format";
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
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Input,
  Progress,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import {
  AddGoalDialog,
  GoalCard,
  RemoveGoalDialog,
  type ParentGoalOption,
} from "@/components/growth/goals";
import {
  GOALS,
  GOAL_CATEGORIES,
  GOAL_PERIOD,
  ACTIVE_CYCLE,
  categoryProgress,
  deriveGoalStatus,
  expectedProgress,
  goalsFor,
  weightedProgress,
  type Goal,
} from "@/mock/growth";
import { DEMO_TODAY } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";

type StatusFilter = "all" | "on_track" | "attention" | "achieved";

const STATUS_OPTIONS = [
  { value: "on_track", label: "On track" },
  { value: "attention", label: "Needs attention" },
  { value: "achieved", label: "Achieved" },
];

export default function GoalsPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const me = persona.employeeId;

  const [goals, setGoals] = React.useState<Goal[]>(() => goalsFor(me));
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [addOpen, setAddOpen] = React.useState(false);
  const [pendingRemove, setPendingRemove] = React.useState<Goal | null>(null);

  /* Switching persona mid-demo swaps the whole goal sheet. */
  React.useEffect(() => {
    setGoals(goalsFor(me));
    setExpanded(new Set());
    setQuery("");
    setCategory("all");
    setStatus("all");
  }, [me]);

  const allocated = goals.reduce((a, g) => a + g.weightage, 0);
  const remaining = 100 - allocated;
  const completion = weightedProgress(goals);
  const expected = goals.length
    ? Math.round(
        goals.reduce((a, g) => a + expectedProgress(g) * g.weightage, 0) /
          (goals.reduce((a, g) => a + g.weightage, 0) || 1),
      )
    : 0;

  const onTrack = goals.filter((g) => g.status === "on_track" || g.status === "achieved").length;
  const attention = goals.filter((g) => g.status === "at_risk" || g.status === "off_track").length;
  const krTotal = goals.reduce((a, g) => a + g.keyResults.length, 0);
  const krDone = goals.reduce((a, g) => a + g.keyResults.filter((k) => k.progress >= 100).length, 0);
  const daysToClose = differenceInCalendarDays(parseISO(ACTIVE_CYCLE.windowEnd), parseISO(DEMO_TODAY));

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return goals.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (status === "on_track" && g.status !== "on_track") return false;
      if (status === "achieved" && g.status !== "achieved") return false;
      if (status === "attention" && g.status !== "at_risk" && g.status !== "off_track") return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.keyResults.some((k) => k.title.toLowerCase().includes(q)) ||
        (g.cascade?.parentGoalTitle.toLowerCase().includes(q) ?? false)
      );
    });
  }, [goals, query, category, status]);

  const filtersOn = query.trim() !== "" || category !== "all" || status !== "all";
  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setStatus("all");
  };

  const chartData = React.useMemo(() => categoryProgress(goals), [goals]);

  /* Manager's goals are the cascade targets offered in the Add goal dialog. */
  const parentOptions: ParentGoalOption[] = React.useMemo(() => {
    const managerCode = employeeByCode(me)?.managerCode;
    if (!managerCode) return [];
    return goalsFor(managerCode).map((g) => ({
      id: g.id,
      title: g.title,
      ownerCode: g.ownerCode,
      ownerName: employeeByCode(g.ownerCode)?.name ?? g.ownerCode,
    }));
  }, [me]);

  /* ------------------------------------------------------------ mutations */

  const recalc = (g: Goal): Goal => {
    const progress = Math.round(
      g.keyResults.reduce((a, k) => a + k.progress, 0) / Math.max(1, g.keyResults.length),
    );
    return {
      ...g,
      progress,
      status: deriveGoalStatus(progress, g.startDate, g.targetDate),
      lastCheckIn: DEMO_TODAY,
    };
  };

  const setKrProgress = (goalId: string, krId: string, progress: number) =>
    setGoals((gs) =>
      gs.map((g) =>
        g.id === goalId
          ? recalc({
              ...g,
              keyResults: g.keyResults.map((k) => (k.id === krId ? { ...k, progress } : k)),
            })
          : g,
      ),
    );

  const markAchieved = (goal: Goal) => {
    setGoals((gs) =>
      gs.map((g) =>
        g.id === goal.id ? recalc({ ...g, keyResults: g.keyResults.map((k) => ({ ...k, progress: 100 })) }) : g,
      ),
    );
    setExpanded((s) => new Set(s).add(goal.id));
    mockAction("Goal marked achieved", {
      description: `${goal.title} — all ${goal.keyResults.length} key results set to 100%.`,
    });
  };

  const checkIn = (goal: Goal) => {
    setGoals((gs) => gs.map((g) => (g.id === goal.id ? { ...g, lastCheckIn: DEMO_TODAY } : g)));
    mockAction("Check-in logged", {
      description: `${goal.title} — check-in dated ${DEMO_TODAY}. Your manager sees this on their cascade view.`,
    });
  };

  const removeGoal = (goal: Goal) => {
    setGoals((gs) => gs.filter((g) => g.id !== goal.id));
    setPendingRemove(null);
    mockAction("Goal removed", {
      description: `${goal.title} removed. Allocated weightage is now ${allocated - goal.weightage}%.`,
      tone: "warning",
    });
  };

  const createGoal = (goal: Goal) => setGoals((gs) => [{ ...goal, ownerCode: me }, ...gs]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allExpanded = visible.length > 0 && visible.every((g) => expanded.has(g.id));

  /* -------------------------------------------------------------- render */

  return (
    <PageBody>
      <PageHeader
        title="My Goals"
        description={`${GOAL_PERIOD.label} · ${persona.name} (${me}) · ${goals.length} goals, ${krDone} of ${krTotal} key results complete.`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/reviews">
                <CalendarClock /> Mid-year review
              </Link>
            </Button>
            <Gated menuKey="my.goals" action="C">
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus /> Add goal
              </Button>
            </Gated>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow>
          <StatTile
            label="Weighted completion"
            value={pct(completion, 0)}
            tone={completion >= expected ? "good" : "warning"}
            icon={Target}
            deltaValue={Math.round(completion - expected)}
            deltaSuffix=" pts"
            deltaLabel="vs expected pace"
            goodDirection="up"
            onClick={clearFilters}
            footer={`Expected ${expected}% by ${DEMO_TODAY} · click to clear filters`}
          />
          <StatTile
            label="On track or achieved"
            value={`${onTrack} of ${goals.length}`}
            tone="good"
            icon={CheckCircle2}
            onClick={() => setStatus("on_track")}
            footer="Show only the goals holding their pace"
          />
          <StatTile
            label="Needs attention"
            value={attention}
            tone={attention > 0 ? "critical" : "good"}
            icon={TriangleAlert}
            onClick={() => setStatus("attention")}
            footer="At risk or off track against the elapsed window"
          />
          <StatTile
            label={ACTIVE_CYCLE.name}
            value={`${daysToClose} days left`}
            tone={daysToClose <= 14 ? "warning" : "accent"}
            icon={CalendarClock}
            href="/reviews"
            footer="Self review closes when the window does"
          />
        </StatRow>
      )}

      {allocated !== 100 && !loading && (
        <Alert
          tone={allocated > 100 ? "danger" : "warning"}
          icon={TriangleAlert}
          title={`Goal weightage totals ${allocated}%, not 100%`}
          action={
            <Gated menuKey="my.goals" action="C">
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                Add goal
              </Button>
            </Gated>
          }
        >
          {allocated > 100
            ? `You are ${allocated - 100} points over. Reduce or remove a goal before the cycle closes — calibration will reject an over-allocated sheet.`
            : `${remaining} points are unallocated. A goal sheet has to total exactly 100% before the mid-year review locks.`}
        </Alert>
      )}

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">
            <Target /> My goals
          </TabsTrigger>
          <TabsTrigger value="cascade">
            <GitFork /> Cascade map
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          <div className="flex flex-col gap-3">
            <Section
              bodyClassName="p-2.5"
              className="shadow-none"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="relative">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search goals and key results…"
                    aria-label="Search goals and key results"
                    className="h-7 w-[240px] pr-6 text-xs"
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
                  label="Category"
                  value={category}
                  onValueChange={setCategory}
                  options={GOAL_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  allLabel="All categories"
                  width="w-[170px]"
                />
                <FilterSelect
                  label="Status"
                  value={status}
                  onValueChange={(v) => setStatus(v as StatusFilter)}
                  options={STATUS_OPTIONS}
                  allLabel="All statuses"
                  width="w-[180px]"
                />
                {filtersOn && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X /> Clear filters
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  <Badge variant={allocated === 100 ? "soft" : "muted"} className="tnum">
                    <ShieldCheck className="size-3" aria-hidden />
                    Weightage {allocated} / 100
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setExpanded(allExpanded ? new Set() : new Set(visible.map((g) => g.id)))
                    }
                  >
                    {allExpanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
                    {allExpanded ? "Collapse all" : "Expand all"}
                  </Button>
                </div>
              </div>
            </Section>

            {loading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[132px]" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={Target}
                title={goals.length === 0 ? "No goals set for this cycle yet" : "No goals match these filters"}
                description={
                  goals.length === 0
                    ? `Add your first ${GOAL_PERIOD.label} goal. Weightage across all goals has to total exactly 100%.`
                    : "Nothing in this category and status combination. Clear the filters to see the full sheet."
                }
                action={
                  goals.length === 0 ? (
                    <Gated menuKey="my.goals" action="C">
                      <Button size="sm" onClick={() => setAddOpen(true)}>
                        <Plus /> Add goal
                      </Button>
                    </Gated>
                  ) : (
                    <Button size="sm" variant="outline" onClick={clearFilters}>
                      <X /> Clear filters
                    </Button>
                  )
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {visible.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    expanded={expanded.has(goal.id)}
                    onToggle={() => toggle(goal.id)}
                    onKeyResultProgress={(krId, p) => setKrProgress(goal.id, krId, p)}
                    onCheckIn={() => checkIn(goal)}
                    onMarkAchieved={() => markAchieved(goal)}
                    onRemove={() => setPendingRemove(goal)}
                  />
                ))}
              </div>
            )}

            {loading ? (
              <ChartSkeleton height={220} />
            ) : (
              <BarCompareChart
                title="Progress by goal category"
                description="Weighted achievement against the pace the elapsed window implies. Bars below the expected line are the ones to talk about at check-in."
                data={chartData as unknown as Record<string, string | number>[]}
                xKey="category"
                series={[
                  { key: "achieved", label: "Achieved" },
                  { key: "expected", label: "Expected by today" },
                ]}
                valueFormat={(v) => `${v}%`}
                height={220}
                footnote={`Weightage by category: ${chartData
                  .map((c) => `${c.category} ${c.weightage}%`)
                  .join(" · ")}`}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="cascade">
          <CascadeMap goals={goals} />
        </TabsContent>
      </Tabs>

      <AddGoalDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        remainingWeight={Math.max(0, remaining)}
        parentOptions={parentOptions}
        onCreate={createGoal}
      />
      <RemoveGoalDialog
        goal={pendingRemove}
        onOpenChange={(v) => !v && setPendingRemove(null)}
        onConfirm={removeGoal}
      />
    </PageBody>
  );
}

/* ------------------------------------------------------------ cascade map */

function CascadeMap({ goals }: { goals: Goal[] }) {
  const rows = goals.map((g) => ({
    goal: g,
    children: GOALS.filter((c) => c.cascade?.parentGoalId === g.id),
  }));
  const total = rows.reduce((a, r) => a + r.children.length, 0);

  if (total === 0) {
    return (
      <EmptyState
        icon={GitFork}
        title="Nothing rolls up into your goals yet"
        description="This view shows the goals other people have cascaded into yours. Individual contributors normally see it empty — switch to the Reporting Manager or Tenant Owner persona from the top bar to see a populated cascade."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows
        .filter((r) => r.children.length > 0)
        .map(({ goal, children }) => (
          <Section
            key={goal.id}
            title={goal.title}
            description={`${goal.category} · ${goal.weightage}% weightage · ${children.length} goal${
              children.length === 1 ? "" : "s"
            } rolling up`}
            actions={<StatusBadge status={goal.status} />}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border">
              {children.map((c) => {
                const owner = employeeByCode(c.ownerCode);
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2">
                    <Avatar name={owner?.name ?? c.ownerCode} size={26} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">{c.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <Link
                          href={`/employees/${c.ownerCode}`}
                          className="hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {owner?.name ?? c.ownerCode}
                        </Link>{" "}
                        · {owner?.designation ?? "—"} · {c.category}
                      </p>
                    </div>
                    <div className="hidden w-32 shrink-0 sm:block">
                      <Progress value={c.progress} aria-label={`${c.title} progress`} />
                    </div>
                    <span className="tnum w-10 shrink-0 text-right text-xs font-medium">
                      {c.progress}%
                    </span>
                    <StatusBadge status={c.status} />
                  </li>
                );
              })}
            </ul>
          </Section>
        ))}
    </div>
  );
}
