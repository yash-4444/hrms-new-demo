"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, CircleDashed, FileSignature, Undo2 } from "lucide-react";
import { fmtDate, pct } from "@/lib/format";
import { branchById } from "@/mock/org";
import { CONSENTS, CONSENT_PURPOSE_LABEL, type ConsentPurpose, type ConsentRecord, type ConsentStatus } from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { BarCompareChart } from "@/components/charts";
import { PersonCell } from "@/components/people/person-cell";
import { ChartSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/overlays";
import { TonePill, type PTone } from "@/components/platform/kit";

const STATUS: Record<ConsentStatus, { label: string; tone: PTone; icon: React.ElementType }> = {
  granted: { label: "Granted", tone: "success", icon: CheckCircle2 },
  withdrawn: { label: "Withdrawn", tone: "danger", icon: Undo2 },
  pending: { label: "Not yet asked", tone: "warning", icon: CircleDashed },
};

const PURPOSES = Object.keys(CONSENT_PURPOSE_LABEL) as ConsentPurpose[];

export default function ConsentPage() {
  const loading = useFakeLoad();
  const [purpose, setPurpose] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [branch, setBranch] = React.useState("all");

  const data = React.useMemo(
    () =>
      CONSENTS.filter(
        (c) => (purpose === "all" || c.purpose === purpose) && (status === "all" || c.status === status) && (branch === "all" || c.branchId === branch),
      ),
    [purpose, status, branch],
  );

  const chart = PURPOSES.map((p) => {
    const rows = CONSENTS.filter((c) => c.purpose === p);
    return {
      purpose: CONSENT_PURPOSE_LABEL[p],
      granted: rows.filter((r) => r.status === "granted").length,
      withdrawn: rows.filter((r) => r.status === "withdrawn").length,
      pending: rows.filter((r) => r.status === "pending").length,
    };
  });

  const columns = React.useMemo<ColumnDef<ConsentRecord, unknown>[]>(
    () => [
      { accessorKey: "employeeName", header: "Employee", cell: ({ row }) => <PersonCell name={row.original.employeeName} code={row.original.employeeCode} subtitle={branchById(row.original.branchId)?.name} /> },
      { accessorKey: "purpose", header: "Purpose", cell: ({ row }) => <span className="text-xs font-medium">{CONSENT_PURPOSE_LABEL[row.original.purpose]}</span> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const s = STATUS[row.original.status];
          return <TonePill tone={s.tone} icon={s.icon}>{s.label}</TonePill>;
        },
      },
      { accessorKey: "capturedAt", header: "Given on", cell: ({ row }) => (row.original.capturedAt ? <span className="tnum text-xs">{fmtDate(row.original.capturedAt)}</span> : <MutedCell>—</MutedCell>) },
      { accessorKey: "withdrawnAt", header: "Withdrawn on", cell: ({ row }) => (row.original.withdrawnAt ? <span className="tnum text-xs">{fmtDate(row.original.withdrawnAt)}</span> : <MutedCell>—</MutedCell>) },
      { accessorKey: "noticeVersion", header: "Notice version", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.noticeVersion}</span> },
      { accessorKey: "channel", header: "Captured via", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.channel}</span> },
    ],
    [],
  );

  const pending = data.filter((c) => c.status === "pending");

  return (
    <PageBody>
      <PageHeader
        title="Consent Register"
        description="Every consent each employee has given or withdrawn, against the exact version of the privacy notice they saw (DPDP Act 2023, s.6). Withdrawal is as easy as giving consent — employees do it from My Privacy."
        actions={
          <Gated menuKey="compliance.consent" action="X">
            <Button
              size="sm"
              variant="outline"
              disabled={!pending.length}
              onClick={() => mockAction(`Consent requests sent to ${new Set(pending.map((p) => p.employeeCode)).size} employees`, { description: "They see the current notice in self-service and on their next sign-in." })}
            >
              <FileSignature /> Request missing consents
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <ChartSkeleton height={180} />
          <TableSkeleton />
        </>
      ) : (
        <>
          <BarCompareChart
            title="Consent by purpose"
            description={`${pct((CONSENTS.filter((c) => c.status === "granted").length / CONSENTS.length) * 100)} of all consent records are granted`}
            data={chart}
            xKey="purpose"
            series={[
              { key: "granted", label: "Granted" },
              { key: "withdrawn", label: "Withdrawn" },
              { key: "pending", label: "Not yet asked" },
            ]}
            stacked
            horizontal
            height={180}
          />

          <DataTable
            columns={columns}
            data={data}
            searchKeys={["employeeName", "employeeCode"]}
            searchPlaceholder="Search employee…"
            filters={
              <>
                <FilterSelect label="Purpose" value={purpose} onValueChange={setPurpose} width="w-[230px]" options={PURPOSES.map((p) => ({ value: p, label: CONSENT_PURPOSE_LABEL[p] }))} />
                <FilterSelect label="Status" value={status} onValueChange={setStatus} options={(Object.keys(STATUS) as ConsentStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))} />
                <FilterSelect label="Branch" value={branch} onValueChange={setBranch} width="w-[190px]" options={["BLR", "PNQ", "HYD", "EWR"].map((b) => ({ value: b, label: branchById(b)?.name ?? b }))} />
              </>
            }
            rowTone={(c) => (c.status === "withdrawn" ? "warning" : undefined)}
            exportName="consent-register"
            emptyIcon={FileSignature}
            emptyTitle="No consent records match"
            emptyDescription="Change the filters to see more records."
          />
        </>
      )}
    </PageBody>
  );
}
