"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Gauge, HardDrive, Headset, Pencil, Puzzle, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, inrCompact, num } from "@/lib/format";
import { MODULES, PLAN_META, type ConsoleTenant, type PlanId } from "@/mock/console-tenants";
import { ADD_ONS, NEXT_RENEWAL, PLAN_COMMERCIAL } from "@/mock/console-plans";
import type { PlanVersionDraft } from "@/components/console/plans-edit-dialog";
import { PlanBadge } from "@/components/console/kit";
import { TonePill } from "@/components/platform/kit";
import { Section } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/* Plans & Entitlements — the three plan cards and the add-on catalogue. */

const PLANS: PlanId[] = ["free", "pro", "enterprise"];

/** Tenants a plan edit reaches: everyone still subscribed. */
export const onPlan = (tenants: ConsoleTenant[], plan: PlanId) =>
  tenants.filter((t) => t.plan === plan && t.status !== "churned" && t.status !== "scheduled_deletion");

export function PlanCards({
  tenants,
  scheduled,
  onEdit,
}: {
  tenants: ConsoleTenant[];
  scheduled: PlanVersionDraft[];
  onEdit: (plan: PlanId) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {PLANS.map((id) => {
        const p = PLAN_META[id];
        const c = PLAN_COMMERCIAL[id];
        const live = onPlan(tenants, id);
        const mrr = live.reduce((a, t) => a + t.mrr, 0);
        const next = scheduled.filter((d) => d.plan === id).at(-1);
        const facts: { icon: React.ElementType; label: string; value: string }[] = [
          { icon: Users, label: "Seats", value: p.maxSeats ? `Up to ${num(p.maxSeats)} employees` : "Purchased seats, no cap" },
          { icon: HardDrive, label: "Storage", value: `${num(p.storageGb)} GB per tenant` },
          { icon: Gauge, label: "API rate limit", value: `${num(p.rateLimit)} requests / min` },
          { icon: Headset, label: "Support", value: c.supportSla },
        ];
        return (
          <Card key={id} className={cn("flex flex-col gap-3 p-4", id === "pro" && "border-primary/40")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <PlanBadge plan={id} />
                  <span className="text-[11px] text-muted-foreground">
                    v{c.version} since {fmtDate(c.versionSince)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{c.tagline}</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${p.label} plan`} onClick={() => onEdit(id)}>
                <Pencil />
              </Button>
            </div>
            <p className="tnum">
              <span className="text-2xl font-semibold tracking-tight text-foreground">{p.seatPrice ? inr(p.seatPrice, { decimals: false }) : "₹0"}</span>
              <span className="text-xs text-muted-foreground"> {p.seatPrice ? "per seat / month" : "free forever"}</span>
            </p>
            <ul className="flex flex-col gap-1.5">
              {facts.map((f) => (
                <li key={f.label} className="flex items-start gap-2 text-xs">
                  <f.icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="sr-only">{f.label}: </span>
                    {f.value}
                  </span>
                </li>
              ))}
              <li className="flex items-start gap-2 text-xs">
                <Puzzle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {p.modules.length} of {MODULES.length} modules
              </li>
            </ul>
            {next && (
              <TonePill tone="info" icon={CalendarClock}>
                v{next.version} from next renewal ({fmtDate(NEXT_RENEWAL)} onward)
              </TonePill>
            )}
            <div className="mt-auto flex items-end justify-between border-t border-border pt-3 text-xs">
              <Link href="/console/tenants" className="hover:underline">
                <span className="tnum block text-base font-semibold text-foreground">{num(live.length)}</span>
                <span className="text-muted-foreground">tenants on plan</span>
              </Link>
              <div className="text-right">
                <span className="tnum block text-base font-semibold text-foreground">{inrCompact(mrr)}</span>
                <span className="text-muted-foreground">MRR</span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function AddOnsSection({ tenants }: { tenants: ConsoleTenant[] }) {
  return (
    <Section title="Add-ons" description="Bought on top of a plan, billed on the same invoice and renewed with it." bodyClassName="p-0">
      <ul className="divide-y divide-border">
        {ADD_ONS.map((a) => {
          const users = a.tenantIds.map((id) => tenants.find((t) => t.id === id)).filter((t): t is ConsoleTenant => !!t);
          return (
            <li key={a.id} className="flex flex-wrap items-start gap-x-4 gap-y-1.5 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{a.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{a.description}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {a.availableOn.map((p) => (
                    <PlanBadge key={p} plan={p} />
                  ))}
                  {a.includedIn.map((p) => (
                    <TonePill key={p} tone="success">
                      Included in {PLAN_META[p].label}
                    </TonePill>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs">
                <p className="tnum font-medium text-foreground">
                  {inr(a.price, { decimals: false })} <span className="font-normal text-muted-foreground">/ {a.unit} / month</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {num(users.length)} tenant{users.length === 1 ? "" : "s"} subscribed
                </p>
                {users.length > 0 && <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-muted-foreground">{users.map((t) => t.name).join(", ")}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
