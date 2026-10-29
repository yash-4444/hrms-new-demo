"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheck2, FileCheck2, FileCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, num } from "@/lib/format";
import { RETURN_FORM_META, type ReturnFiling, type ReturnForm } from "@/mock/finance-statutory";
import { DownloadButton, FinStatus, MoneyCell } from "@/components/finance/kit";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/overlays";
import { Gated } from "@/components/shell/page";
import { DUE_TONE_CLASS, dueText } from "./filing-sheet";

/* ============================================================================
   The filing calendar — every ECR, ESI, PT, 24Q and Form 16 the tenant owes,
   newest due date first, with the countdown measured from DEMO_TODAY.
   ========================================================================== */

export function FilingsTable({
  filings,
  onOpen,
  onGenerate,
  onMarkFiled,
}: {
  filings: ReturnFiling[];
  onOpen: (f: ReturnFiling) => void;
  onGenerate: (fs: ReturnFiling[]) => void;
  onMarkFiled: (f: ReturnFiling) => void;
}) {
  const [formFilter, setFormFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [fyFilter, setFyFilter] = React.useState("all");

  const data = filings.filter(
    (f) =>
      (formFilter === "all" || f.form === formFilter) &&
      (statusFilter === "all" || f.status === statusFilter) &&
      (fyFilter === "all" || f.fy === fyFilter),
  );
  const filtered = formFilter !== "all" || statusFilter !== "all" || fyFilter !== "all";
  const clear = () => {
    setFormFilter("all");
    setStatusFilter("all");
    setFyFilter("all");
  };

  const columns = React.useMemo<ColumnDef<ReturnFiling, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Return",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{row.original.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{RETURN_FORM_META[row.original.form].authority}</p>
          </div>
        ),
      },
      { accessorKey: "periodLabel", header: "Period", cell: ({ row }) => <span className="text-xs">{row.original.periodLabel}</span> },
      {
        accessorKey: "dueDate",
        header: "Due",
        cell: ({ row }) => {
          const d = dueText(row.original);
          return (
            <div>
              <p className="tnum text-xs">{fmtDate(row.original.dueDate)}</p>
              <p className={cn("text-[11px]", DUE_TONE_CLASS[d.tone])}>{d.text}</p>
            </div>
          );
        },
      },
      { accessorKey: "status", header: "Status", cell: ({ row }) => <FinStatus status={row.original.status} /> },
      { accessorKey: "records", header: "Records", cell: ({ row }) => <span className="tnum block text-right text-xs">{num(row.original.records)}</span> },
      { accessorKey: "employeeShare", header: "Employee / TDS", cell: ({ row }) => <MoneyCell value={row.original.employeeShare} /> },
      { accessorKey: "total", header: "Remittance", cell: ({ row }) => <MoneyCell value={row.original.total} /> },
      {
        accessorKey: "ackNo",
        header: "Acknowledgement",
        cell: ({ row }) =>
          row.original.ackNo ? (
            <span className="font-mono text-[11px]">{row.original.ackNo}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        cell: ({ row }) => {
          const f = row.original;
          return (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {f.status === "due" && (
                <Gated menuKey="payroll.returns" action="X">
                  <Button size="sm" variant="outline" onClick={() => onGenerate([f])}>
                    <FileCog /> Generate
                  </Button>
                </Gated>
              )}
              {f.status === "generated" && (
                <Gated menuKey="payroll.returns" action="X">
                  <Button size="sm" variant="outline" onClick={() => onMarkFiled(f)}>
                    <FileCheck2 /> Mark filed
                  </Button>
                </Gated>
              )}
              <Gated menuKey="payroll.returns" action="X">
                <DownloadButton size="icon-sm" variant="ghost" fileName={f.fileName} disabled={f.status === "due"} />
              </Gated>
            </div>
          );
        },
      },
    ],
    [onGenerate, onMarkFiled],
  );

  return (
    <DataTable<ReturnFiling>
      columns={columns}
      data={data}
      getRowId={(f) => f.id}
      searchKeys={["title", "periodLabel", "ackNo", "fileName"]}
      searchPlaceholder="Search return, period or acknowledgement…"
      exportName="statutory-returns-calendar"
      onRowClick={onOpen}
      enableSelection
      rowTone={(f) => {
        const d = dueText(f);
        return d.tone === "danger" ? "danger" : d.tone === "warning" ? "warning" : undefined;
      }}
      bulkActions={(rows, clearSel) => {
        const due = rows.filter((r) => r.status === "due");
        return (
          <Gated menuKey="payroll.returns" action="X">
            <Button
              size="sm"
              variant="outline"
              disabled={due.length === 0}
              onClick={() => {
                onGenerate(due);
                clearSel();
              }}
            >
              <FileCog /> Generate {num(due.length)} due
            </Button>
          </Gated>
        );
      }}
      emptyIcon={CalendarCheck2}
      emptyTitle="No returns match these filters"
      emptyDescription="Clear the form, status or financial-year filter to see the full calendar."
      emptyAction={
        filtered ? (
          <Button variant="outline" size="sm" onClick={clear}>
            Clear filters
          </Button>
        ) : undefined
      }
      filters={
        <>
          <FilterSelect
            label="Form"
            value={formFilter}
            onValueChange={setFormFilter}
            allLabel="All forms"
            width="w-[170px]"
            options={(Object.keys(RETURN_FORM_META) as ReturnForm[]).map((k) => ({ value: k, label: RETURN_FORM_META[k].label }))}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onValueChange={setStatusFilter}
            allLabel="All"
            width="w-[140px]"
            options={[
              { value: "due", label: "Due" },
              { value: "generated", label: "Generated" },
              { value: "filed", label: "Filed" },
            ]}
          />
          <FilterSelect
            label="FY"
            value={fyFilter}
            onValueChange={setFyFilter}
            allLabel="All years"
            width="w-[150px]"
            options={[
              { value: "FY 2026-27", label: "FY 2026-27" },
              { value: "FY 2025-26", label: "FY 2025-26" },
            ]}
          />
          {filtered && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          )}
        </>
      }
    />
  );
}
