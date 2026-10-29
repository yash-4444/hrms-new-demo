"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TENANT } from "@/mock/org";

/* ============================================================================
   Chrome for the public candidate pages (job detail, apply, tracker, offer,
   pre-joining). Same brand header as /careers — never the app shell.
   ========================================================================== */

const NAV = [
  { href: "/careers", label: "Open roles" },
  { href: "/careers/track", label: "Track application" },
];

export function PublicShell({
  children,
  subtitle = "Careers",
  nav = true,
  width = "max-w-5xl",
}: {
  children: React.ReactNode;
  subtitle?: string;
  nav?: boolean;
  width?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a href="#public-main" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
        <div className={cn("mx-auto flex h-14 w-full items-center gap-4 px-4 sm:px-6", width)}>
          <Link href="/careers" className="flex items-center gap-2 rounded focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${TENANT.shortName} careers, home`}>
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">H</span>
            <span className="text-sm font-semibold tracking-tight">{TENANT.shortName}</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">{subtitle}</span>
          </Link>
          {nav && (
            <nav aria-label="Careers" className="ml-auto flex items-center gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main id="public-main" tabIndex={-1} className={cn("mx-auto w-full flex-1 px-4 py-8 outline-none sm:px-6 sm:py-10", width)}>
        {children}
      </main>

      <footer className="border-t border-border bg-card">
        <div className={cn("mx-auto flex w-full flex-col gap-1 px-4 py-6 text-[11px] text-muted-foreground sm:flex-row sm:justify-between sm:px-6", width)}>
          <p>
            {TENANT.legalName} · CIN {TENANT.cin}
          </p>
          <p>
            Questions?{" "}
            <a href={`mailto:${TENANT.supportEmail}`} className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              {TENANT.supportEmail}
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
