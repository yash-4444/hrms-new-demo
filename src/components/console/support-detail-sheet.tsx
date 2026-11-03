"use client";

import * as React from "react";
import { Ban, Eye, FileSearch, Headset, ShieldCheck } from "lucide-react";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { ENDED_BY_LABEL, type SupportSessionLog } from "@/mock/console-support";
import { OPERATOR_IP } from "@/mock/console-audit";
import type { ConsoleTenant } from "@/mock/console-tenants";
import { Facts, TonePill } from "@/components/platform/kit";
import { Alert } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";

/* One support session in full: who, why, how it ended, and the page-by-page
   trail of what the operator looked at inside the tenant. */

export function SessionStatusPill({ live }: { live: boolean }) {
  return live ? (
    <TonePill tone="warning" icon={Headset}>
      Live
    </TonePill>
  ) : (
    <TonePill tone="neutral">Ended</TonePill>
  );
}

export function SupportDetailSheet({
  session: s,
  tenant,
  live,
  minutes,
  onOpenChange,
}: {
  session: SupportSessionLog | null;
  tenant?: ConsoleTenant;
  live: boolean;
  /** Minutes elapsed (live) or actual duration (ended). */
  minutes: number;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={!!s} onOpenChange={onOpenChange}>
      <SheetContent side="right" width="sm:max-w-lg">
        {s && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Headset className="size-4" aria-hidden /> {s.id} · {tenant?.name ?? s.tenantId}
              </SheetTitle>
              <SheetDescription>
                Read-only support session by {s.operator}. The same record sits in {tenant?.name ?? "the tenant"}&apos;s own audit trail.
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <SessionStatusPill live={live} />
                <TonePill tone="info" icon={Eye}>
                  Read-only
                </TonePill>
                {s.ticket && <TonePill tone="neutral">{s.ticket}</TonePill>}
              </div>
              <Facts
                items={[
                  { label: "Operator", value: s.operator },
                  { label: "Source IP", value: <span className="font-mono">{OPERATOR_IP[s.operator] ?? "—"}</span> },
                  { label: "Tenant", value: `${tenant?.name ?? s.tenantId} (${s.tenantId})` },
                  { label: "Tenant owner", value: tenant ? `${tenant.ownerName} — notified at start` : "—" },
                  { label: "Started", value: fmtDateTime(s.startedAt) },
                  { label: live ? "Elapsed" : "Duration", value: `${minutes} of ${s.grantedMinutes} min granted` },
                  { label: "Ended", value: s.endedAt ? fmtDateTime(s.endedAt) : "Still open" },
                  {
                    label: "Ended by",
                    value: s.endedBy ? `${ENDED_BY_LABEL[s.endedBy]}${s.endedByName ? ` (${s.endedByName})` : ""}` : "—",
                  },
                ]}
              />
              <div className="rounded-md border border-border bg-subtle p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reason</p>
                <p className="mt-1 text-xs leading-relaxed">{s.reason}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Pages viewed", value: s.views.length, icon: FileSearch },
                  { label: "Write actions", value: 0, icon: ShieldCheck },
                  { label: "Writes blocked", value: s.blockedWrites, icon: Ban },
                ].map((k) => (
                  <div key={k.label} className="rounded-md border border-border p-2">
                    <k.icon className="mx-auto size-3.5 text-muted-foreground" aria-hidden />
                    <p className="tnum mt-1 text-base font-semibold">{k.value}</p>
                    <p className="text-[11px] text-muted-foreground">{k.label}</p>
                  </div>
                ))}
              </div>
              {s.blockedWrites > 0 && (
                <Alert tone="warning" icon={Ban} title={`${s.blockedWrites} write attempt${s.blockedWrites === 1 ? "" : "s"} refused`}>
                  The read-only lens blocked the attempt before it reached the server. No tenant data changed.
                </Alert>
              )}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pages viewed</p>
                <ol className="relative flex flex-col gap-3 border-l border-border pl-4">
                  {s.views.map((v, i) => (
                    <li key={`${v.at}-${i}`} className="relative">
                      <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                      <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                        <span className="tnum font-medium">{fmtTime(v.at)}</span>
                        <span>{v.label}</span>
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {tenant?.subdomain ?? "tenant"}.hrms-new.app{v.path}
                      </p>
                    </li>
                  ))}
                  {live && (
                    <li className="relative text-xs text-muted-foreground">
                      <span className="absolute -left-[21px] top-1 size-2.5 animate-pulse rounded-full border-2 border-card bg-warning" aria-hidden />
                      Session still open — new pages appear here as they are viewed.
                    </li>
                  )}
                </ol>
              </div>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
