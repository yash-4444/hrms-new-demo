"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Grid3x3,
  Info,
  RotateCcw,
  TriangleAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { num, pct } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import {
  BOX_LEVELS,
  CALIBRATION_CHIPS,
  CALIBRATION_COHORT,
  INITIAL_PLACEMENT,
  NINE_BOXES,
  boxAt,
  boxAxisLabel,
  boxById,
  boxDistribution,
  ratingDistribution,
  type BoxLevel,
  type CalibrationChip,
} from "@/mock/growth";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Avatar, Badge, Hint, Skeleton } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { BarCompareChart, DivergingBarChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";
import { CalibrationBiasHint } from "@/components/ai/embed/review-calibration-bias";

/* ============================================================================
   /reviews/calibration — the 9-box.

   Drag-and-drop uses the native HTML5 API (no library). Every chip also carries
   a "Move to box…" menu so the whole screen is operable from the keyboard.
   Box fills come from the chart layer's sequential ramp via `seqIndex`, so the
   grid reads as one hue light→dark rather than a rainbow.
   ========================================================================== */

const SEQ_VAR = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)", "var(--seq-6)", "var(--seq-7)"];

export default function CalibrationPage() {
  const loading = useFakeLoad();

  const [placement, setPlacement] = React.useState<Record<string, string>>(INITIAL_PLACEMENT);
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [overBox, setOverBox] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  const chipByCode = React.useMemo(
    () => new Map(CALIBRATION_CHIPS.map((c) => [c.employeeCode, c])),
    [],
  );

  const distribution = React.useMemo(() => boxDistribution(placement), [placement]);
  const ratings = React.useMemo(() => ratingDistribution(placement), [placement]);
  const moved = React.useMemo(
    () => Object.keys(placement).filter((k) => placement[k] !== INITIAL_PLACEMENT[k]).length,
    [placement],
  );

  const move = (employeeCode: string, boxId: string) => {
    if (placement[employeeCode] === boxId) return;
    const from = boxById(placement[employeeCode]);
    const to = boxById(boxId);
    setPlacement((p) => ({ ...p, [employeeCode]: boxId }));
    mockAction(`${employeeName(employeeCode)} moved`, {
      description: `${from.name} → ${to.name}. Proposed rating becomes ${to.rating}.`,
    });
  };

  const reset = () => {
    setPlacement(INITIAL_PLACEMENT);
    mockAction("Placement reset", { description: "Back to the managers' original proposals." });
  };

  const chipsInBox = (boxId: string) =>
    CALIBRATION_CHIPS.filter((c) => placement[c.employeeCode] === boxId);

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Calibration" description="Loading the cohort…" />
        <Skeleton className="h-[520px]" />
      </PageBody>
    );
  }

  const overTarget = distribution.filter((d) => d.deltaPct > 4);

  return (
    <PageBody>
      <PageHeader
        title="Calibration"
        description={`${CALIBRATION_COHORT.departmentName} cohort · ${num(CALIBRATION_CHIPS.length)} employees · facilitated by ${employeeName(CALIBRATION_COHORT.facilitatorCode)}. Drag a chip between boxes, or use its Move menu.`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/reviews">
                <ArrowLeft /> Back to reviews
              </Link>
            </Button>
            {moved > 0 && (
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw /> Reset ({moved})
              </Button>
            )}
            <Gated menuKey="growth.calibration" action="A">
              <Button
                size="sm"
                onClick={() =>
                  mockAction("Calibration locked", {
                    description: `${num(CALIBRATION_CHIPS.length)} ratings released to the review cycle.`,
                  })
                }
              >
                <Check /> Lock calibration
              </Button>
            </Gated>
          </>
        }
      />

      <StatRow cols={4}>
        <StatTile label="In cohort" value={num(CALIBRATION_CHIPS.length)} icon={Users} hint={CALIBRATION_COHORT.departmentName} />
        <StatTile label="Moved from proposal" value={num(moved)} icon={Grid3x3} tone={moved > 0 ? "warning" : "neutral"} hint="Changes not yet locked" />
        <StatTile
          label="Flagged by managers"
          value={num(CALIBRATION_CHIPS.filter((c) => c.flagged).length)}
          icon={TriangleAlert}
          tone="warning"
          hint="Proposal disagrees with the box"
        />
        <StatTile
          label="Boxes over target"
          value={num(overTarget.length)}
          icon={Info}
          tone={overTarget.length > 2 ? "warning" : "good"}
          hint="More than 4 points above the healthy share"
        />
      </StatRow>

      {overTarget.length > 0 && (
        <Alert tone="warning" icon={TriangleAlert} title="Distribution is skewed">
          {overTarget
            .map((d) => `${d.name} is ${pct(d.deltaPct)} above its ${pct(d.targetPct, 0)} target`)
            .join(" · ")}
          . Calibration exists to correct exactly this.
        </Alert>
      )}

      <CalibrationBiasHint />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------- the 9-box */}
        <Section
          title="9-box grid"
          description="Performance across, potential up. Drop a chip anywhere; the histogram beside it updates live."
          bodyClassName="p-3"
        >
          <div className="flex gap-2">
            {/* y axis */}
            <div className="flex w-5 shrink-0 flex-col-reverse justify-around">
              {BOX_LEVELS.map((lvl) => (
                <span
                  key={lvl}
                  className="rotate-180 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                  style={{ writingMode: "vertical-rl" }}
                >
                  {boxAxisLabel(lvl)}
                </span>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-3 gap-2">
                {/* rows rendered high potential first */}
                {[...BOX_LEVELS].reverse().map((potential) =>
                  BOX_LEVELS.map((performance) => {
                    const box = boxAt(performance as BoxLevel, potential as BoxLevel);
                    const chips = chipsInBox(box.id);
                    const dist = distribution.find((d) => d.boxId === box.id)!;
                    const isOver = overBox === box.id;
                    return (
                      <div
                        key={box.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setOverBox(box.id);
                        }}
                        onDragLeave={() => setOverBox((b) => (b === box.id ? null : b))}
                        onDrop={(e) => {
                          e.preventDefault();
                          setOverBox(null);
                          const code = e.dataTransfer.getData("text/plain") || dragging;
                          if (code) move(code, box.id);
                          setDragging(null);
                        }}
                        className={cn(
                          "flex min-h-[148px] flex-col rounded-md border transition-colors",
                          isOver ? "border-primary ring-2 ring-ring" : "border-border",
                        )}
                      >
                        <div
                          className="flex items-start justify-between gap-1 rounded-t-[5px] px-2 py-1.5"
                          style={{
                            background: SEQ_VAR[box.seqIndex] ?? "var(--muted)",
                            color: box.seqIndex >= 4 ? "#ffffff" : "var(--chart-ink)",
                          }}
                        >
                          <span className="min-w-0">
                            <Hint text={box.guidance}>
                              <span className="block truncate text-[11px] font-semibold">{box.name}</span>
                            </Hint>
                            <span className="tnum block text-[9px] opacity-85">
                              rating {box.rating} · target {pct(box.targetPct, 0)}
                            </span>
                          </span>
                          <span className="tnum shrink-0 text-right">
                            <span className="block text-xs font-bold">{dist.count}</span>
                            <span
                              className={cn(
                                "block text-[9px] font-medium",
                                Math.abs(dist.deltaPct) < 2 ? "opacity-80" : "",
                              )}
                            >
                              {dist.deltaPct > 0 ? "+" : ""}
                              {dist.deltaPct.toFixed(0)}pt
                            </span>
                          </span>
                        </div>

                        <ul className="scrollbar-thin flex max-h-[170px] flex-1 flex-col gap-1 overflow-y-auto p-1.5">
                          {chips.map((c) => (
                            <ChipCard
                              key={c.employeeCode}
                              chip={c}
                              currentBox={box.id}
                              dragging={dragging === c.employeeCode}
                              selected={selected === c.employeeCode}
                              onSelect={() =>
                                setSelected((s) => (s === c.employeeCode ? null : c.employeeCode))
                              }
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", c.employeeCode);
                                e.dataTransfer.effectAllowed = "move";
                                setDragging(c.employeeCode);
                              }}
                              onDragEnd={() => {
                                setDragging(null);
                                setOverBox(null);
                              }}
                              onMove={(boxId) => move(c.employeeCode, boxId)}
                            />
                          ))}
                          {chips.length === 0 && (
                            <li className="flex flex-1 items-center justify-center text-[10px] text-muted-foreground">
                              Drop here
                            </li>
                          )}
                        </ul>
                      </div>
                    );
                  }),
                )}
              </div>

              {/* x axis */}
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {BOX_LEVELS.map((lvl) => (
                  <span
                    key={lvl}
                    className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {boxAxisLabel(lvl)}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-center text-[10px] text-muted-foreground">
                Performance →&nbsp;&nbsp;|&nbsp;&nbsp;↑ Potential
              </p>
            </div>
          </div>
        </Section>

        {/* ----------------------------------------------- the histogram */}
        <div className="flex flex-col gap-3">
          <BarCompareChart
            title="Rating distribution"
            description="Derived from the live placement — move a chip and this moves with it."
            data={ratings.map((r) => ({ name: `${r.rating} · ${r.label}`, employees: r.count }))}
            xKey="name"
            series={[{ key: "employees", label: "Employees" }]}
            horizontal
            height={220}
            footnote={`${num(CALIBRATION_CHIPS.length)} employees placed. Every box maps to exactly one rating.`}
          />

          <DivergingBarChart
            title="Actual versus target share"
            description="How far each box sits from its healthy distribution. Blue is under target, red is over."
            data={distribution.map((d) => ({ name: d.name, value: d.deltaPct }))}
            valueFormat={(v) => `${v.toFixed(1)}pt`}
            footnote="A box more than 4 points over target usually means grade inflation, not a great team."
          />
        </div>
      </div>

      {/* -------------------------------------------------- box guidance */}
      <Section title="What each box means" description="The guidance facilitators read out before a calibration session starts.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {NINE_BOXES.map((b) => {
            const dist = distribution.find((d) => d.boxId === b.id)!;
            return (
              <div key={b.id} className="rounded-md border border-border p-2.5">
                <p className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-[2px]"
                      style={{ background: SEQ_VAR[b.seqIndex] }}
                    />
                    <span className="text-xs font-semibold">{b.name}</span>
                  </span>
                  <span className="tnum text-[11px] text-muted-foreground">
                    {dist.count} · {pct(dist.actualPct, 0)}
                  </span>
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{b.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{b.guidance}</p>
              </div>
            );
          })}
        </div>
      </Section>
    </PageBody>
  );
}

