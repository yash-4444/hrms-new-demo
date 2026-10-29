"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MapPin, TriangleAlert } from "lucide-react";
import { fmtDate, num } from "@/lib/format";
import { EMPLOYEES } from "@/mock/employees";
import { BRANCH_ROWS, COMPANIES, type BranchRow } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { EmployeeLink } from "@/components/org/bits";
import { MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Alert, Badge } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";

const TIMEZONES = ["Asia/Kolkata", "America/New_York"];
const STATES = ["Karnataka", "Maharashtra", "Telangana", "Tamil Nadu", "Delhi", "New Jersey", "New York"];

export default function BranchesPage() {
  const [rows, setRows] = React.useState<BranchRow[]>(BRANCH_ROWS);
  const [company, setCompany] = React.useState("all");
  const total = rows.reduce((a, b) => a + b.headcount, 0);

  const fields = React.useMemo<MasterField[]>(
    () => [
      { name: "id", label: "Branch code", required: true, lockOnEdit: true, placeholder: "CHN", pattern: { re: /^[A-Z]{3}$/, message: "Use a 3-letter uppercase code, e.g. CHN." } },
      { name: "name", label: "Branch name", required: true, placeholder: "Chennai Delivery Centre" },
      { name: "companyId", label: "Company", kind: "select", required: true, options: COMPANIES.map((c) => ({ value: c.id, label: c.name })) },
      { name: "city", label: "City", required: true },
      { name: "state", label: "State", kind: "select", required: true, options: STATES.map((s) => ({ value: s, label: s })) },
      { name: "timezone", label: "Timezone", kind: "select", required: true, options: TIMEZONES.map((t) => ({ value: t, label: t })), hint: "Stamped on every attendance row at write time." },
      { name: "headCode", label: "Branch head", kind: "select", required: true, options: EMPLOYEES.filter((e) => e.level <= 2).map((e) => ({ value: e.code, label: `${e.name} · ${e.code}` })) },
      { name: "phone", label: "Reception phone", placeholder: "+91 44 4000 0000" },
      { name: "address", label: "Address", kind: "textarea", required: true },
    ],
    [],
  );

  const columns = React.useMemo<ColumnDef<BranchRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Branch",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="tnum text-[11px] text-muted-foreground">
              {row.original.id} · {row.original.city}, {row.original.state}
            </p>
          </div>
        ),
      },
      {
        id: "company",
        header: "Company",
        accessorFn: (r) => COMPANIES.find((c) => c.id === r.companyId)?.name ?? r.companyId,
        cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell>,
      },
      {
        accessorKey: "country",
        header: "Country",
        cell: ({ row }) =>
          row.original.id === "HYD" ? (
            <Badge variant="outline" className="border-warning/40 text-warning-fg">
              <TriangleAlert className="size-3" aria-hidden />
              Not set
            </Badge>
          ) : (
            row.original.country
          ),
      },
      { accessorKey: "timezone", header: "Timezone", cell: ({ getValue }) => <span className="text-xs">{getValue() as string}</span> },
      { id: "head", header: "Branch head", accessorFn: (r) => r.headCode, cell: ({ row }) => <EmployeeLink code={row.original.headCode} /> },
      { accessorKey: "headcount", header: "Headcount", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "ptState", header: "Professional tax", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "opened", header: "Opened", cell: ({ getValue }) => <span className="tnum text-xs">{fmtDate(getValue() as string)}</span> },
    ],
    [],
  );

  return (
    <MasterTable<BranchRow>
      menuKey="org.branches"
      title="Branches"
      description="Physical offices. A branch fixes the country, timezone, holiday calendar and professional-tax state for everyone mapped to it."
      noun="branch"
      plural="branches"
      icon={MapPin}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={fields}
      searchKeys={["name", "city", "state", "id"]}
      filter={(r) => company === "all" || r.companyId === company}
      filters={
        <FilterSelect label="Company" value={company} onValueChange={setCompany} options={COMPANIES.map((c) => ({ value: c.id, label: c.name }))} width="w-[220px]" />
      }
      uniqueField={{ name: "id", get: (r) => r.id, message: "That branch code is already in use." }}
      deactivateWarning={(r) => (r.headcount ? `${r.headcount} employees are still mapped to ${r.name}. Transfer them first or they will fail work-context resolution.` : undefined)}
      toValues={(r) => ({
        id: r?.id ?? "",
        name: r?.name ?? "",
        companyId: r?.companyId ?? "STL-IN",
        city: r?.city ?? "",
        state: r?.state ?? "",
        timezone: r?.timezone ?? "Asia/Kolkata",
        headCode: r?.headCode ?? "",
        phone: r?.phone ?? "",
        address: r?.address ?? "",
      })}
      fromValues={(v, existing) => ({
        id: v.id.toUpperCase(),
        name: v.name,
        companyId: v.companyId,
        city: v.city,
        state: v.state,
        country: ["New Jersey", "New York"].includes(v.state) ? "United States" : "India",
        timezone: v.timezone,
        address: v.address,
        headCode: v.headCode,
        headcount: existing?.headcount ?? 0,
        phone: v.phone,
        opened: existing?.opened ?? "2026-09-16",
        ptState: ["New Jersey", "New York"].includes(v.state) ? "— (US payroll)" : `${v.state} PT`,
      })}
    >
      <StatRow cols={4}>
        <StatTile label="Branches" value={num(rows.filter((r) => r.active).length)} hint={`${rows.length} configured`} icon={MapPin} />
        <StatTile label="Employees mapped" value={num(total)} hint="Same 340 as the directory" href="/employees" />
        <StatTile label="Largest" value={rows.slice().sort((a, b) => b.headcount - a.headcount)[0]?.name ?? "—"} hint={`${num(rows.slice().sort((a, b) => b.headcount - a.headcount)[0]?.headcount ?? 0)} employees`} />
        <StatTile label="Timezones" value={num(new Set(rows.map((r) => r.timezone)).size)} hint="IST and US Eastern" />
      </StatRow>
      <Alert tone="warning" icon={TriangleAlert} title="Hyderabad Satellite has no country set">
        Its 3 employees cannot resolve a holiday calendar and will fail closed (HTTP 422) on punch-in until a country is mapped.
        Fix it in Admin › Work calendars.
      </Alert>
    </MasterTable>
  );
}
