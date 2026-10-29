"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Users } from "lucide-react";
import { num } from "@/lib/format";
import { BRANCHES, DEPARTMENTS, branchById, deptName } from "@/mock/org";
import { EMPLOYEES, employeeName } from "@/mock/employees";
import { TEAM_ROWS, type TeamRow } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { EmployeeLink } from "@/components/org/bits";
import { MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { FilterSelect } from "@/components/ui/overlays";

type Row = TeamRow & { leadName: string };

export default function TeamsPage() {
  const [teams, setTeams] = React.useState<TeamRow[]>(TEAM_ROWS);
  const [dept, setDept] = React.useState("all");
  const [branch, setBranch] = React.useState("all");

  /* the lead's name is folded into the row so the search box finds it */
  const rows = React.useMemo<Row[]>(() => teams.map((t) => ({ ...t, leadName: employeeName(t.leadCode) })), [teams]);
  const setRows: React.Dispatch<React.SetStateAction<Row[]>> = (next) =>
    setTeams((cur) => (typeof next === "function" ? next(cur.map((t) => ({ ...t, leadName: employeeName(t.leadCode) }))) : next));

  const fields = React.useMemo<MasterField[]>(
    () => [
      { name: "name", label: "Team name", required: true, placeholder: "Payments Platform" },
      { name: "departmentId", label: "Department", kind: "select", required: true, options: DEPARTMENTS.map((d) => ({ value: d.id, label: d.name })) },
      { name: "branchId", label: "Home branch", kind: "select", required: true, options: BRANCHES.map((b) => ({ value: b.id, label: b.name })) },
      {
        name: "leadCode",
        label: "Team lead",
        kind: "select",
        required: true,
        options: EMPLOYEES.filter((e) => e.level <= 2).map((e) => ({ value: e.code, label: `${e.name} · ${e.designation}` })),
      },
      { name: "channel", label: "Slack / Teams channel", placeholder: "#team-payments", pattern: { re: /^#[a-z0-9-]+$/, message: "Start with # and use lower-case letters, numbers and hyphens." } },
    ],
    [],
  );

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Team",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="tnum text-[11px] text-muted-foreground">
              {row.original.id} · {row.original.channel}
            </p>
          </div>
        ),
      },
      { id: "dept", header: "Department", accessorFn: (r) => deptName(r.departmentId), cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { id: "branch", header: "Branch", accessorFn: (r) => branchById(r.branchId)?.city ?? r.branchId },
      { accessorKey: "leadName", header: "Lead", cell: ({ row }) => <EmployeeLink code={row.original.leadCode} /> },
      { accessorKey: "members", header: "Direct members", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
    ],
    [],
  );

  const members = teams.reduce((a, t) => a + t.members, 0);

  return (
    <MasterTable<Row>
      menuKey="org.teams"
      title="Teams"
      description="Working teams inside departments. Membership follows the reporting line — a team is its lead's direct reports — so it never drifts from the org chart."
      noun="team"
      plural="teams"
      icon={Users}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={fields}
      searchKeys={["name", "leadName", "channel"]}
      filter={(r) => (dept === "all" || r.departmentId === dept) && (branch === "all" || r.branchId === branch)}
      filters={
        <>
          <FilterSelect label="Department" value={dept} onValueChange={setDept} options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))} width="w-[190px]" />
          <FilterSelect label="Branch" value={branch} onValueChange={setBranch} options={BRANCHES.map((b) => ({ value: b.id, label: b.city }))} />
        </>
      }
      uniqueField={{ name: "name", get: (r) => r.name, message: "A team with this name already exists." }}
      deactivateWarning={(r) => (r.members ? `${r.members} people sit in this team. They stay with ${r.leadName}; only the team label is retired.` : undefined)}
      toValues={(r) => ({
        name: r?.name ?? "",
        departmentId: r?.departmentId ?? "ENG",
        branchId: r?.branchId ?? "BLR",
        leadCode: r?.leadCode ?? "",
        channel: r?.channel ?? "",
      })}
      fromValues={(v, existing, all) => ({
        id: existing?.id ?? `TM-${String(all.length + 1).padStart(2, "0")}`,
        name: v.name,
        departmentId: v.departmentId,
        branchId: v.branchId,
        leadCode: v.leadCode,
        leadName: employeeName(v.leadCode),
        members: existing?.members ?? EMPLOYEES.filter((e) => e.managerCode === v.leadCode).length,
        channel: v.channel || `#team-${v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      })}
    >
      <StatRow cols={3}>
        <StatTile label="Teams" value={num(teams.length)} icon={Users} hint={`${DEPARTMENTS.length} departments`} />
        <StatTile label="People in a team" value={num(members)} hint="Direct reports of a team lead" />
        <StatTile label="Average team size" value={(members / Math.max(1, teams.length)).toFixed(1)} hint="Direct members per lead" />
      </StatRow>
    </MasterTable>
  );
}
