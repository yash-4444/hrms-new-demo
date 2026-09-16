"use client";

import * as React from "react";
import { ArrowRight, Ban, Bus, Car, Eye, Plane, TrainFront, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateShort, inr } from "@/lib/format";
import type { TravelMode, TravelRequest } from "@/mock/workplace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, Badge } from "@/components/ui/primitives";

/* ============================================================================
   The itinerary card — a travel request read as a journey, not a row.

   Legs run down a single connector line, one node per leg, so a three-sector
   circuit is legible at a glance. Every leg carries its own booking status,
   because "Approved" on the request says nothing about whether the return
   flight is ticketed.
   ========================================================================== */

const MODE_ICON: Record<TravelMode, LucideIcon> = {
  Flight: Plane,
  Train: TrainFront,
  Cab: Car,
  Bus: Bus,
};

/** Statuses where cancelling the trip is still a meaningful action. */
const CANCELLABLE = new Set(["draft", "submitted", "approved"]);

export function TravelItineraryCard({
  request,
  onView,
  onSettle,
  onCancel,
  footer,
  className,
}: {
  request: TravelRequest;
  onView?: (r: TravelRequest) => void;
  onSettle?: (r: TravelRequest) => void;
  onCancel?: (r: TravelRequest) => void;
  /** Extra controls under the figures — the approval queue puts its decision bar here. */
  footer?: React.ReactNode;
  className?: string;
}) {
  const legCost = request.legs.reduce((a, l) => a + l.estimatedCost, 0);
  const showActions = Boolean(onView || onSettle || onCancel);

  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      {/* ------------------------------------------------------------ header */}
      <div className="flex flex-col gap-1.5 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">{request.requestNo}</span>
          <Badge variant="muted">{request.tripType}</Badge>
          <StatusBadge status={request.status} className="ml-auto" />
        </div>
        <p className="text-sm text-foreground">{request.purpose}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Avatar name={request.employeeName} size={18} />
            <span className="text-foreground">{request.employeeName}</span>
          </span>
          <span aria-hidden>·</span>
          <span>{request.department}</span>
          <span aria-hidden>·</span>
          <span className="tnum whitespace-nowrap">
            {fmtDateShort(request.startDate)} → {fmtDate(request.endDate)}
          </span>
          <span aria-hidden>·</span>
          <span className="tnum">
            {request.nights} night{request.nights === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* ----------------------------------------------------------- journey */}
      <ol className="relative flex flex-col px-4 py-3">
        <span
          className="absolute bottom-6 left-[27px] top-6 w-px bg-border"
          aria-hidden
        />
        {request.legs.map((leg, i) => {
          const ModeIcon = MODE_ICON[leg.mode];
          const last = i === request.legs.length - 1;
          return (
            <li key={leg.id} className="relative flex gap-3 py-2 first:pt-0 last:pb-0">
              <span className="z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                <ModeIcon className="size-3.5" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{leg.from}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{leg.to}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {leg.mode} · {leg.carrier}
                </p>
                <p className="tnum mt-0.5 text-xs text-muted-foreground">
                  Departs {fmtDate(leg.departDate)}
                  {last && leg.returnDate ? ` · returns ${fmtDate(leg.returnDate)}` : ""}
                </p>
                {leg.bookingRef && (
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{leg.bookingRef}</p>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="tnum text-sm font-medium">{inr(leg.estimatedCost, { decimals: false })}</span>
                <StatusBadge status={leg.bookingStatus} />
              </div>
            </li>
          );
        })}
      </ol>

      {/* ------------------------------------------------------------ figures */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border bg-subtle px-4 py-3 sm:grid-cols-4">
        {[
          { k: "Per-diem", v: request.perDiem, note: `${request.nights + 1} days` },
          { k: "Estimated cost", v: request.estimatedCost, note: `${inr(legCost, { decimals: false })} in fares` },
          { k: "Advance requested", v: request.advanceRequested, note: `${inr(request.advanceDisbursed, { decimals: false })} disbursed` },
          {
            k: "Advance outstanding",
            v: request.advanceOutstanding,
            note: request.advanceOutstanding > 0 ? "To be settled" : "Fully settled",
          },
        ].map((f) => (
          <div key={f.k}>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{f.k}</dt>
            <dd
              className={cn(
                "tnum text-sm font-semibold",
                f.k === "Advance outstanding" && f.v > 0 && "text-warning-fg",
              )}
            >
              {inr(f.v, { decimals: false })}
            </dd>
            <dd className="text-[11px] text-muted-foreground">{f.note}</dd>
          </div>
        ))}
      </dl>

      {request.decisionNote && (
        <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{request.approverName}:</span> {request.decisionNote}
        </p>
      )}

      {(showActions || footer) && (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-2.5">
          {showActions && (
            <div className="flex flex-wrap items-center gap-1.5">
              {onView && (
                <Button variant="outline" size="sm" onClick={() => onView(request)}>
                  <Eye /> View details
                </Button>
              )}
              {onSettle && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={request.advanceOutstanding <= 0}
                  onClick={() => onSettle(request)}
                >
                  <Wallet /> Settle advance
                </Button>
              )}
              {onCancel && CANCELLABLE.has(request.status) && (
                <Button variant="ghost" size="sm" onClick={() => onCancel(request)}>
                  <Ban /> Cancel request
                </Button>
              )}
              <span className="tnum ml-auto text-xs text-muted-foreground">
                {request.legs.length} leg{request.legs.length === 1 ? "" : "s"} · approver {request.approverName}
              </span>
            </div>
          )}
          {footer}
        </div>
      )}
    </Card>
  );
}
