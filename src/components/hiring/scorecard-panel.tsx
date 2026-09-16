"use client";

import * as React from "react";
import {
  BellRing,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  MapPin,
  Phone,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/format";
import { employeeByCode } from "@/mock/employees";
import type { Interview, Scorecard } from "@/mock/hiring";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Avatar,
  AvatarStack,
  Badge,
  EmptyState,
  Progress,
  Separator,
} from "@/components/ui/primitives";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/overlays";

/* ============================================================================
   Interview rounds and their scorecards.

   Every competency shows its NUMBER next to the meter — the bar is a second
   channel, never the only one. Recommendation reuses STATUS_MAP tones with a
   label override, so the colour vocabulary stays identical to the rest of
   the product.
   ========================================================================== */

const MODE_ICON = {
  "Video call": Video,
  "In person": MapPin,
  Telephonic: Phone,
} as const;

/** Recommendation -> an existing STATUS_MAP key, label overridden. */
const RECOMMENDATION_STATUS: Record<Scorecard["recommendation"], string> = {
  "Strong Hire": "achieved",
  Hire: "on_track",
  "No Hire": "at_risk",
  "Strong No Hire": "rejected",
};

function ratingTone(v: number): "success" | "accent" | "warning" | "danger" {
  if (v >= 4) return "success";
  if (v >= 3) return "accent";
  if (v >= 2) return "warning";
  return "danger";
}

const empName = (code: string) => employeeByCode(code)?.name ?? code;
const empTitle = (code: string) => employeeByCode(code)?.designation ?? "Panel member";

function CompetencyRow({ competency, rating }: { competency: string; rating: number }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">{competency}</span>
      <Progress
        value={(rating / 5) * 100}
        tone={ratingTone(rating)}
        className="min-w-0 flex-1"
        aria-label={`${competency}: ${rating} out of 5`}
      />
      <span className="tnum w-14 shrink-0 text-right text-xs font-medium text-foreground">
        {rating.toFixed(1)} / 5
      </span>
    </li>
  );
}

function ScorecardBlock({ card }: { card: Scorecard }) {
  return (
    <div className="rounded-md border border-border bg-subtle p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={empName(card.panelCode)} size={26} />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">
              {empName(card.panelCode)}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {empTitle(card.panelCode)} · submitted {fmtDateTime(card.submittedAt)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tnum text-xs text-muted-foreground">
            Overall{" "}
            <span className="font-semibold text-foreground">{card.overall.toFixed(1)}</span> / 5
          </span>
          <StatusBadge
            status={RECOMMENDATION_STATUS[card.recommendation]}
            label={card.recommendation}
          />
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {card.competencies.map((c) => (
          <CompetencyRow key={c.competency} competency={c.competency} rating={c.rating} />
        ))}
      </ul>

      <Separator className="my-3" />
      <p className="text-xs leading-relaxed text-foreground">{card.feedback}</p>
    </div>
  );
}

function InterviewCard({
  interview,
  defaultOpen,
}: {
  interview: Interview;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const ModeIcon = MODE_ICON[interview.mode];
  const panelNames = interview.panelCodes.map(empName);
  const avg = interview.scorecards.length
    ? interview.scorecards.reduce((a, s) => a + s.overall, 0) / interview.scorecards.length
    : null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="overflow-hidden rounded-md border border-border bg-card"
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={open ? `Collapse ${interview.round}` : `Expand ${interview.round}`}
            aria-expanded={open}
          >
            <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">{interview.round}</p>
            <StatusBadge status={interview.status} />
            <Badge variant="muted">
              <ModeIcon className="size-3" aria-hidden />
              {interview.mode}
            </Badge>
            <Badge variant="outline" className="tnum">
              {interview.durationMins} min
            </Badge>
          </div>
          <p className="tnum mt-0.5 text-xs text-muted-foreground">
            {fmtDateTime(interview.startsAt)} · {interview.venue}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          {avg !== null && (
            <span className="tnum text-xs text-muted-foreground">
              Avg <span className="font-semibold text-foreground">{avg.toFixed(1)}</span> / 5
            </span>
          )}
          <AvatarStack names={panelNames} size={22} max={3} />
        </div>
      </div>

      <CollapsibleContent>
        <div className="border-t border-border p-3">
          <div className="mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Panel:{" "}
              <span className="text-foreground">
                {panelNames.join(", ")}
              </span>
            </span>
            <span>
              Requisition: <span className="text-foreground">{interview.reqCode}</span>
            </span>
          </div>

          {interview.status === "completed" && interview.scorecards.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {interview.scorecards.map((card) => (
                <ScorecardBlock key={`${interview.id}-${card.panelCode}`} card={card} />
              ))}
            </div>
          ) : interview.status === "cancelled" ? (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-center">
              <p className="text-xs font-medium text-foreground">Round cancelled</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                No feedback was recorded. The candidate was informed the same day.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-4">
              <div>
                <p className="text-xs font-medium text-foreground">Awaiting feedback</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {panelNames.length === 1
                    ? `${panelNames[0]} has not submitted a scorecard yet.`
                    : `${panelNames.length} panel members have not submitted scorecards yet.`}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  mockAction("Reminder sent to the panel", {
                    description: `${interview.round} · ${panelNames.join(", ")} — asked to submit the scorecard today.`,
                  })
                }
              >
                <BellRing /> Send reminder
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ScorecardPanel({
  interviews,
  candidateName,
  onSchedule,
}: {
  interviews: Interview[];
  candidateName: string;
  onSchedule?: () => void;
}) {
  const ordered = React.useMemo(
    () => [...interviews].sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [interviews],
  );

  if (!ordered.length) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No interviews yet"
        description={`${candidateName} has not been through a round on this requisition. Schedule the first one to start collecting scorecards.`}
        action={
          onSchedule ? (
            <Button size="sm" onClick={onSchedule}>
              <CalendarClock /> Schedule interview
            </Button>
          ) : undefined
        }
      />
    );
  }

  const completed = ordered.filter((i) => i.status === "completed");
  const cards = completed.flatMap((i) => i.scorecards);
  const average = cards.length ? cards.reduce((a, c) => a + c.overall, 0) / cards.length : null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border bg-subtle px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ClipboardList className="size-3.5" aria-hidden />
          <span className="tnum font-medium text-foreground">{ordered.length}</span> round
          {ordered.length === 1 ? "" : "s"}
        </span>
        <span className="tnum text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{cards.length}</span> scorecard
          {cards.length === 1 ? "" : "s"} submitted
        </span>
        {average !== null && (
          <span className="tnum text-xs text-muted-foreground">
            Panel average{" "}
            <span className="font-semibold text-foreground">{average.toFixed(1)}</span> / 5
          </span>
        )}
        <span className="tnum ml-auto text-xs text-muted-foreground">
          {ordered.filter((i) => i.status === "scheduled").length} upcoming
        </span>
      </div>

      {ordered.map((interview, i) => (
        <InterviewCard
          key={interview.id}
          interview={interview}
          /* Open the next upcoming round and the latest completed one. */
          defaultOpen={interview.status === "scheduled" || i === 0}
        />
      ))}
    </div>
  );
}
