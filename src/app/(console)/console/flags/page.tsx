"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Flag, OctagonX, Percent, Power, SlidersHorizontal } from "lucide-react";
import { fmtAgo, num } from "@/lib/format";
import { PLATFORM_PERSONA } from "@/lib/rbac";
import { MODULES } from "@/mock/console-tenants";
import { FEATURE_FLAGS, exposedTenants, type FeatureFlag, type FlagConfig, type FlagEnv, type FlagState } from "@/mock/console-flags";
import { demoNowMs, mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { recordConsoleAudit } from "@/components/console/console-audit-trail";
import { FlagStatePill, targetingSummary } from "@/components/console/flags-kit";
import { FlagRolloutDialog, type RolloutPatch } from "@/components/console/flags-rollout-dialog";
import { FlagExposureSheet } from "@/components/console/flags-exposure-sheet";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { DataTable } from "@/components/data-table";
import { CardsSkeleton, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { ReasonDialog, TonePill } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { Alert, Switch, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";

const isOn = (c: FlagConfig) => !c.killed && c.state !== "off";

/** What switching a flag back on restores: its roll-out or targeting if it had one. */
function restoredState(f: FeatureFlag, c: FlagConfig): FlagState {
  if (c.state !== "off") return c.state;
  if (f.type === "percentage" && c.percent > 0 && c.percent < 100) return "rollout";
  if (c.plans.length || c.tenantIds.length) return "targeted";
  return "on";
}

export default function FeatureFlagsPage() {
  const loading = useFakeLoad();
  const { tenants } = useConsole();
  const [flags, setFlags] = React.useState<FeatureFlag[]>(FEATURE_FLAGS);
  const [env, setEnv] = React.useState<FlagEnv>("production");
  const [mod, setMod] = React.useState("all");
  const [editing, setEditing] = React.useState<FeatureFlag | null>(null);
  const [toggling, setToggling] = React.useState<FeatureFlag | null>(null);
  const [viewing, setViewing] = React.useState<string | null>(null);

  const live = tenants.filter((t) => t.status === "active" || t.status === "trial").length;
  const configs = flags.map((f) => f.env[env]);
  const data = flags.filter((f) => mod === "all" || f.module === mod);
  const viewed = flags.find((f) => f.key === viewing) ?? null;

  const apply = (f: FeatureFlag, patch: Partial<FlagConfig>, action: string, reason: string, message: string) => {
    const before = f.env[env];
    const after: FlagConfig = { ...before, ...patch, changedAt: format(new Date(demoNowMs()), "yyyy-MM-dd'T'HH:mm:ss"), changedBy: PLATFORM_PERSONA.name };
    const put = (c: FlagConfig) => setFlags((fs) => fs.map((x) => (x.key === f.key ? { ...x, env: { ...x.env, [env]: c } } : x)));
    put(after);
    const snap = (c: FlagConfig) => ({ state: c.state, percent: c.percent, plans: c.plans, tenants: c.tenantIds, killed: c.killed });
    recordConsoleAudit({ action, category: "flag", target: { kind: "flag", id: f.key, label: `${f.key} (${env})` }, reason, before: snap(before), after: snap(after) });
    const n = exposedTenants(f.key, after, tenants).length;
    mockAction(message, { description: `${env === "production" ? "Production" : "Staging"} · now exposed to ${num(n)} of ${num(live)} live tenants.`, tone: isOn(after) ? "success" : "warning", undo: () => put(before) });
  };

  const columns = React.useMemo<ColumnDef<FeatureFlag, unknown>[]>(
    () => [
      {
        accessorKey: "key",
        header: "Flag",
        cell: ({ row }) => (
          <div className="min-w-[220px] max-w-[360px]">
            <p className="font-mono text-xs font-medium">{row.original.key}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.description}</p>
          </div>
        ),
      },
      { accessorKey: "module", header: "Module", cell: ({ row }) => <span className="whitespace-nowrap text-xs">{MODULES.find((m) => m.id === row.original.module)?.label}</span> },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (row.original.type === "percentage" ? <TonePill tone="neutral" icon={Percent}>Percentage</TonePill> : <TonePill tone="neutral">Boolean</TonePill>),
      },
      { id: "state", header: "State", accessorFn: (f) => f.env[env].state, cell: ({ row }) => <FlagStatePill config={row.original.env[env]} /> },
      { id: "targeting", header: "Targeting", accessorFn: (f) => targetingSummary(f.env[env]), cell: ({ row }) => <span className="text-xs">{targetingSummary(row.original.env[env])}</span> },
      {
        id: "exposure",
        header: "Exposed",
        accessorFn: (f) => exposedTenants(f.key, f.env[env], tenants).length,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setViewing(row.original.key);
            }}
            className="tnum whitespace-nowrap rounded text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {num(exposedTenants(row.original.key, row.original.env[env], tenants).length)} tenants
          </button>
        ),
      },
      { accessorKey: "owner", header: "Owner", cell: ({ row }) => <span className="whitespace-nowrap text-xs">{row.original.owner}</span> },
      {
        id: "changed",
        header: "Last changed",
        accessorFn: (f) => f.env[env].changedAt,
        cell: ({ row }) => (
          <div className="whitespace-nowrap text-xs">
            <p>{fmtAgo(row.original.env[env].changedAt)}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.env[env].changedBy}</p>
          </div>
        ),
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const f = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              <Switch checked={isOn(f.env[env])} onCheckedChange={() => setToggling(f)} aria-label={`${isOn(f.env[env]) ? "Turn off" : "Turn on"} ${f.key} in ${env}`} />
              <Button variant="ghost" size="icon-sm" aria-label={`Edit roll-out of ${f.key}`} onClick={() => setEditing(f)}>
                <SlidersHorizontal />
              </Button>
            </div>
          );
        },
      },
    ],
    [env, tenants],
  );

  const t = toggling;
  const tc = t?.env[env];
  const turningOn = tc ? !isOn(tc) : false;

  return (
    <PageBody>
      <PageHeader
        title="Feature Flags"
        description="Staged roll-outs by plan, tenant list or percentage of tenants — per environment. Every change takes a reason and lands in the audit log."
        tabs={
          <Tabs value={env} onValueChange={(v) => setEnv(v as FlagEnv)}>
            <TabsList>
              <TabsTrigger value="production">Production</TabsTrigger>
              <TabsTrigger value="staging">Staging</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={9} />
        </>
      ) : (
        <>
          {env === "staging" && (
            <Alert tone="info" title="Staging">
              Staging serves copies of each tenant on anonymised data. Flags here never reach a production tenant.
            </Alert>
          )}
          <StatRow cols={4}>
            <StatTile label="Flags" value={num(flags.length)} icon={Flag} hint={`${env === "production" ? "Production" : "Staging"} environment`} />
            <StatTile label="On for all" value={num(configs.filter((c) => !c.killed && c.state === "on").length)} icon={Power} tone="good" />
            <StatTile label="Partial roll-out" value={num(configs.filter((c) => !c.killed && (c.state === "rollout" || c.state === "targeted")).length)} icon={Percent} tone="accent" hint="Percentage or targeted" />
            <StatTile label="Killed" value={num(configs.filter((c) => c.killed).length)} icon={OctagonX} tone={configs.some((c) => c.killed) ? "critical" : "neutral"} hint="Kill switch engaged" />
          </StatRow>

          <DataTable
            columns={columns}
            data={data}
            searchKeys={["key", "description", "owner"]}
            searchPlaceholder="Search flag, description, owner…"
            getRowId={(f) => f.key}
            onRowClick={(f) => setViewing(f.key)}
            rowTone={(f) => (f.env[env].killed ? "danger" : undefined)}
            exportName={`feature-flags-${env}`}
            canExport
            emptyIcon={Flag}
            emptyTitle="No flags match"
            emptyDescription="Clear the module filter or search."
            filters={<FilterSelect label="Module" value={mod} onValueChange={setMod} width="w-[190px]" options={MODULES.filter((m) => flags.some((f) => f.module === m.id)).map((m) => ({ value: m.id, label: m.label }))} />}
          />
        </>
      )}

      <FlagExposureSheet
        flag={viewed}
        env={env}
        onOpenChange={(v) => !v && setViewing(null)}
        onEdit={(f) => {
          setViewing(null);
          setEditing(f);
        }}
      />

      {editing && (
        <FlagRolloutDialog
          key={`${editing.key}-${env}`}
          flag={editing}
          env={env}
          onOpenChange={(v) => !v && setEditing(null)}
          onSave={(patch: RolloutPatch, reason) => {
            const f = editing;
            const killing = patch.killed && !f.env[env].killed;
            apply(f, patch, killing ? "flag.kill_switch" : "flag.rollout_change", reason, killing ? `${f.key} killed` : `${f.key} roll-out updated`);
            setEditing(null);
          }}
        />
      )}

      <ReasonDialog
        open={!!t}
        onOpenChange={(v) => !v && setToggling(null)}
        title={t ? `Turn ${turningOn ? "on" : "off"} ${t.key} in ${env}?` : ""}
        description={
          t && tc
            ? turningOn
              ? `Restores ${tc.killed ? "the roll-out held by the kill switch" : `the flag as “${targetingSummary({ ...tc, state: restoredState(t, tc) })}”`}. ${num(exposedTenants(t.key, { ...tc, killed: false, state: restoredState(t, tc) }, tenants).length)} tenants will see it.`
              : `${num(exposedTenants(t.key, tc, tenants).length)} tenants lose it on their next request. The roll-out settings are kept.`
            : undefined
        }
        destructive={!turningOn}
        confirmLabel={turningOn ? "Turn on" : "Turn off"}
        onConfirm={(reason) => {
          if (!t || !tc) return;
          if (turningOn) apply(t, { killed: false, state: restoredState(t, tc) }, "flag.toggle", reason, `${t.key} turned on`);
          else apply(t, { state: "off" }, "flag.toggle", reason, `${t.key} turned off`);
        }}
      />
    </PageBody>
  );
}
