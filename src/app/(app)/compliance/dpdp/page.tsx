"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eraser, FileArchive, Fingerprint, Gavel, Inbox, Loader2, MoreHorizontal, ShieldCheck, Timer } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { DSR_REQUESTS, DSR_TYPE_LABEL, type DataSubjectRequest, type DsrStatus, type DsrType } from "@/mock/platform";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Progress } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FilterSelect,
} from "@/components/ui/overlays";
import { ReasonDialog, TonePill, useSimulatedTask, type PTone } from "@/components/platform/kit";

const STATUS: Record<DsrStatus, { label: string; tone: PTone }> = {
  new: { label: "New", tone: "info" },
  verifying: { label: "Verifying identity", tone: "warning" },
  in_progress: { label: "In progress", tone: "info" },
  on_hold: { label: "Blocked — legal hold", tone: "serious" },
  fulfilled: { label: "Fulfilled", tone: "success" },
  rejected: { label: "Rejected", tone: "neutral" },
};

const daysLeft = (r: DataSubjectRequest) => Math.round((Date.parse(r.dueAt) - Date.parse(DEMO_TODAY)) / 86_400_000);
const isClosed = (r: DataSubjectRequest) => r.status === "fulfilled" || r.status === "rejected";

export default function DpdpPage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const [rows, setRows] = React.useState<DataSubjectRequest[]>(DSR_REQUESTS);
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("open");
  const [verifying, setVerifying] = React.useState<DataSubjectRequest | null>(null);
  const [erasing, setErasing] = React.useState<DataSubjectRequest | null>(null);
  const task = useSimulatedTask(2200);

  const patch = (id: string, p: Partial<DataSubjectRequest>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const fulfil = (r: DataSubjectRequest) =>
    task.start(r.id, () => {
      patch(r.id, { status: "fulfilled" });
      mockAction(`${r.id} fulfilled`, {
        description:
          r.type === "access"
            ? `Export bundle (personal data summary, processing purposes, processors list) sent to ${r.principalName} via an expiring link.`
            : `${DSR_TYPE_LABEL[r.type]} completed and the data principal was notified.`,
      });
    });

  const data = rows.filter((r) => {
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (statusFilter === "open") return !isClosed(r);
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const open = rows.filter((r) => !isClosed(r));
  const overdue = open.filter((r) => daysLeft(r) < 0);

  const columns: ColumnDef<DataSubjectRequest, unknown>[] = [
    { accessorKey: "id", header: "Request", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
    { accessorKey: "type", header: "Right", cell: ({ row }) => <span className="text-xs font-medium">{DSR_TYPE_LABEL[row.original.type]}</span> },
    {
      accessorKey: "principalName",
      header: "Data principal",
      cell: ({ row }) => (
        <div className="text-xs">
          <p className="font-medium">{row.original.principalName}</p>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-mono">{row.original.principalCode}</span> · {row.original.principalKind}
          </p>
        </div>
      ),
    },
    { accessorKey: "receivedAt", header: "Received", cell: ({ row }) => <span className="tnum text-xs">{fmtDate(row.original.receivedAt)}</span> },
    {
      accessorKey: "dueAt",
      header: "SLA",
      cell: ({ row }) => {
        const r = row.original;
        if (isClosed(r)) return <span className="text-xs text-muted-foreground">Closed</span>;
        const d = daysLeft(r);
        return <TonePill tone={d < 0 ? "danger" : d <= 5 ? "warning" : "neutral"} icon={Timer}>{d < 0 ? `${-d} days overdue` : `${d} days left`}</TonePill>;
      },
    },
    {
      accessorKey: "identityVerified",
      header: "Identity",
      cell: ({ row }) => (row.original.identityVerified ? <TonePill tone="success" icon={ShieldCheck}>Verified</TonePill> : <TonePill tone="warning" icon={Fingerprint}>Not verified</TonePill>),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) =>
        task.runningKey === row.original.id ? (
          <div className="w-[130px]">
            <Progress value={task.progress} aria-label="Preparing export bundle" />
            <p className="mt-1 text-[11px] text-muted-foreground">Preparing bundle… {task.progress}%</p>
          </div>
        ) : (
          <TonePill tone={STATUS[row.original.status].tone} icon={row.original.legalHold ? Gavel : undefined}>{STATUS[row.original.status].label}</TonePill>
        ),
    },
    { accessorKey: "channel", header: "Channel", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.channel}</span> },
    {
      id: "__a",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const r = row.original;
        if (isClosed(r)) return null;
        const canEdit = can("compliance.dpdp", "E");
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.id}`}>
                  {task.runningKey === r.id ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>{r.id} · {DSR_TYPE_LABEL[r.type]}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!canEdit || r.identityVerified} onSelect={() => setVerifying(r)}>
                  <Fingerprint /> Verify identity
                </DropdownMenuItem>
                {r.type === "erasure" ? (
                  <DropdownMenuItem destructive disabled={!canEdit || !r.identityVerified || !!r.legalHold} onSelect={() => setErasing(r)}>
                    <Eraser /> {r.legalHold ? "Erase — blocked by legal hold" : "Erase personal data"}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled={!canEdit || !r.identityVerified || !!task.runningKey} onSelect={() => fulfil(r)}>
                    <FileArchive /> {r.type === "access" ? "Fulfil — generate export bundle" : "Mark fulfilled"}
                  </DropdownMenuItem>
                )}
                {!canEdit && <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Your role can view requests but not act on them.</p>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const byType = (Object.keys(DSR_TYPE_LABEL) as DsrType[]).map((t) => ({ name: DSR_TYPE_LABEL[t].split(" (")[0], value: rows.filter((r) => r.type === t).length }));
  const held = rows.filter((r) => r.legalHold && !isClosed(r));

  return (
    <PageBody>
      <PageHeader
        title="Data-Subject Requests"
        description="Rights of data principals under the Digital Personal Data Protection Act, 2023 — access, correction, erasure, grievance redressal and nomination. Grievances must be answered within 7 days; other requests within 30."
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Open requests" value={open.length} icon={Inbox} onClick={() => setStatusFilter("open")} />
            <StatTile label="Overdue" value={overdue.length} icon={Timer} tone={overdue.length ? "critical" : "good"} hint="Past the statutory SLA" />
            <StatTile label="Awaiting identity check" value={open.filter((r) => !r.identityVerified).length} icon={Fingerprint} tone="warning" />
            <StatTile label="Fulfilled (90 days)" value={rows.filter((r) => r.status === "fulfilled").length} icon={ShieldCheck} tone="good" onClick={() => setStatusFilter("fulfilled")} />
          </StatRow>

          {held.map((r) => (
            <Alert key={r.id} tone="warning" icon={Gavel} title={`${r.id}: erasure blocked by legal hold`}>
              {r.legalHold} The DPDP Act permits retention where required by law; the data principal has been told why.
            </Alert>
          ))}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
            <DataTable
              columns={columns}
              data={data}
              searchKeys={["id", "principalName", "principalCode"]}
              searchPlaceholder="Search request, name or code…"
              filters={
                <>
                  <FilterSelect label="Right" value={typeFilter} onValueChange={setTypeFilter} width="w-[200px]" options={(Object.keys(DSR_TYPE_LABEL) as DsrType[]).map((t) => ({ value: t, label: DSR_TYPE_LABEL[t] }))} />
                  <FilterSelect label="Status" value={statusFilter} onValueChange={setStatusFilter} width="w-[190px]" options={[{ value: "open", label: "All open" }, ...(Object.keys(STATUS) as DsrStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))]} />
                </>
              }
              rowTone={(r) => (!isClosed(r) && daysLeft(r) < 0 ? "danger" : undefined)}
              exportName="dpdp-requests"
              emptyIcon={Inbox}
              emptyTitle="No requests match"
              emptyDescription="There are no data-subject requests with these filters."
            />
            <DonutChart title="Requests by right" description="Last 90 days" data={byType} height={200} centreLabel="requests" centreValue={String(rows.length)} />
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!verifying}
        onOpenChange={(v) => !v && setVerifying(null)}
        title={`Mark ${verifying?.principalName ?? ""}'s identity as verified?`}
        description="Confirm you matched the request against the employee's registered email or mobile with a one-time code, or against a government ID for ex-employees and candidates."
        confirmLabel="Identity verified"
        onConfirm={() => {
          if (!verifying) return;
          patch(verifying.id, { identityVerified: true, status: verifying.legalHold ? "on_hold" : "in_progress" });
          mockAction("Identity verified", { description: `${verifying.id} moved to In progress.` });
        }}
      />

      <ReasonDialog
        open={!!erasing}
        onOpenChange={(v) => !v && setErasing(null)}
        title={`Erase personal data for ${erasing?.principalName ?? ""}?`}
        description="Personal fields are irreversibly anonymised across every module. Statutory records (payslips, PF, Form 16) are retained in anonymised form until their retention period ends. This cannot be undone."
        confirmLabel="Erase permanently"
        typePhrase={erasing?.principalCode}
        commentLabel="Legal basis / note"
        onConfirm={(note) => {
          if (!erasing) return;
          patch(erasing.id, { status: "fulfilled" });
          mockAction(`Personal data erased for ${erasing.principalCode}`, { description: `Erasure certificate generated and sent to the data principal. Note: “${note}”`, tone: "warning" });
        }}
      />
    </PageBody>
  );
}
