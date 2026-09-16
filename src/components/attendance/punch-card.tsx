"use client";

import * as React from "react";
import { ArrowRight, Fingerprint, LogIn, LogOut, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDay, fmtTime, hm, hms } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { mockAction, useApp } from "@/components/app-state";
import { Gated } from "@/components/shell/page";
import { DEMO_TODAY } from "@/mock/org";
import type { AttendanceDay, PunchPair } from "@/mock/attendance";

/* ----------------------------------------------------------------------------
   The punch card. The elapsed timer starts inside an effect so the server HTML
   and the first client render agree — a clock in the initial state would
   hydrate-mismatch every single time.
   -------------------------------------------------------------------------- */

const FULL_DAY_MINUTES = 480;

/** Today's date at the wall-clock time inside an ISO datetime string. */
function todayAtClock(iso: string) {
  const d = new Date();
  d.setHours(Number(iso.slice(11, 13)), Number(iso.slice(14, 16)), 0, 0);
  return d;
}

export function PunchCard({
  today,
  shiftLabel,
  onOpenDetail,
  className,
}: {
  today?: AttendanceDay;
  shiftLabel: string;
  onOpenDetail: () => void;
  className?: string;
}) {
  const { punchedIn, punchIn, punchOut } = useApp();

  const [pairs, setPairs] = React.useState<PunchPair[]>(() => today?.punches ?? []);
  const [sessionStart, setSessionStart] = React.useState<Date | null>(null);
  const [nowMs, setNowMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    setPairs(today?.punches ?? []);
  }, [today]);

  /* The demo fixture leaves today's last pair open; anchor the ticking timer to
     it on mount so the card agrees with the punch list beside it. */
  React.useEffect(() => {
    const open = today?.punches.find((p) => p.out === null);
    setSessionStart(open ? todayAtClock(open.in) : null);
  }, [today]);

  React.useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const liveSeconds =
    punchedIn && sessionStart && nowMs ? Math.max(0, (nowMs - sessionStart.getTime()) / 1000) : 0;

  const closedMinutes = pairs
    .filter((p) => p.out !== null)
    .reduce((a, p) => a + p.minutes, 0);
  const totalMinutes = closedMinutes + Math.floor(liveSeconds / 60);
  const pct = Math.min(100, (totalMinutes / FULL_DAY_MINUTES) * 100);

  const handlePunchIn = () => {
    const now = new Date();
    punchIn();
    setSessionStart(now);
    setPairs((ps) => [
      ...ps,
      {
        in: `${DEMO_TODAY}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`,
        out: null,
        minutes: 0,
        source: "Web",
        device: "WEB-SELF-SERVICE",
      },
    ]);
  };

  const handlePunchOut = () => {
    const now = new Date();
    const minutes = sessionStart
      ? Math.max(1, Math.round((now.getTime() - sessionStart.getTime()) / 60000))
      : 1;
    punchOut();
    setSessionStart(null);
    setPairs((ps) => {
      const next = [...ps];
      const idx = next.findIndex((p) => p.out === null);
      if (idx >= 0) {
        next[idx] = {
          ...next[idx],
          out: `${DEMO_TODAY}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`,
          minutes,
        };
      }
      return next;
    });
  };

  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Punch clock</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtDay(DEMO_TODAY)} · shift {shiftLabel} · Asia/Kolkata
          </p>
        </div>
        <StatusBadge
          status={punchedIn ? "running" : "completed"}
          label={punchedIn ? "Punched in" : "Punched out"}
        />
      </div>

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Elapsed this session
          </p>
          <p
            className="tnum mt-0.5 text-4xl font-semibold leading-none tracking-tight text-foreground"
            aria-live="off"
          >
            {nowMs === null ? "00:00:00" : hms(liveSeconds)}
          </p>
          <div className="mt-3 max-w-sm">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">Toward an 8h full day</span>
              <span className="tnum text-xs font-medium">{hm(totalMinutes)} / 8h 0m</span>
            </div>
            <Progress value={pct} tone={pct >= 100 ? "success" : "accent"} aria-label="Hours worked today" />
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5">
          <Gated menuKey="my.attendance" action="X">
            <Button size="lg" onClick={handlePunchIn} disabled={punchedIn} className="w-full">
              <LogIn /> Punch In
            </Button>
          </Gated>
          <Gated menuKey="my.attendance" action="X">
            <Button
              size="lg"
              variant="outline"
              onClick={handlePunchOut}
              disabled={!punchedIn}
              className="w-full"
            >
              <LogOut /> Punch Out
            </Button>
          </Gated>
          <Button variant="ghost" size="sm" onClick={onOpenDetail}>
            View today&rsquo;s detail
          </Button>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Today&rsquo;s punch pairs
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              mockAction("Punch log refreshed", {
                description: `${pairs.length} pair${pairs.length === 1 ? "" : "s"} pulled from the Bengaluru controllers.`,
              })
            }
          >
            Refresh from device
          </Button>
        </div>
        {pairs.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No punches recorded today yet. Punch in to start the shift.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {pairs.map((p, i) => (
              <li
                key={`${p.in}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-subtle px-2.5 py-1.5"
              >
                <Fingerprint className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="tnum text-xs font-medium">{fmtTime(p.in)}</span>
                <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                <span className="tnum text-xs font-medium">
                  {p.out ? fmtTime(p.out) : "— running —"}
                </span>
                <span className="tnum text-xs text-muted-foreground">
                  {p.out ? hm(p.minutes) : hm(Math.floor(liveSeconds / 60))}
                </span>
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" aria-hidden />
                  {p.device} · {p.source}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
