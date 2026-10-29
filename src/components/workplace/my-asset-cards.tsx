"use client";

import * as React from "react";
import Link from "next/link";
import { Laptop, PackagePlus, Wrench } from "lucide-react";
import { fmtDate } from "@/lib/format";
import type { Asset } from "@/mock/workplace";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";

/* ============================================================================
   The equipment one person is holding — the self-service half of /assets.
   Every persona can raise an asset request, so the empty state and the header
   point at /assets/requests; the asset page itself (/assets/<id>) needs the
   register grant, so a card links there only for a persona that holds it.
   ========================================================================== */

export function MyAssetCards({ assets, holderName }: { assets: Asset[]; holderName: string }) {
  const { can } = useApp();
  const canRequest = can("workplace.asset_requests", "V");
  const canOpen = can("workplace.assets", "V");

  if (assets.length === 0) {
    return (
      <EmptyState
        icon={Laptop}
        title="No assets allocated to you"
        description={`Nothing in the register is currently assigned to ${holderName}. Request what you need and IT ships it from stock.`}
        action={
          canRequest ? (
            <Button size="sm" asChild>
              <Link href="/assets/requests">
                <PackagePlus /> Request an asset
              </Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {assets.map((a) => (
        <Card key={a.id} className="p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {a.make} {a.model}
              </p>
              {canOpen ? (
                <Link href={`/assets/${a.id}`} className="font-mono text-[11px] text-muted-foreground hover:underline">
                  {a.tag}
                </Link>
              ) : (
                <p className="font-mono text-[11px] text-muted-foreground">{a.tag}</p>
              )}
            </div>
            <StatusBadge status={a.status} />
          </div>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-2.5 text-[11px]">
            {[
              ["Category", a.category],
              ["Serial", a.serial],
              ["Condition", a.condition],
              ["Allocated on", a.allocatedOn ? fmtDate(a.allocatedOn) : "—"],
              ["Warranty", a.inWarranty ? `until ${fmtDate(a.warrantyExpiry)}` : "Expired"],
            ].map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="truncate text-right font-medium">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
          <div className="mt-2.5 flex gap-1.5 border-t border-border pt-2.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() =>
                mockAction("Issue reported", {
                  description: `${a.tag} — an IT engineer will contact you within the SLA${a.inWarranty ? ` and log a warranty claim with ${a.vendor}` : ""}.`,
                })
              }
            >
              <Wrench /> Report an issue
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