/* ------------------------------------------------------------- the chip */

function ChipCard({
  chip,
  currentBox,
  dragging,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  chip: CalibrationChip;
  currentBox: string;
  dragging: boolean;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onMove: (boxId: string) => void;
}) {
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex cursor-grab items-center gap-1.5 rounded border border-border bg-card px-1.5 py-1 active:cursor-grabbing",
        dragging && "opacity-40",
        selected && "ring-2 ring-ring",
      )}
    >
      <Avatar name={chip.name} size={18} />
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${chip.name}, ${chip.designation}, currently in ${boxById(currentBox).name}`}
      >
        <span className="block truncate text-[10px] font-medium leading-tight">{chip.name}</span>
        <span className="tnum block truncate text-[9px] leading-tight text-muted-foreground">
          {chip.gradeId} · {chip.managerRating.toFixed(1)}
        </span>
      </button>

      {chip.flagged && (
        <Hint text="The manager's proposed rating disagrees with this box">
          <TriangleAlert className="size-3 shrink-0 text-warning-fg" aria-hidden />
        </Hint>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Move ${chip.name} to another box`}
            className="shrink-0 rounded px-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
          >
            ⋯
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[220px]">
          <DropdownMenuLabel>Move {chip.name.split(" ")[0]} to…</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {NINE_BOXES.map((b) => (
            <DropdownMenuItem
              key={b.id}
              disabled={b.id === currentBox}
              onSelect={() => onMove(b.id)}
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: SEQ_VAR[b.seqIndex] }}
              />
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              {b.id === currentBox && <Check className="size-3 shrink-0" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/employees/${chip.employeeCode}`}>Open profile</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
