"use client";

import * as React from "react";
import { Check, Send, X } from "lucide-react";
import { fmtDate } from "@/lib/format";
import type { SalaryRevision } from "@/mock/finance-payroll";
import { useApp } from "@/components/app-state";
import { DecisionDialog, FinStatus } from "@/components/finance/kit";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { Gated } from "@/components/shell/page";
import { DetailList, DetailRow } from "@/components/people/person-cell";
import { ArrearsPreview, BreakupCompare } from "./breakup-compare";

export function RevisionSheet({
  revision,
  onOpenChange,
  onApprove,
  onReject,
  onSubmit,
}: {
  revision: SalaryRevision | null;
  onOpenChange: (v: boolean) => void;
  onApprove: (r: SalaryRevision) => void;
  onReject: (r: SalaryRevision, comment: string) => void;
  onSubmit: (r: SalaryRevision) => void;
}) {
  const { persona } = useApp();
  const [rejecting, setRejecting] = React.useState(false);
  const r = revision;
  const selfApproval = r?.raisedBy === persona.name;

  return (
    <>
      <Sheet open={!!r} onOpenChange={onOpenChange}>
        <SheetContent width="sm:max-w-2xl">
          {r && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {r.name} <FinStatus status={r.status} />
                </SheetTitle>
                <SheetDescription>
                  {r.id} · {r.reason} · effective {fmtDate(r.effectiveFrom)}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-4">
                <DetailList>
                  <DetailRow label="Employee">
                    {r.employeeCode} · {r.department}
                  </DetailRow>
                  <DetailRow label="Raised by">
                    {r.raisedBy} on {fmtDate(r.raisedOn)}
                  </DetailRow>
                  {r.decidedBy && (
                    <DetailRow label={r.status === "rejected" ? "Rejected by" : "Approved by"}>
                      {r.decidedBy} on {fmtDate(r.decidedOn!)}
                    </DetailRow>
                  )}
                  <DetailRow label="Justification">{r.note}</DetailRow>
                </DetailList>
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold">CTC breakup — before and after</h3>
                  <BreakupCompare gradeId={r.gradeId} oldCtc={r.oldCtc} newGradeId={r.newGradeId} newCtc={r.newCtc} />
                </section>
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold">Arrears preview</h3>
                  <ArrearsPreview
                    gradeId={r.gradeId}
                    oldCtc={r.oldCtc}
                    newGradeId={r.newGradeId}
                    newCtc={r.newCtc}
                    effectiveFrom={r.effectiveFrom}
                  />
                </section>
                {r.status === "pending_approval" && (
                  <Alert tone="info" title="Segregation of duties">
                    Payroll raises revisions; only the Finance Controller can approve them. Approving a back-dated revision
                    posts the arrears to the September 2026 run and marks it for recalculation.
                  </Alert>
                )}
                {selfApproval && r.status === "pending_approval" && (
                  <Alert tone="warning">You raised this revision, so you cannot also approve it.</Alert>
                )}
              </SheetBody>
              <SheetFooter>
                {r.status === "draft" && (
                  <Gated menuKey="payroll.salary" action="E">
                    <Button size="sm" onClick={() => onSubmit(r)}>
                      <Send /> Submit for approval
                    </Button>
                  </Gated>
                )}
                {r.status === "pending_approval" && (
                  <>
                    <Gated menuKey="payroll.salary" action="A">
                      <Button variant="outline" size="sm" disabled={selfApproval} onClick={() => setRejecting(true)}>
                        <X /> Reject
                      </Button>
                    </Gated>
                    <Gated menuKey="payroll.salary" action="A">
                      <Button size="sm" disabled={selfApproval} onClick={() => onApprove(r)}>
                        <Check /> Approve revision
                      </Button>
                    </Gated>
                  </>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
      <DecisionDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={`Reject ${r?.id ?? "revision"}?`}
        description="Payroll is notified with your reason. The employee's current salary stays in force."
        confirmLabel="Reject revision"
        onConfirm={(comment) => r && onReject(r, comment)}
      />
    </>
  );
}
