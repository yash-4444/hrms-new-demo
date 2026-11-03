"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { isPlatformRole, PLATFORM_PERSONA } from "@/lib/rbac";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Route guard for the whole /console tree. The console is not part of the
 * tenant RBAC matrix — no tenant grant, not even Tenant Owner's, can open it —
 * so it is gated by role alone. A tenant persona gets the same Access denied
 * pattern as RouteGuard, and never sees the console's shell or nav.
 */
export function ConsoleGuard({ children }: { children: React.ReactNode }) {
  const { role, persona, setRole } = useApp();
  if (isPlatformRole(role)) return <>{children}</>;

  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="max-w-lg p-6 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-destructive-soft text-destructive-fg">
          <ShieldAlert className="size-5" aria-hidden />
        </div>
        <h1 className="text-base font-semibold">Access denied</h1>
        <p className="mt-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{persona.name}</span> is signed in as{" "}
          <span className="font-medium text-foreground">{persona.role}</span>, a role inside one organisation. The
          Platform Console belongs to the SaaS vendor&apos;s operators — no tenant grant can open it, not even Tenant
          Owner.
        </p>
        <div className="mt-3 rounded-md border border-border bg-subtle p-2.5 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Required role</p>
          <p className="mt-1 font-mono text-xs text-foreground">Platform (vendor) › {PLATFORM_PERSONA.role}</p>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          In the demo you can switch to the vendor persona to see the console.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <Button size="sm" onClick={() => setRole(PLATFORM_PERSONA.id)}>
            View as {PLATFORM_PERSONA.role}
          </Button>
        </div>
      </Card>
    </main>
  );
}
