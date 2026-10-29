"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { TENANT } from "@/mock/org";

/* ============================================================================
   Public auth page frame — the same two-pane layout as /login, without the
   app shell. The left pane changes its pitch per page.
   ========================================================================== */

export function AuthShell({
  title,
  description,
  pitchTitle = "Secure by default, simple for everyone.",
  pitch = "Every sign-in is protected by a tenant-level password policy, optional MFA and a full audit trail. Sessions can be revoked from any device in one click.",
  points = ["Password policy enforced at the tenant", "TOTP and recovery-code MFA", "Every sign-in recorded in the audit log"],
  backHref = "/login",
  backLabel = "Back to sign in",
  wide,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  pitchTitle?: string;
  pitch?: string;
  points?: string[];
  backHref?: string | null;
  backLabel?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border bg-card p-10 lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            H
          </span>
          <span className="text-sm font-semibold tracking-tight">HRMS-NEW</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-lg font-semibold tracking-tight">{pitchTitle}</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{pitch}</p>
          <ul className="mt-6 flex flex-col gap-2">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-xs">
                <ShieldCheck className="size-3.5 text-success-fg" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {TENANT.legalName} · CIN {TENANT.cin}
        </p>
      </div>

      <div className="flex items-center justify-center p-5">
        <div className={cn("w-full", wide ? "max-w-xl" : "max-w-sm")}>
          <div className="mb-5 lg:hidden">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              H
            </span>
          </div>
          {backHref && (
            <Link
              href={backHref}
              className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden /> {backLabel}
            </Link>
          )}
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
