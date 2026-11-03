"use client";

import * as React from "react";
import { CalendarClock, Users } from "lucide-react";
import { fmtDate, inr, num } from "@/lib/format";
import { PLAN_META, type PlanId } from "@/mock/console-tenants";
import { NEXT_RENEWAL, PLAN_COMMERCIAL } from "@/mock/console-plans";
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
  useDiscardGuard,
} from "@/components/ui/overlays";

/* Edit a plan — creates the plan's next version. Tenants stay on the version
   stamped on their subscription until their own renewal, so nothing already
   invoiced or in force is reinterpreted ("stamp, don't re-resolve"). */

export interface PlanVersionDraft {
  plan: PlanId;
  version: number;
  changes: { label: string; from: string; to: string }[];
  reason: string;
  at: string;
}

type Fields = { seatPrice: string; maxSeats: string; storageGb: string; rateLimit: string; supportSla: string };

const fieldsFor = (plan: PlanId): Fields => ({
  seatPrice: String(PLAN_META[plan].seatPrice),
  maxSeats: String(PLAN_META[plan].maxSeats ?? ""),
  storageGb: String(PLAN_META[plan].storageGb),
  rateLimit: String(PLAN_META[plan].rateLimit),
  supportSla: PLAN_COMMERCIAL[plan].supportSla,
});

/** Rendered only while open, so each opening starts from the published values. */
export function EditPlanDialog({
  plan,
  affected,
  nextVersion,
  onOpenChange,
  onSave,
}: {
  plan: PlanId;
  /** Live tenants on this plan — the ones the new version reaches. */
  affected: number;
  nextVersion: number;
  onOpenChange: (v: boolean) => void;
  onSave: (draft: Omit<PlanVersionDraft, "at">) => void;
}) {
  const base = React.useMemo(() => fieldsFor(plan), [plan]);
  const [f, setF] = React.useState<Fields>(base);
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const meta = PLAN_META[plan];
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const n = (k: keyof Fields) => Number(f[k]);
  const errors: Partial<Record<keyof Fields | "reason", string>> = {};
  if (plan !== "free" && (!f.seatPrice || n("seatPrice") < 1)) errors.seatPrice = "Enter a price of at least ₹1";
  if (plan === "free" && (!Number.isInteger(n("maxSeats")) || n("maxSeats") < 1)) errors.maxSeats = "Enter a whole number of seats";
  if (!Number.isInteger(n("storageGb")) || n("storageGb") < 1) errors.storageGb = "Enter whole GB, at least 1";
  if (!Number.isInteger(n("rateLimit")) || n("rateLimit") < 10) errors.rateLimit = "At least 10 requests per minute";
  if (f.supportSla.trim().length < 3) errors.supportSla = "Describe the support terms";
  if (reason.trim().length < 5) errors.reason = "Add a short reason (at least 5 characters)";

  const rows: { key: keyof Fields; label: string; fmt: (v: string) => string }[] = [
    ...(plan === "free"
      ? [{ key: "maxSeats" as const, label: "Seat cap", fmt: (v: string) => `${num(Number(v))} seats` }]
      : [{ key: "seatPrice" as const, label: "Price per seat", fmt: (v: string) => `${inr(Number(v), { decimals: false })} / month` }]),
    { key: "storageGb", label: "Storage", fmt: (v) => `${num(Number(v))} GB` },
    { key: "rateLimit", label: "API rate limit", fmt: (v) => `${num(Number(v))} / min` },
    { key: "supportSla", label: "Support SLA", fmt: (v) => v.trim() },
  ];
  const changes = rows.filter((r) => f[r.key].trim() !== base[r.key]).map((r) => ({ label: r.label, from: r.fmt(base[r.key]), to: r.fmt(f[r.key]) }));
  const priceUp = plan !== "free" && n("seatPrice") > meta.seatPrice;
  const reduced = n("rateLimit") < meta.rateLimit || n("storageGb") < meta.storageGb || (plan === "free" && n("maxSeats") < (meta.maxSeats ?? 0));

  const dirty = changes.length > 0 || reason.trim().length > 0;
  const { requestClose, guard } = useDiscardGuard(dirty, () => onOpenChange(false));
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && requestClose()}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              Edit {meta.label} — draft v{nextVersion}
            </DialogTitle>
            <DialogDescription>
              Publishes version {nextVersion} of the {meta.label} plan. New sign-ups get it straight away; existing tenants move at their next renewal.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-3 sm:grid-cols-2">
            {plan === "free" ? (
              <Field label="Seat cap" htmlFor="pe-seats" required error={show("maxSeats")}>
                <Input id="pe-seats" type="number" min={1} value={f.maxSeats} onChange={set("maxSeats")} aria-invalid={!!show("maxSeats")} />
              </Field>
            ) : (
              <Field label="Price per seat / month (₹)" htmlFor="pe-price" required error={show("seatPrice")}>
                <Input id="pe-price" type="number" min={1} value={f.seatPrice} onChange={set("seatPrice")} aria-invalid={!!show("seatPrice")} />
              </Field>
            )}
            <Field label="Storage (GB)" htmlFor="pe-storage" required error={show("storageGb")}>
              <Input id="pe-storage" type="number" min={1} value={f.storageGb} onChange={set("storageGb")} aria-invalid={!!show("storageGb")} />
            </Field>
            <Field label="API rate limit (requests / min)" htmlFor="pe-rate" required error={show("rateLimit")} hint="PerTenant policy, 1-minute fixed window.">
              <Input id="pe-rate" type="number" min={10} value={f.rateLimit} onChange={set("rateLimit")} aria-invalid={!!show("rateLimit")} />
            </Field>
            <Field label="Support SLA" htmlFor="pe-sla" required error={show("supportSla")}>
              <Input id="pe-sla" value={f.supportSla} onChange={set("supportSla")} aria-invalid={!!show("supportSla")} />
            </Field>
            <Field label="Reason for the change" htmlFor="pe-reason" required error={show("reason")} className="sm:col-span-2">
              <Textarea id="pe-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Recorded on the plan's version history." aria-invalid={!!show("reason")} />
            </Field>
            <Alert tone="warning" icon={Users} className="sm:col-span-2" title={`${num(affected)} tenant${affected === 1 ? "" : "s"} on ${meta.label} will be affected`}>
              Each moves to v{nextVersion} at its own next renewal (earliest {fmtDate(NEXT_RENEWAL)}). Until then it keeps the v{PLAN_COMMERCIAL[plan].version} terms stamped on its
              subscription — invoices already raised are never recalculated.
              {priceUp && " Owners are emailed the new price 30 days before it applies."}
              {reduced && " Reducing a limit can block a tenant already above it — check usage first."}
            </Alert>
            {changes.length > 0 && (
              <div className="rounded-md border border-border bg-subtle p-2.5 text-xs sm:col-span-2">
                <p className="mb-1 flex items-center gap-1 font-medium text-foreground">
                  <CalendarClock className="size-3.5" aria-hidden /> v{nextVersion} changes
                </p>
                <ul className="flex flex-col gap-0.5 text-muted-foreground">
                  {changes.map((c) => (
                    <li key={c.label}>
                      {c.label}: <span className="line-through">{c.from}</span> → <span className="font-medium text-foreground">{c.to}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              disabled={!changes.length}
              onClick={() => {
                setTouched(true);
                if (Object.keys(errors).length) return;
                onSave({ plan, version: nextVersion, changes, reason: reason.trim() });
              }}
            >
              Schedule v{nextVersion}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {guard}
    </>
  );
}
