"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Check, ClipboardList, Inbox, PackageCheck, Plus, X } from "lucide-react";
import { fmtDate, inr, inrCompact, num } from "@/lib/format";
import { employeeByCode, employeeName } from "@/mock/employees";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { ASSETS } from "@/mock/workplace";
import { ASSET_REQUESTS, type AssetRequest, type RequestFulfilment } from "@/mock/service";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { AssetLink, ReasonDialog } from "@/components/service/kit";
import { AssetRequestDialog } from "@/components/service/asset-request-dialog";

const NEXT_STEP: Partial<Record<RequestFulfilment, { to: RequestFulfilment; label: string }>> = {
  not_started: { to: "in_review", label: "Start procurement" },
  in_review: { to: "scheduled", label: "Schedule handover" },
  scheduled: { to: "completed", label: "Mark delivered" },
};

export default function AssetRequestsPage() {
  const loading = useFakeLoad();
  const { persona, can } = useApp();
  const [rows, setRows] = React.useState<AssetRequest[]>(ASSET_REQUESTS);
  const [raiseOpen, setRaiseOpen] = React.useState(false);
  const [rejecting, setRejecting] = React.useState<AssetRequest | null>(null);

  const me = persona.employeeId;
  const mine = rows.filter((r) => r.requesterCode === me);
  const toApprove = rows.filter((r) => r.managerCode === me && r.approval === "pending");
  const fulfilment = rows.filter((r) => r.approval === "approved");
  const isIt = can("workplace.asset_requests", "E");
  const isApprover = can("workplace.asset_requests", "A");
  const myManager = employeeByCode(me)?.managerCode ?? null;

  const patch = (id: string, p: Partial<AssetRequest>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const columns = React.useMemo<ColumnDef<AssetRequest, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Request", cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      {
        accessorKey: "requesterName",
        header: "Requested by",
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5">
            <Avatar name={row.original.requesterName} size={20} />
            <span className="flex flex-col">
              <span className="font-medium">{row.original.requesterName}</span>
              <span className="text-[10px] text-muted-foreground">{row.original.department}</span>
            </span>
          </span>
        ),
      },
      { accessorKey: "item", header: "Item", cell: ({ row }) => <span className="flex flex-col"><span>{row.original.item}</span><Badge variant="muted">{row.original.category}</Badge></span> },
      { accessorKey: "justification", header: "Justification", cell: ({ row }) => <p className="line-clamp-2 max-w-xs text-muted-foreground">{row.original.justification}</p> },
      { accessorKey: "raisedOn", header: "Raised", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.raisedOn)}</span> },
      { accessorKey: "estCost", header: "Est. cost", cell: ({ row }) => <NumCell>{inr(row.original.estCost, { decimals: false })}</NumCell> },
      { accessorKey: "managerName", header: "Approver" },
      { accessorKey: "approval", header: "Approval", cell: ({ row }) => <StatusBadge status={row.original.approval} /> },
      {
        accessorKey: "fulfilment",
        header: "IT fulfilment",
        cell: ({ row }) => (
          <span className="flex flex-col gap-0.5">
            <StatusBadge status={row.original.fulfilment} />
            {row.original.fulfilledAssetId && (
              <AssetLink id={row.original.fulfilledAssetId} label={<span className="font-mono text-[10px] text-muted-foreground">{row.original.fulfilledAssetId}</span>} />
            )}
          </span>
        ),
      },
    ],
    [],
  );

  const approveCol: ColumnDef<AssetRequest, unknown> = {
    id: "approve",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="flex gap-1">
        <Gated menuKey="workplace.asset_requests" action="A">
          <Button size="sm" onClick={() => { patch(row.original.id, { approval: "approved", approvedOn: DEMO_TODAY }); mockAction(`${row.original.id} approved`, { description: "Sent to the IT Service Desk to fulfil." }); }}>
            <Check /> Approve
          </Button>
        </Gated>
        <Gated menuKey="workplace.asset_requests" action="A">
          <Button size="sm" variant="outline" onClick={() => setRejecting(row.original)}>
            <X /> Reject
          </Button>
        </Gated>
      </span>
    ),
  };

  const fulfilCol: ColumnDef<AssetRequest, unknown> = {
    id: "fulfil",
    header: "",
    enableSorting: false,
    cell: ({ row }) => {
      const step = NEXT_STEP[row.original.fulfilment];
      if (!step) return null;
      return (
        <Gated menuKey="workplace.asset_requests" action="E">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const stock = ASSETS.find((a) => a.category === row.original.category && a.status === "in_stock");
              patch(row.original.id, { fulfilment: step.to, fulfilledAssetId: step.to === "scheduled" ? (stock?.id ?? null) : row.original.fulfilledAssetId });
              mockAction(`${row.original.id}: ${step.label.toLowerCase()}`, {
                description: step.to === "scheduled" && stock ? `${stock.id} reserved for ${row.original.requesterName}.` : undefined,
              });
            }}
          >
            <ArrowRight /> {step.label}
          </Button>
        </Gated>
      );
    },
  };

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Asset requests" description="Loading requests…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  const common = { getRowId: (r: AssetRequest) => r.id, searchKeys: ["id", "item", "requesterName"] as (keyof AssetRequest & string)[], searchPlaceholder: "Search request, item or person…" };

  return (
    <PageBody>
      <PageHeader
        title="Asset requests"
        description="Ask for equipment, approve your team's requests, and track IT fulfilment end to end."
        actions={
          <Gated menuKey="workplace.asset_requests" action="C">
            <Button size="sm" onClick={() => setRaiseOpen(true)}>
              <Plus /> Request equipment
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Awaiting manager" value={num(rows.filter((r) => r.approval === "pending").length)} icon={Inbox} tone="warning" />
        <StatTile label="In fulfilment" value={num(fulfilment.filter((r) => r.fulfilment !== "completed").length)} icon={ClipboardList} />
        <StatTile label="Delivered" value={num(rows.filter((r) => r.fulfilment === "completed").length)} icon={PackageCheck} tone="good" />
        <StatTile label="Approved spend" value={inrCompact(fulfilment.reduce((s, r) => s + r.estCost, 0))} hint="Estimated, at catalogue price" />
      </StatRow>

      <Tabs defaultValue={isIt ? "fulfilment" : isApprover && toApprove.length ? "approve" : "mine"}>
        <TabsList>
          <TabsTrigger value="mine">My requests ({mine.length})</TabsTrigger>
          {isApprover && <TabsTrigger value="approve">To approve ({toApprove.length})</TabsTrigger>}
          {isIt && <TabsTrigger value="fulfilment">IT fulfilment ({fulfilment.filter((r) => r.fulfilment !== "completed").length})</TabsTrigger>}
          {isIt && <TabsTrigger value="all">All requests</TabsTrigger>}
        </TabsList>
        <TabsContent value="mine">
          <DataTable {...common} columns={columns} data={mine} exportName="my-asset-requests" emptyIcon={ClipboardList} emptyTitle="You have not requested anything"
            emptyDescription="Need a monitor, headset or replacement laptop? Raise a request and your manager is notified."
            emptyAction={<Gated menuKey="workplace.asset_requests" action="C"><Button size="sm" onClick={() => setRaiseOpen(true)}><Plus /> Request equipment</Button></Gated>} />
        </TabsContent>
        {isApprover && (
          <TabsContent value="approve">
            <DataTable {...common} columns={[...columns, approveCol]} data={toApprove} exportName="asset-requests-to-approve" emptyIcon={Check} emptyTitle="Nothing waiting for you" emptyDescription="Requests from your direct reports appear here." />
          </TabsContent>
        )}
        {isIt && (
          <TabsContent value="fulfilment">
            <DataTable {...common} columns={[...columns, fulfilCol]} data={fulfilment.filter((r) => r.fulfilment !== "completed")} exportName="asset-fulfilment" emptyIcon={PackageCheck} emptyTitle="Fulfilment queue is clear" emptyDescription="Approved requests waiting for procurement or handover appear here." />
          </TabsContent>
        )}
        {isIt && (
          <TabsContent value="all">
            <DataTable {...common} columns={columns} data={rows} exportName="asset-requests" enableSelection emptyIcon={ClipboardList} emptyTitle="No requests" emptyDescription="Requests raised by anyone in the tenant appear here." />
          </TabsContent>
        )}
      </Tabs>

      <AssetRequestDialog
        open={raiseOpen}
        onOpenChange={setRaiseOpen}
        managerName={myManager ? employeeName(myManager) : "your manager"}
        onSave={(v) => {
          const e = employeeByCode(me);
          const id = `AR-2026-${String(181 + rows.length * 2).padStart(4, "0")}`;
          setRows((rs) => [
            { id, requesterCode: me, requesterName: persona.name, department: e ? deptName(e.departmentId) : persona.department, managerCode: myManager ?? "STL-0001", managerName: employeeName(myManager ?? "STL-0001"),
              category: v.category, item: v.item, justification: v.justification, raisedOn: DEMO_TODAY, neededBy: v.neededBy, approval: "pending", approvedOn: null, fulfilment: "not_started", fulfilledAssetId: null,
              estCost: ASSETS.find((a) => a.category === v.category)?.purchaseCost ?? 0 },
            ...rs,
          ]);
          mockAction(`${id} submitted`, { description: `${v.item} — waiting for ${employeeName(myManager ?? "STL-0001")}.` });
        }}
      />
      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={`Reject ${rejecting?.id ?? ""}?`}
        description={rejecting ? `${rejecting.requesterName} is told why their request for ${rejecting.item} was declined.` : undefined}
        confirmLabel="Reject request"
        onConfirm={(reason) => {
          if (!rejecting) return;
          patch(rejecting.id, { approval: "rejected", fulfilment: "cancelled" });
          mockAction(`${rejecting.id} rejected`, { description: reason, tone: "info" });
        }}
      />
    </PageBody>
  );
}
