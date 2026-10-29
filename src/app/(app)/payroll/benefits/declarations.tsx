"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BellRing, Check, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";
import { FBP_COMPONENTS, fbpComponent, type FbpDeclaration } from "@/mock/finance-loans";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { DataTable, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { StatusBadge } from "@/components/ui/status-badge";
import { Gated } from "@/components/shell/page";
import { MoneyCell, ReconcileCheck } from "@/components/finance/kit";

const SHORT: Record<string, string> = {
  fuel: "Fuel",
  telephone: "Telephone",
  meal: "Meals",
  lta: "LTA",
  books: "Books",
};

const columns: ColumnDef<FbpDeclaration, unknown>[] = [
  {
    accessorKey: "name",
    header: "Employee",
    cell: ({ row }) => (
      <PersonCell
        name={row.original.name}
        subtitle={`${row.original.employeeCode} · ${row.original.gradeId} · ${row.original.department}`}
      />
    ),
  },
  ...FBP_COMPONENTS.map<ColumnDef<FbpDeclaration, unknown>>((c) => ({
    id: c.id,
    accessorFn: (d) => d.lines[c.id],
    header: () => <span className="block text-right">{SHORT[c.id]}</span>,
    cell: ({ row }) => {
      const v = row.original.lines[c.id];
      const over = v > c.annualLimit;
      const body = (
        <NumCell className={cn(v === 0 && "text-muted-foreground", over && "font-semibold text-destructive-fg")}>
          {v === 0 ? "—" : inr(v, { decimals: false })}
        </NumCell>
      );
      return over ? (
        <Hint text={`Above the ${inr(c.annualLimit, { decimals: false })} annual limit — only the limit is tax-free`}>
          <span tabIndex={0}>{body}</span>
        </Hint>
      ) : (
        body
      );
    },
  })),
  {
    accessorKey: "total",
    header: () => <span className="block text-right">Declared</span>,
    cell: ({ row }) => <MoneyCell value={row.original.total} className="font-medium" />,
  },
  {
    accessorKey: "basket",
    header: () => <span className="block text-right">Basket</span>,
    cell: ({ row }) => (
      <MoneyCell value={row.original.basket} className={row.original.overBasket ? "text-warning-fg" : "text-muted-foreground"} />
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className="flex flex-col gap-0.5">
        <StatusBadge status={row.original.status} />
        {(row.original.overLimit.length > 0 || row.original.overBasket) && (
          <span className="text-[11px] text-destructive-fg">
            {row.original.overLimit.length > 0
              ? `Over limit: ${row.original.overLimit.map((id) => fbpComponent(id).name).join(", ")}`
              : "Exceeds basket"}
          </span>
        )}
      </span>
    ),
  },
];

export function DeclarationsTab({
  rows,
  onApprove,
}: {
  rows: FbpDeclaration[];
  onApprove: (codes: string[]) => void;
}) {
  const [status, setStatus] = React.useState("all");
  const [flag, setFlag] = React.useState("all");
  const data = rows.filter(
    (d) =>
      (status === "all" || d.status === status) &&
      (flag === "all" || (flag === "flagged") === (d.overLimit.length > 0 || d.overBasket)),
  );
  const componentSum = rows.reduce((s, d) => s + FBP_COMPONENTS.reduce((t, c) => t + d.lines[c.id], 0), 0);
  const declaredSum = rows.reduce((s, d) => s + d.total, 0);

  return (
    <div className="flex flex-col gap-3">
      <ReconcileCheck
        label="Declarations foot"
        leftLabel="Σ component columns"
        left={componentSum}
        rightLabel="Σ declared totals"
        right={declaredSum}
      />
      <DataTable<FbpDeclaration>
        columns={columns}
        data={data}
        getRowId={(d) => d.employeeCode}
        searchKeys={["name", "employeeCode", "department"]}
        searchPlaceholder="Search employee…"
        exportName="fbp-declarations-fy2026-27"
        enableSelection
        rowTone={(d) => (d.overLimit.length || d.overBasket ? "warning" : undefined)}
        emptyIcon={ClipboardList}
        emptyTitle="No declarations match"
        emptyDescription="Clear the status or flag filter to see every eligible employee."
        filters={
          <>
            <FilterSelect
              label="Status"
              value={status}
              onValueChange={setStatus}
              allLabel="All"
              width="w-[170px]"
              options={[
                { value: "not_started", label: "Not started" },
                { value: "draft", label: "Draft" },
                { value: "submitted", label: "Submitted" },
                { value: "approved", label: "Approved" },
              ]}
            />
            <FilterSelect
              label="Limits"
              value={flag}
              onValueChange={setFlag}
              allLabel="Any"
              width="w-[150px]"
              options={[
                { value: "flagged", label: "Over limit" },
                { value: "clean", label: "Within limits" },
              ]}
            />
          </>
        }
        bulkActions={(sel, clear) => {
          const approvable = sel.filter((d) => d.status === "submitted" && !d.overLimit.length && !d.overBasket);
          const remind = sel.filter((d) => d.status === "not_started" || d.status === "draft");
          return (
            <>
              <Gated menuKey="payroll.benefits" action="E">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!remind.length}
                  onClick={() => {
                    mockAction(`Reminder sent to ${remind.length} employee${remind.length === 1 ? "" : "s"}`, {
                      description: "Email and in-app nudge: the declaration window closes on 30 Sep 2026.",
                    });
                    clear();
                  }}
                >
                  <BellRing /> Remind {remind.length || ""}
                </Button>
              </Gated>
              <Gated menuKey="payroll.benefits" action="A">
                <Button
                  size="sm"
                  disabled={!approvable.length}
                  onClick={() => {
                    onApprove(approvable.map((d) => d.employeeCode));
                    clear();
                  }}
                >
                  <Check /> Approve {approvable.length || ""} within limits
                </Button>
              </Gated>
            </>
          );
        }}
      />
    </div>
  );
}
