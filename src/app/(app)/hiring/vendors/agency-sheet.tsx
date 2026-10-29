"use client";

import Link from "next/link";
import { Check, Flag, Receipt, Users } from "lucide-react";

import { fmtDate, inr } from "@/lib/format";
import { candidateById, stageLabel } from "@/mock/hiring";
import type { Agency, AgencyInvoice } from "@/mock/lifecycle";
import { Gated } from "@/components/shell/page";
import { KV, LcBadge } from "@/components/lifecycle/kit";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";

/* ============================================================================
   Agency detail — who they have in our pipeline right now, and every invoice
   they have raised. Fee = CTC × fee %, GST 18 % on the fee.
   ========================================================================== */

export function AgencySheet({
  agency,
  open,
  onOpenChange,
  linkCandidates,
  onApprove,
  onDispute,
}: {
  agency: Agency | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  linkCandidates: boolean;
  onApprove: (a: Agency, inv: AgencyInvoice) => void;
  onDispute: (a: Agency, inv: AgencyInvoice) => void;
}) {
  const live = agency ? agency.liveCandidateIds.map((id) => candidateById(id)).filter((c) => c !== undefined) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-2xl">
        {agency && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2.5">
                <Avatar name={agency.name} size={36} />
                <span className="min-w-0">
                  <span className="block truncate">{agency.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">{agency.focus}</span>
                </span>
              </SheetTitle>
              <SheetDescription className="sr-only">Agency terms, live candidates and invoices</SheetDescription>
            </SheetHeader>

            <SheetBody className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-border p-3 sm:grid-cols-3">
                <KV label="Status">
                  <StatusBadge status={agency.status} />
                </KV>
                <KV label="Account contact">{agency.contact}</KV>
                <KV label="Email">
                  <a href={`mailto:${agency.email}`} className="block truncate text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                    {agency.email}
                  </a>
                </KV>
                <KV label="Fee">
                  <span className="tnum">{agency.feePct}% of annual CTC</span>
                </KV>
                <KV label="Shortlist SLA">
                  <span className="tnum">
                    {agency.slaDays} days · met {agency.slaMetPct}%
                  </span>
                </KV>
                <KV label="Replacement guarantee">
                  <span className="tnum">{agency.replacementDays} days</span>
                </KV>
                <KV label="Contract ends">
                  <span className="tnum">{fmtDate(agency.contractEnd)}</span>
                </KV>
                <KV label="FY submissions → hires">
                  <span className="tnum">
                    {agency.submissionsFy} → {agency.interviewsFy} interviewed → {agency.hiresFy} hired
                  </span>
                </KV>
              </div>

              <section aria-labelledby="agy-live">
                <h3 id="agy-live" className="mb-2 text-xs font-semibold text-foreground">
                  Live candidates in pipeline <span className="tnum text-muted-foreground">({live.length})</span>
                </h3>
                {live.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No live candidates"
                    description={
                      agency.status === "on_hold"
                        ? "The agency is on hold — new submissions are paused until the account is reviewed."
                        : "Nothing submitted against an open requisition this cycle."
                    }
                    className="py-6"
                  />
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {live.map((c) => (
                      <li key={c.id} className="flex items-center gap-2.5 px-3 py-2">
                        <Avatar name={c.name} size={26} />
                        <span className="min-w-0 flex-1">
                          {linkCandidates ? (
                            <Link
                              href={`/candidates/${c.id}`}
                              className="block truncate text-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {c.name}
                            </Link>
                          ) : (
                            <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                          )}
                          <span className="tnum block truncate text-[11px] text-muted-foreground">
                            {c.role} · {c.reqCode} · {c.stageAgeDays}d in stage
                          </span>
                        </span>
                        <StatusBadge status={c.stage} label={stageLabel(c.stage)} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="agy-inv">
                <h3 id="agy-inv" className="mb-2 text-xs font-semibold text-foreground">
                  Invoices
                </h3>
                {agency.invoices.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No invoices raised"
                    description="An invoice is raised only once a placed candidate has joined. Fees are payable after the replacement window."
                    className="py-6"
                  />
                ) : (
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-2.5 py-2 text-left font-medium">Invoice</th>
                          <th scope="col" className="px-2.5 py-2 text-right font-medium">CTC</th>
                          <th scope="col" className="px-2.5 py-2 text-right font-medium">Fee</th>
                          <th scope="col" className="px-2.5 py-2 text-right font-medium">GST 18%</th>
                          <th scope="col" className="px-2.5 py-2 text-right font-medium">Total</th>
                          <th scope="col" className="px-2.5 py-2 text-left font-medium">Status</th>
                          <th scope="col" className="px-2.5 py-2"><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {agency.invoices.map((inv) => (
                          <tr key={inv.id} className="align-top">
                            <td className="px-2.5 py-2">
                              <span className="tnum block font-medium text-foreground">{inv.id}</span>
                              <span className="block text-muted-foreground">
                                {inv.hireName} · {inv.role}
                              </span>
                              <span className="tnum block text-[11px] text-muted-foreground">Raised {fmtDate(inv.raisedOn)}</span>
                            </td>
                            <td className="tnum px-2.5 py-2 text-right">{inr(inv.ctc, { decimals: false })}</td>
                            <td className="tnum px-2.5 py-2 text-right">
                              {inr(inv.fee, { decimals: false })}
                              <span className="block text-[11px] text-muted-foreground">@ {inv.feePct}%</span>
                            </td>
                            <td className="tnum px-2.5 py-2 text-right">{inr(inv.gst, { decimals: false })}</td>
                            <td className="tnum px-2.5 py-2 text-right font-semibold">{inr(inv.total, { decimals: false })}</td>
                            <td className="px-2.5 py-2">
                              <LcBadge status={inv.status} />
                            </td>
                            <td className="px-2.5 py-2">
                              {(inv.status === "pending" || inv.status === "approved") && (
                                <span className="flex justify-end gap-1">
                                  {inv.status === "pending" && (
                                    <Gated menuKey="hiring.vendors" action="E">
                                      <Button size="sm" variant="soft" onClick={() => onApprove(agency, inv)}>
                                        <Check /> Approve
                                      </Button>
                                    </Gated>
                                  )}
                                  <Gated menuKey="hiring.vendors" action="E">
                                    <Button size="sm" variant="ghost" onClick={() => onDispute(agency, inv)}>
                                      <Flag /> Dispute
                                    </Button>
                                  </Gated>
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
