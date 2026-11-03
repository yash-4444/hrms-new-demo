"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarClock, Trash2 } from "lucide-react";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { PLATFORM_PERSONA } from "@/lib/rbac";
import { PLAN_META, type PlanId } from "@/mock/console-tenants";
import { NEXT_RENEWAL, PLAN_COMMERCIAL } from "@/mock/console-plans";
import { demoNowMs, mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { PlanBadge } from "@/components/console/kit";
import { AddOnsSection, PlanCards, onPlan } from "@/components/console/plans-cards";
import { EntitlementMatrix } from "@/components/console/plans-matrix";
import { EditPlanDialog, type PlanVersionDraft } from "@/components/console/plans-edit-dialog";
import { CardsSkeleton, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";

export default function PlansPage() {
  const loading = useFakeLoad();
  const { tenants } = useConsole();
  const [editing, setEditing] = React.useState<PlanId | null>(null);
  const [scheduled, setScheduled] = React.useState<PlanVersionDraft[]>([]);
  const [cancelling, setCancelling] = React.useState<PlanVersionDraft | null>(null);

  const nextVersion = (p: PlanId) => Math.max(PLAN_COMMERCIAL[p].version, ...scheduled.filter((d) => d.plan === p).map((d) => d.version)) + 1;

  return (
    <PageBody>
      <PageHeader
        title="Plans & entitlements"
        description="Free, Pro and Enterprise — what each includes, what it costs and how hard it may call the API. Edits create a new plan version that tenants pick up at renewal, never retroactively."
      />

      {loading ? (
        <>
          <CardsSkeleton count={3} height={280} />
          <TableSkeleton rows={10} />
        </>
      ) : (
        <>
          <PlanCards tenants={tenants} scheduled={scheduled} onEdit={setEditing} />
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <EntitlementMatrix />
            <div className="flex flex-col gap-4">
              <Section
                title="Scheduled plan versions"
                description={`Applied tenant by tenant at each one's next renewal, from ${fmtDate(NEXT_RENEWAL)}.`}
                bodyClassName="p-0"
              >
                {scheduled.length === 0 ? (
                  <EmptyState
                    icon={CalendarClock}
                    title="No changes scheduled"
                    description="Edit a plan to draft its next version. Tenants keep the terms stamped on their subscription until they renew."
                    className="m-4"
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {scheduled.map((d) => (
                      <li key={`${d.plan}-${d.version}`} className="flex items-start gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <PlanBadge plan={d.plan} /> v{d.version}
                          </p>
                          <ul className="mt-1 text-[11px] text-muted-foreground">
                            {d.changes.map((c) => (
                              <li key={c.label}>
                                {c.label}: {c.from} → <span className="text-foreground">{c.to}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            “{d.reason}” · {PLATFORM_PERSONA.name}, {fmtDateTime(d.at)}
                          </p>
                        </div>
                        <Button size="icon-sm" variant="ghost" aria-label={`Cancel ${PLAN_META[d.plan].label} v${d.version}`} onClick={() => setCancelling(d)}>
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
              <AddOnsSection tenants={tenants} />
            </div>
          </div>
        </>
      )}

      {editing && (
        <EditPlanDialog
          plan={editing}
          affected={onPlan(tenants, editing).length}
          nextVersion={nextVersion(editing)}
          onOpenChange={(v) => !v && setEditing(null)}
          onSave={(draft) => {
            setScheduled((s) => [...s, { ...draft, at: format(new Date(demoNowMs()), "yyyy-MM-dd'T'HH:mm:ss") }]);
            setEditing(null);
            const n = onPlan(tenants, draft.plan).length;
            mockAction(`${PLAN_META[draft.plan].label} v${draft.version} scheduled`, {
              description: `New sign-ups get it now; ${n} existing tenant${n === 1 ? "" : "s"} move at their next renewal (from ${fmtDate(NEXT_RENEWAL)}).`,
            });
          }}
        />
      )}
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title={`Cancel ${cancelling ? PLAN_META[cancelling.plan].label : ""} v${cancelling?.version ?? ""}?`}
        description="No tenant has renewed onto it yet, so nothing changes for anyone. The draft is discarded."
        confirmLabel="Cancel version"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => {
          if (!cancelling) return;
          setScheduled((s) => s.filter((d) => d !== cancelling));
          mockAction(`${PLAN_META[cancelling.plan].label} v${cancelling.version} cancelled`, { tone: "info" });
        }}
      />
    </PageBody>
  );
}
