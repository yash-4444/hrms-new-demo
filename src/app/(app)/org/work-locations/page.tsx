"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Building2, Home, LocateFixed, MapPinned, Shuffle } from "lucide-react";
import { num } from "@/lib/format";
import { BRANCHES, branchById } from "@/mock/org";
import { WORK_LOCATION_ROWS, type WorkLocationRow, type WorkLocationType } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Badge } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";

const TYPE_ICON: Record<WorkLocationType, React.ElementType> = { Office: Building2, Hybrid: Shuffle, Remote: Home };

const coord = { re: /^-?\d{1,3}\.\d{2,6}$/, message: "Decimal degrees, e.g. 12.9279" };

const FIELDS: MasterField[] = [
  { name: "name", label: "Location name", required: true, wide: true },
  { name: "type", label: "Type", kind: "select", required: true, options: (["Office", "Hybrid", "Remote"] as const).map((t) => ({ value: t, label: t })) },
  { name: "branchId", label: "Branch", kind: "select", options: [{ value: "none", label: "— none (remote) —" }, ...BRANCHES.map((b) => ({ value: b.id, label: b.name }))] },
  { name: "address", label: "Address", kind: "textarea", required: true },
  { name: "lat", label: "Latitude", pattern: coord },
  { name: "lng", label: "Longitude", pattern: coord },
  { name: "geofenceM", label: "Geo-fence radius (m)", kind: "number", min: 50, max: 2000, hint: "Mobile punch-in is accepted only inside this circle. Leave blank for remote." },
];

export default function WorkLocationsPage() {
  const [rows, setRows] = React.useState<WorkLocationRow[]>(WORK_LOCATION_ROWS);
  const [type, setType] = React.useState("all");
  const by = (t: WorkLocationType) => rows.filter((r) => r.type === t).reduce((a, r) => a + r.employees, 0);
  const total = rows.reduce((a, r) => a + r.employees, 0);

  const columns = React.useMemo<ColumnDef<WorkLocationRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Location",
        cell: ({ row }) => {
          const Icon = TYPE_ICON[row.original.type];
          return (
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{row.original.name}</p>
                <p className="tnum text-[11px] text-muted-foreground">{row.original.id}</p>
              </div>
            </div>
          );
        },
      },
      { accessorKey: "type", header: "Type", cell: ({ getValue }) => <Badge variant={getValue() === "Office" ? "soft" : "muted"}>{getValue() as string}</Badge> },
      { id: "branch", header: "Branch", accessorFn: (r) => (r.branchId ? branchById(r.branchId)?.city ?? r.branchId : "—") },
      { accessorKey: "address", header: "Address", cell: ({ getValue }) => <span className="line-clamp-2 max-w-[260px] text-xs text-muted-foreground">{getValue() as string}</span> },
      {
        id: "geo",
        header: "Geo-fence",
        accessorFn: (r) => r.geofenceM ?? 0,
        cell: ({ row }) =>
          row.original.geofenceM ? (
            <div className="tnum text-xs leading-tight">
              <p className="flex items-center gap-1">
                <LocateFixed className="size-3 text-muted-foreground" aria-hidden />
                {row.original.geofenceM} m radius
              </p>
              <p className="text-[11px] text-muted-foreground">
                {row.original.lat?.toFixed(4)}, {row.original.lng?.toFixed(4)}
              </p>
            </div>
          ) : (
            <MutedCell>No fence — remote</MutedCell>
          ),
      },
      { accessorKey: "employees", header: "Employees", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
    ],
    [],
  );

  return (
    <MasterTable<WorkLocationRow>
      menuKey="org.work_locations"
      title="Work Locations"
      description="Where people actually work — office, hybrid hot-desk pools and remote — with the geo-fence the mobile punch-in checks against."
      noun="work location"
      plural="work locations"
      icon={MapPinned}
      rows={rows}
      onRowsChange={setRows}
      columns={columns}
      fields={FIELDS}
      searchKeys={["name", "address", "id"]}
      filter={(r) => type === "all" || r.type === type}
      filters={<FilterSelect label="Type" value={type} onValueChange={setType} options={["Office", "Hybrid", "Remote"].map((t) => ({ value: t, label: t }))} width="w-[140px]" />}
      uniqueField={{ name: "name", get: (r) => r.name, message: "A location with this name already exists." }}
      deactivateWarning={(r) => (r.employees ? `${r.employees} employees are mapped here; their punch-ins will fall back to the branch office fence.` : undefined)}
      toValues={(r) => ({
        name: r?.name ?? "",
        type: r?.type ?? "Office",
        branchId: r?.branchId ?? "none",
        address: r?.address ?? "",
        lat: r?.lat != null ? String(r.lat) : "",
        lng: r?.lng != null ? String(r.lng) : "",
        geofenceM: r?.geofenceM != null ? String(r.geofenceM) : "",
      })}
      fromValues={(v, existing, all) => ({
        id: existing?.id ?? `WL-NEW-${String(all.length + 1).padStart(2, "0")}`,
        name: v.name,
        type: v.type as WorkLocationType,
        branchId: v.branchId === "none" ? null : v.branchId,
        address: v.address,
        lat: v.lat ? Number(v.lat) : null,
        lng: v.lng ? Number(v.lng) : null,
        geofenceM: v.geofenceM ? Number(v.geofenceM) : null,
        employees: existing?.employees ?? 0,
      })}
    >
      <StatRow cols={4}>
        <StatTile label="All employees" value={num(total)} hint="Matches the directory" href="/employees" icon={MapPinned} />
        <StatTile label="Office" value={num(by("Office"))} hint={`${Math.round((by("Office") / Math.max(1, total)) * 100)}% on-site`} />
        <StatTile label="Hybrid" value={num(by("Hybrid"))} hint="3 office days a week" />
        <StatTile label="Remote" value={num(by("Remote"))} hint="India + United States" />
      </StatRow>
    </MasterTable>
  );
}
