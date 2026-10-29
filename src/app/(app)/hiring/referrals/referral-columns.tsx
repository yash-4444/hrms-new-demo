"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Check, X } from "lucide-react";

import { fmtDate, fmtMonth, inr } from "@/lib/format";
import { stageLabel } from "@/mock/hiring";
import { BONUS_STATUS_LABEL, bonusEligibleOn, type Referral } from "@/mock/lifecycle";
import { Gated } from "@/components/shell/page";
import { LcBadge } from "@/components/lifecycle/kit";
import { PersonCell } from "@/components/people/person-cell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Hint } from "@/components/ui/primitives";

/* ============================================================================
   Columns for both referral tables. "mine" is the employee's own tracker;
   "all" is the recruiter / HR ledger with the reward approval actions.
   ========================================================================== */

export const referralStageLabel = (r: Referral) => (r.stage === "submitted" ? "Submitted" : stageLabel(r.stage));

export const payoutLabel = (p: string | null) => (p ? fmtMonth(`${p}-01`) : "—");

export function referralColumns({
  mode,
  linkCandidates,
  linkEmployees,
  onApprove,
  onReject,
}: {
  mode: "mine" | "all";
  linkCandidates: boolean;
  linkEmployees: boolean;
  onApprove?: (r: Referral) => void;
  onReject?: (r: Referral) => void;
}): ColumnDef<Referral, unknown>[] {
  const cols: ColumnDef<Referral, unknown>[] = [
    {
      id: "candidate",
      header: "Candidate",
      accessorKey: "candidateName",
      enableHiding: false,
      cell: ({ row }) => {
        const r = row.original;
        const href =
          r.candidateId && linkCandidates
            ? `/candidates/${r.candidateId}`
            : r.hiredEmployeeCode && linkEmployees
              ? `/employees/${r.hiredEmployeeCode}`
              : undefined;
        return <PersonCell name={r.candidateName} subtitle={r.hiredEmployeeCode ? `Joined as ${r.hiredEmployeeCode}` : r.candidateEmail} href={href} />;
      },
    },
    {
      id: "role",
      header: "Role",
      accessorKey: "role",
      cell: ({ row }) => (
        <span className="block min-w-0">
          <span className="block truncate">{row.original.role}</span>
          {row.original.reqCode && <span className="tnum block text-[11px] text-muted-foreground">{row.original.reqCode}</span>}
        </span>
      ),
    },
  ];

  if (mode === "all") {
    cols.push({
      id: "referrer",
      header: "Referred by",
      accessorKey: "referrerName",
      cell: ({ row }) => (
        <PersonCell
          name={row.original.referrerName}
          code={row.original.referrerCode}
          size={22}
          href={linkEmployees ? `/employees/${row.original.referrerCode}` : undefined}
        />
      ),
    });
  } else {
    cols.push({ id: "relationship", header: "Relationship", accessorKey: "relationship" });
  }

  cols.push(
    {
      id: "submittedOn",
      header: "Submitted",
      accessorKey: "submittedOn",
      cell: ({ row }) => <span className="tnum whitespace-nowrap text-muted-foreground">{fmtDate(row.original.submittedOn)}</span>,
    },
    {
      id: "stage",
      header: "Stage",
      accessorFn: referralStageLabel,
      cell: ({ row }) => <StatusBadge status={row.original.stage} label={referralStageLabel(row.original)} />,
    },
    {
      id: "bonus",
      header: () => <span className="block text-right">Bonus</span>,
      accessorKey: "bonus",
      cell: ({ row }) => <span className="tnum block text-right font-medium">{inr(row.original.bonus, { decimals: false })}</span>,
    },
    {
      id: "bonusStatus",
      header: "Bonus status",
      accessorFn: (r) => BONUS_STATUS_LABEL[r.bonusStatus],
      cell: ({ row }) => {
        const r = row.original;
        const eligible = bonusEligibleOn(r);
        return (
          <Hint text={r.bonusStatus === "pending_tenure" && eligible ? `Payable once 90 days are completed on ${fmtDate(eligible)}.` : ""}>
            <span className="inline-flex">
              <LcBadge status={r.bonusStatus} label={BONUS_STATUS_LABEL[r.bonusStatus]} />
            </span>
          </Hint>
        );
      },
    },
    {
      id: "payout",
      header: "Payout period",
      accessorFn: (r) => r.payoutPeriod ?? "",
      cell: ({ row }) => {
        const r = row.original;
        if (r.payoutPeriod) return <span className="tnum whitespace-nowrap">{payoutLabel(r.payoutPeriod)} payroll</span>;
        const eligible = bonusEligibleOn(r);
        return (
          <span className="tnum whitespace-nowrap text-muted-foreground">
            {r.bonusStatus === "pending_tenure" && eligible ? `Eligible ${fmtDate(eligible)}` : "—"}
          </span>
        );
      },
    },
  );

  if (mode === "all" && onApprove && onReject) {
    cols.push({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) =>
        row.original.bonusStatus === "pending_approval" ? (
          <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Gated menuKey="hiring.referrals" action="A">
              <Button size="sm" variant="soft" onClick={() => onApprove(row.original)}>
                <Check /> Approve
              </Button>
            </Gated>
            <Gated menuKey="hiring.referrals" action="A">
              <Button size="sm" variant="ghost" onClick={() => onReject(row.original)} aria-label={`Reject bonus for ${row.original.candidateName}`}>
                <X /> Reject
              </Button>
            </Gated>
          </span>
        ) : null,
    });
  }

  return cols;
}
