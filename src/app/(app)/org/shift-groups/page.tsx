"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Layers3 } from "lucide-react";
import { num } from "@/lib/format";
import { BRANCHES, branchById } from "@/mock/org";
import { SHIFT_GROUP_ROWS, SHIFT_ROWS, type ShiftGroupRow } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { ShiftChip } from "@/components/org/bits";
import { MutedCell, NumCell } from "@/components/data-table";
import { Badge } from "@/components/ui/primitives";

const ROTATIONS: ShiftGroupRow["rotation"][] = ["Fixed", "Weekly", "Fortnightly"];

export default function ShiftGroupsPage() {
  const [rows, setRows] = React.useState<ShiftGroupRow[]>(SHIFT_GROUP_ROWS);

  const fields = React.useMemo<MasterField[]>(
    () => [
      { name: "name", label: "Group name", required: true, wide: true },
      { name: "primaryShift", label: "Primary shift", kind: "select", required: true, options: SHIFT_ROWS.filter((s) => s.active).map((s) => ({ value: s.id, label: `${s.name} (${s.start}–${s.end})` })) },
      {
        name: "extraShifts",
        label: "Rotates with (codes)",
        placeholder: "SUP-M, SUP-N",
        hint: "Comma-separated shift codes the group rotates through.",
        pattern: { re: /^([A-Z0-9-]+)(\s*,\s*[A-Z0-9-]+)*$/, message: "Use shift codes separated by commas." },
      },
      { name: "rotation", label: "Rotation", kind: "select", required: true, options: ROTATIONS.map((r) => ({ value: r, label: r })) },
      { name: "branchId", label: "Branch", kind: "select", required: true, options: BRANCHES.map((b) => ({ value: b.id, label: b.name })) },
      { name: "description", label: "Description", kind: "textarea" },
    ],
    [],
  );

  const columns = React.useMemo<ColumnDef<ShiftGroupRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Shift group",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[280px]">
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.description}</p>
          </div>
        ),
      },
      {
        id: "shifts",
        header: "Shifts",
        accessorFn: (r) => r.shiftIds.join(", "),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.shiftIds.map((s) => (
              <ShiftChip key={s} id={s} compact />
            ))}
          </div>
        ),
      },
      { accessorKey: "rotation", header: "Rotation", cell: ({ getValue }) => <Badge variant={getValue() === "Fixed" ? "muted" : "soft"}>{getValue() as string}</Badge> },
      { id: "branch", header: "Branch", accessorFn: (r) => branchById(r.branchId)?.name ?? r.branchId, cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "members", header: "Members", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
    ],
    [],
  );

  return (
    <MasterTable<ShiftGroupRow>
      menuKey="org.shift_groups"
      title="Shift Groups"
      description="Bundles of shifts that rotate together. The roster board and roster templates are built per group, so a rotation rule is defined once."
      noun="shift group"
      plural="shift groups"
      icon={Layers3}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={fields}
      dialogSize="lg"
      searchKeys={["name", "description"]}
      uniqueField={{ name: "name", get: (r) => r.name, message: "A group with this name already exists." }}
      deactivateWarning={(r) => (r.members ? `${r.members} employees are rostered through this group.` : undefined)}
      toValues={(r) => ({
        name: r?.name ?? "",
        primaryShift: r?.shiftIds[0] ?? "GEN",
        extraShifts: r?.shiftIds.slice(1).join(", ") ?? "",
        rotation: r?.rotation ?? "Fixed",
        branchId: r?.branchId ?? "BLR",
        description: r?.description ?? "",
      })}
      fromValues={(v, existing, all) => ({
        id: existing?.id ?? `SG-${String(all.length + 1).padStart(2, "0")}`,
        name: v.name,
        shiftIds: [v.primaryShift, ...v.extraShifts.split(",").map((s) => s.trim().toUpperCase()).filter((s) => s && s !== v.primaryShift)],
        rotation: v.rotation as ShiftGroupRow["rotation"],
        branchId: v.branchId,
        members: existing?.members ?? 0,
        description: v.description,
      })}
    />
  );
}
