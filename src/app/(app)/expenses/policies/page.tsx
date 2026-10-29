"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FolderCog, Pencil, Plus } from "lucide-react";
import { fmtDate, inr } from "@/lib/format";
import { EXP_GRADE_BANDS, EXP_POLICY_LIMITS, type ExpPolicyLimit } from "@/mock/finance-expense";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { LimitDialog } from "./limit-dialog";
import { PerDiemTab } from "./per-diem";
import { ChainTab } from "./chain";

/* ============================================================================
   /expenses/policies — the rules every claim is checked against: category caps
   by grade band and city tier, per-diem rates and the approval chain. Edited by
   Finance and HR; every change is effective for new claims only.
   ========================================================================== */

const money = (v: number) => inr(v, { decimals: false });

export default function ExpensePoliciesPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [limits, setLimits] = React.useState<ExpPolicyLimit[]>(EXP_POLICY_LIMITS);
  const [editing, setEditing] = React.useState<ExpPolicyLimit | null>(null);
  const [creating, setCreating] = React.useState(false);

  const save = (next: Omit<ExpPolicyLimit, "id" | "updatedOn" | "updatedBy">) => {
    const before = limits;
    const stamp = { updatedOn: "2026-09-16", updatedBy: persona.name };
    if (editing) {
      setLimits((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...next, ...stamp } : p)));
      mockAction(`${next.category} policy saved`, {
        description: "New caps apply to claim lines dated from tomorrow. Claims already submitted are checked against the old caps.",
        undo: () => setLimits(before),
      });
    } else {
      setLimits((prev) => [...prev, { ...next, ...stamp, id: `POL-${String(prev.length + 1).padStart(2, "0")}` }]);
      mockAction(`${next.category} added`, { description: "Employees can pick it on new claims right away.", undo: () => setLimits(before) });
    }
  };

  const columns = React.useMemo<ColumnDef<ExpPolicyLimit, unknown>[]>(
    () => [
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.category}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.basis}</p>
          </div>
        ),
      },
      ...EXP_GRADE_BANDS.map<ColumnDef<ExpPolicyLimit, unknown>>((b) => ({
        id: b,
        header: b,
        cell: ({ row }) => {
          const l = row.original.limits[b];
          return (
            <NumCell>
              {money(l.metro)}
              {row.original.tiered && <span className="block text-[11px] text-muted-foreground">{money(l.nonMetro)} non-metro</span>}
            </NumCell>
          );
        },
      })),
      {
        accessorKey: "receiptAbove",
        header: "Receipt needed",
        cell: ({ row }) => <MutedCell>{row.original.receiptAbove === 0 ? "Always" : `Above ${money(row.original.receiptAbove)}`}</MutedCell>,
      },
      {
        accessorKey: "preApproval",
        header: "Pre-approval",
        cell: ({ row }) => (row.original.preApproval ? <Badge variant="soft">Required</Badge> : <MutedCell>No</MutedCell>),
      },
      {
        accessorKey: "updatedOn",
        header: "Last changed",
        cell: ({ row }) => (
          <span className="text-xs">
            {fmtDate(row.original.updatedOn)}
            <span className="block text-[11px] text-muted-foreground">{row.original.updatedBy}</span>
          </span>
        ),
      },
      {
        id: "edit",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <Gated menuKey="workplace.expense_policies" action="E">
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${row.original.category}`} onClick={() => setEditing(row.original)}>
              <Pencil />
            </Button>
          </Gated>
        ),
      },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Expense policies"
        description="Caps by grade band and city tier, per-diem rates and the approval chain. Claims are checked against these the moment a line is added."
        actions={
          <Gated menuKey="workplace.expense_policies" action="C">
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> Add category
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <TableSkeleton />
      ) : (
        <Tabs defaultValue="limits">
          <TabsList>
            <TabsTrigger value="limits">Category limits</TabsTrigger>
            <TabsTrigger value="perdiem">Per-diem rates</TabsTrigger>
            <TabsTrigger value="chain">Approval chain</TabsTrigger>
          </TabsList>
          <TabsContent value="limits" className="mt-3">
            <DataTable<ExpPolicyLimit>
              columns={columns}
              data={limits}
              getRowId={(p) => p.id}
              searchKeys={["category", "basis"]}
              searchPlaceholder="Search categories…"
              exportName="expense-category-limits"
              emptyIcon={FolderCog}
              emptyTitle="No expense categories"
              emptyDescription="Add a category so employees can file claims against it."
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Metro caps shown first; stay, meals and local cabs carry a lower non-metro cap. G3–G4 metro is the reference cap
              quoted on the claim form.
            </p>
          </TabsContent>
          <TabsContent value="perdiem" className="mt-3">
            <PerDiemTab />
          </TabsContent>
          <TabsContent value="chain" className="mt-3">
            <ChainTab />
          </TabsContent>
        </Tabs>
      )}

      <LimitDialog
        open={creating || !!editing}
        policy={editing}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCreating(false);
          }
        }}
        onSave={save}
      />
    </PageBody>
  );
}
