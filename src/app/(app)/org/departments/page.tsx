"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building, ChevronDown, ChevronRight, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { TENANT } from "@/mock/org";
import { EMPLOYEES, employeeName } from "@/mock/employees";
import { COST_CENTRE_ROWS, DEPARTMENT_ROWS, type DepartmentRow } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { EmployeeLink } from "@/components/org/bits";
import { MutedCell, NumCell } from "@/components/data-table";
import { Section } from "@/components/shell/page";
import { Avatar, Badge } from "@/components/ui/primitives";

export default function DepartmentsPage() {
  const [rows, setRows] = React.useState<DepartmentRow[]>(DEPARTMENT_ROWS);
  const [focus, setFocus] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const divisions = rows.filter((r) => r.parentId === null);
  const childrenOf = (id: string) => rows.filter((r) => r.parentId === id);
  const total = divisions.reduce((a, d) => a + d.headcount, 0);

  const fields = React.useMemo<MasterField[]>(
    () => [
      { name: "id", label: "Code", required: true, lockOnEdit: true, placeholder: "QA", pattern: { re: /^[A-Z]{2,5}$/, message: "2–5 uppercase letters." } },
      { name: "name", label: "Department name", required: true },
      {
        name: "parentId",
        label: "Parent",
        kind: "select",
        required: true,
        options: [{ value: "none", label: "— Top-level division —" }, ...rows.filter((r) => r.isDivision).map((r) => ({ value: r.id, label: r.name }))],
      },
      { name: "headCode", label: "Department head", kind: "select", required: true, options: EMPLOYEES.filter((e) => e.level <= 2).map((e) => ({ value: e.code, label: `${e.name} · ${e.designation}` })) },
      {
        name: "costCentre",
        label: "Cost centre",
        kind: "select",
        required: true,
        options: COST_CENTRE_ROWS.map((c) => ({ value: c.id, label: `${c.id} · ${c.name}` })),
        hint: "Salary cost for everyone in this department posts here.",
      },
    ],
    [rows],
  );

  const columns = React.useMemo<ColumnDef<DepartmentRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Department",
        cell: ({ row }) => (
          <div className={cn("min-w-0", !row.original.isDivision && "pl-3")}>
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              {row.original.name}
              {row.original.isDivision && <Badge variant="soft">Division</Badge>}
            </p>
            <p className="tnum text-[11px] text-muted-foreground">{row.original.id}</p>
          </div>
        ),
      },
      {
        id: "parent",
        header: "Parent",
        accessorFn: (r) => (r.parentId ? rows.find((x) => x.id === r.parentId)?.name ?? r.parentId : TENANT.shortName),
        cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell>,
      },
      { id: "head", header: "Head", accessorFn: (r) => employeeName(r.headCode), cell: ({ row }) => <EmployeeLink code={row.original.headCode} /> },
      { accessorKey: "headcount", header: "Headcount", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "costCentre", header: "Cost centre", cell: ({ getValue }) => <span className="tnum text-xs">{getValue() as string}</span> },
    ],
    [rows],
  );

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <MasterTable<DepartmentRow>
      menuKey="org.departments"
      title="Departments"
      description="Divisions and departments with their head, headcount and cost centre. Headcounts are counted live from the employee directory."
      noun="department"
      plural="departments"
      icon={Network}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={fields}
      searchKeys={["name", "id", "costCentre"]}
      filter={(r) => !focus || r.id === focus || r.parentId === focus}
      uniqueField={{ name: "id", get: (r) => r.id, message: "That department code is already used." }}
      deactivateWarning={(r) =>
        r.headcount ? `${r.headcount} employees are in ${r.name}. Move them to another department before it disappears from pickers.` : undefined
      }
      toValues={(r) => ({
        id: r?.id ?? "",
        name: r?.name ?? "",
        parentId: r ? r.parentId ?? "none" : "TECH",
        headCode: r?.headCode ?? "",
        costCentre: r?.costCentre ?? "",
      })}
      fromValues={(v, existing) => ({
        id: v.id.toUpperCase(),
        name: v.name,
        parentId: v.parentId === "none" ? null : v.parentId,
        headCode: v.headCode,
        headcount: existing?.headcount ?? 0,
        costCentre: v.costCentre,
        isDivision: v.parentId === "none",
      })}
    >
      <Section
        title="Hierarchy"
        description={`${TENANT.name} · ${num(total)} employees · select a node to filter the table`}
        actions={
          focus ? (
            <button type="button" onClick={() => setFocus(null)} className="text-xs font-medium text-primary hover:underline">
              Clear filter
            </button>
          ) : undefined
        }
      >
        <div role="tree" aria-label="Department hierarchy" className="flex flex-col gap-1">
          <div className="flex items-center gap-2 rounded-md bg-subtle px-2 py-1.5">
            <Building className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold">{TENANT.name}</span>
            <span className="tnum ml-auto text-xs text-muted-foreground">{num(total)} people</span>
          </div>
          <div className="grid grid-cols-1 gap-2 pl-3 md:grid-cols-3">
            {divisions.map((d) => {
              const open = !collapsed.has(d.id);
              const kids = childrenOf(d.id);
              return (
                <div key={d.id} role="treeitem" aria-expanded={open} aria-selected={focus === d.id} className="rounded-md border border-border">
                  <div className={cn("flex items-center gap-1.5 border-b border-border px-2 py-1.5", focus === d.id && "bg-primary-soft")}>
                    <button type="button" onClick={() => toggle(d.id)} aria-label={open ? `Collapse ${d.name}` : `Expand ${d.name}`} className="rounded p-0.5 text-muted-foreground hover:bg-muted">
                      {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button>
                    <button type="button" onClick={() => setFocus(focus === d.id ? null : d.id)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold">{d.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {employeeName(d.headCode)} · {d.costCentre}
                      </p>
                    </button>
                    <span className="tnum text-xs font-semibold">{num(d.headcount)}</span>
                  </div>
                  {open && (
                    <ul role="group" className="flex flex-col p-1">
                      {kids.map((k) => (
                        <li key={k.id} role="treeitem" aria-selected={focus === k.id}>
                          <button
                            type="button"
                            onClick={() => setFocus(focus === k.id ? null : k.id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-muted",
                              focus === k.id && "bg-primary-soft",
                              !k.active && "opacity-60",
                            )}
                          >
                            <Avatar name={employeeName(k.headCode)} size={20} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">{k.name}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{employeeName(k.headCode)}</span>
                            </span>
                            <span className="tnum text-xs text-muted-foreground">{num(k.headcount)}</span>
                          </button>
                        </li>
                      ))}
                      {!kids.length && <li className="px-1.5 py-1 text-[11px] text-muted-foreground">No departments yet</li>}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    </MasterTable>
  );
}
