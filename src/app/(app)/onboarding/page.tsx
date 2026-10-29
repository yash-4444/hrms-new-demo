"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { AlertTriangle, CalendarClock, CheckCircle2, Circle, ListChecks, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Hint, Progress } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { PersonCell } from "@/components/people/person-cell";
import { OnboardingSheet } from "@/components/lifecycle/onboarding-sheet";
import { AssignTaskDialog, type AssignTaskValues } from "@/components/lifecycle/assign-task-dialog";
import type { ChecklistSuggestion } from "@/components/lifecycle/ai-checklist";
import { DEMO_TODAY, branchById, deptName } from "@/mock/org";
import {
  ONBOARDING,
  READINESS_KEYS,
  TEMPLATES,
  instanceProgress,
  offsetLabel,
  type OnboardingInstance,
  type OnboardingTask,
} from "@/mock/lifecycle";

/* ============================================================================
   /onboarding — every joiner from offer-accepted to the end of month one.
   Task state is local and optimistic; completing a task moves the progress
   bar, the readiness chips and the KPI row in the same tick.
   ========================================================================== */

const dToJoin = (i: OnboardingInstance) => differenceInCalendarDays(parseISO(i.joiningDate), parseISO(DEMO_TODAY));
const overdueCount = (i: OnboardingInstance) => i.tasks.filter((t) => t.status === "overdue").length;

