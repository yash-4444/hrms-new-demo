"use client";

import * as React from "react";
import { Info, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { TENANT, deptName } from "@/mock/org";
import { amountInWords } from "@/mock/payroll";
import type { FnfLine, FnfRecord } from "@/mock/lifecycle";

/* ------------------------------------------------------------ explain line */

/** "Explain this number" — the rule, the inputs and the arithmetic behind one line. */
export function ExplainLine({ line }: { line: FnfLine }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px] text-muted-foreground" aria-label={`Explain ${line.label}`}>
          <Info aria-hidden /> Explain
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 text-xs">
        <p className="font-semibold">{line.label}</p>
        <p className="tnum mt-1 rounded bg-muted px-2 py-1 font-mono text-[11px]">
          {line.formula} = {inr(line.amount, { decimals: false })}
        </p>
        <p className="mt-2 leading-relaxed text-muted-foreground">{line.explanation}</p>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------------------------------------------------- line table */

export function FnfLines({ title, lines, total, tone }: { title: string; lines: FnfLine[]; total: number; tone: "earning" | "deduction" }) {
  return (
    <table className="w-full text-xs">
      <caption className="sr-only">{title}</caption>
      <thead>
        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <th scope="col" className="py-1.5 font-medium">{title}</th>
          <th scope="col" className="py-1.5 font-medium">Formula</th>
          <th scope="col" className="py-1.5 text-right font-medium">Amount</th>
          <th scope="col" className="w-20 py-1.5"><span className="sr-only">Explain</span></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {lines.map((l) => (
          <tr key={l.key}>
            <td className="py-2 pr-3 font-medium">{l.label}</td>
            <td className="tnum py-2 pr-3 font-mono text-[11px] text-muted-foreground">{l.formula}</td>
            <td className={cn("tnum py-2 text-right", l.amount === 0 && "text-muted-foreground")}>{inr(l.amount, { decimals: false })}</td>
            <td className="py-2 text-right">
              <ExplainLine line={l} />
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-border font-semibold">
          <td className="py-2" colSpan={2}>
            Total {tone === "earning" ? "earnings" : "deductions"}
          </td>
          <td className="tnum py-2 text-right">{inr(total, { decimals: false })}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

/* -------------------------------------------------------- A4 statement */

export function FnfStatementDialog({ record: f, open, onOpenChange }: { record: FnfRecord; open: boolean; onOpenChange: (v: boolean) => void }) {
  const s = f.separation;
  const rows = Math.max(f.earnings.length, f.deductions.length);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>F&amp;F statement — {s.name}</DialogTitle>
          <DialogDescription>A4 preview generated from the settlement worksheet. Every figure reconciles to the lines on screen.</DialogDescription>
        </DialogHeader>
        <DialogBody className="scrollbar-thin overflow-y-auto bg-muted/40">
          <article aria-label="Full and final settlement statement" className="mx-auto aspect-[210/297] w-full max-w-[640px] rounded-sm border border-border bg-card p-8 text-[11px] leading-relaxed text-foreground shadow-sm">
            <header className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <p className="text-sm font-semibold">{TENANT.legalName}</p>
                <p className="text-muted-foreground">CIN {TENANT.cin} · PAN {TENANT.pan} · TAN {TENANT.tan}</p>
              </div>
              <p className="text-right font-semibold">
                Full &amp; Final Settlement
                <span className="block font-normal text-muted-foreground">{f.id}</span>
              </p>
            </header>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
              {[
                ["Employee", `${s.name} (${s.code})`],
                ["Designation", `${s.designation}, ${deptName(s.departmentId)}`],
                ["Date of joining", fmtDate(s.joiningDate)],
                ["Last working day", fmtDate(s.lwd)],
                ["Service", `${f.serviceYears.toFixed(2)} years`],
                ["Separation", s.type === "retirement" ? "Superannuation" : s.type === "voluntary" ? "Resignation" : "Termination"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <table className="mt-4 w-full border border-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">Earnings</th>
                  <th className="px-2 py-1 text-right">₹</th>
                  <th className="border-l border-border px-2 py-1 text-left">Deductions</th>
                  <th className="px-2 py-1 text-right">₹</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rows }).map((_, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1">{f.earnings[i]?.label ?? ""}</td>
                    <td className="tnum px-2 py-1 text-right">{f.earnings[i] ? inr(f.earnings[i].amount, { decimals: false }).replace("₹", "") : ""}</td>
                    <td className="border-l border-border px-2 py-1">{f.deductions[i]?.label ?? ""}</td>
                    <td className="tnum px-2 py-1 text-right">{f.deductions[i] ? inr(f.deductions[i].amount, { decimals: false }).replace("₹", "") : ""}</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted font-semibold">
                  <td className="px-2 py-1">Total earnings</td>
                  <td className="tnum px-2 py-1 text-right">{inr(f.totalEarnings, { decimals: false }).replace("₹", "")}</td>
                  <td className="border-l border-border px-2 py-1">Total deductions</td>
                  <td className="tnum px-2 py-1 text-right">{inr(f.totalDeductions, { decimals: false }).replace("₹", "")}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-sm font-semibold">
              {f.net >= 0 ? "Net payable to employee" : "Net recoverable from employee"}: <span className="tnum">{inr(Math.abs(f.net), { decimals: false })}</span>
            </p>
            <p className="text-muted-foreground">({amountInWords(Math.abs(f.net))})</p>
            <p className="mt-3 text-muted-foreground">
              Leave encashment is exempt under s.10(10AA)(ii) and gratuity under s.10(10)(iii) within the statutory limits; TDS is deducted on the taxable balance. Form 16 for FY 2026-27 will reflect this settlement.
            </p>
            <footer className="mt-8 grid grid-cols-3 gap-4 text-center">
              {[
                ["Prepared by", f.preparedBy, f.preparedOn],
                ["Approved by", f.approvedBy ?? "Pending", f.approvedOn],
                ["Employee acknowledgement", s.name, null],
              ].map(([k, n, d]) => (
                <div key={k} className="border-t border-border pt-1.5">
                  <p className="font-medium">{n}</p>
                  <p className="text-muted-foreground">
                    {k}
                    {d ? ` · ${fmtDate(d)}` : ""}
                  </p>
                </div>
              ))}
            </footer>
          </article>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => mockAction("Statement generated", { description: `${f.id}.pdf — shared with ${s.name} on their personal email and stored in documents.` })}>
            <Printer aria-hidden /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
