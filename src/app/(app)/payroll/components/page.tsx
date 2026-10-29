"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Calculator, Layers, Pencil, Plus, Puzzle, ReceiptIndianRupee, ShieldCheck, Trash2 } from "lucide-react";
import { num } from "@/lib/format";
import {
  PAY_COMPONENT_CATALOG,
  PAY_COMPONENT_TYPES,
  type PayComponentDef,
  type PayComponentTaxability,
  type PayComponentType,
} from "@/mock/finance-payroll";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  FilterSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { DetailList, DetailRow } from "@/components/people/person-cell";
import { ComponentFormDialog, type ComponentFormValues } from "./component-form";
import { ComponentTester, FormulaCode } from "./formula";

/* ============================================================================
   /payroll/components — the salary component catalog. Every formula here is
   the rule the September run actually used; the tester proves it.
   ========================================================================== */

const TYPE_TONE: Record<PayComponentType, "default" | "secondary" | "outline" | "soft" | "muted"> = {
  Earning: "soft",
  "Statutory deduction": "secondary",
  Deduction: "outline",
  "Employer contribution": "muted",
  Reimbursement: "outline",
};

export default function SalaryComponentsPage() {
  const loading = useFakeLoad();
  const [rows, setRows] = React.useState<PayComponentDef[]>(PAY_COMPONENT_CATALOG);
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [detail, setDetail] = React.useState<PayComponentDef | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PayComponentDef | null>(null);
  const [deleting, setDeleting] = React.useState<PayComponentDef | null>(null);

  const filtered = React.useMemo(
    () => [...rows].filter((r) => typeFilter === "all" || r.type === typeFilter).sort((a, b) => a.order - b.order),
    [rows, typeFilter],
  );

  const openEdit = (c: PayComponentDef | null) => {
    setEditing(c);
    setFormOpen(true);
  };

  const save = (v: ComponentFormValues) => {
    const next: PayComponentDef = {
      ...v,
      type: v.type as PayComponentType,
      taxability: v.taxability as PayComponentTaxability,
      active: editing?.active ?? true,
      reference: editing?.reference ?? "Tenant-defined",
    };
    setRows((prev) => (editing ? prev.map((r) => (r.code === editing.code ? next : r)) : [...prev, next]));
    if (detail?.code === next.code) setDetail(next);
    mockAction(editing ? `${next.name} updated` : `${next.name} created`, {
      description: "Applies from the next calculation of the September 2026 run.",
    });
  };

  const columns = React.useMemo<ColumnDef<PayComponentDef, unknown>[]>(
    () => [
      { accessorKey: "order", header: "Order", cell: ({ row }) => <NumCell>{row.original.order}</NumCell> },
      {
        accessorKey: "name",
        header: "Component",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{row.original.code}</span>
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <Badge variant={TYPE_TONE[row.original.type]}>{row.original.type}</Badge>,
      },
      { accessorKey: "taxability", header: "Taxability", cell: ({ row }) => <MutedCell>{row.original.taxability}</MutedCell> },
      {
        accessorKey: "formula",
        header: "Formula",
        cell: ({ row }) => (
          <code className="block max-w-[340px] truncate font-mono text-[11px]" title={row.original.formula}>
            {row.original.formula.split(" = ")[1] ?? row.original.formula}
          </code>
        ),
      },
      {
        accessorKey: "prorated",
        header: "Pro-rated",
        cell: ({ row }) => <MutedCell>{row.original.prorated ? "Yes" : "No"}</MutedCell>,
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.active ? "active" : "draft"} label={row.original.active ? "Active" : "Inactive"} />,
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Salary components" description="Loading the component catalog…" />
        <CardsSkeleton count={4} />
        <TableSkeleton rows={10} />
      </PageBody>
    );
  }

  const count = (t: PayComponentType) => rows.filter((r) => r.type === t).length;

  return (
    <PageBody>
      <PageHeader
        title="Salary components"
        description="The building blocks of every salary structure. Formulas are evaluated in order, and each one can be tested against a real employee in the September 2026 run."
        actions={
          <Gated menuKey="payroll.components" action="C">
            <Button size="sm" onClick={() => openEdit(null)}>
              <Plus /> New component
            </Button>
          </Gated>
        }
      />
      <StatRow cols={4}>
        <StatTile label="Components" value={num(rows.length)} icon={Puzzle} hint={`${num(rows.filter((r) => r.active).length)} active`} />
        <StatTile label="Earnings" value={num(count("Earning"))} icon={ReceiptIndianRupee} onClick={() => setTypeFilter("Earning")} />
        <StatTile label="Statutory deductions" value={num(count("Statutory deduction"))} icon={ShieldCheck} hint="PF, ESI, PT, LWF, TDS" onClick={() => setTypeFilter("Statutory deduction")} />
        <StatTile label="Employer contributions" value={num(count("Employer contribution"))} icon={Layers} hint="Inside CTC, outside gross" onClick={() => setTypeFilter("Employer contribution")} />
      </StatRow>

      <DataTable<PayComponentDef>
        columns={columns}
        data={filtered}
        getRowId={(r) => r.code}
        searchKeys={["code", "name", "formula", "reference"]}
        searchPlaceholder="Search code, name or formula…"
        exportName="salary-components"
        onRowClick={setDetail}
        pageSize={25}
        emptyIcon={Calculator}
        emptyTitle="No component of this type"
        emptyDescription="Clear the type filter, or create a component for this category."
        emptyAction={
          <Button variant="outline" size="sm" onClick={() => setTypeFilter("all")}>
            Clear filter
          </Button>
        }
        filters={
          <FilterSelect
            label="Type"
            value={typeFilter}
            onValueChange={setTypeFilter}
            allLabel="All types"
            width="w-[210px]"
            options={PAY_COMPONENT_TYPES.map((t) => ({ value: t, label: t }))}
          />
        }
      />

      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <SheetContent width="sm:max-w-xl">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.name}</SheetTitle>
                <SheetDescription>
                  <span className="font-mono">{detail.code}</span> · {detail.type} · order {detail.order}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-4">
                <FormulaCode formula={detail.formula} />
                <DetailList>
                  <DetailRow label="Taxability">{detail.taxability}</DetailRow>
                  <DetailRow label="Pro-ration">{detail.prorated ? "Pro-rated for joiners and leavers" : "Not pro-rated"}</DetailRow>
                  <DetailRow label="On payslip">{detail.onPayslip ? "Yes" : "No — employer side only"}</DetailRow>
                  <DetailRow label="Reference">{detail.reference}</DetailRow>
                  <DetailRow label="Note">{detail.note || "—"}</DetailRow>
                </DetailList>
                <ComponentTester code={detail.code} />
              </SheetBody>
              <SheetFooter>
                <Gated menuKey="payroll.components" action="D">
                  <Button variant="outline" size="sm" onClick={() => setDeleting(detail)}>
                    <Trash2 /> Delete
                  </Button>
                </Gated>
                <Gated menuKey="payroll.components" action="E">
                  <Button size="sm" onClick={() => openEdit(detail)}>
                    <Pencil /> Edit
                  </Button>
                </Gated>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ComponentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        existingCodes={rows.map((r) => r.code)}
        onSave={save}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        destructive
        title={`Delete ${deleting?.name ?? "component"}?`}
        description="It is removed from every salary structure from the next calculation. Paid runs keep the amounts they were calculated with."
        confirmLabel="Delete component"
        onConfirm={() => {
          if (!deleting) return;
          const removed = deleting;
          setRows((prev) => prev.filter((r) => r.code !== removed.code));
          setDetail(null);
          mockAction(`${removed.name} deleted`, {
            undo: () => setRows((prev) => [...prev, removed]),
          });
        }}
      />
    </PageBody>
  );
}
