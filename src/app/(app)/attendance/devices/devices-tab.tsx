"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Fingerprint, RefreshCw } from "lucide-react";
import { differenceInMinutes, parseISO } from "date-fns";
import { fmtTime, hm, num } from "@/lib/format";
import { DEMO_NOW } from "@/mock/org";
import type { BiometricDevice } from "@/mock/finance-time";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/overlays";
import { Hint } from "@/components/ui/primitives";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { Gated } from "@/components/shell/page";
import { FinStatus } from "@/components/finance/kit";

/** Relative to DEMO_NOW, never the wall clock. */
function sinceDemoNow(iso: string) {
  const m = differenceInMinutes(parseISO(DEMO_NOW), parseISO(iso));
  return m < 2 ? "just now" : `${hm(m)} ago`;
}

export function DevicesTab({
  devices,
  onSync,
}: {
  devices: BiometricDevice[];
  onSync: (ids: string[]) => void;
}) {
  const [branch, setBranch] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const rows = devices.filter(
    (d) => (branch === "all" || d.branchId === branch) && (status === "all" || d.status === status),
  );

  const columns = React.useMemo<ColumnDef<BiometricDevice, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Device",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-mono text-xs font-medium">{row.original.name}</span>
            <span className="text-[11px] text-muted-foreground">
              {row.original.vendor} {row.original.model}
            </span>
          </span>
        ),
      },
      {
        accessorKey: "branch",
        header: "Branch",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span>{row.original.branch}</span>
            <span className="text-[11px] text-muted-foreground">{row.original.location}</span>
          </span>
        ),
      },
      { accessorKey: "ip", header: "IP address", cell: ({ getValue }) => <span className="tnum font-mono text-xs">{getValue() as string}</span> },
      { accessorKey: "serial", header: "Serial", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      { accessorKey: "firmware", header: "Firmware", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      {
        accessorKey: "lastSync",
        header: "Last sync",
        cell: ({ getValue }) => (
          <span className="tnum text-xs">
            {fmtTime(getValue() as string)}{" "}
            <span className="text-muted-foreground">· {sinceDemoNow(getValue() as string)}</span>
          </span>
        ),
      },
      { accessorKey: "enrolled", header: "Enrolled", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      { accessorKey: "punchesToday", header: "Punches today", cell: ({ getValue }) => <NumCell>{num(getValue() as number)}</NumCell> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.note ? (
            <Hint text={row.original.note}>
              <span tabIndex={0} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <FinStatus status={row.original.status} />
              </span>
            </Hint>
          ) : (
            <FinStatus status={row.original.status} />
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Gated menuKey="time.devices" action="E">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Force sync ${row.original.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onSync([row.original.id]);
              }}
            >
              <RefreshCw />
            </Button>
          </Gated>
        ),
      },
    ],
    [onSync],
  );

  return (
    <DataTable<BiometricDevice>
      columns={columns}
      data={rows}
      getRowId={(d) => d.id}
      searchKeys={["name", "model", "ip", "location", "serial"]}
      searchPlaceholder="Search device, IP or serial…"
      exportName="biometric-devices"
      enableSelection
      rowTone={(d) => (d.status === "error" ? "danger" : d.status === "offline" ? "warning" : undefined)}
      emptyIcon={Fingerprint}
      emptyTitle="No device matches these filters"
      emptyDescription="Clear the branch or status filter, or register a new device."
      filters={
        <>
          <FilterSelect
            label="Branch"
            value={branch}
            onValueChange={setBranch}
            allLabel="All branches"
            width="w-[180px]"
            options={[...new Map(devices.map((d) => [d.branchId, d.branch])).entries()].map(([value, label]) => ({ value, label }))}
          />
          <FilterSelect
            label="Status"
            value={status}
            onValueChange={setStatus}
            allLabel="Any"
            width="w-[130px]"
            options={[
              { value: "online", label: "Online" },
              { value: "offline", label: "Offline" },
              { value: "error", label: "Error" },
            ]}
          />
        </>
      }
      bulkActions={(sel, clear) => (
        <Gated menuKey="time.devices" action="E">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onSync(sel.map((d) => d.id));
              clear();
            }}
          >
            <RefreshCw /> Force sync {sel.length}
          </Button>
        </Gated>
      )}
    />
  );
}

/** Marks devices as freshly synced and toasts the result. */
export function syncDevices(devices: BiometricDevice[], ids: string[]): BiometricDevice[] {
  const next = devices.map((d) =>
    ids.includes(d.id) && d.status !== "error" ? { ...d, status: "online" as const, lastSync: DEMO_NOW } : d,
  );
  const blocked = devices.filter((d) => ids.includes(d.id) && d.status === "error").length;
  mockAction(`Sync requested for ${ids.length} device${ids.length === 1 ? "" : "s"}`, {
    description: blocked
      ? `${blocked} device in Error state needs attention on site before it can sync.`
      : "Pending punches were pulled and queued for processing.",
    tone: blocked ? "warning" : "success",
  });
  return next;
}
