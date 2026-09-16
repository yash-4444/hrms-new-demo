"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronDown,
  CornerDownRight,
  Flag,
  MoreHorizontal,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, pct } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProgressRing } from "@/components/charts";
import { Avatar, Badge, Field, Input, Progress, Textarea } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import {
  GOAL_CATEGORIES,
  GOAL_PERIOD,
  deriveGoalStatus,
  type Goal,
  type GoalCategory,
  type GoalStatus,
} from "@/mock/growth";
import { DEMO_TODAY } from "@/mock/org";

const RING_TONE: Record<GoalStatus, "good" | "warning" | "critical"> = {
  achieved: "good",
  on_track: "good",
  at_risk: "warning",
  off_track: "critical",
};

/* ========================================================== single goal card */

export function GoalCard({
  goal,
  expanded,
  onToggle,
  onKeyResultProgress,
  onCheckIn,
  onMarkAchieved,
  onRemove,
}: {
  goal: Goal;
  expanded: boolean;
  onToggle: () => void;
  onKeyResultProgress: (krId: string, progress: number) => void;
  onCheckIn: () => void;
  onMarkAchieved: () => void;
  onRemove: () => void;
}) {
  const panelId = `kr-${goal.id}`;
  const done = goal.keyResults.filter((k) => k.progress >= 100).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        <ProgressRing
          value={goal.progress}
          size={54}
          thickness={6}
          tone={RING_TONE[goal.status]}
          sublabel={`${goal.weightage}% wt`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">{goal.title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{goal.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatusBadge status={goal.status} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for goal: ${goal.title}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={onCheckIn}>
                    <Flag /> Log a check-in
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onMarkAchieved} disabled={goal.progress >= 100}>
                    <Target /> Mark every key result achieved
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={onRemove}>
                    <Trash2 /> Remove this goal
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Badge variant="muted">{goal.category}</Badge>
            <span className="tnum">
              Weightage <span className="font-medium text-foreground">{goal.weightage}%</span>
            </span>
            <span className="tnum">
              Progress <span className="font-medium text-foreground">{pct(goal.progress, 0)}</span>
            </span>
            <span className="tnum">Target {fmtDate(goal.targetDate)}</span>
            <span className="tnum">Last check-in {fmtDate(goal.lastCheckIn)}</span>
          </div>

          {goal.cascade && (
            <Link
              href={`/employees/${goal.cascade.parentOwnerCode}`}
              title={`Open ${goal.cascade.parentOwnerName}'s profile`}
              className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary/25 bg-primary-soft px-1.5 py-1 text-xs text-primary-soft-foreground transition-colors hover:bg-primary-soft/70 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CornerDownRight className="size-3 shrink-0" aria-hidden />
              <span className="shrink-0 font-medium">Rolls up to:</span>
              <span className="truncate">{goal.cascade.parentGoalTitle}</span>
              <span aria-hidden>·</span>
              <Avatar name={goal.cascade.parentOwnerName} size={16} />
              <span className="shrink-0">{goal.cascade.parentOwnerName}</span>
              <span className="shrink-0 opacity-70">{goal.cascade.parentOwnerCode}</span>
            </Link>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="mt-2 inline-flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
            {expanded ? "Hide" : "Show"} {goal.keyResults.length} key results
            <span className="tnum font-normal text-muted-foreground">
              ({done}/{goal.keyResults.length} complete)
            </span>
          </button>
        </div>
      </div>

      {expanded && (
        <div id={panelId} className="border-t border-border bg-subtle px-3 py-2.5">
          <ul className="flex flex-col gap-2.5">
            {goal.keyResults.map((kr) => (
              <li key={kr.id} className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-xs text-foreground">{kr.title}</p>
                  <span className="tnum shrink-0 text-xs font-medium text-foreground">
                    {pct(kr.progress, 0)}
                  </span>
                </div>
                <Progress value={kr.progress} aria-label={`${kr.title} progress`} />
                <Gated menuKey="my.goals" action="E">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={kr.progress}
                    aria-label={`Set progress for key result: ${kr.title}`}
                    aria-valuetext={`${kr.progress} per cent`}
                    onChange={(e) => onKeyResultProgress(kr.id, Number(e.target.value))}
                    onPointerUp={() => announceKr(kr.title, kr.progress)}
                    onKeyUp={(e) => {
                      if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
                        announceKr(kr.title, kr.progress);
                      }
                    }}
                    className="h-4 w-full cursor-pointer accent-[var(--primary)]"
                  />
                </Gated>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function announceKr(title: string, progress: number) {
  mockAction("Key result updated", {
    description: `${title} — now ${progress}%. Goal progress and status recalculated.`,
  });
}

/* ------------------------------------------------------------- add goal */

const CATEGORY_VALUES = GOAL_CATEGORIES as [GoalCategory, ...GoalCategory[]];

export interface ParentGoalOption {
  id: string;
  title: string;
  ownerCode: string;
  ownerName: string;
}

export function AddGoalDialog({
  open,
  onOpenChange,
  remainingWeight,
  parentOptions,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 100 minus the weight already allocated to this owner's goals. */
  remainingWeight: number;
  parentOptions: ParentGoalOption[];
  onCreate: (goal: Goal) => void;
}) {
  const schema = React.useMemo(
    () =>
      z
        .object({
          title: z.string().trim().min(12, "Write a specific, measurable title — at least 12 characters."),
          description: z
            .string()
            .trim()
            .min(20, "Say what 'done' looks like, in at least 20 characters."),
          category: z.enum(CATEGORY_VALUES),
          weightage: z
            .number({ message: "Enter a weightage between 5 and 100." })
            .int("Use whole percentage points.")
            .min(5, "A goal worth less than 5% is not worth tracking separately.")
            .max(100, "A single goal cannot be worth more than 100%."),
          targetDate: z
            .string()
            .min(1, "Pick a target date.")
            .refine((v) => v > DEMO_TODAY, "The target date has to be in the future.")
            .refine(
              (v) => v <= GOAL_PERIOD.end,
              `Goals must land inside ${GOAL_PERIOD.label} — on or before ${GOAL_PERIOD.end}.`,
            ),
          parentGoalId: z.string(),
          keyResults: z
            .string()
            .trim()
            .min(6, "Add at least one key result, one per line.")
            .refine(
              (v) => v.split("\n").filter((l) => l.trim().length > 3).length <= 5,
              "Five key results is the maximum — anything more is a goal in disguise.",
            ),
        })
        .superRefine((d, ctx) => {
          if (d.weightage > remainingWeight) {
            ctx.addIssue({
              code: "custom",
              path: ["weightage"],
              message:
                remainingWeight <= 0
                  ? "All 100% is already allocated. Lower another goal's weightage before adding this one."
                  : `Only ${remainingWeight}% of weightage is left. Total across all your goals must stay at or below 100%.`,
            });
          }
        }),
    [remainingWeight],
  );

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      category: "Business",
      weightage: Math.min(20, Math.max(5, remainingWeight)),
      targetDate: GOAL_PERIOD.end,
      parentGoalId: "none",
      keyResults: "",
    },
  });

  const category = watch("category");
  const parentGoalId = watch("parentGoalId");

  const close = React.useCallback(
    (v: boolean) => {
      if (!v) reset();
      onOpenChange(v);
    },
    [onOpenChange, reset],
  );

  const submit = handleSubmit((values) => {
    const parent = parentOptions.find((p) => p.id === values.parentGoalId) ?? null;
    const titles = values.keyResults
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 3);
    const id = `GOL-NEW-${Date.now().toString(36).toUpperCase()}`;
    const goal: Goal = {
      id,
      ownerCode: "",
      title: values.title,
      description: values.description,
      category: values.category,
      weightage: values.weightage,
      progress: 0,
      startDate: DEMO_TODAY,
      targetDate: values.targetDate,
      status: deriveGoalStatus(0, DEMO_TODAY, values.targetDate),
      keyResults: titles.map((title, i) => ({
        id: `${id}-KR${i + 1}`,
        title,
        progress: 0,
        dueDate: values.targetDate,
      })),
      cascade: parent
        ? {
            parentGoalId: parent.id,
            parentGoalTitle: parent.title,
            parentOwnerCode: parent.ownerCode,
            parentOwnerName: parent.ownerName,
          }
        : null,
      lastCheckIn: DEMO_TODAY,
    };
    onCreate(goal);
    mockAction("Goal created", {
      description: `${values.title} · ${values.weightage}% weightage · ${titles.length} key result${
        titles.length === 1 ? "" : "s"
      }.`,
    });
    close(false);
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Add a goal</DialogTitle>
          <DialogDescription>
            {GOAL_PERIOD.label} · <span className="tnum">{remainingWeight}%</span> of weightage still
            unallocated. Every employee&apos;s goals must total exactly 100%.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate>
          <DialogBody className="flex flex-col gap-3.5">
            {remainingWeight <= 0 && (
              <p
                role="alert"
                className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-fg"
              >
                All 100% is already allocated. Lower the weightage on an existing goal before adding
                another one — this form will block the submit until then.
              </p>
            )}

            <Field label="Goal title" htmlFor="goal-title" required error={errors.title?.message}>
              <Input
                id="goal-title"
                placeholder="Cut p95 checkout latency from 840 ms to under 400 ms"
                aria-invalid={!!errors.title}
                {...register("title")}
              />
            </Field>

            <Field
              label="What does done look like?"
              htmlFor="goal-desc"
              required
              error={errors.description?.message}
            >
              <Textarea
                id="goal-desc"
                rows={3}
                placeholder="Describe the outcome, the baseline you are moving from, and how it will be measured."
                aria-invalid={!!errors.description}
                {...register("description")}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <Field label="Category" required error={errors.category?.message}>
                <Select
                  value={category}
                  onValueChange={(v) => setValue("category", v as GoalCategory, { shouldValidate: true })}
                >
                  <SelectTrigger aria-label="Category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Weightage %"
                htmlFor="goal-weight"
                required
                error={errors.weightage?.message}
                hint={`${remainingWeight}% unallocated`}
              >
                <Input
                  id="goal-weight"
                  type="number"
                  min={5}
                  max={100}
                  step={1}
                  className="tnum"
                  aria-invalid={!!errors.weightage}
                  {...register("weightage", { valueAsNumber: true })}
                />
              </Field>

              <Field label="Target date" htmlFor="goal-date" required error={errors.targetDate?.message}>
                <Input
                  id="goal-date"
                  type="date"
                  className="tnum"
                  aria-invalid={!!errors.targetDate}
                  {...register("targetDate")}
                />
              </Field>
            </div>

            <Field
              label="Rolls up to"
              error={errors.parentGoalId?.message}
              hint="Cascading makes the roll-up visible on your manager's own goal page."
            >
              <Select
                value={parentGoalId}
                onValueChange={(v) => setValue("parentGoalId", v, { shouldValidate: true })}
              >
                <SelectTrigger aria-label="Parent goal">
                  <SelectValue placeholder="No parent goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent — this goal stands alone</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} · {p.ownerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Key results"
              htmlFor="goal-krs"
              required
              error={errors.keyResults?.message}
              hint="One per line, up to five. Each should carry a number you can check."
            >
              <Textarea
                id="goal-krs"
                rows={4}
                placeholder={
                  "Remove the synchronous tax lookup from the request path\nHold p95 under 400 ms for four consecutive weeks"
                }
                aria-invalid={!!errors.keyResults}
                {...register("keyResults")}
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              <Plus /> Create goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------ remove goal */

export function RemoveGoalDialog({
  goal,
  onOpenChange,
  onConfirm,
}: {
  goal: Goal | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (goal: Goal) => void;
}) {
  return (
    <ConfirmDialog
      open={!!goal}
      onOpenChange={onOpenChange}
      destructive
      title="Remove this goal?"
      confirmLabel="Remove goal"
      description={
        goal ? (
          <>
            <span className="font-medium text-foreground">{goal.title}</span> and its{" "}
            {goal.keyResults.length} key results will be removed. Your remaining goals will total{" "}
            <span className="tnum font-medium text-foreground">{100 - goal.weightage}%</span>, so you will
            need to re-weight before the cycle closes.
          </>
        ) : undefined
      }
      onConfirm={() => goal && onConfirm(goal)}
    />
  );
}
