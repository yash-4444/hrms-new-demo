"use client";

import * as React from "react";
import Link from "next/link";
import { addDays, parseISO } from "date-fns";
import { Ban, CircleCheck, CirclePause, CircleX, Clock, CreditCard, Mail, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateShort, inr } from "@/lib/format";
import type { ConsoleTenant } from "@/mock/console-tenants";
import { DUNNING_STEPS, DUNNING_SUSPEND_DAY, dunningDay, invoiceTotal, type DunningCase, type PlatformInvoice } from "@/mock/console-billing";
import { TenantStatusBadge } from "@/components/console/kit";
import { TonePill } from "@/components/platform/kit";
import { Section } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";

/* Billing — the dunning queue. Card failures are retried on day 1, 3 and 7;
   unpaid bank-transfer invoices get reminders on the same days. Day 14
   suspends the tenant (data retained, sign-in blocked) unless paused. */

type StepState = "done" | "next" | "upcoming";

export function DunningPanel({
  cases,
  tenants,
  invoices,
  paused,
  onRetry,
  onPause,
  onSuspend,
}: {
  cases: DunningCase[];
  tenants: ConsoleTenant[];
  invoices: PlatformInvoice[];
  paused: Set<string>;
  onRetry: (c: DunningCase) => void;
  onPause: (c: DunningCase) => void;
  onSuspend: (c: DunningCase) => void;
}) {
  return (
    <Section
      title="Dunning"
      description={`Retries or reminders on day ${DUNNING_STEPS.join(", ")}; suspension on day ${DUNNING_SUSPEND_DAY}.`}
      bodyClassName="p-0"
      actions={<span className="tnum text-xs text-muted-foreground">{cases.length} open</span>}
    >
      {cases.length === 0 ? (
        <EmptyState icon={CircleCheck} title="No failed payments" description="Every invoice is paid or inside its terms." className="m-4" />
      ) : (
        <ul className="divide-y divide-border">
          {cases.map((c) => {
            const t = tenants.find((x) => x.id === c.tenantId);
            const inv = invoices.find((i) => i.id === c.invoiceId);
            if (!t) return null;
            const day = dunningDay(c);
            const isPaused = paused.has(c.tenantId);
            const suspended = t.status === "suspended";
            const nextStep = [...DUNNING_STEPS, DUNNING_SUSPEND_DAY].find((d) => d > day);
            const steps: { day: number; label: string; state: StepState }[] = [...DUNNING_STEPS, DUNNING_SUSPEND_DAY].map((d) => ({
              day: d,
              label: d === DUNNING_SUSPEND_DAY ? "Suspend" : c.kind === "card" ? "Retry" : "Remind",
              state: d <= day ? "done" : d === nextStep ? "next" : "upcoming",
            }));
            return (
              <li key={c.tenantId} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/console/tenants/${t.id}`} className="text-xs font-medium text-foreground hover:underline">
                        {t.name}
                      </Link>
                      <TenantStatusBadge status={t.status} />
                      {isPaused && (
                        <TonePill tone="neutral" icon={CirclePause}>
                          Paused
                        </TonePill>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">{c.invoiceId}</span>
                      {inv && <span className="tnum"> · {inr(invoiceTotal(inv), { decimals: false })}</span>} · {c.reason}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    {c.kind === "card" ? <CreditCard className="size-3" aria-hidden /> : <Mail className="size-3" aria-hidden />}
                    <span className="tnum">Day {Math.min(day, 99)}</span>
                  </span>
                </div>
                <ol className="flex flex-wrap gap-1" aria-label={`Dunning schedule for ${t.name}`}>
                  {steps.map((s) => {
                    const on = fmtDateShort(addDays(parseISO(c.startedOn), s.day));
                    const Icon = s.state === "done" ? (s.label === "Suspend" ? Ban : CircleX) : Clock;
                    return (
                      <li
                        key={s.day}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]",
                          s.state === "done" && (s.label === "Suspend" ? "border-destructive/25 bg-destructive-soft text-destructive-fg" : "border-border bg-muted text-muted-foreground"),
                          s.state === "next" && !isPaused && "border-warning/30 bg-warning-soft text-warning-fg",
                          (s.state === "upcoming" || (s.state === "next" && isPaused)) && "border-dashed border-border text-muted-foreground",
                        )}
                      >
                        <Icon className="size-3" aria-hidden />
                        <span className="tnum">
                          D{s.day} {s.label} · {on}
                        </span>
                        <span className="sr-only">{s.state === "done" ? (c.kind === "card" && s.label !== "Suspend" ? "failed" : "done") : s.state === "next" ? "next" : "scheduled"}</span>
                      </li>
                    );
                  })}
                </ol>
                {!suspended && (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => onRetry(c)}>
                      <RotateCcw /> {c.kind === "card" ? "Retry charge now" : "Send reminder now"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={isPaused} onClick={() => onPause(c)}>
                      <CirclePause /> Pause dunning
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive-fg" onClick={() => onSuspend(c)}>
                      <Ban /> Suspend now
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
