"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { CalendarHeart, Hourglass, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockAction } from "@/components/app-state";
import { AI_TONE, AiBadge, AiExplainButton, AiSuggestionCard } from "@/components/ai/ai-ui";
import type { LeaveApplication } from "@/mock/leave";
import { expiryNudges, leaveRisk, longWeekends, teamClash } from "./leave-ai";

const nice = (s: string) => format(parseISO(s), "EEE dd MMM");
const short = (s: string) => format(parseISO(s), "dd MMM");

/* ------------------------------------------------------- approvals chip */

/** Per-row AI recommendation for a leave request, with a "Why?" breakdown. */
export function LeaveRiskChip({ application }: { application: LeaveApplication }) {
  const risk = React.useMemo(() => leaveRisk(application), [application]);
  const low = risk.level === "low";
  return (
    <span className="flex max-w-[240px] items-center gap-1">
      <span
        className={cn(
          "inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
          low ? AI_TONE.chip : "border-warning/30 bg-warning-soft text-warning-fg",
        )}
      >
        {low ? <ShieldCheck className="size-3 shrink-0" aria-hidden /> : <Hourglass className="size-3 shrink-0" aria-hidden />}
        <span className="truncate">{risk.label}</span>
      </span>
      <AiExplainButton
        title="Why this recommendation?"
        summary={`${application.employeeName} · ${application.typeName} · ${short(application.fromDate)}–${short(application.toDate)}. AI recommends; you decide.`}
        drivers={risk.drivers}
        footnote="Checks balance, team overlap, Monday/Friday pattern, notice and backdating. Never approves or rejects on its own."
        className="shrink-0"
      />
    </span>
  );
}

/** One-line inline recommendation for the decision dialog. */
export function LeaveRiskNote({ application }: { application: LeaveApplication }) {
  const risk = React.useMemo(() => leaveRisk(application), [application]);
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs", AI_TONE.soft)} role="note">
      <AiBadge label="AI check" />
      <span className="min-w-0 flex-1 font-medium text-foreground">{risk.label}</span>
      <AiExplainButton title="Why this recommendation?" summary="AI recommends; you decide." drivers={risk.drivers} />
    </div>
  );
}

/* ------------------------------------------------------- apply dialog */

/**
 * AI hints inside the apply-leave form: team clash, a long-weekend idea and a
 * balance-expiry nudge. Advisory only — nothing here blocks submission.
 */
export function ApplyLeaveAiHints({
  employeeCode,
  country,
  typeCode,
  fromDate,
  toDate,
  onUseDates,
}: {
  employeeCode: string;
  country: "IN" | "US";
  typeCode: string;
  fromDate: string;
  toDate: string;
  onUseDates: (from: string, to: string) => void;
}) {
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set());
  const hide = (id: string) => setDismissed((s) => new Set(s).add(id));

  const range = fromDate && toDate && toDate >= fromDate;
  const clash = React.useMemo(
    () => (range ? teamClash(employeeCode, fromDate, toDate) : null),
    [range, employeeCode, fromDate, toDate],
  );
  const weekend = React.useMemo(() => longWeekends(country, 1)[0] ?? null, [country]);
  const nudge = React.useMemo(() => {
    const n = expiryNudges(employeeCode);
    return n.find((x) => x.typeCode === typeCode) ?? n[0] ?? null;
  }, [employeeCode, typeCode]);

  const showWeekend = weekend && !dismissed.has("weekend") && !(fromDate === weekend.from && toDate === weekend.to);
  const showNudge = nudge && !dismissed.has(`nudge-${nudge.typeCode}`);
  if (!clash && !showWeekend && !showNudge) return null;

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      {clash && clash.teamSize > 0 && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
            clash.peakNames.length >= 2 ? "border-warning/30 bg-warning-soft" : AI_TONE.soft,
          )}
          role="note"
        >
          <Users className={cn("mt-0.5 size-3.5 shrink-0", clash.peakNames.length >= 2 ? "text-warning-fg" : AI_TONE.icon)} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
              <AiBadge label="Team clash check" />
              {clash.peakNames.length === 0
                ? `None of your ${clash.teamSize} teammates is off in this range.`
                : `${clash.peakNames.length} of ${clash.teamSize} teammates ${clash.peakNames.length === 1 ? "is" : "are"} off on ${short(clash.peakDate!)}.`}
            </p>
            {clash.anyOff.length > 0 && (
              <p className="mt-0.5 text-muted-foreground">
                Overlapping approved or pending leave: {clash.anyOff.join(", ")}. You can still apply — your manager sees the same view.
              </p>
            )}
          </div>
        </div>
      )}

      {showWeekend && weekend && (
        <AiSuggestionCard
          title="Best days for a long weekend"
          confidence={90}
          body={
            <p className="flex items-start gap-1.5">
              <CalendarHeart className={cn("mt-0.5 size-3.5 shrink-0", AI_TONE.icon)} aria-hidden />
              <span>
                {weekend.holiday} falls on {nice(weekend.holidayDate)}. Take{" "}
                <strong className="font-semibold">
                  {weekend.leaveDays === 1 ? nice(weekend.from) : `${nice(weekend.from)} – ${nice(weekend.to)}`}
                </strong>{" "}
                ({weekend.leaveDays} day{weekend.leaveDays === 1 ? "" : "s"} of leave) and you are off{" "}
                {short(weekend.offFrom)}–{short(weekend.offTo)} — {weekend.totalDays} days in a row.
              </span>
            </p>
          }
          acceptLabel="Use these dates"
          onAccept={() => {
            onUseDates(weekend.from, weekend.to);
            mockAction("Dates filled from AI suggestion", {
              tone: "info",
              description: `${nice(weekend.from)}${weekend.leaveDays > 1 ? ` – ${nice(weekend.to)}` : ""}. Review the reason and submit when ready.`,
            });
          }}
          onDismiss={() => hide("weekend")}
        />
      )}

      {showNudge && nudge && (
        <AiSuggestionCard
          title="Balance expiry"
          body={<p>{nudge.text}</p>}
          onDismiss={() => hide(`nudge-${nudge.typeCode}`)}
        />
      )}
    </div>
  );
}
