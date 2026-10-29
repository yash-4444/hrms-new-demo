"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { BellRing, Check, FileCheck2, FileClock, FileWarning, FileX2, Files, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, num } from "@/lib/format";
import { BRANCHES, DEMO_TODAY } from "@/mock/org";
import { employeeByCode, employeeName } from "@/mock/employees";
import { DOCUMENTS, type DocStatus, type EmployeeDocument } from "@/mock/masters";
import { EmployeeLink } from "@/components/org/bits";
import { RejectReasonDialog } from "@/components/org/doc-reject-dialog";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, FilterSelect } from "@/components/ui/overlays";

/** Document statuses resolved through the shared status map with our own labels. */
const DOC_STATUS: Record<DocStatus, { status: string; label: string }> = {
  pending: { status: "pending", label: "Pending" },
  verified: { status: "approved", label: "Verified" },
  rejected: { status: "rejected", label: "Rejected" },
  expired: { status: "overdue", label: "Expired" },
};

type Row = EmployeeDocument & { employeeName: string; branchId: string; daysLeft: number | null };

const daysLeft = (d: string | null) => (d ? differenceInCalendarDays(parseISO(d), parseISO(DEMO_TODAY)) : null);
const TYPES = [...new Set(DOCUMENTS.map((d) => d.type))];

