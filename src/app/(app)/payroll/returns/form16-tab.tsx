"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, num } from "@/lib/format";
import { TENANT } from "@/mock/org";
import { STANDARD_DEDUCTION } from "@/mock/payroll";
import { returnAck, type Form16Row, type ReturnFiling } from "@/mock/finance-statutory";
import { mockAction } from "@/components/app-state";
import { DownloadButton, MoneyCell, ReconcileCheck } from "@/components/finance/kit";
import { DataTable } from "@/components/data-table";
import { DetailList, DetailRow, PersonCell } from "@/components/people/person-cell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { FilterSelect, Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { Gated, Section } from "@/components/shell/page";

/* ============================================================================
   Form 16 (Part A from TRACES, Part B from payroll) and Form 12BA for
   FY 2025-26 — one row per employee, built from all twelve months.
   ========================================================================== */

const Q_LABELS = ["Q1 · Apr–Jun 2025", "Q2 · Jul–Sep 2025", "Q3 · Oct–Dec 2025", "Q4 · Jan–Mar 2026"];
const rs = (v: number) => inr(v, { decimals: false });

export function Form16Tab({ rows, filing }: { rows: Form16Row[]; filing: ReturnFiling | undefined }) {
  const [perqFilter, setPerqFilter] = React.useState("all");
  const [open, setOpen] = React.useState<Form16Row | null>(null);

  const data = rows.filter((r) => perqFilter === "all" || (perqFilter === "yes" ? r.perquisites > 0 : r.perquisites === 0));
  const tdsTotal = rows.reduce((s, r) => s + r.tds, 0);

  const columns = React.useMemo<ColumnDef<Form16Row, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Employee", cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.code} subtitle={`${row.original.code} · ${row.original.designation}`} size={22} /> },
      { accessorKey: "pan", header: "PAN", cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.pan}</span> },
      { accessorKey: "months", header: "Months", cell: ({ row }) => <span className="tnum block text-right text-xs">{row.original.months}</span> },
      { accessorKey: "grossSalary", header: "Gross salary", cell: ({ row }) => <MoneyCell value={row.original.grossSalary} /> },
      { accessorKey: "perquisites", header: "12BA perquisites", cell: ({ row }) => <MoneyCell value={row.original.perquisites} className={row.original.perquisites ? undefined : "text-muted-foreground"} /> },
      { accessorKey: "taxOnIncome", header: "Tax on income", cell: ({ row }) => <MoneyCell value={row.original.taxOnIncome} /> },
      { accessorKey: "tds", header: "TDS (Part A)", cell: ({ row }) => <MoneyCell value={row.original.tds} /> },
      {
        accessorKey: "balance",
        header: "Payable / (refund)",
        cell: ({ row }) => <MoneyCell value={row.original.balance} className={row.original.balance > 0 ? "text-warning-fg" : undefined} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Gated menuKey="payroll.returns" action="X">
              <DownloadButton size="icon-sm" variant="ghost" label="Download Form 16 for" fileName={`Form16_${row.original.pan}_FY2025-26.pdf`} />
            </Gated>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      {filing && (
        <ReconcileCheck label="Form 16 issue" leftLabel={`Σ Part A TDS on ${num(rows.length)} certificates`} left={tdsTotal} rightLabel="filing total" right={filing.employeeShare} />
      )}
      <DataTable<Form16Row>
        columns={columns}
        data={data}
        getRowId={(r) => r.code}
        searchKeys={["name", "code", "pan", "designation"]}
        searchPlaceholder="Search name, code or PAN…"
        exportName="form16-fy2025-26"
        onRowClick={setOpen}
        enableSelection
        rowTone={(r) => (r.balance > 0 ? "warning" : undefined)}
        bulkActions={(sel, clear) => (
          <Gated menuKey="payroll.returns" action="X">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                mockAction(`Emailed Form 16 to ${num(sel.length)} employee${sel.length === 1 ? "" : "s"}`, {
                  description: "Password-protected PDF — the password is PAN in capitals plus date of birth (DDMMYYYY).",
                });
                clear();
              }}
            >
              <Mail /> Email Form 16
            </Button>
          </Gated>
        )}
        filters={
          <FilterSelect
            label="Perquisites"
            value={perqFilter}
            onValueChange={setPerqFilter}
            allLabel="All"
            width="w-[170px]"
            options={[
              { value: "yes", label: "With 12BA perquisites" },
              { value: "no", label: "Nil perquisites" },
            ]}
          />
        }
        emptyIcon={FileText}
        emptyTitle="No certificates match"
        emptyDescription="Clear the perquisite filter or the search to see every Form 16 for FY 2025-26."
      />

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent width="sm:max-w-xl">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>Form 16 · {open.name}</SheetTitle>
                <SheetDescription>
                  FY 2025-26 (AY 2026-27) · PAN {open.pan} · issued {fmtDate(open.issuedOn)}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-3">
                <Section title="Part A — TDS deducted and deposited" description={`Deductor ${TENANT.legalName} · TAN ${TENANT.tan}`} bodyClassName="p-0">
                  <table className="w-full text-xs">
                    <caption className="sr-only">Quarterly TDS for {open.name}</caption>
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-4 py-2 text-left font-medium">Quarter</th>
                        <th scope="col" className="px-4 py-2 text-left font-medium">Receipt no.</th>
                        <th scope="col" className="px-4 py-2 text-right font-medium">TDS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {open.tdsByQuarter.map((t, i) => (
                        <tr key={Q_LABELS[i]} className="border-t border-border">
                          <td className="px-4 py-2">{Q_LABELS[i]}</td>
                          <td className="px-4 py-2 font-mono text-[11px]">{returnAck(`24Q-2025-26-Q${i + 1}`, "TKN ")}</td>
                          <td className="tnum px-4 py-2 text-right">{rs(t)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border font-semibold">
                        <td className="px-4 py-2" colSpan={2}>Total deposited</td>
                        <td className="tnum px-4 py-2 text-right">{rs(open.tds)}</td>
                      </tr>
                    </tbody>
                  </table>
                </Section>

                <Section title="Part B — Salary and tax computation" description="New regime · Section 115BAC">
                  <DetailList>
                    <DetailRow label="1(a) Salary u/s 17(1)">{rs(open.salary17_1)}</DetailRow>
                    <DetailRow label="1(b) Perquisites u/s 17(2) — Form 12BA">{rs(open.perquisites)}</DetailRow>
                    <DetailRow label="1(d) Gross salary">{rs(open.grossSalary)}</DetailRow>
                    <DetailRow label="4(a) Standard deduction u/s 16(ia)">({rs(Math.min(STANDARD_DEDUCTION, open.grossSalary))})</DetailRow>
                    <DetailRow label="Total taxable income">{rs(open.taxable)}</DetailRow>
                    <DetailRow label="Tax incl. 4% cess, after 87A">{rs(open.taxOnIncome)}</DetailRow>
                    <DetailRow label="TDS deducted (Part A)">{rs(open.tds)}</DetailRow>
                    <DetailRow label={open.balance >= 0 ? "Balance payable by employee" : "Refund due to employee"}>
                      <span className={cn(open.balance > 0 && "text-warning-fg")}>{rs(Math.abs(open.balance))}</span>
                    </DetailRow>
                  </DetailList>
                </Section>

                <Section title="Form 12BA — perquisites">
                  {open.perquisites > 0 ? (
                    <div className="flex flex-col gap-1.5 text-xs">
                      <p>{open.perquisiteNote}</p>
                      <p className="text-muted-foreground">
                        {open.months} months × {rs(11000)} (car ₹8,000 + chauffeur ₹3,000) = <span className="tnum font-medium text-foreground">{rs(open.perquisites)}</span>
                      </p>
                      <Badge variant="muted" className="w-fit">Not grossed up — employee settles via self-assessment</Badge>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nil — no perquisites or profits in lieu of salary for FY 2025-26.</p>
                  )}
                </Section>

                <div className="flex flex-wrap justify-end gap-1.5">
                  <Gated menuKey="payroll.returns" action="X">
                    <DownloadButton fileName={`Form16_PartA_${open.pan}_FY2025-26.pdf`} label="Part A" />
                  </Gated>
                  <Gated menuKey="payroll.returns" action="X">
                    <DownloadButton fileName={`Form16_PartB_${open.pan}_FY2025-26.pdf`} label="Part B" />
                  </Gated>
                  <Gated menuKey="payroll.returns" action="X">
                    <DownloadButton fileName={`Form12BA_${open.pan}_FY2025-26.pdf`} label="Form 12BA" />
                  </Gated>
                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
