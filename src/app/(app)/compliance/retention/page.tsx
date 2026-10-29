"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, Gavel, Loader2, ScanSearch, ShieldCheck } from "lucide-react";
import { fmtDate, num } from "@/lib/format";
import { RETENTION_POLICIES, type RetentionPolicy } from "@/mock/platform";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Switch } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { ReasonDialog, TonePill, useSimulatedTask, type PTone } from "@/components/platform/kit";

const ACTION_TONE: Record<RetentionPolicy["action"], PTone> = { Anonymise: "info", Delete: "serious", Archive: "neutral", "Not stored": "neutral" };

/** Deterministic dry-run breakdown — the preview never touches data. */
function breakdown(p: RetentionPolicy) {
  const held = p.legalHold ? Math.round(p.eligible * 0.04) : 0;
  const recent = Math.round((p.eligible - held) * 0.06);
  return { eligible: p.eligible, held, recent, wouldAct: p.eligible - held - recent };
}

export default function RetentionPage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const [policies, setPolicies] = React.useState<RetentionPolicy[]>(RETENTION_POLICIES);
  const [preview, setPreview] = React.useState<RetentionPolicy | null>(null);
  const [releasing, setReleasing] = React.useState<RetentionPolicy | null>(null);
  const task = useSimulatedTask(1500);

  const setHold = (p: RetentionPolicy, on: boolean, note?: string) => {
    setPolicies((prev) => prev.map((x) => (x.id === p.id ? { ...x, legalHold: on } : x)));
    mockAction(on ? `Legal hold placed on ${p.entity}` : `Legal hold released on ${p.entity}`, {
      description: on ? "No record in this entity will be purged or anonymised until the hold is released." : `Reason recorded: “${note}”. Normal retention resumes at the next scheduled run.`,
      tone: on ? "success" : "warning",
    });
  };

  const columns: ColumnDef<RetentionPolicy, unknown>[] = [
    {
      accessorKey: "entity",
      header: "Data",
      cell: ({ row }) => (
        <div className="text-xs">
          <p className="font-medium">{row.original.entity}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.module}</p>
        </div>
      ),
    },
    { accessorKey: "period", header: "Retention", cell: ({ row }) => <span className="text-xs">{row.original.period}</span> },
    { accessorKey: "basis", header: "Legal basis", cell: ({ row }) => <p className="max-w-[260px] text-xs text-muted-foreground">{row.original.basis}</p> },
    { accessorKey: "action", header: "At expiry", cell: ({ row }) => <TonePill tone={ACTION_TONE[row.original.action]}>{row.original.action}</TonePill> },
    {
      accessorKey: "legalHold",
      header: "Legal hold",
      cell: ({ row }) =>
        row.original.action === "Not stored" ? (
          <MutedCell>—</MutedCell>
        ) : (
          <Gated menuKey="compliance.retention" action="E">
            <Switch
              checked={row.original.legalHold}
              aria-label={`Legal hold on ${row.original.entity}`}
              onCheckedChange={(on) => (on ? setHold(row.original, true) : setReleasing(row.original))}
            />
          </Gated>
        ),
    },
    { accessorKey: "eligible", header: "Past retention", cell: ({ row }) => <NumCell>{row.original.action === "Not stored" ? "—" : num(row.original.eligible)}</NumCell> },
    { accessorKey: "lastPurgeRun", header: "Last run", cell: ({ row }) => (row.original.lastPurgeRun ? <span className="tnum text-xs">{fmtDate(row.original.lastPurgeRun)}</span> : <MutedCell>Never</MutedCell>) },
    {
      id: "__a",
      header: "",
      enableHiding: false,
      cell: ({ row }) =>
        row.original.action === "Not stored" ? null : (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              disabled={!!task.runningKey}
              onClick={() => task.start(row.original.id, () => setPreview(row.original))}
            >
              {task.runningKey === row.original.id ? <Loader2 className="animate-spin" /> : <ScanSearch />} Preview purge
            </Button>
          </div>
        ),
    },
  ];

  const pb = preview ? breakdown(preview) : null;

  return (
    <PageBody>
      <PageHeader
        title="Retention Policies"
        description="How long each kind of personal data is kept, why, and what happens when the period ends. Purges run only from the scheduled retention job with a 30-day review window — this screen previews, it never deletes."
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <TableSkeleton rows={9} />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Policies" value={policies.length} icon={Archive} />
            <StatTile label="Under legal hold" value={policies.filter((p) => p.legalHold).length} icon={Gavel} tone="warning" />
            <StatTile label="Records past retention" value={num(policies.reduce((t, p) => t + p.eligible, 0))} icon={ScanSearch} hint="Awaiting the next scheduled run" />
            <StatTile label="Next scheduled run" value="1 Oct 2026" icon={ShieldCheck} hint="Monthly · 02:00 IST · dry run first" />
          </StatRow>

          {!can("compliance.retention", "E") && (
            <Alert tone="neutral" icon={ShieldCheck}>
              You can preview purges but not change policies or legal holds.
            </Alert>
          )}

          <DataTable
            columns={columns}
            data={policies}
            searchKeys={["entity", "module", "basis"]}
            searchPlaceholder="Search policies…"
            rowTone={(p) => (p.legalHold ? "warning" : undefined)}
            exportName="retention-policies"
            emptyIcon={Archive}
            emptyTitle="No retention policies"
            emptyDescription="Define a policy for every personal-data entity before go-live."
          />
        </>
      )}

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Purge preview — {preview?.entity}</DialogTitle>
            <DialogDescription>Dry run as of 16 Sep 2026. Nothing has been changed.</DialogDescription>
          </DialogHeader>
          {preview && pb && (
            <DialogBody className="flex flex-col gap-3 text-xs">
              <dl className="divide-y divide-border rounded-md border border-border">
                {[
                  ["Past the retention period", pb.eligible],
                  ["Excluded — under legal hold", pb.held],
                  ["Excluded — open DSR or audit in last 30 days", pb.recent],
                ].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between px-3 py-2">
                    <dt className="text-muted-foreground">{l}</dt>
                    <dd className="tnum font-medium">{num(v as number)}</dd>
                  </div>
                ))}
                <div className="flex justify-between bg-subtle px-3 py-2">
                  <dt className="font-semibold">Would be {preview.action.toLowerCase()}d at the next run</dt>
                  <dd className="tnum font-semibold">{num(pb.wouldAct)}</dd>
                </div>
              </dl>
              {preview.legalHold && (
                <Alert tone="warning" icon={Gavel}>
                  A legal hold is active on this entity — the scheduled job will skip it entirely until the hold is released.
                </Alert>
              )}
            </DialogBody>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => mockAction("Preview exported", { description: "CSV of record IDs only — no personal fields.", tone: "info" })}
            >
              Export record IDs
            </Button>
            <Button onClick={() => setPreview(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={!!releasing}
        onOpenChange={(v) => !v && setReleasing(null)}
        title={`Release the legal hold on ${releasing?.entity ?? ""}?`}
        description="Records past their retention period become eligible at the next scheduled run. Confirm with Legal that the underlying matter is closed."
        confirmLabel="Release hold"
        commentLabel="Matter reference / reason"
        onConfirm={(note) => releasing && setHold(releasing, false, note)}
      />
    </PageBody>
  );
}
