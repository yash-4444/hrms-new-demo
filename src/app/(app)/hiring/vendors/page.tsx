"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Building2, Handshake, Plus, Receipt, Send, UserCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtDate, inr, pct } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { AGENCIES, type Agency, type AgencyInvoice, type InvoiceStatus } from "@/mock/lifecycle";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { ReasonDialog } from "@/components/lifecycle/kit";
import { PersonCell } from "@/components/people/person-cell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge, Hint, Progress } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { AgencySheet } from "./agency-sheet";
import { AddAgencyDialog } from "./add-agency-dialog";

/* ============================================================================
   /hiring/vendors — search partners, their SLA record and what they bill us.
   Invoice approvals and disputes update the sheet, the table and the
   outstanding total in the same tick.
   ========================================================================== */

const OUTSTANDING: InvoiceStatus[] = ["pending", "approved", "disputed"];
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
];

const slaTone = (v: number) => (v >= 85 ? "success" : v >= 70 ? "warning" : "danger");
const convRate = (a: Agency) => (a.submissionsFy ? Math.round((a.hiresFy / a.submissionsFy) * 1000) / 10 : 0);
const daysToEnd = (a: Agency) => differenceInCalendarDays(parseISO(a.contractEnd), parseISO(DEMO_TODAY));

