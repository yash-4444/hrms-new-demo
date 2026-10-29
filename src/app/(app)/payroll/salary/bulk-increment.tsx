"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSpreadsheet, FileUp, RotateCcw, Send } from "lucide-react";
import { sum } from "@/lib/utils";
import { fmtDate, inr, num, pct } from "@/lib/format";
import {
  BULK_INCREMENT_SAMPLE,
  validateBulkIncrements,
  type BulkIncrementResult,
} from "@/mock/finance-payroll";
import { mockAction } from "@/components/app-state";
import { DownloadButton, MoneyCell } from "@/components/finance/kit";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/primitives";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { Gated, Section } from "@/components/shell/page";

const STATUS_AS: Record<BulkIncrementResult["status"], string> = { valid: "approved", warning: "due_soon", invalid: "failed" };
const STATUS_LABEL: Record<BulkIncrementResult["status"], string> = { valid: "Valid", warning: "Warning", invalid: "Invalid" };

/** Bulk increment upload: parse → dry-run validation → submit only the rows that pass. */
export function BulkIncrementPanel({ onSubmitted }: { onSubmitted: (count: number) => void }) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const results = React.useMemo(() => (fileName ? validateBulkIncrements(BULK_INCREMENT_SAMPLE) : []), [fileName]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const ok = results.filter((r) => r.status !== "invalid");
  const invalid = results.length - ok.length;
  const warnings = results.filter((r) => r.status === "warning").length;
  const uplift = sum(ok.map((r) => (r.newCtc ?? 0) - (r.oldCtc ?? 0)));
  const arrears = sum(ok.map((r) => r.arrears));

  const load = (name: string) => {
    setFileName(name);
    setSubmitted(false);
    mockAction(`Dry run complete for ${name}`, {
      description: "Nothing has been written yet — review the results, then submit the valid rows.",
      tone: "info",
    });
  };

  const columns = React.useMemo<ColumnDef<BulkIncrementResult, unknown>[]>(
    () => [
      { accessorKey: "row", header: "Row", cell: ({ row }) => <NumCell>{row.original.row}</NumCell> },
      {
        accessorKey: "employeeCode",
        header: "Employee",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{row.original.employeeCode}</span>
          </span>
        ),
      },
      { accessorKey: "incrementPct", header: "Increment", cell: ({ row }) => <NumCell>{pct(row.original.incrementPct)}</NumCell> },
      { accessorKey: "oldCtc", header: "Current CTC", cell: ({ row }) => (row.original.oldCtc === null ? <MutedCell>—</MutedCell> : <MoneyCell value={row.original.oldCtc} />) },
      { accessorKey: "newCtc", header: "New CTC", cell: ({ row }) => (row.original.newCtc === null ? <MutedCell>—</MutedCell> : <MoneyCell value={row.original.newCtc} />) },
      { accessorKey: "effectiveFrom", header: "Effective", cell: ({ row }) => <MutedCell>{fmtDate(row.original.effectiveFrom)}</MutedCell> },
      { accessorKey: "arrears", header: "Arrears", cell: ({ row }) => <MoneyCell value={row.original.arrears} /> },
      {
        accessorKey: "status",
        header: "Result",
        cell: ({ row }) => (
          <span className="flex flex-col gap-0.5">
            <StatusBadge status={STATUS_AS[row.original.status]} label={STATUS_LABEL[row.original.status]} />
            <span className="max-w-[260px] text-[11px] text-muted-foreground">{row.original.message}</span>
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <Section
      title="Bulk increment upload"
      description="CSV with employee code, increment %, effective date and reason. Every file is dry-run first; only rows that pass are submitted for the Finance Controller's approval."
      actions={<DownloadButton fileName="bulk-increment-template.csv" label="Template" description="Columns: employee_code, increment_pct, effective_from, reason." />}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border px-3 py-3">
          <FileSpreadsheet className="size-5 text-muted-foreground" aria-hidden />
          <span className="text-xs text-muted-foreground">{fileName ? `Loaded ${fileName} · ${num(results.length)} rows` : "No file chosen yet."}</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="sr-only"
            aria-label="Choose increment CSV"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) load(f.name);
              e.target.value = "";
            }}
          />
          <div className="ml-auto flex gap-1.5">
            <Gated menuKey="payroll.salary" action="C">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                <FileUp /> Choose CSV
              </Button>
            </Gated>
            <Gated menuKey="payroll.salary" action="C">
              <Button variant="outline" size="sm" onClick={() => load("mid-year-increments-sep26.csv")}>
                Use sample file
              </Button>
            </Gated>
            {fileName && (
              <Button variant="ghost" size="sm" onClick={() => setFileName(null)}>
                <RotateCcw /> Clear
              </Button>
            )}
          </div>
        </div>

        {!fileName ? (
          <EmptyState
            icon={FileUp}
            title="Upload a file to dry-run it"
            description="Validation checks the employee is on the India payroll, the increment is within 0–40%, the date is in an open financial year, duplicates, and the grade band."
          />
        ) : (
          <>
            <Alert tone={invalid ? "warning" : "success"} title={`${num(ok.length)} of ${num(results.length)} rows can be submitted`}>
              {num(invalid)} invalid row{invalid === 1 ? "" : "s"} will be skipped and {num(warnings)} carry a warning for the
              approver. Annual CTC uplift {inr(uplift, { decimals: false })}; back-dated arrears {inr(arrears, { decimals: false })}.
            </Alert>
            <DataTable<BulkIncrementResult>
              columns={columns}
              data={results}
              getRowId={(r) => String(r.row)}
              searchKeys={["employeeCode", "name", "message"]}
              searchPlaceholder="Search code, name or message…"
              exportName="bulk-increment-dry-run"
              rowTone={(r) => (r.status === "invalid" ? "danger" : r.status === "warning" ? "warning" : undefined)}
              emptyTitle="No rows in this file"
              emptyDescription="The file had a header row only."
              toolbar={
                <Gated menuKey="payroll.salary" action="C">
                  <Button
                    size="sm"
                    disabled={submitted || ok.length === 0}
                    onClick={() => {
                      setSubmitted(true);
                      onSubmitted(ok.length);
                      mockAction(`${num(ok.length)} revisions submitted for approval`, {
                        description: `Sent to Lakshmi Pillai (Finance Controller). ${num(invalid)} invalid rows were skipped.`,
                      });
                    }}
                  >
                    <Send /> {submitted ? "Submitted" : `Submit ${num(ok.length)} valid rows`}
                  </Button>
                </Gated>
              }
            />
          </>
        )}
      </div>
    </Section>
  );
}