export default function DocumentRegisterPage() {
  const loading = useFakeLoad();
  const { can, persona } = useApp();
  const canAct = can("people.documents", "E");

  const [docs, setDocs] = React.useState<EmployeeDocument[]>(DOCUMENTS);
  const [view, setView] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [branch, setBranch] = React.useState("all");
  const [rejecting, setRejecting] = React.useState<EmployeeDocument | null>(null);

  const all = React.useMemo<Row[]>(
    () =>
      docs.map((d) => ({
        ...d,
        employeeName: employeeName(d.employeeCode),
        branchId: employeeByCode(d.employeeCode)?.branchId ?? "",
        daysLeft: daysLeft(d.expiry),
      })),
    [docs],
  );
  const expiring = all.filter((d) => d.daysLeft !== null && d.daysLeft >= 0 && d.daysLeft <= 30);
  const pending = all.filter((d) => d.status === "pending");
  const rows = (view === "expiring" ? expiring : view === "pending" ? pending : all).filter(
    (d) => (type === "all" || d.type === type) && (status === "all" || d.status === status) && (branch === "all" || d.branchId === branch),
  );

  const setStatusFor = (ids: string[], next: DocStatus, reason?: string) => {
    const before = docs;
    const set = new Set(ids);
    setDocs((ds) => ds.map((d) => (set.has(d.id) ? { ...d, status: next, verifiedBy: persona.name, rejectReason: reason } : d)));
    return () => setDocs(before);
  };

  const verify = (ids: string[]) => {
    const undo = setStatusFor(ids, "verified");
    mockAction(ids.length === 1 ? `${ids[0]} verified` : `${ids.length} documents verified`, {
      description: `Verified by ${persona.name}. The employee's profile shows the green check.`,
      undo,
    });
  };

  const remind = (list: Row[]) => {
    const people = new Set(list.map((d) => d.employeeCode)).size;
    mockAction(`Reminder sent to ${people} employee${people === 1 ? "" : "s"}`, {
      description: `In-app and email: “Please upload a renewed copy of your ${list.length === 1 ? list[0].type : "documents"} before expiry.”`,
      tone: "info",
    });
  };

  const columns: ColumnDef<Row, unknown>[] = [
      { accessorKey: "employeeName", header: "Employee", cell: ({ row }) => <EmployeeLink code={row.original.employeeCode} /> },
      {
        accessorKey: "type",
        header: "Document",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.original.type}</p>
            <p className="tnum truncate text-[11px] text-muted-foreground">
              {row.original.fileName} · {num(row.original.sizeKb)} KB
            </p>
          </div>
        ),
      },
      { accessorKey: "number", header: "Number", cell: ({ getValue }) => <span className="tnum font-mono text-xs" aria-label="Masked document number">{getValue() as string}</span> },
      {
        accessorKey: "daysLeft",
        header: "Expiry",
        sortUndefined: "last",
        cell: ({ row }) => {
          const d = row.original.daysLeft;
          if (d === null) return <MutedCell>No expiry</MutedCell>;
          return (
            <div className="tnum leading-tight">
              <p className="text-xs">{fmtDate(row.original.expiry!)}</p>
              <p className={cn("text-[11px]", d < 0 ? "text-destructive-fg" : d <= 30 ? "font-medium text-warning-fg" : "text-muted-foreground")}>
                {d < 0 ? `Expired ${-d} days ago` : d === 0 ? "Expires today" : `${d} days left`}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Verification",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <StatusBadge status={DOC_STATUS[row.original.status].status} label={DOC_STATUS[row.original.status].label} />
            {row.original.rejectReason && <span className="max-w-[200px] truncate text-[11px] text-muted-foreground">{row.original.rejectReason}</span>}
          </div>
        ),
      },
      { accessorKey: "uploadedOn", header: "Uploaded", cell: ({ getValue }) => <span className="tnum text-xs">{fmtDate(getValue() as string)}</span> },
      { accessorKey: "verifiedBy", header: "Checked by", cell: ({ getValue }) => <MutedCell>{(getValue() as string) ?? "—"}</MutedCell> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.id}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!canAct || row.original.status === "verified" || row.original.status === "expired"} onSelect={() => verify([row.original.id])}>
                  <Check aria-hidden />
                  Verify
                </DropdownMenuItem>
                <DropdownMenuItem destructive disabled={!canAct || row.original.status === "rejected"} onSelect={() => setRejecting(row.original)}>
                  <X aria-hidden />
                  Reject…
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canAct} onSelect={() => remind([row.original])}>
                  <BellRing aria-hidden />
                  Send reminder
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => mockAction(`${row.original.fileName} downloaded`, { description: "Watermarked copy — the download is logged.", tone: "info" })}>
                  <Files aria-hidden />
                  Download
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Document Register"
        description="Identity, education and employment documents across every employee — masked numbers, expiry tracking and a verification trail."
        tabs={
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="all">All documents ({num(all.length)})</TabsTrigger>
              <TabsTrigger value="expiring">Expiring in 30 days ({num(expiring.length)})</TabsTrigger>
              <TabsTrigger value="pending">Pending verification ({num(pending.length)})</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Verified" value={num(all.filter((d) => d.status === "verified").length)} icon={FileCheck2} tone="good" onClick={() => { setView("all"); setStatus("verified"); }} />
        <StatTile label="Pending verification" value={num(pending.length)} icon={FileClock} tone="warning" onClick={() => setView("pending")} />
        <StatTile label="Expiring in 30 days" value={num(expiring.length)} icon={FileWarning} tone="serious" onClick={() => setView("expiring")} />
        <StatTile label="Expired / rejected" value={num(all.filter((d) => d.status === "expired" || d.status === "rejected").length)} icon={FileX2} tone="critical" onClick={() => { setView("all"); setStatus("expired"); }} />
      </StatRow>

      <Section bodyClassName="p-3">
        {loading ? (
          <TableSkeleton />
        ) : (
          <DataTable<Row>
            columns={columns}
            data={rows}
            searchKeys={["employeeName", "employeeCode", "type", "id"]}
            searchPlaceholder="Search employee, code or document…"
            getRowId={(r) => r.id}
            exportName="document-register"
            enableSelection={canAct}
            filters={
              <>
                <FilterSelect label="Type" value={type} onValueChange={setType} options={TYPES.map((t) => ({ value: t, label: t }))} width="w-[210px]" />
                <FilterSelect label="Status" value={status} onValueChange={setStatus} options={(Object.keys(DOC_STATUS) as DocStatus[]).map((s) => ({ value: s, label: DOC_STATUS[s].label }))} />
                <FilterSelect label="Branch" value={branch} onValueChange={setBranch} options={BRANCHES.map((b) => ({ value: b.id, label: b.city }))} />
              </>
            }
            bulkActions={(selected, clear) => (
              <>
                <Button size="sm" variant="outline" onClick={() => { remind(selected); clear(); }}>
                  <BellRing aria-hidden />
                  Remind {selected.length}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selected.some((s) => s.status === "pending")}
                  onClick={() => { verify(selected.filter((s) => s.status === "pending").map((s) => s.id)); clear(); }}
                >
                  <Check aria-hidden />
                  Verify pending
                </Button>
              </>
            )}
            rowTone={(r) => (r.status === "expired" ? "danger" : r.daysLeft !== null && r.daysLeft >= 0 && r.daysLeft <= 30 ? "warning" : undefined)}
            emptyIcon={Files}
            emptyTitle={view === "expiring" ? "Nothing expires in the next 30 days" : "No documents match"}
            emptyDescription="Change the view or clear a filter to see more of the register."
          />
        )}
      </Section>

      <RejectReasonDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title={`Reject ${rejecting?.type ?? "document"}?`}
        subject={rejecting ? `${employeeName(rejecting.employeeCode)} · ${rejecting.id}.` : ""}
        onReject={(reason) => {
          if (!rejecting) return;
          const undo = setStatusFor([rejecting.id], "rejected", reason);
          mockAction(`${rejecting.id} rejected`, { description: `${employeeName(rejecting.employeeCode)} has been asked to re-upload.`, tone: "warning", undo });
        }}
      />
    </PageBody>
  );
}