export default function VendorsPage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const linkCandidates = can("hiring.candidates", "V");

  const [agencies, setAgencies] = React.useState<Agency[]>(() => AGENCIES.map((a) => ({ ...a, invoices: a.invoices.map((i) => ({ ...i })) })));
  const [status, setStatus] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [addOpen, setAddOpen] = React.useState(false);
  const [disputing, setDisputing] = React.useState<{ agency: Agency; inv: AgencyInvoice } | null>(null);

  const rows = React.useMemo(() => agencies.filter((a) => status === "all" || a.status === status), [agencies, status]);

  const kpis = React.useMemo(() => {
    const open = agencies.flatMap((a) => a.invoices).filter((i) => OUTSTANDING.includes(i.status));
    return {
      active: agencies.filter((a) => a.status === "active").length,
      onHold: agencies.filter((a) => a.status === "on_hold").length,
      submissions: agencies.reduce((s, a) => s + a.submissionsFy, 0),
      interviews: agencies.reduce((s, a) => s + a.interviewsFy, 0),
      hires: agencies.reduce((s, a) => s + a.hiresFy, 0),
      outstanding: open.reduce((s, i) => s + i.total, 0),
      outstandingCount: open.length,
      disputed: open.filter((i) => i.status === "disputed").length,
    };
  }, [agencies]);

  /* -------------------------------------------------------------- mutators */

  const setInvoice = (agencyId: string, invId: string, next: InvoiceStatus) =>
    setAgencies((prev) =>
      prev.map((a) => (a.id === agencyId ? { ...a, invoices: a.invoices.map((i) => (i.id === invId ? { ...i, status: next } : i)) } : a)),
    );

  const approve = (a: Agency, inv: AgencyInvoice) => {
    setInvoice(a.id, inv.id, "approved");
    mockAction(`Invoice ${inv.id} approved`, {
      description: `${inr(inv.total, { decimals: false })} incl. GST to ${a.name} — queued for the next vendor payment run.`,
      undo: () => setInvoice(a.id, inv.id, inv.status),
    });
  };

  const dispute = (comment: string) => {
    if (!disputing) return;
    const { agency: a, inv } = disputing;
    setInvoice(a.id, inv.id, "disputed");
    mockAction(`Invoice ${inv.id} disputed`, {
      description: `${a.contact} at ${a.name} has been notified. Reason: ${comment}`,
      tone: "warning",
    });
  };

  const added = (a: Agency) => {
    setAgencies((prev) => [...prev, a]);
    mockAction(`${a.name} added`, {
      description: `Empanelled at ${a.feePct}% with a ${a.slaDays}-day shortlist SLA. ${a.contact} has been sent a vendor-portal invite.`,
    });
  };

  const openAgency = (a: Agency) => {
    setOpenId(a.id);
    setSheetOpen(true);
  };
  const active = openId ? (agencies.find((a) => a.id === openId) ?? null) : null;

  /* ---------------------------------------------------------------- columns */

  const columns = React.useMemo<ColumnDef<Agency, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Agency",
        accessorKey: "name",
        enableHiding: false,
        cell: ({ row }) => <PersonCell name={row.original.name} subtitle={row.original.focus} />,
      },
      { id: "contact", header: "Contact", accessorKey: "contact" },
      { id: "feePct", header: () => <span className="block text-right">Fee</span>, accessorKey: "feePct", cell: ({ row }) => <NumCell>{row.original.feePct}%</NumCell> },
      { id: "slaDays", header: () => <span className="block text-right">SLA</span>, accessorKey: "slaDays", cell: ({ row }) => <NumCell>{row.original.slaDays} d</NumCell> },
      {
        id: "slaMet",
        header: "SLA met",
        accessorKey: "slaMetPct",
        cell: ({ row }) => {
          const v = row.original.slaMetPct;
          return (
            <span className="flex min-w-[110px] items-center gap-2">
              <Progress value={v} tone={slaTone(v)} className="h-1.5 flex-1" aria-label={`SLA met ${v}%`} />
              <span className={cn("tnum w-9 text-right text-xs", v < 70 && "font-medium text-destructive-fg")}>{v}%</span>
            </span>
          );
        },
      },
      { id: "submissions", header: () => <span className="block text-right">Submitted</span>, accessorKey: "submissionsFy", cell: ({ row }) => <NumCell>{row.original.submissionsFy}</NumCell> },
      { id: "interviews", header: () => <span className="block text-right">Interviewed</span>, accessorKey: "interviewsFy", cell: ({ row }) => <NumCell>{row.original.interviewsFy}</NumCell> },
      { id: "hires", header: () => <span className="block text-right">Hired</span>, accessorKey: "hiresFy", cell: ({ row }) => <NumCell>{row.original.hiresFy}</NumCell> },
      {
        id: "conversion",
        header: () => <span className="block text-right">Submit → hire</span>,
        accessorFn: convRate,
        cell: ({ row }) => <NumCell>{row.original.submissionsFy ? pct(convRate(row.original)) : "—"}</NumCell>,
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (a) => (a.status === "active" ? "Active" : "On hold"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "contractEnd",
        header: "Contract end",
        accessorKey: "contractEnd",
        cell: ({ row }) => {
          const d = daysToEnd(row.original);
          const soon = d <= 60;
          return (
            <Hint text={soon ? (d < 0 ? "Contract has lapsed — renew or offboard." : `Renewal due in ${d} days.`) : ""}>
              <span className={cn("tnum whitespace-nowrap", soon ? "font-medium text-warning-fg" : "text-muted-foreground")}>
                {fmtDate(row.original.contractEnd)}
              </span>
            </Hint>
          );
        },
      },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Agencies"
        description="Search partners on contract, how fast they shortlist, how many of their candidates we hire, and every fee they bill — with GST — in one ledger."
        actions={
          <Gated menuKey="hiring.vendors" action="C">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Add agency
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <CardsSkeleton count={4} />
      ) : (
        <StatRow cols={4}>
          <StatTile
            label="Active agencies"
            value={kpis.active}
            icon={Handshake}
            tone="accent"
            hint={`${kpis.onHold} on hold`}
            onClick={() => setStatus(status === "active" ? "all" : "active")}
            footer={status === "active" ? "Filtering the table — click again to clear" : undefined}
          />
          <StatTile label="Submissions this FY" value={kpis.submissions} icon={Send} hint={`${kpis.interviews} reached interview`} />
          <StatTile
            label="Hires this FY"
            value={kpis.hires}
            icon={UserCheck}
            tone="good"
            hint={`${pct(kpis.submissions ? (kpis.hires / kpis.submissions) * 100 : 0)} of submissions`}
          />
          <StatTile
            label="Invoices outstanding"
            value={inr(kpis.outstanding, { decimals: false })}
            icon={Receipt}
            tone={kpis.disputed > 0 ? "warning" : "neutral"}
            hint={`${kpis.outstandingCount} invoices incl. 18% GST · ${kpis.disputed} disputed`}
          />
        </StatRow>
      )}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : (
        <DataTable<Agency>
          columns={columns}
          data={rows}
          getRowId={(a) => a.id}
          searchKeys={["name", "contact", "focus"]}
          searchPlaceholder="Search agency, contact or focus…"
          exportName="agencies"
          onRowClick={openAgency}
          rowTone={(a) => (a.status === "on_hold" ? "warning" : undefined)}
          emptyIcon={Building2}
          emptyTitle="No agencies in this status"
          emptyDescription="Clear the filter to see every empanelled agency."
          emptyAction={
            <Button variant="outline" size="sm" onClick={() => setStatus("all")}>
              Clear filter
            </Button>
          }
          filters={
            <FilterSelect label="Status" value={status} onValueChange={setStatus} options={STATUS_OPTIONS} allLabel="All statuses" width="w-[170px]" />
          }
          toolbar={
            <Badge variant="muted" className="tnum">
              {rows.length} of {agencies.length}
            </Badge>
          }
        />
      )}

      <AgencySheet
        agency={active}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        linkCandidates={linkCandidates}
        onApprove={approve}
        onDispute={(agency, inv) => setDisputing({ agency, inv })}
      />

      <AddAgencyDialog open={addOpen} onOpenChange={setAddOpen} nextId={`AGY-${String(agencies.length + 1).padStart(2, "0")}`} onAdded={added} />

      <ReasonDialog
        open={!!disputing}
        onOpenChange={(v) => !v && setDisputing(null)}
        title={disputing ? `Dispute invoice ${disputing.inv.id}?` : "Dispute invoice"}
        description={
          disputing
            ? `${inr(disputing.inv.total, { decimals: false })} from ${disputing.agency.name} for ${disputing.inv.hireName}. Payment is held until the dispute is resolved.`
            : undefined
        }
        confirmLabel="Raise dispute"
        onConfirm={dispute}
      />
    </PageBody>
  );
}
