"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { fmtDate, inr, num, toDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CONSOLE_TODAY, MODULES, PLAN_META, type ConsoleTenant, type PlanId } from "@/mock/console-tenants";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";

/* Change plan / seats, and extend a trial. Both hand the new values back to
   the caller (useTenantActions), which writes state and the activity trail.
   Rendered only while open, so each opening starts from the tenant's values. */

export function ChangePlanDialog({
  tenant,
  onOpenChange,
  onConfirm,
}: {
  tenant: ConsoleTenant;
  onOpenChange: (v: boolean) => void;
  onConfirm: (plan: PlanId, seats: number) => void;
}) {
  const [plan, setPlan] = React.useState<PlanId>(tenant.plan);
  const [seats, setSeats] = React.useState(String(tenant.seatLimit));

  const meta = PLAN_META[plan];
  const seatCount = plan === "free" ? 25 : Number(seats);
  const seatError =
    plan === "free"
      ? tenant.seatsUsed > 25
        ? `${num(tenant.seatsUsed)} employees are active — Free allows 25.`
        : undefined
      : !Number.isInteger(seatCount) || seatCount < 1
        ? "Enter a whole number of seats."
        : seatCount < tenant.seatsUsed
          ? `Cannot go below the ${num(tenant.seatsUsed)} seats in use.`
          : undefined;
  const lost = PLAN_META[tenant.plan].modules.filter((m) => !meta.modules.includes(m));
  const gained = meta.modules.filter((m) => !PLAN_META[tenant.plan].modules.includes(m));
  const label = (id: string) => MODULES.find((m) => m.id === id)?.label ?? id;
  const unchanged = plan === tenant.plan && seatCount === tenant.seatLimit;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Change plan — {tenant.name}</DialogTitle>
          <DialogDescription>
            Takes effect immediately. The difference is prorated on the next invoice and the owner is emailed.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Plan">
            {Object.values(PLAN_META).map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={plan === p.id}
                onClick={() => setPlan(p.id)}
                className={cn(
                  "rounded-md border p-2.5 text-left text-xs focus-visible:ring-2 focus-visible:ring-ring",
                  plan === p.id ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
                )}
              >
                <span className="block text-sm font-semibold">{p.label}</span>
                <span className="block text-[11px] opacity-80">
                  {p.seatPrice ? `${inr(p.seatPrice, { decimals: false })} / seat / mo` : "Up to 25 employees"}
                </span>
                <span className="mt-1 block text-[11px] opacity-80">
                  {p.modules.length} modules · {num(p.rateLimit)} rpm
                </span>
              </button>
            ))}
          </div>
          {plan !== "free" && (
            <Field label="Seats" htmlFor="cp-seats" required error={seatError} hint={`${num(tenant.seatsUsed)} in use today.`}>
              <Input id="cp-seats" type="number" min={tenant.seatsUsed} value={seats} onChange={(e) => setSeats(e.target.value)} aria-invalid={!!seatError} />
            </Field>
          )}
          {plan === "free" && seatError && <Alert tone="danger">{seatError}</Alert>}
          {lost.length > 0 && (
            <Alert tone="warning" title={`${lost.length} module${lost.length === 1 ? "" : "s"} will switch off`}>
              {lost.map(label).join(", ")}. Data is kept read-only for 90 days in case the tenant upgrades again.
            </Alert>
          )}
          {gained.length > 0 && (
            <Alert tone="info" title={`${gained.length} module${gained.length === 1 ? "" : "s"} become available`}>
              {gained.map(label).join(", ")} — off until the tenant admin enables them.
            </Alert>
          )}
          <p className="tnum text-xs text-muted-foreground">
            New monthly value:{" "}
            <span className="font-medium text-foreground">
              {inr((seatError ? 0 : seatCount) * meta.seatPrice, { decimals: false })}
            </span>{" "}
            (was {inr(tenant.seatLimit * PLAN_META[tenant.plan].seatPrice, { decimals: false })}).
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!!seatError || unchanged} onClick={() => onConfirm(plan, seatCount)}>
            Apply change
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EXTENSIONS = [7, 14, 30];

export function ExtendTrialDialog({
  tenant,
  onOpenChange,
  onConfirm,
}: {
  tenant: ConsoleTenant;
  onOpenChange: (v: boolean) => void;
  onConfirm: (newEnd: string, days: number, note: string) => void;
}) {
  const [days, setDays] = React.useState(14);
  const [note, setNote] = React.useState("");
  const from = tenant.trialEndsAt && tenant.trialEndsAt > CONSOLE_TODAY ? tenant.trialEndsAt : CONSOLE_TODAY;
  const newEnd = format(addDays(toDate(from), days), "yyyy-MM-dd");
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Extend trial — {tenant.name}</DialogTitle>
          <DialogDescription>
            Currently ends {tenant.trialEndsAt ? fmtDate(tenant.trialEndsAt) : "—"}. The owner is told the new date by email.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <div className="flex gap-1.5" role="radiogroup" aria-label="Extend by">
            {EXTENSIONS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={days === d}
                onClick={() => setDays(d)}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-ring",
                  days === d ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
                )}
              >
                +{d} days
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            New end date: <span className="font-medium text-foreground">{fmtDate(newEnd)}</span>
          </p>
          <Field label="Note for the account team" htmlFor="et-note">
            <Textarea id="et-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Waiting on their security review." />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(newEnd, days, note.trim())}>
            Extend to {fmtDate(newEnd)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
