"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSpreadsheet, UserX } from "lucide-react";
import { inr, num } from "@/lib/format";
import {
  BANK_ADVICE_BANKS,
  type BankAdviceFile,
  type BankAdviceRecord,
  type HeldRecord,
} from "@/mock/finance-run";
import { Badge } from "@/components/ui/primitives";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Gated } from "@/components/shell/page";
import { DownloadButton, FinStatus, MoneyCell } from "@/components/finance/kit";

/* Bank files table, the records drawer and the held-salaries table. */

export function FilesTable({
  files,
  fileStatus,
  canDownload,
  exportName,
}: {
  files: BankAdviceFile[];
  fileStatus: string;
  canDownload: boolean;
  exportName: string;
}) {
  const [open, setOpen] = React.useState<BankAdviceFile | null>(null);
  const columns: ColumnDef<BankAdviceFile, unknown>[] = [
    {
      accessorKey: "fileName",
      header: "File",
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-xs font-medium">{row.original.fileName}</span>
          <span className="truncate text-[11px] text-muted-foreground">{row.original.format}</span>
        </span>
      ),
    },
    { id: "bank", accessorFn: (f) => BANK_ADVICE_BANKS[f.bank].name, header: "Bank" },
    { accessorKey: "mode", header: "Mode", cell: ({ getValue }) => <Badge variant="outline">{String(getValue())}</Badge> },
    { accessorKey: "debitAccount", header: "Debit account", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
    {
      accessorKey: "count",
      header: () => <span className="block text-right">Records</span>,
      cell: ({ getValue }) => <NumCell>{num(Number(getValue()))}</NumCell>,
    },
    {
      accessorKey: "total",
      header: () => <span className="block text-right">Amount</span>,
      cell: ({ getValue }) => <MoneyCell value={Number(getValue())} className="font-semibold" />,
    },
    { id: "status", header: "Status", cell: () => <FinStatus status={fileStatus} /> },
    {
      id: "dl",
      header: () => <span className="sr-only">Download</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Gated menuKey="payroll.bank_advice" action="X">
          <DownloadButton
            size="icon-sm"
            variant="ghost"
            fileName={row.original.fileName}
            description={`${num(row.original.count)} records · ${inr(row.original.total, { decimals: false })}`}
            disabled={!canDownload}
          />
        </Gated>
      ),
    },
  ];
  return (
    <>
      <DataTable<BankAdviceFile>
        columns={columns}
        data={files}
        getRowId={(f) => f.id}
        exportName={exportName}
        onRowClick={setOpen}
        emptyIcon={FileSpreadsheet}
        emptyTitle="No bank files"
        emptyDescription="Every employee in this run is held, so there is nothing to credit."
      />
      <RecordsSheet file={open} onClose={() => setOpen(null)} />
    </>
  );
}

const RECORD_COLUMNS: ColumnDef<BankAdviceRecord, unknown>[] = [
  {
    accessorKey: "name",
    header: "Beneficiary",
    cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.code} size={22} />,
  },
  { accessorKey: "ifsc", header: "IFSC", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
  { accessorKey: "account", header: "Account", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
  {
    accessorKey: "amount",
    header: () => <span className="block text-right">Amount</span>,
    cell: ({ getValue }) => <MoneyCell value={Number(getValue())} />,
  },
];

function RecordsSheet({ file, onClose }: { file: BankAdviceFile | null; onClose: () => void }) {
  return (
    <Sheet open={!!file} onOpenChange={(v) => !v && onClose()}>
      <SheetContent width="sm:max-w-2xl">
        {file && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-sm">{file.fileName}</SheetTitle>
              <SheetDescription>
                {BANK_ADVICE_BANKS[file.bank].name} · {file.mode} · {num(file.count)} records ·{" "}
                {inr(file.total, { decimals: false })} from {file.debitAccount}
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <DataTable<BankAdviceRecord>
                columns={RECORD_COLUMNS}
                data={file.records}
                getRowId={(r) => r.code}
                searchKeys={["name", "code", "ifsc"]}
                exportName={file.fileName.replace(/\.\w+$/, "")}
                pageSize={12}
                dense
                emptyTitle="No record matches"
                emptyDescription="Clear the search to see every credit in this file."
              />
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const HELD_COLUMNS: ColumnDef<HeldRecord, unknown>[] = [
  {
    accessorKey: "name",
    header: "Employee",
    cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.code} />,
  },
  {
    accessorKey: "reason",
    header: "Held because",
    cell: ({ row }) => (
      <span className="flex flex-col gap-0.5">
        <FinStatus status={row.original.reason === "missing_bank" ? "error" : "exception"} />
        <span className="text-[11px] text-muted-foreground">{row.original.detail}</span>
      </span>
    ),
  },
  {
    accessorKey: "net",
    header: () => <span className="block text-right">Net pay</span>,
    cell: ({ getValue }) => <MoneyCell value={Number(getValue())} />,
  },
];

export function HeldTable({ held, exportName }: { held: HeldRecord[]; exportName: string }) {
  return (
    <DataTable<HeldRecord>
      columns={HELD_COLUMNS}
      data={held}
      getRowId={(h) => h.code}
      exportName={exportName}
      rowTone={(h) => (h.net < 0 ? "danger" : "warning")}
      emptyIcon={UserX}
      emptyTitle="Nobody is held"
      emptyDescription="Every employee in this run has a verified account and a positive net pay."
    />
  );
}
