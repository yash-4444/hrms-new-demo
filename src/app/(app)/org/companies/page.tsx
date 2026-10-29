"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building } from "lucide-react";
import { num } from "@/lib/format";
import { branchById } from "@/mock/org";
import { COMPANIES, type Company } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Badge } from "@/components/ui/primitives";

const FIELDS: MasterField[] = [
  { name: "name", label: "Display name", required: true },
  { name: "legalName", label: "Legal name", required: true },
  {
    name: "country",
    label: "Country of incorporation",
    kind: "select",
    required: true,
    options: [
      { value: "IN", label: "India" },
      { value: "US", label: "United States" },
    ],
    lockOnEdit: true,
  },
  { name: "currency", label: "Payroll currency", kind: "select", required: true, options: [{ value: "INR", label: "INR" }, { value: "USD", label: "USD" }] },
  { name: "registration", label: "Registration no.", required: true, placeholder: "CIN U72900KA2016PTC094218" },
  { name: "taxId", label: "Tax identifiers", required: true, placeholder: "PAN · TAN / EIN" },
  {
    name: "gstin",
    label: "GSTIN",
    placeholder: "29AAFCS4821K1ZP",
    pattern: { re: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, message: "Enter a valid 15-character GSTIN." },
  },
  { name: "fyStart", label: "Financial year starts", kind: "select", required: true, options: [{ value: "April", label: "April" }, { value: "January", label: "January" }] },
  { name: "address", label: "Registered address", kind: "textarea", required: true },
];

export default function CompaniesPage() {
  const [rows, setRows] = React.useState<Company[]>(COMPANIES);
  const total = rows.reduce((a, c) => a + c.headcount, 0);

  const columns = React.useMemo<ColumnDef<Company, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Company",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              {row.original.name}
              {row.original.isPrimary && <Badge variant="soft">Primary</Badge>}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.legalName}</p>
          </div>
        ),
      },
      { accessorKey: "countryName", header: "Country" },
      {
        accessorKey: "registration",
        header: "Registration",
        cell: ({ row }) => (
          <div className="tnum text-xs leading-tight">
            <p>{row.original.registration}</p>
            <p className="text-muted-foreground">{row.original.taxId}</p>
          </div>
        ),
      },
      { accessorKey: "gstin", header: "GSTIN", cell: ({ getValue }) => <span className="tnum text-xs">{(getValue() as string) ?? "—"}</span> },
      {
        id: "branches",
        header: "Branches",
        accessorFn: (c) => c.branchIds.map((b) => branchById(b)?.name ?? b).join(", "),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.branchIds.map((b) => (
              <Badge key={b} variant="muted">
                {branchById(b)?.city ?? b}
              </Badge>
            ))}
          </div>
        ),
      },
      { accessorKey: "headcount", header: "Headcount", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { id: "fy", header: "Currency · FY", accessorFn: (c) => `${c.currency} · ${c.fyStart}` },
    ],
    [],
  );

  return (
    <MasterTable<Company>
      menuKey="org.companies"
      title="Companies"
      description="Legal entities on this tenant. Each branch belongs to exactly one company, which decides statutory registrations, payroll currency and the financial year."
      noun="company"
      plural="companies"
      icon={Building}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={FIELDS}
      searchKeys={["name", "legalName", "registration", "countryName"]}
      uniqueField={{ name: "name", get: (r) => r.name, message: "A company with this name already exists." }}
      deactivateWarning={(r) => (r.headcount ? `${r.headcount} employees are employed by ${r.name}. Move them before payroll stops recognising it.` : undefined)}
      toValues={(r) => ({
        name: r?.name ?? "",
        legalName: r?.legalName ?? "",
        country: r?.country ?? "IN",
        currency: r?.currency ?? "INR",
        registration: r?.registration ?? "",
        taxId: r?.taxId ?? "",
        gstin: r?.gstin ?? "",
        fyStart: r?.fyStart ?? "April",
        address: r?.address ?? "",
      })}
      fromValues={(v, existing, all) => ({
        id: existing?.id ?? `STL-${v.country}${all.filter((c) => c.country === v.country).length + 1}`,
        name: v.name,
        legalName: v.legalName,
        country: v.country,
        countryName: v.country === "IN" ? "India" : "United States",
        registration: v.registration,
        taxId: v.taxId,
        gstin: v.gstin || null,
        address: v.address,
        currency: v.currency,
        fyStart: v.fyStart,
        branchIds: existing?.branchIds ?? [],
        headcount: existing?.headcount ?? 0,
        isPrimary: existing?.isPrimary ?? false,
      })}
    >
      <StatRow cols={3}>
        <StatTile label="Legal entities" value={num(rows.length)} hint="India Pvt Ltd + US Inc." icon={Building} />
        <StatTile label="Employees across entities" value={num(total)} hint="Reconciles with the directory" href="/employees" />
        <StatTile label="Countries" value={num(new Set(rows.map((r) => r.country)).size)} hint="India · United States" />
      </StatRow>
    </MasterTable>
  );
}
