"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeftRight, Check, CopyPlus, GripVertical, LayoutTemplate, Send, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, fmtDay } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { employeeByCode, employeeName } from "@/mock/employees";
import {
  OFF,
  ROSTER_EMPLOYEES,
  ROSTER_MIN_COVER,
  ROSTER_WEEKS,
  SWAP_REQUESTS,
  buildRoster,
  shiftById,
  shiftHours,
  weekDates,
  type RosterGrid,
  type SwapRequest,
} from "@/mock/masters";
import { ShiftChip } from "@/components/org/bits";
import { mockAction, useApp } from "@/components/app-state";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, EmptyState, Field, Textarea } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";

const PALETTE = ["SUP-E", "SUP-M", "SUP-N", "WKND", OFF];
const ROTA_SHIFTS = ["SUP-E", "SUP-M", "SUP-N"];
const MAX_WEEKLY_HOURS = 48;

export default function RosterBoardPage() {
  const loading = useFakeLoad();
  const { can, persona } = useApp();
  const canAssign = can("org.rosters", "E");

  const [week, setWeek] = React.useState(ROSTER_WEEKS[0].id);
  const [grids, setGrids] = React.useState<Record<string, RosterGrid>>(() =>
    Object.fromEntries(ROSTER_WEEKS.map((w) => [w.id, buildRoster(w.id)])),
  );
  const [published, setPublished] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(ROSTER_WEEKS.map((w) => [w.id, w.published])),
  );
  const [edits, setEdits] = React.useState<Record<string, number>>({});
  const [swaps, setSwaps] = React.useState<SwapRequest[]>(SWAP_REQUESTS);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [rejecting, setRejecting] = React.useState<SwapRequest | null>(null);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState<string | null>(null);

  const dates = weekDates(week);
  const grid = grids[week];
  const weekMeta = ROSTER_WEEKS.find((w) => w.id === week)!;

  const assign = (code: string, date: string, shift: string) => {
    if (!canAssign) return;
    const prev = grid[code][date];
    if (prev === shift) return;
    setGrids((g) => ({ ...g, [week]: { ...g[week], [code]: { ...g[week][code], [date]: shift } } }));
    setEdits((e) => ({ ...e, [week]: (e[week] ?? 0) + 1 }));
    setPublished((p) => ({ ...p, [week]: false }));
    mockAction(`${employeeName(code)} · ${fmtDay(date)}`, {
      description: `${label(prev)} → ${label(shift)}. Unpublished until you publish the week.`,
      tone: "info",
      undo: () => setGrids((g) => ({ ...g, [week]: { ...g[week], [code]: { ...g[week][code], [date]: prev } } })),
    });
  };

  const copyPrevious = () => {
    const prevWeek = ROSTER_WEEKS[0].id;
    const src = grids[prevWeek];
    const prevDates = weekDates(prevWeek);
    setGrids((g) => ({
      ...g,
      [week]: Object.fromEntries(
        ROSTER_EMPLOYEES.map((c) => [c, Object.fromEntries(dates.map((d, i) => [d, src[c][prevDates[i]] === "LEAVE" ? ROTA_SHIFTS[0] : src[c][prevDates[i]]]))]),
      ),
    }));
    setEdits((e) => ({ ...e, [week]: (e[week] ?? 0) + ROSTER_EMPLOYEES.length }));
    mockAction("Copied 14 – 20 Sep into this week", { description: "Leave days were replaced with the employee's base shift. Review nights before publishing." });
  };

  const coverage = (date: string, shift: string) => ROSTER_EMPLOYEES.filter((c) => grid[c][date] === shift).length;
  const gaps = dates.flatMap((d) => ROTA_SHIFTS.filter((s) => coverage(d, s) < ROSTER_MIN_COVER[s]).map((s) => ({ d, s })));
  const hoursOf = (code: string) =>
    dates.reduce((a, d) => {
      const s = shiftById(grid[code][d]);
      return a + (s ? shiftHours(s) : 0);
    }, 0);

  const decideSwap = (s: SwapRequest, status: "approved" | "rejected", reason?: string) => {
    setSwaps((xs) => xs.map((x) => (x.id === s.id ? { ...x, status } : x)));
    if (status === "approved") {
      const wk = ROSTER_WEEKS.find((w) => weekDates(w.id).includes(s.date))?.id;
      if (wk)
        setGrids((g) => ({
          ...g,
          [wk]: {
            ...g[wk],
            [s.requesterCode]: { ...g[wk][s.requesterCode], [s.date]: s.toShift },
            [s.counterpartCode]: { ...g[wk][s.counterpartCode], [s.date]: s.fromShift },
          },
        }));
      mockAction(`Swap ${s.id} approved`, {
        description: `${employeeName(s.requesterCode)} and ${employeeName(s.counterpartCode)} swapped on ${fmtDay(s.date)}. Both have been notified.`,
      });
    } else {
      mockAction(`Swap ${s.id} rejected`, { description: `Reason sent to ${employeeName(s.requesterCode)}: “${reason}”`, tone: "warning" });
    }
  };

  const pending = swaps.filter((s) => s.status === "pending");

  return (
    <PageBody>
      <PageHeader
        title="Roster Board"
        description="Customer support 24×5 · Pune. Drag a shift from the palette onto a day, or click a cell to pick one. Publishing notifies every rostered employee and locks the week for attendance."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/org/rosters/templates">
                <LayoutTemplate aria-hidden />
                Templates
              </Link>
            </Button>
            {week !== ROSTER_WEEKS[0].id && (
              <Gated menuKey="org.rosters" action="E">
                <Button size="sm" variant="outline" onClick={copyPrevious}>
                  <CopyPlus aria-hidden />
                  Copy previous week
                </Button>
              </Gated>
            )}
            <Gated menuKey="org.rosters" action="A">
              <Button size="sm" onClick={() => setPublishOpen(true)} disabled={published[week]}>
                <Send aria-hidden />
                {published[week] ? "Published" : "Publish week"}
              </Button>
            </Gated>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={week} onValueChange={setWeek}>
          <SelectTrigger size="sm" className="w-[220px]" aria-label="Roster week">
            <span>
              <span className="text-muted-foreground">Week: </span>
              {weekMeta.label}
            </span>
          </SelectTrigger>
          <SelectContent>
            {ROSTER_WEEKS.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {published[week] ? <StatusBadge status="completed" label="Published" /> : <StatusBadge status="draft" label={edits[week] ? `Draft · ${edits[week]} unpublished changes` : "Draft"} />}
        {gaps.length > 0 && (
          <Badge variant="outline" className="border-warning/40 text-warning-fg">
            <TriangleAlert className="size-3" aria-hidden />
            {gaps.length} coverage gap{gaps.length === 1 ? "" : "s"}
          </Badge>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-1.5" aria-label="Shift palette">
          <span className="text-[11px] font-medium text-muted-foreground">Drag to assign:</span>
          {PALETTE.map((p) => (
            <span
              key={p}
              draggable={canAssign}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", p)}
              className={cn("inline-flex items-center", canAssign && "cursor-grab active:cursor-grabbing")}
            >
              {canAssign && <GripVertical className="size-3 text-muted-foreground" aria-hidden />}
              <ShiftChip id={p} compact />
            </span>
          ))}
        </div>
      </div>

      <Section bodyClassName="p-0">
        {loading ? (
          <div className="p-3">
            <TableSkeleton rows={10} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-xs">
              <caption className="sr-only">Roster for {weekMeta.label}</caption>
              <thead>
                <tr className="border-b border-border bg-subtle">
                  <th scope="col" className="sticky left-0 z-10 bg-subtle px-3 py-2 text-left font-semibold">
                    Employee
                  </th>
                  {dates.map((d) => (
                    <th key={d} scope="col" className={cn("px-1.5 py-2 text-center font-semibold", d === DEMO_TODAY && "text-primary")}>
                      {format(parseISO(d), "EEE")}
                      <span className="tnum block text-[10px] font-normal text-muted-foreground">{format(parseISO(d), "dd MMM")}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-2 text-right font-semibold">
                    Hours
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROSTER_EMPLOYEES.map((code) => {
                  const e = employeeByCode(code)!;
                  const hrs = hoursOf(code);
                  return (
                    <tr key={code} className="border-b border-border">
                      <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-normal">
                        <span className="flex items-center gap-2">
                          <Avatar name={e.name} size={22} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{e.name}</span>
                            <span className="tnum block text-[10px] text-muted-foreground">{e.code}</span>
                          </span>
                        </span>
                      </th>
                      {dates.map((d) => {
                        const key = `${code}|${d}`;
                        const value = grid[code][d];
                        return (
                          <td
                            key={d}
                            className={cn("px-1 py-1 text-center", d === DEMO_TODAY && "bg-primary-soft/40", dragOver === key && "bg-primary-soft")}
                            onDragOver={(ev) => {
                              if (!canAssign) return;
                              ev.preventDefault();
                              setDragOver(key);
                            }}
                            onDragLeave={() => setDragOver((k) => (k === key ? null : k))}
                            onDrop={(ev) => {
                              ev.preventDefault();
                              setDragOver(null);
                              const s = ev.dataTransfer.getData("text/plain");
                              if (s) assign(code, d, s);
                            }}
                          >
                            <Popover>
                              <PopoverTrigger asChild disabled={!canAssign || value === "LEAVE"}>
                                <button
                                  type="button"
                                  aria-label={`${e.name}, ${fmtDay(d)}: ${label(value)}${canAssign && value !== "LEAVE" ? " — change shift" : ""}`}
                                  className="w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                                >
                                  <ShiftChip id={value} compact className="w-full justify-center" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-52 p-1" align="center">
                                <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                                  {e.firstName} · {fmtDay(d)}
                                </p>
                                {PALETTE.map((p) => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => assign(code, d, p)}
                                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted"
                                  >
                                    <ShiftChip id={p} />
                                    {p === value && <Check className="size-3.5 text-primary" aria-label="Current" />}
                                  </button>
                                ))}
                              </PopoverContent>
                            </Popover>
                          </td>
                        );
                      })}
                      <td className={cn("tnum px-2 py-1 text-right", hrs > MAX_WEEKLY_HOURS ? "font-semibold text-destructive-fg" : "text-muted-foreground")}>
                        {hrs.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                {ROTA_SHIFTS.map((s) => (
                  <tr key={s} className="border-b border-border bg-subtle/60">
                    <th scope="row" className="sticky left-0 z-10 bg-subtle px-3 py-1.5 text-left font-normal">
                      <span className="flex items-center gap-1.5">
                        <ShiftChip id={s} compact />
                        <span className="text-[11px] text-muted-foreground">cover (min {ROSTER_MIN_COVER[s]})</span>
                      </span>
                    </th>
                    {dates.map((d) => {
                      const n = coverage(d, s);
                      const short = n < ROSTER_MIN_COVER[s];
                      return (
                        <td key={d} className={cn("tnum px-1 py-1.5 text-center", short ? "font-semibold text-warning-fg" : "text-muted-foreground")}>
                          {short && <TriangleAlert className="mr-0.5 inline size-3" aria-label="Below minimum" />}
                          {n}
                        </td>
                      );
                    })}
                    <td />
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        )}
      </Section>

      <Section title="Shift swap requests" description={`${pending.length} waiting for a decision`}>
        {swaps.length === 0 ? (
          <EmptyState icon={ArrowLeftRight} title="No swap requests" description="When two employees agree to swap a shift, the request lands here for approval." />
        ) : (
          <ul className="divide-y divide-border">
            {swaps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="flex min-w-[260px] flex-1 items-center gap-2">
                  <Avatar name={employeeName(s.requesterCode)} size={26} />
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-medium">{employeeName(s.requesterCode)}</span>
                      <span className="text-muted-foreground"> ⇄ </span>
                      <span className="font-medium">{employeeName(s.counterpartCode)}</span>
                      <span className="tnum text-muted-foreground"> · {fmtDay(s.date)}</span>
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {s.id} · “{s.reason}” · raised {fmtDateTime(s.raisedAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShiftChip id={s.fromShift} compact />
                  <ArrowLeftRight className="size-3 text-muted-foreground" aria-label="swaps with" />
                  <ShiftChip id={s.toShift} compact />
                </div>
                {s.status === "pending" ? (
                  <div className="flex gap-1.5">
                    <Gated menuKey="org.rosters" action="A">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRejecting(s);
                          setRejectReason("");
                          setRejectError(null);
                        }}
                      >
                        <X aria-hidden />
                        Reject
                      </Button>
                    </Gated>
                    <Gated menuKey="org.rosters" action="A">
                      <Button size="sm" onClick={() => decideSwap(s, "approved")}>
                        <Check aria-hidden />
                        Approve
                      </Button>
                    </Gated>
                  </div>
                ) : (
                  <StatusBadge status={s.status} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={`Publish ${weekMeta.label}?`}
        description={
          <>
            {ROSTER_EMPLOYEES.length} employees will be notified in-app and by email, and attendance will expect these shifts.
            {gaps.length > 0 && (
              <span className="mt-1.5 block font-medium text-warning-fg">
                {gaps.length} shift-day{gaps.length === 1 ? " is" : "s are"} below minimum cover — you can still publish.
              </span>
            )}
          </>
        }
        confirmLabel="Publish"
        onConfirm={() => {
          setPublished((p) => ({ ...p, [week]: true }));
          setEdits((e) => ({ ...e, [week]: 0 }));
          mockAction(`${weekMeta.label} published`, { description: `Published by ${persona.name}. ${ROSTER_EMPLOYEES.length} employees notified.` });
        }}
      />

      <Dialog open={!!rejecting} onOpenChange={(v) => !v && setRejecting(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Reject swap {rejecting?.id}?</DialogTitle>
            <DialogDescription>
              {rejecting && `${employeeName(rejecting.requesterCode)} keeps their ${label(rejecting.fromShift)} shift on ${fmtDay(rejecting.date)}.`} The reason is
              shared with both employees.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Reason" htmlFor="swap-reason" required error={rejectError ?? undefined}>
              <Textarea
                id="swap-reason"
                rows={3}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="e.g. Night cover would drop below minimum on Saturday."
                aria-invalid={!!rejectError}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectReason.trim().length < 5) {
                  setRejectError("Give a reason of at least 5 characters.");
                  return;
                }
                if (rejecting) decideSwap(rejecting, "rejected", rejectReason.trim());
                setRejecting(null);
              }}
            >
              Reject swap
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}

function label(id: string) {
  if (id === OFF) return "Weekly off";
  if (id === "LEAVE") return "Leave";
  return shiftById(id)?.name ?? id;
}
