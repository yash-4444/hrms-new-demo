"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarRange, Paperclip, Phone, UserRoundCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { employeeByCode } from "@/mock/employees";
import { LEAVE_TYPE_BY_CODE, balanceFor, excludedDays, countryOf, type LeaveApplication } from "@/mock/leave";
import { Avatar, Badge } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/overlays";

/* ============================================================================
   One read-only surface for a leave request, opened from every leave table.
   Actions differ by screen, so the caller passes them in.
   ========================================================================== */

export function LeaveDetailSheet({
  application,
  onOpenChange,
  actions,
}: {
  application: LeaveApplication | null;
  onOpenChange: (v: boolean) => void;
  actions?: (application: LeaveApplication) => React.ReactNode;
}) {
  const app = application;
  const employee = app ? employeeByCode(app.employeeCode) : undefined;
  const balance = app ? balanceFor(app.employeeCode, app.typeCode) : undefined;
  const type = app ? LEAVE_TYPE_BY_CODE[app.typeCode] : undefined;
  const skipped = app && type && !type.countsCalendarDays
    ? excludedDays(app.fromDate, app.toDate, countryOf(app.employeeCode))
    : [];

  const timeline = app
    ? [
        {
          label: "Applied",
          at: app.appliedOn,
          detail: `${app.employeeName} raised ${app.id}${app.isBackdated ? " (backdated)" : ""}`,
          tone: "info" as const,
        },
        ...(app.decidedOn
          ? [
              {
                label:
                  app.status === "approved"
                    ? "Approved"
                    : app.status === "rejected"
                      ? "Rejected"
                      : app.status === "sent_back"
                        ? "Sent back"
                        : app.status === "withdrawn"
                          ? "Withdrawn"
                          : "Cancelled",
                at: app.decidedOn,
                detail: app.decisionComment ?? `Decided by ${app.approverName}`,
                tone: "neutral" as const,
              },
            ]
          : [
              {
                label: "Awaiting decision",
                at: app.appliedOn,
                detail: `Sitting with ${app.approverName}`,
                tone: "warning" as const,
              },
            ]),
      ]
    : [];

  return (
    <Sheet open={!!app} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-lg" aria-describedby={undefined}>
        {app && (
          <>
            <SheetHeader>
              <SheetTitle>{app.id}</SheetTitle>
              <SheetDescription>
                {app.typeName} · {fmtDate(app.fromDate)} → {fmtDate(app.toDate)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={app.employeeName} size={40} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/employees/${app.employeeCode}`}
                    className="text-sm font-semibold hover:underline"
                  >
                    {app.employeeName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {employee?.designation ?? "—"} · {app.department} · {app.employeeCode}
                  </p>
                </div>
                <StatusBadge status={app.status} size="md" />
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-md border border-border bg-subtle p-3">
                {[
                  ["Days deducted", `${app.days}`],
                  ["Calendar days", `${app.calendarDays}`],
                  ["Weekend / holiday", `${app.sandwichDays}`],
                  ["Balance after", balance ? `${Math.round((balance.available - (app.status === "approved" ? 0 : app.days)) * 100) / 100}` : "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
                    <dd className="tnum mt-0.5 text-sm font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>

              {(app.halfDayFirst || app.halfDaySecond) && (
                <Badge variant="soft">
                  Half day ·{" "}
                  {app.halfDaySession === "first_half" ? "first half (09:30 – 13:30)" : "second half (13:30 – 18:30)"}
                  {app.halfDayFirst && app.halfDaySecond
                    ? " on both the first and last day"
                    : app.halfDaySecond
                      ? " on the last day"
                      : ""}
                </Badge>
              )}

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="mt-1 rounded-md border border-border px-2.5 py-2 text-xs">{app.reason}</p>
              </div>

              {skipped.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Days inside the range that are not deducted
                  </p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {skipped.map((s) => (
                      <li key={s.date} className="text-xs text-muted-foreground">
                        {fmtDate(s.date)} — {s.reason.kind === "weekend" ? s.reason.label : s.reason.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-1.5 text-xs">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <UserRoundCheck className="size-3.5" aria-hidden /> Approver:{" "}
                  <span className="font-medium text-foreground">{app.approverName}</span>
                </p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="size-3.5" aria-hidden /> Reachable on{" "}
                  <span className="font-medium text-foreground">{app.contactNumber}</span>
                </p>
                {app.documentName && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Paperclip className="size-3.5" aria-hidden />
                    <span className="font-medium text-foreground">{app.documentName}</span>
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Timeline</p>
                <ol className="mt-2 flex flex-col gap-3 border-l border-border pl-3.5">
                  {timeline.map((t, i) => (
                    <li key={i} className="relative">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -left-[19px] top-1 size-2 rounded-full ring-2 ring-card",
                          t.tone === "warning" ? "bg-warning" : t.tone === "info" ? "bg-info" : "bg-muted-foreground",
                        )}
                      />
                      <p className="text-xs font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(`${t.at}T10:15:00`)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.detail}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/leave/calendar?month=${app.fromDate.slice(0, 7)}&dept=${app.departmentId}`}>
                  <CalendarRange /> See it on the calendar
                </Link>
              </Button>
              {actions?.(app)}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
