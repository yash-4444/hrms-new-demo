"use client";

import { CircleOff, Crosshair, OctagonX, Percent, Power } from "lucide-react";
import { PLAN_META } from "@/mock/console-tenants";
import type { FlagConfig } from "@/mock/console-flags";
import { TonePill } from "@/components/platform/kit";

/* Feature flags — the state pill and the one-line targeting summary, shared by
   the flags table and the exposure sheet. */

export function FlagStatePill({ config: c }: { config: FlagConfig }) {
  if (c.killed)
    return (
      <TonePill tone="danger" icon={OctagonX}>
        Killed
      </TonePill>
    );
  switch (c.state) {
    case "off":
      return (
        <TonePill tone="neutral" icon={CircleOff}>
          Off
        </TonePill>
      );
    case "on":
      return (
        <TonePill tone="success" icon={Power}>
          On for all
        </TonePill>
      );
    case "rollout":
      return (
        <TonePill tone="accent" icon={Percent}>
          {c.percent}% roll-out
        </TonePill>
      );
    case "targeted":
      return (
        <TonePill tone="info" icon={Crosshair}>
          Targeted
        </TonePill>
      );
  }
}

export function targetingSummary(c: FlagConfig) {
  if (c.state === "off") return "—";
  if (c.state === "on") return "Every tenant";
  const plans = c.plans.map((p) => PLAN_META[p].label).join(" + ");
  const listed = c.tenantIds.length ? `${c.tenantIds.length} tenant${c.tenantIds.length === 1 ? "" : "s"}` : "";
  if (c.state === "rollout") return [`${c.percent}% of ${plans || "all plans"}`, listed && `+ ${listed}`].filter(Boolean).join(" ");
  return [plans && `${plans} plan`, listed].filter(Boolean).join(" + ") || "Nobody yet";
}
