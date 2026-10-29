"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { BadgeIndianRupee, Hourglass, ReceiptText, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, inrCompact } from "@/lib/format";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterSelect } from "@/components/ui/overlays";
import { PersonCell } from "@/components/people/person-cell";
import { LcBadge } from "@/components/lifecycle/kit";
import { deptName } from "@/mock/org";
import { FNF_RECORDS, FNF_STATUS_LABEL, type FnfRecord } from "@/mock/lifecycle";

/* ============================================================================
   /fnf — every full & final settlement. Payroll prepares (maker), the Finance
   Controller approves (checker). Each figure is computed from the payroll
   structure, the leave ledger and clearance recoveries.
   ========================================================================== */

const lineAmount = (f: FnfRecord, key: string) => f.earnings.find((l) => l.key === key)?.amount ?? 0;

export default function FnfPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const [status, setStatus] = React.useState("all");
  const data = FNF_RECORDS.filter((f) => status === "all" || f.status === status);

  const open = FNF_RECORDS.filter((f) => f.status !== "paid");
  const payable = open.filter((f) => f.net > 0).reduce((a, f) => a + f.net, 0);
  const recoverable = open.filter((f) => f.net < 0).reduce((a, f) => a - f.net, 0);
  const gratuity = FNF_RECORDS.reduce((a, f) => a + lineAmount(f, "gratuity"), 0);

  const columns = React.useMemo<ColumnDef<FnfRecord, unknown>[]>(
    () => [
      { id: "id", header: "F&F", accessorKey: "id", cell: ({ row }) => <span className="tnum font-medium">{row.original.id}</span> },
      {
        id: "employee",
        header: "Employee",
        accessorFn: (f) => f.separation.name,
        enableHiding: false,
        cell: ({ row }) => <PersonCell name={row.original.separation.name} subtitle={`${row.original.separation.code} · ${deptName(row.original.separation.departmentId)}`} />,
      },
      { id: "lwd", header: "Last working day", accessorFn: (f) => f.separation.lwd, cell: ({ row }) => <span className="tnum">{fmtDate(row.original.separation.lwd)}</span> },
      { id: "service", header: "Service", accessorKey: "serviceYears", cell: ({ row }) => <span className="tnum">{row.original.serviceYears.toFixed(2)} yrs</span> },
      { id: "encash", header: "Leave encashment", accessorFn: (f) => lineAmount(f, "encash"), cell: ({ getValue }) => <span className="tnum block text-right">{inr(getValue() as number, { decimals: false })}</span> },
      {
        id: "gratuity",
        header: "Gratuity",
        accessorFn: (f) => lineAmount(f, "gratuity"),
        cell: ({ getValue }) => <span className={cn("tnum block text-right", !getValue() && "text-muted-foreground")}>{getValue() ? inr(getValue() as number, { decimals: false }) : "—"}</span>,
      },
      { id: "earnings", header: "Earnings", accessorKey: "totalEarnings", cell: ({ row }) => <span className="tnum block text-right">{inr(row.original.totalEarnings, { decimals: false })}</span> },
      { id: "deductions", header: "Deductions", accessorKey: "totalDeductions", cell: ({ row }) => <span className="tnum block text-right">{inr(row.original.totalDeductions, { decimals: false })}</span> },
      {
        id: "net",
        header: "Net",
        accessorKey: "net",
        cell: ({ row }) => {
          const n = row.original.net;
          return (
            <span className={cn("tnum block text-right font-semibold", n < 0 ? "text-destructive-fg" : "text-foreground")}>
              {inr(Math.abs(n), { decimals: false })}
              <span className="block text-[11px] font-normal text-muted-foreground">{n < 0 ? "recoverable" : "payable"}</span>
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (row.original.status === "paid" ? <StatusBadge status="paid" /> : <LcBadge status={row.original.status} label={FNF_STATUS_LABEL[row.original.status]} />),
      },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Full & Final"
        description="Settlements for every exit. Payroll prepares, the Finance Controller approves — no one can do both. Open a settlement to see each line's formula and generate the statement."
      />
      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow>
          <StatTile label="Open settlements" value={open.length} icon={Hourglass} hint="Draft, awaiting Finance or approved" />
          <StatTile label="Awaiting Finance" value={FNF_RECORDS.filter((f) => f.status === "pending_approval").length} icon={Scale} tone="warning" onClick={() => setStatus("pending_approval")} />
          <StatTile label="Net payable (open)" value={inrCompact(payable)} icon={BadgeIndianRupee} hint={inr(payable, { decimals: false })} />
          <StatTile label="Recoverable (open)" value={inrCompact(recoverable)} tone={recoverable ? "critical" : "neutral"} hint={`Gratuity across all settlements ${inr(gratuity, { decimals: false })}`} />
        </StatRow>
      )}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchKeys={["id"]}
          searchPlaceholder="Search by F&F id…"
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(`/fnf/${r.id}`)}
          rowTone={(r) => (r.net < 0 ? "danger" : r.status === "pending_approval" ? "warning" : undefined)}
          exportName="full-and-final"
          emptyIcon={ReceiptText}
          emptyTitle="No settlements in this status"
          emptyDescription="Clear the status filter to see every settlement."
          filters={<FilterSelect label="Status" value={status} onValueChange={setStatus} options={Object.entries(FNF_STATUS_LABEL).map(([value, label]) => ({ value, label }))} />}
        />
      )}
    </PageBody>
  );
}
