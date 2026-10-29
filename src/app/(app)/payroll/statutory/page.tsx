"use client";

import * as React from "react";
import { CalendarClock, History, Landmark, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, inr, num } from "@/lib/format";
import { DEMO_NOW, DEMO_TODAY } from "@/mock/org";
import { CURRENT_PERIOD } from "@/mock/payroll";
import {
  STAT_SECTIONS,
  ecrChallan,
  esiLines,
  monthStatutoryRecon,
  ptLines,
  type StatSection,
  type StatSectionId,
  type StatVersion,
} from "@/mock/finance-statutory";
import { mockAction, useApp } from "@/components/app-state";
import { ReconcileCheck } from "@/components/finance/kit";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Alert, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { CardsSkeleton, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { SectionPanel } from "./section-panel";
import { EditVersionDialog } from "./edit-version-dialog";

/* ============================================================================
   /payroll/statutory — PF, ESI, PT, LWF, TDS and establishment codes.

   The version in force is read from the same constants the salary engine
   uses, and every edit creates a future-dated version instead of changing the
   one a past run was calculated with.
   ========================================================================== */

const GROUPS: { id: StatSection["group"]; label: string }[] = [
  { id: "PF", label: "Provident Fund" },
  { id: "ESI", label: "ESI" },
  { id: "PT", label: "Professional Tax" },
  { id: "LWF", label: "Labour Welfare Fund" },
  { id: "TDS", label: "TDS" },
  { id: "Codes", label: "Establishment codes" },
];

export default function StatutorySetupPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [sections, setSections] = React.useState<StatSection[]>(STAT_SECTIONS);
  const [group, setGroup] = React.useState<StatSection["group"]>("PF");
  const [sub, setSub] = React.useState<Partial<Record<StatSection["group"], StatSectionId>>>({});
  const [editing, setEditing] = React.useState<StatSectionId | null>(null);

  const period = CURRENT_PERIOD.id;
  const usage = React.useMemo(() => {
    const pf = ecrChallan(period);
    const esi = esiLines(period);
    const recon = monthStatutoryRecon(period);
    return { pf, esiCount: esi.length, recon };
  }, [period]);

  const scheduled = sections.flatMap((s) => s.versions.filter((v) => v.effectiveFrom > DEMO_TODAY));
  const lastChange = sections
    .flatMap((s) => s.versions.map((v) => ({ v, s })))
    .sort((a, b) => (a.v.changedOn < b.v.changedOn ? 1 : -1))[0];

  const save = (id: StatSectionId, v: StatVersion) => {
    const stamped = { ...v, changedBy: persona.name, changedOn: DEMO_NOW };
    const section = sections.find((s) => s.id === id)!;
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, versions: [...s.versions, stamped] } : s)));
    mockAction(`${section.title} — v${v.version} scheduled`, {
      description: `Takes effect ${fmtDate(v.effectiveFrom)}. The ${CURRENT_PERIOD.label} run keeps the current version.`,
      undo: () =>
        setSections((prev) =>
          prev.map((s) => (s.id === id ? { ...s, versions: s.versions.filter((x) => x.version !== v.version) } : s)),
        ),
    });
  };

  const usageFor = (s: StatSection): React.ReactNode => {
    if (s.id === "pf")
      return (
        <ReconcileCheck
          label={`${CURRENT_PERIOD.label} run`}
          leftLabel={`EE PF on ${num(usage.pf.members)} members`}
          left={usage.pf.ee}
          rightLabel="ER PF"
          right={usage.pf.er}
        />
      );
    if (s.id === "esi")
      return (
        <Alert tone="neutral">
          {usage.esiCount === 0
            ? `No employee is under the ${inr(21000, { decimals: false })} gross threshold in ${CURRENT_PERIOD.label} — the ESI return is filed as nil.`
            : `${num(usage.esiCount)} employees are covered in ${CURRENT_PERIOD.label}.`}
        </Alert>
      );
    if (s.group === "PT") {
      const state = s.title.split("— ")[1];
      const lines = ptLines(period, state);
      return (
        <Alert tone="neutral">
          {CURRENT_PERIOD.label}: {num(lines.length)} employees ·{" "}
          {inr(lines.reduce((t, l) => t + l.ee, 0), { decimals: false })} deducted.
        </Alert>
      );
    }
    if (s.group === "LWF")
      return <Alert tone="neutral">Not deducted in {CURRENT_PERIOD.label}. Next deduction: December 2026 run.</Alert>;
    if (s.id === "tds")
      return (
        <ReconcileCheck
          label={`${CURRENT_PERIOD.label} statutory`}
          leftLabel="PF + ESI + PT + TDS"
          left={usage.recon.sum}
          rightLabel="run statutory"
          right={usage.recon.runStatutory}
        />
      );
    return <Alert tone="neutral">Printed on ECR, ESI challans, PT returns, Form 24Q and Form 16.</Alert>;
  };

  const editingSection = sections.find((s) => s.id === editing);

  return (
    <PageBody>
      <PageHeader
        title="Statutory setup"
        description="Rates, ceilings and registrations the pay run applies. Every section is effective-dated — an edit schedules a new version and keeps the full history."
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={6} />
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label="Sections configured" value={num(sections.length)} icon={Landmark} hint="PF, ESI, 3 × PT, 2 × LWF, TDS, codes" />
            <StatTile
              label="Scheduled changes"
              value={num(scheduled.length)}
              icon={CalendarClock}
              tone={scheduled.length ? "warning" : "neutral"}
              hint={scheduled.length ? `Next on ${fmtDate(scheduled.map((v) => v.effectiveFrom).sort()[0])}` : "Nothing pending"}
            />
            <StatTile
              label="Last change"
              value={lastChange ? fmtDate(lastChange.v.changedOn) : "—"}
              icon={History}
              hint={lastChange ? `${lastChange.s.title.split(" (")[0]} · ${lastChange.v.changedBy}` : undefined}
            />
            <StatTile
              label={`${CURRENT_PERIOD.shortLabel} run alignment`}
              value={usage.recon.sum === usage.recon.runStatutory ? "Reconciled" : "Drift"}
              icon={ShieldCheck}
              tone={usage.recon.sum === usage.recon.runStatutory ? "good" : "critical"}
              hint={`Statutory ${inr(usage.recon.runStatutory, { decimals: false })} · as of ${fmtDateTime(DEMO_NOW)}`}
            />
          </StatRow>

          <Tabs value={group} onValueChange={(v) => setGroup(v as StatSection["group"])}>
            <TabsList className="h-auto flex-wrap">
              {GROUPS.map((g) => (
                <TabsTrigger key={g.id} value={g.id}>
                  {g.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {GROUPS.map((g) => {
              const inGroup = sections.filter((s) => s.group === g.id);
              const activeId = sub[g.id] ?? inGroup[0].id;
              const active = inGroup.find((s) => s.id === activeId) ?? inGroup[0];
              return (
                <TabsContent key={g.id} value={g.id} className="mt-3 flex flex-col gap-3">
                  {inGroup.length > 1 && (
                    <div role="radiogroup" aria-label={`${g.label} by state`} className="flex flex-wrap gap-1.5">
                      {inGroup.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          role="radio"
                          aria-checked={s.id === active.id}
                          onClick={() => setSub((p) => ({ ...p, [g.id]: s.id }))}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            s.id === active.id ? "border-primary/40 bg-primary-soft text-primary-soft-foreground" : "border-border bg-card hover:bg-muted",
                          )}
                        >
                          {s.title.split("— ")[1]}
                        </button>
                      ))}
                    </div>
                  )}
                  <SectionPanel section={active} usage={usageFor(active)} onEdit={() => setEditing(active.id)} />
                </TabsContent>
              );
            })}
          </Tabs>
        </>
      )}

      {editingSection && (
        <EditVersionDialog
          section={editingSection}
          open={!!editing}
          onOpenChange={(v) => !v && setEditing(null)}
          onSave={(v) => save(editingSection.id, v)}
        />
      )}
    </PageBody>
  );
}
