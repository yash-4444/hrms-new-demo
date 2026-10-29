"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BellRing, Check, ClipboardCheck, MapPinOff, MoreHorizontal, PackageSearch, ScanLine, SearchX, Wrench } from "lucide-react";
import { fmtDate, num, pct } from "@/lib/format";
import { employeeName } from "@/mock/employees";
import { AUDIT_BRANCHES, AUDIT_CYCLES, DISCREPANCIES, type Discrepancy, type DiscrepancyKind } from "@/mock/service";
import { mockAction } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Badge, Progress } from "@/components/ui/primitives";
import { ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { AssetLink, ReasonDialog, ToneChip, type ChipTone } from "@/components/service/kit";

type Row = Discrepancy & { resolution: string | null };

const KIND_META: Record<DiscrepancyKind, { tone: ChipTone; icon: typeof SearchX }> = {
  Missing: { tone: "danger", icon: SearchX },
  "Wrong location": { tone: "warning", icon: MapPinOff },
  "Condition mismatch": { tone: "serious", icon: Wrench },
};

export default function AssetAuditPage() {
  const loading = useFakeLoad();
  const [rows, setRows] = React.useState<Row[]>(() => DISCREPANCIES.map((d) => ({ ...d, resolution: null })));
  const [writingOff, setWritingOff] = React.useState<Row | null>(null);
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [cycleClosed, setCycleClosed] = React.useState(false);
  const cycle = AUDIT_CYCLES[0];
  const open = rows.filter((r) => !r.resolution);
  const progress = (cycle.scanned / cycle.expected) * 100;

  const resolve = (ids: string[], resolution: string, msg: string) => {
    setRows((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, resolution } : r)));
    mockAction(msg);
  };

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "assetId",
        header: "Asset",
        cell: ({ row }) => (
          <span className="flex flex-col">
            <AssetLink id={row.original.assetId} />
            <span className="text-[11px] text-muted-foreground">{row.original.assetLabel}</span>
          </span>
        ),
      },
      { accessorKey: "kind", header: "Discrepancy", cell: ({ row }) => <ToneChip tone={KIND_META[row.original.kind].tone} icon={KIND_META[row.original.kind].icon}>{row.original.kind}</ToneChip> },
      { accessorKey: "branchId", header: "Branch", cell: ({ row }) => <Badge variant="muted">{row.original.branchId}</Badge> },
      { accessorKey: "expected", header: "Register says" },
      { accessorKey: "found", header: "Found", cell: ({ row }) => <span className="font-medium">{row.original.found}</span> },
      { accessorKey: "scannedBy", header: "Verifier", cell: ({ row }) => <MutedCell>{employeeName(row.original.scannedBy)} · {fmtDate(row.original.scannedOn)}</MutedCell> },
      {
        accessorKey: "resolution",
        header: "Status",
        cell: ({ row }) => (row.original.resolution ? <span className="flex flex-col gap-0.5"><StatusBadge status="completed" /><span className="text-[10px] text-muted-foreground">{row.original.resolution}</span></span> : <StatusBadge status="open" />),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          if (r.resolution) return null;
          return (
            <Gated menuKey="workplace.asset_audit" action="E">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label={`Reconcile ${r.assetId}`}><MoreHorizontal /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {r.kind === "Missing" && <DropdownMenuItem onSelect={() => resolve([r.id], "Found on re-scan", `${r.assetId} marked found`)}><Check /> Mark found</DropdownMenuItem>}
                  {r.kind === "Wrong location" && <DropdownMenuItem onSelect={() => resolve([r.id], `Location updated to ${r.found}`, `${r.assetId} location updated`)}><MapPinOff /> Accept found location</DropdownMenuItem>}
                  {r.kind === "Condition mismatch" && <DropdownMenuItem onSelect={() => resolve([r.id], `Condition updated to ${r.found.split(" —")[0]}`, `${r.assetId} condition updated`)}><Wrench /> Accept found condition</DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => resolve([r.id], "Re-scan requested", `Re-scan requested for ${r.assetId}`)}><ScanLine /> Request re-scan</DropdownMenuItem>
                  {r.kind === "Missing" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive-fg" onSelect={() => setWritingOff(r)}><SearchX /> Write off as lost…</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </Gated>
          );
        },
      },
    ],
    [],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Asset verification" description="Loading the verification cycle…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Asset verification"
        description={`${cycle.name} · ${fmtDate(cycle.start)} – ${fmtDate(cycle.end)}. Verifiers scan every tag on site; anything that does not match the register lands below.`}
        actions={
          <Gated menuKey="workplace.asset_audit" action="A">
            <Button size="sm" disabled={open.length > 0 || cycleClosed} onClick={() => setCloseOpen(true)}>
              <ClipboardCheck /> {cycleClosed ? "Cycle closed" : "Close cycle"}
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Assets in scope" value={num(cycle.expected)} icon={PackageSearch} hint="Retired assets excluded" />
        <StatTile label="Scanned" value={num(cycle.scanned)} icon={ScanLine} hint={pct(progress)} tone="accent" />
        <StatTile label="Not yet scanned" value={num(cycle.expected - cycle.scanned)} hint={`Due ${fmtDate(cycle.end)}`} tone="warning" />
        <StatTile label="Open discrepancies" value={num(open.length)} icon={SearchX} tone={open.length ? "critical" : "good"} hint={`${rows.length - open.length} reconciled`} />
      </StatRow>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <Section title="Progress by branch" description="Scanned against the register for each site.">
            <ul className="flex flex-col gap-3">
              {AUDIT_BRANCHES.map((b) => {
                const p = b.expected ? (b.scanned / b.expected) * 100 : 0;
                return (
                  <li key={b.branchId} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{b.city}</span>
                      <span className="tnum text-muted-foreground">{b.scanned} / {b.expected} · {pct(p, 0)}</span>
                    </div>
                    <Progress value={p} tone={p >= 100 ? "success" : p < 50 ? "warning" : "accent"} aria-label={`${b.city} verification progress`} />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Verifier: {employeeName(b.verifier)}</span>
                      {p < 100 && (
                        <Gated menuKey="workplace.asset_audit" action="E">
                          <Button size="sm" variant="ghost" onClick={() => mockAction(`Reminder sent to ${employeeName(b.verifier)}`, { description: `${b.expected - b.scanned} tags left at ${b.city}.` })}>
                            <BellRing /> Remind
                          </Button>
                        </Gated>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
          <Section title="Cycles">
            <ul className="flex flex-col divide-y divide-border text-xs">
              {AUDIT_CYCLES.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="flex flex-col">
                    <span className="font-medium">{c.name}</span>
                    <span className="tnum text-muted-foreground">{num(c.scanned)} / {num(c.expected)} scanned · {c.discrepancies} discrepancies</span>
                  </span>
                  <StatusBadge status={c.id === cycle.id && !cycleClosed ? "running" : "completed"} />
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(r) => r.id}
          searchKeys={["assetId", "assetLabel", "found"]}
          searchPlaceholder="Search tag or finding…"
          exportName="verification-discrepancies"
          enableSelection
          rowTone={(r) => (!r.resolution && r.kind === "Missing" ? "danger" : undefined)}
          bulkActions={(selected, clear) => (
            <Gated menuKey="workplace.asset_audit" action="E">
              <Button size="sm" onClick={() => { resolve(selected.filter((s) => s.kind !== "Missing").map((s) => s.id), "Found values accepted", `${selected.filter((s) => s.kind !== "Missing").length} discrepancies reconciled`); clear(); }}>
                <Check /> Accept found values
              </Button>
            </Gated>
          )}
          emptyIcon={ClipboardCheck}
          emptyTitle="No discrepancies"
          emptyDescription="Every scanned tag matched the register."
        />
      </div>

      <ReasonDialog
        open={!!writingOff}
        onOpenChange={(o) => !o && setWritingOff(null)}
        title={`Write off ${writingOff?.assetId ?? ""} as lost?`}
        description="The asset is marked Lost, its book value is written off, and the last holder is asked to file an incident report."
        confirmLabel="Write off"
        commentLabel="Reason and incident reference"
        onConfirm={(reason) => writingOff && resolve([writingOff.id], `Written off — ${reason}`, `${writingOff.assetId} written off as lost`)}
      />
      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title={`Close ${cycle.name}?`}
        description="Locks the scan results and publishes the verification certificate to Finance and the auditors."
        confirmLabel="Close cycle"
        onConfirm={() => { setCycleClosed(true); mockAction(`${cycle.name} closed`, { description: "Certificate shared with Finance and Internal Audit." }); }}
      />
    </PageBody>
  );
}
