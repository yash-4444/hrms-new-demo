"use client";

import { cn, sum } from "@/lib/utils";
import { inr, pct } from "@/lib/format";
import { CURRENT_PERIOD, ctcBreakup, type Breakup } from "@/mock/payroll";
import { revisionArrears } from "@/mock/finance-payroll";
import { ReconcileCheck } from "@/components/finance/kit";

/* Before/after CTC breakup and the month-by-month arrears preview — shared by
   the revision sheet and the new-revision dialog. */

const LINES: { key: keyof Breakup; label: string; strong?: boolean }[] = [
  { key: "basic", label: "Basic" },
  { key: "hra", label: "HRA" },
  { key: "conveyance", label: "Conveyance" },
  { key: "medical", label: "Medical" },
  { key: "lta", label: "LTA" },
  { key: "perf", label: "Performance pay" },
  { key: "special", label: "Special allowance" },
  { key: "gross", label: "Monthly gross", strong: true },
  { key: "employerPf", label: "Employer PF" },
  { key: "employerEsi", label: "Employer ESI" },
  { key: "gratuity", label: "Gratuity provision" },
  { key: "monthlyCtc", label: "Monthly CTC", strong: true },
];

const money = (v: number) => inr(v, { decimals: false });

export function BreakupCompare({
  gradeId,
  oldCtc,
  newGradeId,
  newCtc,
}: {
  gradeId: string;
  oldCtc: number;
  newGradeId: string;
  newCtc: number;
}) {
  const before = ctcBreakup(gradeId, oldCtc);
  const after = ctcBreakup(newGradeId, newCtc);
  const inc = oldCtc ? ((newCtc - oldCtc) / oldCtc) * 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-xs">
          <caption className="sr-only">Monthly CTC breakup before and after the revision</caption>
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Component</th>
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Current · {gradeId}</th>
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Revised · {newGradeId}</th>
              <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {LINES.filter((l) => l.key !== "perf" || before.perf || after.perf).map((l) => {
              const b = Number(before[l.key]);
              const a = Number(after[l.key]);
              return (
                <tr key={l.key} className={cn(l.strong && "bg-subtle font-semibold")}>
                  <th scope="row" className="px-2.5 py-1.5 text-left font-[inherit]">{l.label}</th>
                  <td className="tnum px-2.5 py-1.5 text-right">{money(b)}</td>
                  <td className="tnum px-2.5 py-1.5 text-right">{money(a)}</td>
                  <td className={cn("tnum px-2.5 py-1.5 text-right", a - b > 0 ? "text-success-fg" : a - b < 0 ? "text-destructive-fg" : "text-muted-foreground")}>
                    {a - b === 0 ? "—" : `${a - b > 0 ? "+" : ""}${money(a - b)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Annual CTC {money(oldCtc)} → <span className="font-semibold text-foreground">{money(newCtc)}</span> ·{" "}
        <span className={inc >= 0 ? "text-success-fg" : "text-destructive-fg"}>
          {inc >= 0 ? "+" : ""}
          {pct(inc)}
        </span>
      </p>
      <ReconcileCheck
        label="Revised breakup reconciles"
        left={after.gross + after.employerTotal}
        right={after.monthlyCtc}
        leftLabel="gross + employer cost"
        rightLabel="monthly CTC"
      />
    </div>
  );
}

export function ArrearsPreview({
  gradeId,
  oldCtc,
  newGradeId,
  newCtc,
  effectiveFrom,
}: {
  gradeId: string;
  oldCtc: number;
  newGradeId: string;
  newCtc: number;
  effectiveFrom: string;
}) {
  const months = revisionArrears(gradeId, oldCtc, newGradeId, newCtc, effectiveFrom);
  if (months.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
        Not back-dated — the revised salary starts in the run for the effective month, so there are no arrears.
      </p>
    );
  }
  const total = sum(months.map((m) => m.diff));
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-xs">
        <caption className="sr-only">Arrears by month</caption>
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Month</th>
            <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Paid gross</th>
            <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Revised gross</th>
            <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Arrears</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {months.map((m) => (
            <tr key={m.periodId}>
              <th scope="row" className="px-2.5 py-1.5 text-left font-normal">
                {m.label}
                {m.factor < 1 && <span className="ml-1 text-muted-foreground">(pro-rated {pct(m.factor * 100, 0)})</span>}
              </th>
              <td className="tnum px-2.5 py-1.5 text-right">{money(m.oldGross)}</td>
              <td className="tnum px-2.5 py-1.5 text-right">{money(m.newGross)}</td>
              <td className="tnum px-2.5 py-1.5 text-right font-medium">{money(m.diff)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-subtle font-semibold">
          <tr>
            <th scope="row" colSpan={3} className="px-2.5 py-1.5 text-left">
              Total arrears · paid as ARR in the {CURRENT_PERIOD.label} run after approval
            </th>
            <td className="tnum px-2.5 py-1.5 text-right">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
