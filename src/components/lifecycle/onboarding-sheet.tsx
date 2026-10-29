"use client";

import * as React from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { AlertTriangle, Check, CheckCircle2, Circle, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { useApp } from "@/components/app-state";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { deptName, branchById, DEMO_TODAY } from "@/mock/org";
import { employeeByCode } from "@/mock/employees";
import {
  READINESS_KEYS,
  TASK_OWNERS,
  assigneeName,
  instanceProgress,
  offsetLabel,
  type OnboardingInstance,
  type OnboardingTask,
} from "@/mock/lifecycle";
import { LcBadge, OwnerChip } from "./kit";
import { AiChecklistPanel, type ChecklistSuggestion } from "./ai-checklist";

/* ============================================================================
   One joiner's onboarding: Day-1 readiness, tasks grouped by owner with SLA
   and escalation, and the AI checklist additions.
   ========================================================================== */

export function OnboardingSheet({
  instance,
  open,
  onOpenChange,
  onComplete,
  onAssign,
  onAddSuggestion,
}: {
  instance: OnboardingInstance | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete: (instanceId: string, task: OnboardingTask) => void;
  onAssign: (instance: OnboardingInstance, task: OnboardingTask | null) => void;
  onAddSuggestion: (instanceId: string, s: ChecklistSuggestion) => void;
}) {
  const { can } = useApp();
  if (!instance) return null;
  const i = instance;
  const progress = instanceProgress(i);
  const dToJoin = differenceInCalendarDays(parseISO(i.joiningDate), parseISO(DEMO_TODAY));
  const joinerName = (task: OnboardingTask) =>
    task.owner === "Employee" ? i.joinerName : assigneeName(task.assigneeCode, task.owner === "Manager" ? "Reporting manager" : task.owner);
  const canEdit = can("lifecycle.onboarding", "E");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{i.joinerName}</SheetTitle>
          <SheetDescription>
            {i.role} · {deptName(i.departmentId)} · {branchById(i.branchId)?.city} · joins {fmtDate(i.joiningDate)}{" "}
            {dToJoin > 0 ? `(in ${dToJoin} days)` : dToJoin === 0 ? "(today)" : `(Day ${-dToJoin + 1})`}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="scrollbar-thin flex flex-col gap-5 overflow-y-auto">
          <div className="flex items-center gap-3">
            <Progress value={progress} tone={progress === 100 ? "success" : "accent"} aria-label="Checklist progress" />
            <span className="tnum shrink-0 text-xs font-medium">{progress}%</span>
          </div>

          <section aria-labelledby="ready-h">
            <h3 id="ready-h" className="text-xs font-semibold">
              Day-1 readiness
            </h3>
            <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {READINESS_KEYS.map((r) => {
                const t = i.tasks.find((x) => x.key === r.key);
                const ok = t?.status === "done";
                const late = t?.status === "overdue";
                return (
                  <li
                    key={r.key}
                    className={cn(
                      "flex flex-col gap-1 rounded-md border px-2.5 py-2 text-xs",
                      ok ? "border-success/25 bg-success-soft text-success-fg" : late ? "border-destructive/25 bg-destructive-soft text-destructive-fg" : "border-border bg-subtle",
                    )}
                  >
                    <span className="flex items-center gap-1 font-medium">
                      {ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : late ? <AlertTriangle className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
                      {r.label}
                    </span>
                    <span className="tnum text-[11px] opacity-80">{ok ? `Done ${fmtDate(t!.completedOn!)}` : t ? `Due ${fmtDate(t.due)}` : "Not in template"}</span>
                  </li>
                );
              })}
            </ul>
            {i.buddyCode && <p className="mt-1.5 text-[11px] text-muted-foreground">Buddy: {employeeByCode(i.buddyCode)?.name}</p>}
          </section>

          <section aria-labelledby="ai-h" className="flex flex-col gap-2">
            <h3 id="ai-h" className="text-xs font-semibold">
              Role- and location-specific additions
            </h3>
            <AiChecklistPanel key={i.id} instance={i} canEdit={canEdit} onAccept={(s) => onAddSuggestion(i.id, s)} />
          </section>

          <section aria-labelledby="tasks-h" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 id="tasks-h" className="text-xs font-semibold">
                Tasks by owner
              </h3>
              <Gated menuKey="lifecycle.onboarding" action="C">
                <Button size="sm" variant="outline" onClick={() => onAssign(i, null)}>
                  <UserCog aria-hidden /> Assign task
                </Button>
              </Gated>
            </div>
            {TASK_OWNERS.map((owner) => {
              const tasks = i.tasks.filter((t) => t.owner === owner);
              if (!tasks.length) return null;
              const open = tasks.filter((t) => t.status !== "done").length;
              return (
                <div key={owner} className="rounded-md border border-border">
                  <div className="flex items-center justify-between border-b border-border bg-subtle px-3 py-1.5">
                    <OwnerChip owner={owner} />
                    <span className="tnum text-[11px] text-muted-foreground">
                      {tasks.length - open}/{tasks.length} done
                    </span>
                  </div>
                  <ul className="divide-y divide-border">
                    {tasks.map((t) => (
                      <li key={t.key} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs", t.status === "overdue" && "bg-destructive-soft/40")}>
                        <div className="min-w-0 flex-1">
                          <p className={cn("font-medium", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</p>
                          <p className="tnum text-[11px] text-muted-foreground">
                            {offsetLabel(t.offset)} · due {fmtDate(t.due)} · SLA {t.slaHours}h · {joinerName(t)}
                          </p>
                          {t.escalatedTo && (
                            <p className="mt-0.5 text-[11px] font-medium text-destructive-fg">
                              Escalated to {t.escalatedTo} · {differenceInCalendarDays(parseISO(DEMO_TODAY), parseISO(t.due))} days past due
                            </p>
                          )}
                        </div>
                        <LcBadge status={t.status} />
                        {t.status !== "done" && (
                          <div className="flex gap-1">
                            <Gated menuKey="lifecycle.onboarding" action="E">
                              <Button size="sm" variant="outline" onClick={() => onComplete(i.id, t)}>
                                <Check aria-hidden /> Complete
                              </Button>
                            </Gated>
                            <Gated menuKey="lifecycle.onboarding" action="C">
                              <Button size="sm" variant="ghost" onClick={() => onAssign(i, t)}>
                                Re-assign
                              </Button>
                            </Gated>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
