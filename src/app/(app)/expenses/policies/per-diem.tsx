"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Pencil } from "lucide-react";
import { inr } from "@/lib/format";
import { EXP_GRADE_BANDS, EXP_PER_DIEM, type ExpPerDiem } from "@/mock/finance-expense";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { DialogBody, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field, Input } from "@/components/ui/primitives";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { Gated } from "@/components/shell/page";
import { GuardedDialog } from "@/components/finance/kit";

/* ============================================================================
   Per-diem rates by city tier and grade band. International is in USD and
   converted at the RBI reference rate on the travel date.
   ========================================================================== */

const money = (row: ExpPerDiem, v: number) => (row.currency === "USD" ? `US$${v}` : inr(v, { decimals: false }));

const rate = z.number({ error: "Enter a rate" }).int("Whole units only").positive("Must be above zero");
const schema = z.object({ g12: rate, g34: rate, g5: rate, incidentals: z.number({ error: "Enter an amount" }).int().min(0) });
type Values = z.infer<typeof schema>;

export function PerDiemTab() {
  const [rows, setRows] = React.useState<ExpPerDiem[]>(EXP_PER_DIEM);
  const [editing, setEditing] = React.useState<ExpPerDiem | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { errors } = form.formState;

  const open = (r: ExpPerDiem) => {
    form.reset({ g12: r.rates["G1–G2"], g34: r.rates["G3–G4"], g5: r.rates["G5+"], incidentals: r.incidentals });
    setEditing(r);
  };

  const save = form.handleSubmit((v) => {
    if (!editing) return;
    const before = rows;
    setRows((prev) =>
      prev.map((r) =>
        r.id === editing.id
          ? { ...r, rates: { "G1–G2": v.g12, "G3–G4": v.g34, "G5+": v.g5 }, incidentals: v.incidentals }
          : r,
      ),
    );
    mockAction(`${editing.tier} per-diem updated`, {
      description: "Applies to trips starting from tomorrow. Trips already approved keep the rate they were approved at.",
      undo: () => setRows(before),
    });
    setEditing(null);
  });

  const columns = React.useMemo<ColumnDef<ExpPerDiem, unknown>[]>(
    () => [
      {
        accessorKey: "tier",
        header: "City tier",
        cell: ({ row }) => (
          <div className="max-w-[320px]">
            <p className="font-medium">{row.original.tier}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.cities}</p>
          </div>
        ),
      },
      ...EXP_GRADE_BANDS.map<ColumnDef<ExpPerDiem, unknown>>((b) => ({
        id: b,
        header: `${b} / day`,
        cell: ({ row }) => <NumCell>{money(row.original, row.original.rates[b])}</NumCell>,
      })),
      {
        accessorKey: "incidentals",
        header: "Incidentals / day",
        cell: ({ row }) => <NumCell>{money(row.original, row.original.incidentals)}</NumCell>,
      },
      { accessorKey: "currency", header: "Currency", cell: ({ row }) => <MutedCell>{row.original.currency}</MutedCell> },
      {
        id: "edit",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <Gated menuKey="workplace.expense_policies" action="E">
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${row.original.tier} per-diem`} onClick={() => open(row.original)}>
              <Pencil />
            </Button>
          </Gated>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <>
      <DataTable<ExpPerDiem>
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        exportName="expense-per-diem"
        emptyIcon={MapPin}
        emptyTitle="No per-diem rates"
        emptyDescription="Add a city tier to start paying daily allowances on approved trips."
      />
      <GuardedDialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)} dirty={form.formState.isDirty} size="sm">
        <DialogHeader>
          <DialogTitle>Edit {editing?.tier} per-diem</DialogTitle>
          <DialogDescription>Daily allowance in {editing?.currency} per grade band, plus incidentals.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save}>
          <DialogBody className="grid gap-3 sm:grid-cols-2">
            <Field label="G1–G2" htmlFor="pd-g12" required error={errors.g12?.message}>
              <Input id="pd-g12" type="number" className="tnum" {...form.register("g12", { valueAsNumber: true })} />
            </Field>
            <Field label="G3–G4" htmlFor="pd-g34" required error={errors.g34?.message}>
              <Input id="pd-g34" type="number" className="tnum" {...form.register("g34", { valueAsNumber: true })} />
            </Field>
            <Field label="G5+" htmlFor="pd-g5" required error={errors.g5?.message}>
              <Input id="pd-g5" type="number" className="tnum" {...form.register("g5", { valueAsNumber: true })} />
            </Field>
            <Field label="Incidentals" htmlFor="pd-inc" required error={errors.incidentals?.message}>
              <Input id="pd-inc" type="number" className="tnum" {...form.register("incidentals", { valueAsNumber: true })} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save rates</Button>
          </DialogFooter>
        </form>
      </GuardedDialog>
    </>
  );
}
