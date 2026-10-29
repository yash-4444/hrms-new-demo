"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, CheckCircle2, FileText, ReceiptText, Send, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/overlays";
import { KV, LcBadge, ReasonDialog, Timeline, type TimelineItem } from "@/components/lifecycle/kit";
import { FnfLines, FnfStatementDialog } from "@/components/lifecycle/fnf-statement";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { FNF_STATUS_LABEL, fnfById, type FnfRecord, type FnfStatus } from "@/mock/lifecycle";

/* ============================================================================
   /fnf/[id] — one settlement: every line with its formula and explanation,
   the maker-checker trail (Payroll prepares, Finance approves) and the A4
   statement. Totals are recomputed from the lines on every render.
   ========================================================================== */

export default function FnfDetailView() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const base = fnfById(id);
  const loading = useFakeLoad();
  const [rec, setRec] = React.useState<FnfRecord | undefined>(base);
  const [statement, setStatement] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const [returning, setReturning] = React.useState(false);

  if (!rec)
    return (
      <EmptyState
        icon={ReceiptText}
        title="Settlement not found"
        description={`No full & final settlement with id ${id}.`}
        action={
          <Button size="sm" asChild>
            <Link href="/fnf">Back to Full &amp; Final</Link>
          </Button>
        }
      />
    );

  const f = rec;
  const s = f.separation;
  const earnings = f.earnings.reduce((a, l) => a + l.amount, 0);
  const deductions = f.deductions.reduce((a, l) => a + l.amount, 0);
  const net = earnings - deductions;
  const reconciles = earnings === f.totalEarnings && deductions === f.totalDeductions && net === f.net;
  const setStatus = (status: FnfStatus, p: Partial<FnfRecord> = {}) => setRec({ ...f, status, ...p });

  const trail: TimelineItem[] = [
    { at: f.preparedOn, title: `Prepared by ${f.preparedBy} (Payroll)`, detail: f.status === "draft" ? "Projected to the last working day — recomputes if inputs change." : undefined, tone: f.status === "draft" ? "current" : "done" },
    f.status === "pending_approval"
      ? { at: DEMO_TODAY, title: "Awaiting Finance approval — Lakshmi Pillai", tone: "current" }
      : f.approvedOn
        ? { at: f.approvedOn, title: `Approved by ${f.approvedBy} (Finance Controller)` }
        : { at: s.lwd, title: "Finance approval", tone: "upcoming" },
    f.paidOn ? { at: f.paidOn, title: "Paid by bank transfer", detail: "Included in the off-cycle payout file." } : { at: s.lwd, title: "Payout", tone: "upcoming" },
  ];

  return (
    <PageBody>
      <Link href="/fnf" className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-3.5" aria-hidden /> Full &amp; Final
      </Link>
      <PageHeader
        title={`F&F — ${s.name}`}
        description={`${f.id} · ${s.designation} · ${deptName(s.departmentId)} · last working day ${fmtDate(s.lwd)}`}
        actions={
          <>
            {f.status === "paid" ? <StatusBadge status="paid" /> : <LcBadge status={f.status} label={FNF_STATUS_LABEL[f.status]} />}
            {f.status === "draft" && (
              <Gated menuKey="lifecycle.fnf" action="E">
                <Button size="sm" variant="outline" onClick={() => { setStatus("pending_approval"); mockAction("Sent to Finance", { description: `${f.id} — Lakshmi Pillai notified to approve.` }); }}>
                  <Send aria-hidden /> Submit for approval
                </Button>
              </Gated>
            )}
            {f.status === "pending_approval" && (
              <>
                <Gated menuKey="lifecycle.fnf" action="A">
                  <Button size="sm" variant="ghost" onClick={() => setReturning(true)}>
                    <Undo2 aria-hidden /> Send back
                  </Button>
                </Gated>
                <Gated menuKey="lifecycle.fnf" action="A">
                  <Button size="sm" onClick={() => setApproving(true)}>
                    <BadgeCheck aria-hidden /> Approve
                  </Button>
                </Gated>
              </>
            )}
            {f.status === "approved" && (
              <Gated menuKey="lifecycle.fnf" action="E">
                <Button size="sm" variant="outline" onClick={() => { setStatus("paid", { paidOn: DEMO_TODAY }); mockAction("Marked paid", { description: `${inr(Math.abs(net), { decimals: false })} released in today's off-cycle payout file.` }); }}>
                  <CheckCircle2 aria-hidden /> Mark paid
                </Button>
              </Gated>
            )}
            <Button size="sm" variant="outline" onClick={() => setStatement(true)}>
              <FileText aria-hidden /> Generate statement
            </Button>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton count={3} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Earnings</p>
                <p className="tnum mt-1 text-lg font-semibold">{inr(earnings, { decimals: false })}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Deductions</p>
                <p className="tnum mt-1 text-lg font-semibold">{inr(deductions, { decimals: false })}</p>
              </div>
              <div className={cn("rounded-md border p-3", net >= 0 ? "border-success/25 bg-success-soft" : "border-destructive/25 bg-destructive-soft")}>
                <p className={cn("text-[11px] uppercase tracking-wide", net >= 0 ? "text-success-fg" : "text-destructive-fg")}>{net >= 0 ? "Net payable" : "Net recoverable"}</p>
                <p className={cn("tnum mt-1 text-lg font-semibold", net >= 0 ? "text-success-fg" : "text-destructive-fg")}>{inr(Math.abs(net), { decimals: false })}</p>
              </div>
            </div>
            {net < 0 && (
              <Alert tone="danger" title="Deductions exceed the settlement">
                The employee owes {inr(-net, { decimals: false })}. A recovery letter is issued with the statement; the loan agreement allows recovery from the employee directly.
              </Alert>
            )}
            <Section title="Earnings" description="Salary to LWD, leave encashment, gratuity and any incentive.">
              <FnfLines title="Earnings" lines={f.earnings} total={earnings} tone="earning" />
            </Section>
            <Section title="Deductions" description="Statutory deductions and every recovery raised during clearance.">
              <FnfLines title="Deductions" lines={f.deductions} total={deductions} tone="deduction" />
            </Section>
            <p className={cn("tnum text-xs", reconciles ? "text-success-fg" : "text-destructive-fg")}>
              {reconciles ? "✓" : "✗"} {inr(earnings, { decimals: false })} − {inr(deductions, { decimals: false })} = {inr(net, { decimals: false })} · reconciles with the worksheet
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Section title="Inputs">
              <div className="grid grid-cols-2 gap-3">
                <KV label="Annual CTC">{inr(s.ctc, { decimals: false })}</KV>
                <KV label="Grade">{s.gradeId}</KV>
                <KV label="Monthly gross">{inr(f.breakup.gross, { decimals: false })}</KV>
                <KV label="Monthly basic">{inr(f.breakup.basic, { decimals: false })}</KV>
                <KV label="Joined">{fmtDate(s.joiningDate)}</KV>
                <KV label="Service">{f.serviceYears.toFixed(2)} yrs</KV>
                <KV label="Gratuity years">{f.gratuityYears || "Not eligible"}</KV>
                <KV label="EL balance">{f.elBalance} days</KV>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Salary figures come from the payroll structure for {s.gradeId}; the EL balance from the leave ledger; recoveries from the{" "}
                {s.former ? "clearance record" : <Link className="text-primary hover:underline" href={`/separations/${s.id}`}>clearance matrix</Link>}.
              </p>
            </Section>
            <Section title="Maker–checker">
              <Timeline items={trail} />
            </Section>
          </div>
        </div>
      )}

      <FnfStatementDialog record={{ ...f, totalEarnings: earnings, totalDeductions: deductions, net }} open={statement} onOpenChange={setStatement} />
      <ConfirmDialog
        open={approving}
        onOpenChange={setApproving}
        title={`Approve ${inr(Math.abs(net), { decimals: false })} ${net >= 0 ? "payable" : "recoverable"}?`}
        description={`${s.name}'s settlement moves to the off-cycle payout. Prepared by ${f.preparedBy}; you are the checker.`}
        confirmLabel="Approve settlement"
        onConfirm={() => {
          setStatus("approved", { approvedBy: "Lakshmi Pillai", approvedOn: DEMO_TODAY });
          mockAction("F&F approved", { description: `${f.id} — ${inr(Math.abs(net), { decimals: false })}. Payroll can release it in the next off-cycle file.` });
        }}
      />
      <ReasonDialog
        open={returning}
        onOpenChange={setReturning}
        title="Send back to Payroll?"
        description="The settlement returns to draft with your comment."
        confirmLabel="Send back"
        onConfirm={(c) => {
          setStatus("draft");
          mockAction("Sent back to Payroll", { description: c, tone: "warning" });
        }}
      />
    </PageBody>
  );
}
