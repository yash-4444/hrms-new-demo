"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Fingerprint, MapPin, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDay, fmtTime, hm } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Sheet,
} from "@/components/ui/overlays";
import { Gated } from "@/components/shell/page";
import { DAY_STATE_UI, dayStateLabel } from "./day-state";
import type { AttendanceDay, CellState } from "@/mock/attendance";

export interface DayDetail {
  date: string;
  state: CellState;
  record?: AttendanceDay;
  holidayName?: string;
  /** Shown when the drawer is opened from the team board. */
  employeeName?: string;
  employeeCode?: string;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tnum text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

export function DayDetailSheet({
  detail,
  onOpenChange,
}: {
  detail: DayDetail | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const rec = detail?.record;
  const ui = detail ? DAY_STATE_UI[detail.state] : null;

  return (
    <Sheet open={!!detail} onOpenChange={onOpenChange}>
      {detail && ui && (
        <SheetContent width="sm:max-w-md" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "flex size-6 items-center justify-center rounded-md border text-[10px] font-semibold",
                  ui.cell,
                )}
              >
                {ui.letter}
              </span>
              {fmtDay(detail.date)}
            </SheetTitle>
            <SheetDescription>
              {detail.employeeName
                ? `${detail.employeeName} · ${detail.employeeCode} · ${dayStateLabel(detail.state)}`
                : `${dayStateLabel(detail.state)}${rec ? ` · shift ${rec.shiftLabel}` : ""}`}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={detail.state === "not_marked" ? "not_marked" : detail.state} />
              {rec?.late && <StatusBadge status="late" label={`Late by ${rec.lateByMinutes} min`} />}
              {rec?.withinGrace && <StatusBadge status="approved" label="Within grace" />}
              {rec?.inProgress && <StatusBadge status="running" label="Shift running" />}
            </div>

            {detail.state === "holiday" && (
              <Alert tone="info" icon={Clock} title={detail.holidayName ?? rec?.holidayName ?? "Public holiday"}>
                A paid holiday on the resolved work calendar. No punch is expected.
              </Alert>
            )}
            {detail.state === "weekend" && (
              <Alert tone="neutral" icon={Clock} title="Weekly off">
                Saturday and Sunday are non-working on the India — Standard 5-day calendar.
              </Alert>
            )}
            {detail.state === "leave" && (
              <Alert tone="info" icon={Clock} title={rec?.leaveType ?? "Approved leave"}>
                Approved leave — the day is payable and no regularisation is required.
              </Alert>
            )}
            {detail.state === "absent" && (
              <Alert tone="danger" icon={TriangleAlert} title="Marked absent">
                {rec?.note ?? "No punch was recorded against an open working day."}
              </Alert>
            )}
            {detail.state === "not_marked" && (
              <Alert tone="neutral" icon={Clock} title="Nothing recorded yet">
                This date sits outside the 90-day attendance window loaded for the demo.
              </Alert>
            )}

            {rec && rec.punches.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Punch pairs
                </p>
                <ul className="flex flex-col gap-1.5">
                  {rec.punches.map((p, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-md border border-border bg-subtle px-2.5 py-2"
                    >
                      <Fingerprint className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="tnum text-xs font-medium">{fmtTime(p.in)}</span>
                      <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                      <span className="tnum text-xs font-medium">
                        {p.out ? fmtTime(p.out) : "— running —"}
                      </span>
                      <span className="tnum ml-auto text-xs text-muted-foreground">{hm(p.minutes)}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" aria-hidden />
                        {p.device}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {rec && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Day totals
                </p>
                <Row label="Shift" value={rec.shiftLabel} />
                <Row label="First in" value={rec.firstIn ? fmtTime(rec.firstIn) : "—"} />
                <Row label="Last out" value={rec.lastOut ? fmtTime(rec.lastOut) : "—"} />
                <Row label="Worked" value={hm(rec.workedMinutes)} />
                <Row label="Break" value={rec.breakMinutes ? hm(rec.breakMinutes) : "—"} />
                <Row
                  label="Overtime"
                  value={rec.overtimeMinutes ? hm(rec.overtimeMinutes) : "—"}
                />
                <Row
                  label="Late by"
                  value={rec.lateByMinutes ? `${rec.lateByMinutes} min` : "On time"}
                />
                <Row label="Source" value={rec.punches[0]?.source ?? "—"} />
              </div>
            )}

            {rec?.note && detail.state !== "absent" && (
              <p className="rounded-md border border-border bg-subtle px-2.5 py-2 text-xs text-muted-foreground">
                {rec.note}
              </p>
            )}
          </SheetBody>

          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Gated menuKey="time.amendments" action="C">
              <Button
                onClick={() => {
                  onOpenChange(false);
                  router.push("/attendance/amendments");
                }}
              >
                Raise regularisation
              </Button>
            </Gated>
          </SheetFooter>
        </SheetContent>
      )}
    </Sheet>
  );
}
