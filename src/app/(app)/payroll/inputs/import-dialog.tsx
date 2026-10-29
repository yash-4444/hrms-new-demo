"use client";

import * as React from "react";
import { FileSpreadsheet, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, num } from "@/lib/format";
import { employeeByCode } from "@/mock/employees";
import { deptName } from "@/mock/org";
import {
  PAYROLL_INPUT_CSV_SAMPLE,
  validatePayrollInputCsv,
  type PayrollOneTimeInput,
} from "@/mock/finance-payroll";
import { DownloadButton, GuardedDialog } from "@/components/finance/kit";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";

const TONE = { valid: "approved", warning: "due_soon", invalid: "failed" } as const;
const LABEL = { valid: "Valid", warning: "Warning", invalid: "Invalid" } as const;

/** CSV import of one-time inputs: choose a file, see a validation dry run, import only what passes. */
export function ImportInputsDialog({
  open,
  onOpenChange,
  startIndex,
  onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  startIndex: number;
  onImport: (rows: PayrollOneTimeInput[]) => void;
}) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const results = React.useMemo(() => (fileName ? validatePayrollInputCsv(PAYROLL_INPUT_CSV_SAMPLE) : []), [fileName]);
  const ok = results.filter((r) => r.status !== "invalid");

  const close = (v: boolean) => {
    onOpenChange(v);
    if (!v) setFileName(null);
  };

  const commit = () => {
    onImport(
      ok.map((r, i): PayrollOneTimeInput => {
        const e = employeeByCode(r.employeeCode)!;
        const deduction = r.component === "ADV" || r.component === "DED_OTHER";
        return {
          id: `PIN-M-${String(startIndex + i).padStart(3, "0")}`,
          employeeCode: e.code,
          name: e.name,
          department: deptName(e.departmentId),
          component: r.component,
          componentName: r.note,
          kind: deduction ? "deduction" : "earning",
          amount: r.amount,
          source: `CSV import · ${fileName} row ${r.row}`,
          status: "pending",
          enteredBy: "Rahul Desai",
          enteredOn: "2026-09-16",
        };
      }),
    );
    close(false);
  };

  return (
    <GuardedDialog open={open} onOpenChange={close} dirty={!!fileName} size="xl">
      <DialogHeader>
        <DialogTitle>Import inputs from CSV</DialogTitle>
        <DialogDescription>
          Columns: employee_code, component, amount, note. Only one-time components (BONUS, ARR, ADV, DED_OTHER) accept
          inputs; formula components are rejected.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-3 py-3">
          <FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-xs text-muted-foreground">{fileName ? `${fileName} · ${num(results.length)} rows` : "No file chosen."}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="sr-only"
            aria-label="Choose inputs CSV"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFileName(f.name);
              e.target.value = "";
            }}
          />
          <div className="ml-auto flex gap-1.5">
            <DownloadButton fileName="payroll-inputs-template.csv" label="Template" description="employee_code, component, amount, note" />
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              <FileUp /> Choose CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFileName("sep26-one-time-inputs.csv")}>
              Use sample file
            </Button>
          </div>
        </div>
        {fileName && (
          <>
            <Alert tone={ok.length === results.length ? "success" : "warning"} title={`Dry run: ${num(ok.length)} of ${num(results.length)} rows can be imported`}>
              Nothing is written until you import. Invalid rows are skipped; warnings are imported and flagged.
            </Alert>
            <div className="max-h-[320px] overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <caption className="sr-only">Validation results</caption>
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Row</th>
                    <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Employee</th>
                    <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Component</th>
                    <th scope="col" className="px-2.5 py-1.5 text-right font-medium">Amount</th>
                    <th scope="col" className="px-2.5 py-1.5 text-left font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((r) => (
                    <tr key={r.row} className={cn(r.status === "invalid" && "bg-destructive-soft/40", r.status === "warning" && "bg-warning-soft/40")}>
                      <td className="tnum px-2.5 py-1.5 text-right">{r.row}</td>
                      <td className="px-2.5 py-1.5">
                        <span className="block font-medium">{r.name}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{r.employeeCode}</span>
                      </td>
                      <td className="px-2.5 py-1.5 font-mono">{r.component}</td>
                      <td className="tnum px-2.5 py-1.5 text-right">{inr(r.amount, { decimals: false })}</td>
                      <td className="px-2.5 py-1.5">
                        <StatusBadge status={TONE[r.status]} label={LABEL[r.status]} />
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{r.message}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={() => close(false)}>
          Cancel
        </Button>
        <Button disabled={!fileName || ok.length === 0} onClick={commit}>
          Import {fileName ? num(ok.length) : ""} rows
        </Button>
      </DialogFooter>
    </GuardedDialog>
  );
}
