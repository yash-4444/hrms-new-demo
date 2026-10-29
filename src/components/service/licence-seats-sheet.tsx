"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Clock, UserMinus, UserPlus, Users } from "lucide-react";
import { fmtDate, inr } from "@/lib/format";
import { employeeByCode, employeeName } from "@/mock/employees";
import { DEMO_TODAY } from "@/mock/org";
import type { Licence, Seat } from "@/mock/service";
import { mockAction } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import { ConfirmDialog, Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { Gated } from "@/components/shell/page";
import { ToneChip } from "./kit";

const assignSchema = z.object({
  code: z.string().trim().min(1, "Enter an employee code").refine((c) => !!employeeByCode(c.toUpperCase()), "No employee with that code"),
});

/** Seat roster for one licence: who holds a seat, when they last used it, assign / unassign. */
export function LicenceSeatsSheet({
  licence,
  seats,
  onOpenChange,
  onAssign,
  onUnassign,
}: {
  licence: Licence | null;
  seats: Seat[];
  onOpenChange: (v: boolean) => void;
  onAssign: (code: string) => void;
  onUnassign: (seat: Seat) => void;
}) {
  const [revoking, setRevoking] = React.useState<Seat | null>(null);
  const free = licence ? licence.seatsPurchased - seats.length : 0;
  const { register, handleSubmit, reset, setError, formState } = useForm<{ code: string }>({
    resolver: zodResolver(assignSchema),
    defaultValues: { code: "" },
  });

  const submit = handleSubmit(({ code }) => {
    const c = code.toUpperCase();
    if (seats.some((s) => s.employeeCode === c)) {
      setError("code", { message: `${employeeName(c)} already holds a seat` });
      return;
    }
    onAssign(c);
    reset({ code: "" });
  });

  const columns = React.useMemo<ColumnDef<Seat, unknown>[]>(
    () => [
      { accessorKey: "employeeCode", header: "Seat holder", cell: ({ row }) => <span className="flex flex-col"><span className="font-medium">{employeeName(row.original.employeeCode)}</span><span className="font-mono text-[10px] text-muted-foreground">{row.original.employeeCode}</span></span> },
      { accessorKey: "assignedOn", header: "Assigned", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.assignedOn)}</span> },
      { accessorKey: "lastActive", header: "Last active", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.lastActive)}</span> },
      {
        accessorKey: "idleDays",
        header: "Idle",
        cell: ({ row }) => (row.original.idleDays > 60 ? <ToneChip tone="warning" icon={Clock}>{row.original.idleDays} days</ToneChip> : <NumCell>{row.original.idleDays} d</NumCell>),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Gated menuKey="workplace.licences" action="E">
            <Button size="icon-sm" variant="ghost" aria-label={`Unassign ${employeeName(row.original.employeeCode)}`} onClick={() => setRevoking(row.original)}>
              <UserMinus />
            </Button>
          </Gated>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <Sheet open={!!licence} onOpenChange={onOpenChange}>
        <SheetContent width="sm:max-w-2xl">
          {licence && (
            <>
              <SheetHeader>
                <SheetTitle>{licence.product} · {licence.edition}</SheetTitle>
                <SheetDescription>
                  {seats.length} of {licence.seatsPurchased} seats assigned · {free} free · {inr(licence.costPerSeat, { decimals: false })} per seat a year
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-3 overflow-y-auto">
                <form onSubmit={submit} noValidate className="flex items-end gap-2">
                  <Field label="Assign a seat to" htmlFor="seat-code" error={formState.errors.code?.message} className="flex-1">
                    <Input id="seat-code" placeholder="Employee code, e.g. STL-0142" aria-invalid={!!formState.errors.code} {...register("code")} />
                  </Field>
                  <Gated menuKey="workplace.licences" action="C">
                    <Button type="submit" size="sm" disabled={free <= 0}>
                      <UserPlus /> Assign
                    </Button>
                  </Gated>
                </form>
                <DataTable
                  columns={columns}
                  data={[...seats].sort((a, b) => b.idleDays - a.idleDays)}
                  getRowId={(s) => s.id}
                  searchKeys={["employeeCode"]}
                  searchPlaceholder="Search employee code…"
                  exportName={`${licence.id.toLowerCase()}-seats`}
                  pageSize={12}
                  dense
                  rowTone={(s) => (s.idleDays > 60 ? "warning" : undefined)}
                  emptyIcon={Users}
                  emptyTitle="No seats assigned"
                  emptyDescription="Assign a seat above; it is provisioned through single sign-on within minutes."
                />
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Unassign ${revoking ? employeeName(revoking.employeeCode) : ""}?`}
        description={`Their ${licence?.product ?? ""} access is removed at the next SSO sync. Files they own are transferred to their manager.`}
        confirmLabel="Unassign seat"
        destructive
        onConfirm={() => {
          if (!revoking || !licence) return;
          onUnassign(revoking);
          mockAction(`Seat reclaimed from ${employeeName(revoking.employeeCode)}`, {
            description: `${licence.product} · effective ${fmtDate(DEMO_TODAY)}.`,
          });
        }}
      />
    </>
  );
}
