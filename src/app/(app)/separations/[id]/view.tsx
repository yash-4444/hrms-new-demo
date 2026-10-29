"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarClock, ReceiptText, UserX } from "lucide-react";
import { fmtDate, inr } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Badge, EmptyState } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { KV, LcBadge, Timeline, type TimelineItem } from "@/components/lifecycle/kit";
import { ClearanceMatrix } from "@/components/lifecycle/clearance-matrix";
import { DEMO_TODAY, branchById, deptName } from "@/mock/org";
import { employeeName } from "@/mock/employees";
import {
  EXIT_INTERVIEWS,
  SEPARATION_STATUS_LABEL,
  clearanceFor,
  clearanceOpen,
  clearanceOpensOn,
  daysToLwd,
  fnfForSeparation,
  loanOutstanding,
  reasonLabel,
  separationById,
  tenureYears,
  type ClearanceItem,
  type Separation,
} from "@/mock/lifecycle";

/* ============================================================================
   /separations/[id] — the clearance matrix, recoveries and the exit timeline
   for one separation. Sign-offs and recoveries are optimistic, in memory.
   ========================================================================== */

function timelineFor(s: Separation, items: ClearanceItem[]): TimelineItem[] {
  const out: TimelineItem[] = [{ at: s.initiatedOn, title: s.type === "voluntary" ? "Resignation submitted" : s.type === "retirement" ? "Retirement notice issued" : "Termination notice served", detail: s.reasonDetail }];
  out.push(s.managerApprovedOn ? { at: s.managerApprovedOn, title: `Accepted by ${employeeName(s.managerCode)}` } : { at: DEMO_TODAY, title: "Awaiting manager acceptance", tone: "current" });
  if (s.managerApprovedOn) out.push(s.hrApprovedOn ? { at: s.hrApprovedOn, title: "Approved by HR — Priya Menon" } : { at: DEMO_TODAY, title: "Awaiting HR approval", tone: "current" });
  if (s.waivedDays || s.buyoutDays) out.push({ at: s.hrApprovedOn ?? s.initiatedOn, title: s.buyoutDays ? `${s.buyoutDays} days of notice bought out` : `${s.waivedDays} days of notice waived`, detail: `Last working day set to ${fmtDate(s.lwd)}.` });
  const opens = clearanceOpensOn(s);
  const cleared = items.filter((i) => i.status === "cleared").length;
  out.push({ at: opens, title: "Clearance opened", detail: clearanceOpen(s) ? `${cleared} of ${items.length} items cleared` : undefined, tone: clearanceOpen(s) ? (s.status === "completed" ? "done" : "current") : "upcoming" });
  const exi = EXIT_INTERVIEWS.find((x) => x.code === s.code);
  if (exi) out.push({ at: exi.scheduledOn, title: exi.status === "completed" ? `Exit interview with ${exi.interviewer}` : `Exit interview scheduled with ${exi.interviewer}`, tone: exi.status === "completed" ? "done" : "upcoming" });
  out.push({ at: s.lwd, title: "Last working day", tone: s.status === "completed" ? "done" : "upcoming" });
  const fnf = fnfForSeparation(s.id);
  if (fnf) out.push({ at: fnf.paidOn ?? fnf.approvedOn ?? fnf.preparedOn, title: fnf.paidOn ? "F&F paid" : fnf.approvedOn ? "F&F approved by Finance" : "F&F prepared by Payroll", detail: `${fnf.id} · net ${inr(fnf.net)}`, tone: fnf.paidOn ? "done" : "current" });
  return out;
}

export default function SeparationDetailView() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const sep = separationById(id);
  const loading = useFakeLoad();
  const [items, setItems] = React.useState<ClearanceItem[]>(() => (sep ? clearanceFor(sep) : []));

  if (!sep)
    return (
      <EmptyState
        icon={UserX}
        title="Separation not found"
        description={`No separation with id ${id}. It may have been created in another session.`}
        action={
          <Button size="sm" asChild>
            <Link href="/separations">Back to separations</Link>
          </Button>
        }
      />
    );

  const s = sep;
  const fnf = fnfForSeparation(s.id);
  const open = clearanceOpen(s);
  const recoveries = items.reduce((a, i) => a + i.recovery, 0);
  const d = daysToLwd(s);
  const manager = employeeName(s.managerCode);

  const signOff = (it: ClearanceItem) => {
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, status: "cleared", signedBy: "You", signedOn: DEMO_TODAY } : x)));
    mockAction(`${it.dept} item cleared`, { description: it.recovery ? `${it.label} — ${inr(it.recovery)} carries to F&F.` : it.label });
  };

  const raise = (it: ClearanceItem, amount: number, note: string) => {
    setItems((xs) => xs.map((x) => (x.id === it.id ? { ...x, status: "recovery", recovery: amount, detail: note } : x)));
    mockAction("Recovery raised", { description: `${inr(amount)} — ${it.label}. Payroll sees it on the F&F worksheet.`, tone: "warning" });
  };

  return (
    <PageBody>
      <Link href="/separations" className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-3.5" aria-hidden /> Separations
      </Link>
      <PageHeader
        title={`${s.name} — clearance`}
        description={`${s.id} · ${s.designation} · ${deptName(s.departmentId)} · ${branchById(s.branchId)?.city ?? s.branchId}`}
        actions={
          <>
            {s.status === "completed" ? <StatusBadge status="exited" size="md" /> : <LcBadge status={s.status} label={SEPARATION_STATUS_LABEL[s.status]} />}
            {fnf && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/fnf/${fnf.id}`}>
                  <ReceiptText aria-hidden /> F&amp;F {fnf.id}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <Section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KV label="Type">{s.type === "voluntary" ? "Voluntary" : s.type === "involuntary" ? "Involuntary" : "Retirement"}</KV>
          <KV label="Reason">
            <span className="flex flex-wrap items-center gap-1">
              {reasonLabel(s)} {s.regretted && <Badge variant="soft">Regretted</Badge>}
            </span>
          </KV>
          <KV label="Initiated">{fmtDate(s.initiatedOn)}</KV>
          <KV label="Notice">
            <span className="tnum">
              {s.noticeDays} d{s.waivedDays ? ` · ${s.waivedDays} waived` : ""}
              {s.buyoutDays ? ` · ${s.buyoutDays} buyout` : ""}
            </span>
          </KV>
          <KV label="Last working day">
            <span className="tnum">
              {fmtDate(s.lwd)} <span className="text-xs text-muted-foreground">{d > 0 ? `(in ${d} d)` : ""}</span>
            </span>
          </KV>
          <KV label="Service">
            <span className="tnum">{tenureYears(s.joiningDate, s.lwd).toFixed(2)} years</span>
          </KV>
        </div>
      </Section>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Section
          title="Clearance matrix"
          description={open ? `Sign off your desk's items. Recoveries flow to the F&F — ${inr(recoveries)} raised so far${loanOutstanding(s) ? ", including the loan balance" : ""}.` : undefined}
        >
          {loading ? (
            <TableSkeleton rows={8} />
          ) : (
            <>
              {!open && (
                <Alert tone="info" icon={CalendarClock} title={`Clearance opens on ${fmtDate(clearanceOpensOn(s))}`} className="mb-3">
                  Fifteen days before the last working day, each department is notified and the items below unlock for sign-off.
                </Alert>
              )}
              <ClearanceMatrix items={items} open={open && s.status !== "completed"} managerName={manager} onSignOff={signOff} onRecovery={raise} />
            </>
          )}
        </Section>
        <Section title="Timeline">
          <Timeline items={timelineFor(s, items)} />
        </Section>
      </div>
    </PageBody>
  );
}
