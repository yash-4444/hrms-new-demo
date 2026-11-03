"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, CircleX, MessageSquareMore, MoreHorizontal, UserPlus, Zap } from "lucide-react";
import { fmtAgo, fmtDateTime, hm } from "@/lib/format";
import { COUNTRY_META } from "@/mock/console-tenants";
import { AUTO_APPROVER, minutesToDecide, type SignupRequest, type SignupStatus } from "@/mock/console-signups";
import { sinceSubmitted } from "@/components/console/signup-store";
import { PlanBadge } from "@/components/console/kit";
import { SignupCheckSummary, TENANT_HAS_PAGE } from "@/components/console/signups-review";
import { MutedCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/overlays";

/* The Sign-up Requests table, one column set per tab. Self-serve requests
   from /register carry a marker under the company name. */

export type SignupAction = "approve" | "reject" | "info";

export function useSignupColumns(
  tab: SignupStatus,
  isTaken: (s: SignupRequest) => boolean,
  onAction: (kind: SignupAction, s: SignupRequest) => void,
): ColumnDef<SignupRequest, unknown>[] {
  return React.useMemo<ColumnDef<SignupRequest, unknown>[]>(() => {
    const company: ColumnDef<SignupRequest, unknown> = {
      accessorKey: "company",
      header: "Company",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{row.original.company}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{row.original.subdomain}.hrms-new.app</p>
          {row.original.selfServe && (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-info/30 bg-info-soft px-1 text-[10px] font-medium text-info-fg">
              <UserPlus className="size-2.5" aria-hidden /> Self-serve · {sinceSubmitted(row.original.submittedAt)}
            </span>
          )}
        </div>
      ),
    };
    const plan: ColumnDef<SignupRequest, unknown> = { accessorKey: "plan", header: "Plan", cell: ({ row }) => <PlanBadge plan={row.original.plan} /> };
    const decided = (label: string): ColumnDef<SignupRequest, unknown> => ({
      accessorKey: "decidedAt",
      header: label,
      cell: ({ row }) => (
        <div className="text-xs">
          <p className="tnum">{fmtDateTime(row.original.decidedAt ?? "")}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.decidedBy}</p>
        </div>
      ),
    });
    if (tab === "approved")
      return [
        company,
        plan,
        {
          accessorKey: "tenantId",
          header: "Tenant",
          cell: ({ row }) => {
            const id = row.original.tenantId;
            if (!id) return <MutedCell>—</MutedCell>;
            return TENANT_HAS_PAGE.has(id) ? (
              <Link href={`/console/tenants/${id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-primary hover:underline">
                {id}
              </Link>
            ) : (
              <span className="font-mono text-xs">{id}</span>
            );
          },
        },
        decided("Approved"),
        {
          id: "speed",
          header: "Time to approve",
          accessorFn: (r) => minutesToDecide(r),
          cell: ({ row }) =>
            row.original.decidedBy === AUTO_APPROVER ? (
              <span className="inline-flex items-center gap-1 text-xs text-info-fg">
                <Zap className="size-3" aria-hidden /> Auto
              </span>
            ) : (
              <span className="tnum text-xs">{hm(minutesToDecide(row.original))}</span>
            ),
        },
      ];
    if (tab === "rejected")
      return [
        company,
        plan,
        { accessorKey: "rejectReason", header: "Reason", cell: ({ row }) => <span className="line-clamp-2 max-w-[360px] text-xs">{row.original.rejectReason}</span> },
        decided("Rejected"),
      ];
    return [
      company,
      plan,
      { accessorKey: "country", header: "Country", cell: ({ row }) => <span className="text-xs">{COUNTRY_META[row.original.country].label}</span> },
      {
        accessorKey: "adminName",
        header: "Admin",
        cell: ({ row }) => (
          <div className="min-w-0 text-xs">
            <p className="truncate">{row.original.adminName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.adminEmail}</p>
          </div>
        ),
      },
      { accessorKey: "size", header: "Size", cell: ({ row }) => <span className="tnum text-xs">{row.original.size}</span> },
      {
        accessorKey: "submittedAt",
        header: "Submitted",
        cell: ({ row }) => <MutedCell>{row.original.selfServe ? sinceSubmitted(row.original.submittedAt) : fmtAgo(row.original.submittedAt)}</MutedCell>,
      },
      {
        id: "checks",
        header: "Checks",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <SignupCheckSummary request={row.original} subdomainTaken={isTaken(row.original)} />
            {row.original.infoRequest && (
              <span className="inline-flex items-center gap-1 text-[11px] text-info-fg">
                <MessageSquareMore className="size-3" aria-hidden /> Info requested
              </span>
            )}
          </div>
        ),
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" disabled={!s.checks.emailVerified || isTaken(s)} onClick={() => onAction("approve", s)}>
                <Check /> Approve
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${s.company}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onAction("info", s)}>
                    <MessageSquareMore /> Request info
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => onAction("reject", s)}>
                    <CircleX /> Reject
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ];
  }, [tab, isTaken, onAction]);
}
