"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Eye, Headset, X } from "lucide-react";
import { isPlatformRole } from "@/lib/rbac";
import { useApp, useDemoNow } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/* ============================================================================
   Support sessions, seen from the tenant side.

   SupportSessionBanner is the persistent strip a platform operator sees on
   every tenant screen while a support session is open — and, in the console,
   a reminder that one is still running. OperatorOutsideTenant is what the
   tenant shell renders for the operator without a session: they belong to no
   tenant, so there is nothing to show but the way back to the console.
   ========================================================================== */

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export function SupportSessionBanner({ where = "tenant" }: { where?: "tenant" | "console" }) {
  const { supportSession, endSupportSession } = useApp();
  const { logActivity } = useConsole();
  const router = useRouter();
  const now = useDemoNow();
  if (!supportSession) return null;

  const left = supportSession.endsAt - now;
  const end = () => {
    logActivity(supportSession.tenantId, {
      category: "support",
      action: "Support session ended by the operator",
      detail: `${supportSession.ticket} · ended with ${mmss(left)} left`,
    });
    endSupportSession();
    router.push(`/console/tenants/${supportSession.tenantId}`);
  };

  return (
    <div
      role="status"
      aria-live="off"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-warning/60 bg-warning px-3 py-1.5 text-xs text-[#3a2800] lg:px-4"
    >
      <Headset className="size-3.5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Support session in {supportSession.tenantName}</span>
        <span> — ends in </span>
        <span className="tnum font-semibold" aria-label={`${Math.ceil(left / 60000)} minutes left`}>
          {mmss(left)}
        </span>
        <span className="hidden sm:inline">
          {" "}
          · {supportSession.ticket} · read-only, recorded in the tenant&apos;s audit trail
        </span>
      </p>
      <span className="flex items-center gap-1.5">
        {where === "console" ? (
          <Button size="sm" variant="outline" className="h-6 border-[#3a2800]/30 bg-white/40 px-2 text-[#3a2800] hover:bg-white/60" asChild>
            <Link href="/dashboard">
              <Building2 /> Return to tenant
            </Link>
          </Button>
        ) : (
          <span className="hidden items-center gap-1 rounded border border-[#3a2800]/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide md:inline-flex">
            <Eye className="size-3" aria-hidden /> Read-only
          </span>
        )}
        <Button size="sm" className="h-6 bg-[#3a2800] px-2 text-white hover:bg-[#3a2800]/85" onClick={end}>
          <X /> End session
        </Button>
      </span>
    </div>
  );
}

/** The tenant shell for a platform operator with no open support session. */
export function OperatorOutsideTenant({ children }: { children: React.ReactNode }) {
  const { role, supportSession, persona } = useApp();
  if (!isPlatformRole(role) || supportSession) return <>{children}</>;
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-lg p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-info-soft text-info-fg">
          <Headset className="size-5" aria-hidden />
        </div>
        <h1 className="text-base font-semibold">You are outside every tenant</h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{persona.name}</span> is signed in as{" "}
          <span className="font-medium text-foreground">{persona.role}</span>. Platform operators hold no grants inside
          an organisation — tenant screens open only through a support session started from the console, with a
          reason and a ticket, recorded in that tenant&apos;s audit trail.
        </p>
        <div className="mt-4 flex justify-center">
          <Button size="sm" asChild>
            <Link href="/console">
              <ArrowLeft /> Back to the Platform Console
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