export default function OnboardingPage() {
  const loading = useFakeLoad();
  const [items, setItems] = React.useState<OnboardingInstance[]>(() => ONBOARDING.map((i) => ({ ...i, tasks: [...i.tasks] })));
  const [period, setPeriod] = React.useState("all");
  const [branch, setBranch] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [assign, setAssign] = React.useState<{ instance: OnboardingInstance; task: OnboardingTask | null } | null>(null);

  const selected = items.find((x) => x.id === selectedId) ?? null;

  const patchInstance = (id: string, fn: (i: OnboardingInstance) => OnboardingInstance) =>
    setItems((xs) => xs.map((x) => (x.id === id ? fn(x) : x)));

  const complete = (id: string, task: OnboardingTask) => {
    patchInstance(id, (i) => ({
      ...i,
      tasks: i.tasks.map((t) => (t.key === task.key ? { ...t, status: "done", completedOn: DEMO_TODAY, escalatedTo: null } : t)),
    }));
    mockAction("Task completed", { description: `${task.title} — marked done ${fmtDate(DEMO_TODAY)}.` });
  };

  const saveAssign = (v: AssignTaskValues) => {
    if (!assign) return;
    const { instance, task } = assign;
    const offset = differenceInCalendarDays(parseISO(v.due), parseISO(instance.joiningDate));
    patchInstance(instance.id, (i) => ({
      ...i,
      tasks: task
        ? i.tasks.map((t) => (t.key === task.key ? { ...t, owner: v.owner, assigneeCode: v.assigneeCode, due: v.due, slaHours: v.slaHours, status: "pending", escalatedTo: null } : t))
        : [
            ...i.tasks,
            { key: `custom-${i.tasks.length + 1}`, title: v.title, owner: v.owner, offset, slaHours: v.slaHours, due: v.due, status: "pending", assigneeCode: v.assigneeCode, completedOn: null, escalatedTo: null },
          ],
    }));
    mockAction(task ? "Task re-assigned" : "Task assigned", {
      description: `${task?.title ?? v.title} — due ${fmtDate(v.due)} for ${instance.joinerName}. The owner is notified by email and in-app.`,
    });
  };

  const addSuggestion = (id: string, s: ChecklistSuggestion) => {
    patchInstance(id, (i) => {
      const due = format(addDays(parseISO(i.joiningDate), s.offset), "yyyy-MM-dd");
      const assignee = s.owner === "Manager" ? i.managerCode : s.owner === "Employee" ? (i.employeeCode ?? "") : s.owner === "IT" ? "STL-0314" : s.owner === "Finance" ? "STL-0017" : "STL-0305";
      return { ...i, tasks: [...i.tasks, { key: s.key, title: s.title, owner: s.owner, offset: s.offset, slaHours: 24, due, status: "pending", assigneeCode: assignee, completedOn: null, escalatedTo: null }] };
    });
    mockAction("AI suggestion added to the checklist", { description: `${s.title} (${offsetLabel(s.offset)}) — you accepted it; it now behaves like any template task.` });
  };

  const rows = items.filter((i) => {
    const d = dToJoin(i);
    const w = period === "all" || (period === "upcoming" ? d > 0 : d <= 0);
    return w && (branch === "all" || i.branchId === branch);
  });

  const kpi = React.useMemo(() => {
    const upcoming = items.filter((i) => dToJoin(i) > 0 && dToJoin(i) <= 30);
    const overdue = items.reduce((a, i) => a + overdueCount(i), 0);
    const nextWeek = items.filter((i) => dToJoin(i) > 0 && dToJoin(i) <= 21);
    const ready = nextWeek.filter((i) => READINESS_KEYS.every((r) => i.tasks.find((t) => t.key === r.key)?.status === "done")).length;
    const avg = Math.round(items.reduce((a, i) => a + instanceProgress(i), 0) / Math.max(1, items.length));
    return { upcoming: upcoming.length, overdue, ready, nextWeek: nextWeek.length, avg };
  }, [items]);

  const columns = React.useMemo<ColumnDef<OnboardingInstance, unknown>[]>(
    () => [
      {
        id: "joiner",
        header: "Joiner",
        accessorKey: "joinerName",
        enableHiding: false,
        cell: ({ row }) => (
          <PersonCell
            name={row.original.joinerName}
            subtitle={row.original.role}
            href={row.original.employeeCode ? `/employees/${row.original.employeeCode}` : row.original.candidateId ? `/candidates/${row.original.candidateId}` : undefined}
          />
        ),
      },
      { id: "dept", header: "Department", accessorFn: (i) => deptName(i.departmentId) },
      { id: "branch", header: "Location", accessorFn: (i) => branchById(i.branchId)?.city ?? i.branchId },
      {
        id: "joining",
        header: "Joining",
        accessorKey: "joiningDate",
        cell: ({ row }) => {
          const d = dToJoin(row.original);
          return (
            <span className="tnum whitespace-nowrap">
              {fmtDate(row.original.joiningDate)}
              <span className="block text-[11px] text-muted-foreground">{d > 0 ? `in ${d} days` : d === 0 ? "today" : `Day ${-d + 1}`}</span>
            </span>
          );
        },
      },
      {
        id: "progress",
        header: "Progress",
        accessorFn: (i) => instanceProgress(i),
        cell: ({ row }) => {
          const p = instanceProgress(row.original);
          return (
            <span className="flex w-28 items-center gap-2">
              <Progress value={p} tone={p === 100 ? "success" : "accent"} aria-label={`${p}% complete`} />
              <span className="tnum text-[11px]">{p}%</span>
            </span>
          );
        },
      },
      {
        id: "readiness",
        header: "Day-1 readiness",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex gap-1">
            {READINESS_KEYS.map((r) => {
              const t = row.original.tasks.find((x) => x.key === r.key);
              const ok = t?.status === "done";
              const late = t?.status === "overdue";
              const Icon = ok ? CheckCircle2 : late ? AlertTriangle : Circle;
              return (
                <Hint key={r.key} text={`${r.label}: ${ok ? "done" : late ? "overdue" : t ? `due ${fmtDate(t.due)}` : "not in template"}`}>
                  <span className={cn("inline-flex", ok ? "text-success-fg" : late ? "text-destructive-fg" : "text-muted-foreground")} aria-label={`${r.label}: ${ok ? "done" : late ? "overdue" : "pending"}`}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                </Hint>
              );
            })}
          </span>
        ),
      },
      {
        id: "overdue",
        header: "Overdue",
        accessorFn: (i) => overdueCount(i),
        cell: ({ row }) => {
          const n = overdueCount(row.original);
          return n ? <span className="tnum font-medium text-destructive-fg">{n} escalated</span> : <span className="text-muted-foreground">—</span>;
        },
      },
      { id: "template", header: "Template", accessorFn: (i) => TEMPLATES.find((t) => t.id === i.templateId)?.name ?? i.templateId },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Onboarding"
        description="Every joiner from offer accepted to the end of month one. Checklists are generated from templates on offer acceptance; tasks escalate automatically one day after their SLA."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link href="/onboarding/templates">
              <ListChecks aria-hidden /> Checklist templates
            </Link>
          </Button>
        }
      />
      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow>
          <StatTile label="Joining in 30 days" value={kpi.upcoming} icon={UserPlus} hint="Offers accepted with a joining date ahead" onClick={() => setPeriod("upcoming")} />
          <StatTile label="Day-1 ready (next 3 weeks)" value={`${kpi.ready} / ${kpi.nextWeek}`} icon={CheckCircle2} hint="Laptop, email, ID card and buddy all done" tone={kpi.ready < kpi.nextWeek ? "warning" : "good"} />
          <StatTile label="Overdue tasks" value={kpi.overdue} icon={AlertTriangle} hint="Escalated to the owner's lead" tone={kpi.overdue ? "critical" : "good"} />
          <StatTile label="Average checklist progress" value={`${kpi.avg}%`} icon={CalendarClock} />
        </StatRow>
      )}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchKeys={["joinerName", "role"]}
          searchPlaceholder="Search joiners…"
          getRowId={(r) => r.id}
          onRowClick={(r) => setSelectedId(r.id)}
          rowTone={(r) => (overdueCount(r) ? "warning" : undefined)}
          exportName="onboarding"
          emptyIcon={UserPlus}
          emptyTitle="No joiners match these filters"
          emptyDescription="Clear the filters to see every joiner in the onboarding window."
          filters={
            <>
              <FilterSelect label="Window" value={period} onValueChange={setPeriod} options={[{ value: "upcoming", label: "Upcoming joiners" }, { value: "joined", label: "Joined — first month" }]} />
              <FilterSelect label="Location" value={branch} onValueChange={setBranch} options={["BLR", "PNQ", "EWR"].map((b) => ({ value: b, label: branchById(b)?.city ?? b }))} />
            </>
          }
        />
      )}

      <OnboardingSheet
        instance={selected}
        open={!!selected}
        onOpenChange={(v) => !v && setSelectedId(null)}
        onComplete={complete}
        onAssign={(instance, task) => setAssign({ instance, task })}
        onAddSuggestion={addSuggestion}
      />
      {assign && (
        <AssignTaskDialog
          open={!!assign}
          onOpenChange={(v) => !v && setAssign(null)}
          joinerName={assign.instance.joinerName}
          joinerCode={assign.instance.employeeCode}
          managerCode={assign.instance.managerCode}
          task={assign.task}
          onSave={saveAssign}
        />
      )}
    </PageBody>
  );
}
