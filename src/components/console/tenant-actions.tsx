"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { fmtDate, num } from "@/lib/format";
import {
  CONSOLE_TODAY,
  DELETION_RETENTION_DAYS,
  MODULES,
  PLAN_META,
  daysFromToday,
  purgeDate,
  type ConsoleTenant,
  type PlanId,
} from "@/mock/console-tenants";
import { mockAction, useApp } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { ChangePlanDialog, ExtendTrialDialog } from "@/components/console/plan-trial-dialogs";
import { ImpersonateDialog } from "@/components/console/impersonate-dialog";
import { ReasonDialog } from "@/components/platform/kit";
import { Alert } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";

/* ============================================================================
   Every operator action on a tenant, in one place, so the tenants list, the
   tenant detail page and later console screens behave identically:

     const { open, can, dialogs } = useTenantActions();
     <Button onClick={() => open("suspend", tenant)} disabled={!can("suspend", tenant)}>…
     {dialogs}

   Each action updates console state, appends to the tenant's activity trail
   and toasts. Destructive ones confirm; suspend, impersonate and delete
   require a reason.
   ========================================================================== */

export type TenantActionKind = "plan" | "trial" | "suspend" | "reactivate" | "impersonate" | "export" | "delete" | "cancel_delete";

/** Why an action is unavailable for this tenant, or null when it is allowed. */
export function tenantActionBlock(kind: TenantActionKind, t: ConsoleTenant): string | null {
  const gone = t.status === "churned" || t.status === "scheduled_deletion";
  switch (kind) {
    case "plan":
      return gone ? "Closed tenants cannot change plan." : null;
    case "trial":
      return t.status === "trial" ? null : "Only tenants on a trial can be extended.";
    case "suspend":
      return t.status === "active" || t.status === "trial" ? null : `A ${t.status.replace("_", " ")} tenant cannot be suspended.`;
    case "reactivate":
      return t.status === "suspended" ? null : "Only suspended tenants can be reactivated.";
    case "impersonate":
      return t.status === "active" || t.status === "trial" || t.status === "suspended"
        ? null
        : "Support sessions need a provisioned, live tenant.";
    case "export":
      return t.status === "pending" || t.status === "churned" ? "There is no retained data to export." : null;
    case "delete":
      return gone || t.status === "pending" ? "Deletion is already scheduled or the tenant holds no data." : null;
    case "cancel_delete":
      return t.status === "scheduled_deletion" ? null : "No deletion is scheduled.";
  }
}

export function useTenantActions() {
  const { updateTenant, logActivity } = useConsole();
  const { startSupportSession } = useApp();
  const router = useRouter();
  const [pending, setPending] = React.useState<{ kind: TenantActionKind; tenant: ConsoleTenant } | null>(null);
  const close = () => setPending(null);
  const t = pending?.tenant;

  const open = React.useCallback((kind: TenantActionKind, tenant: ConsoleTenant) => setPending({ kind, tenant }), []);
  const can = React.useCallback((kind: TenantActionKind, tenant: ConsoleTenant) => tenantActionBlock(kind, tenant) === null, []);

  /** Apply a patch with an Undo that restores exactly the fields it touched. */
  const apply = (tenant: ConsoleTenant, patch: Partial<ConsoleTenant>) => {
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, tenant[k as keyof ConsoleTenant]])) as Partial<ConsoleTenant>;
    updateTenant(tenant.id, patch);
    return () => updateTenant(tenant.id, before);
  };

  const changePlan = (tenant: ConsoleTenant, plan: PlanId, seats: number) => {
    const meta = PLAN_META[plan];
    const billed = tenant.status === "active" || tenant.status === "suspended";
    const undo = apply(tenant, {
      plan,
      seatLimit: seats,
      mrr: billed ? seats * meta.seatPrice : 0,
      /* Keep what the tenant had switched on, inside the new entitlement. */
      modules: tenant.modules.filter((m) => meta.modules.includes(m) || MODULES.find((x) => x.id === m)?.alwaysOn),
    });
    const from = `${PLAN_META[tenant.plan].label} · ${num(tenant.seatLimit)} seats`;
    const to = `${meta.label} · ${num(seats)} seats`;
    logActivity(tenant.id, { category: "billing", action: "Plan changed by the platform", detail: `${from} → ${to}` });
    mockAction(`${tenant.name} moved to ${to}`, { description: `Was ${from}. Prorated on the next invoice; the owner has been emailed.`, undo });
  };

  const dialogs = (
    <>
      {pending?.kind === "plan" && t && (
        <ChangePlanDialog
          tenant={t}
          onOpenChange={(v) => !v && close()}
          onConfirm={(plan, seats) => {
            changePlan(t, plan, seats);
            close();
          }}
        />
      )}

      {pending?.kind === "trial" && t && (
        <ExtendTrialDialog
          tenant={t}
          onOpenChange={(v) => !v && close()}
          onConfirm={(newEnd, days, note) => {
            const undo = apply(t, { trialEndsAt: newEnd });
            logActivity(t.id, { category: "billing", action: "Trial extended", detail: `+${days} days, to ${fmtDate(newEnd)}${note ? ` — ${note}` : ""}` });
            mockAction(`Trial extended to ${fmtDate(newEnd)}`, { description: `${t.name} · +${days} days. The owner has been emailed.`, undo });
            close();
          }}
        />
      )}

      {pending?.kind === "impersonate" && t && (
        <ImpersonateDialog
          tenant={t}
          onOpenChange={(v) => !v && close()}
          onConfirm={({ reason, ticket, minutes }) => {
            logActivity(t.id, { category: "support", action: "Support session started (read-only)", detail: `${ticket} · ${minutes} min · ${reason}` });
            startSupportSession({ tenantId: t.id, tenantName: t.name, ticket, reason, minutes });
            mockAction(`Support session open in ${t.name}`, {
              description: `${ticket} · ${minutes} minutes, read-only. ${t.ownerName} has been notified.`,
              tone: "warning",
            });
            close();
            router.push("/dashboard");
          }}
        />
      )}

      <ReasonDialog
        open={pending?.kind === "suspend"}
        onOpenChange={(v) => !v && close()}
        title={`Suspend ${t?.name ?? "tenant"}?`}
        description="Every user is signed out and sees a suspension notice. Data is retained and nothing is deleted; scheduled jobs such as pay runs and leave accrual pause until you reactivate."
        confirmLabel="Suspend tenant"
        commentLabel="Reason (shown to the tenant owner)"
        commentPlaceholder="e.g. Two invoices unpaid past 60 days under the billing policy."
        onConfirm={(reason) => {
          if (!t) return;
          const undo = apply(t, { status: "suspended", statusNote: reason });
          logActivity(t.id, { category: "lifecycle", action: "Tenant suspended", detail: reason });
          mockAction(`${t.name} suspended`, { description: `${num(t.seatsUsed)} users signed out. Reason sent to ${t.ownerEmail}.`, tone: "warning", undo });
        }}
      />

      <ConfirmDialog
        open={pending?.kind === "reactivate"}
        onOpenChange={(v) => !v && close()}
        title={`Reactivate ${t?.name ?? "tenant"}?`}
        description="Users can sign in again straight away and paused jobs resume from where they stopped. Make sure the reason for the suspension is resolved."
        confirmLabel="Reactivate"
        onConfirm={() => {
          if (!t) return;
          const backToTrial = t.trialEndsAt !== undefined && daysFromToday(t.trialEndsAt) > 0 && t.mrr === 0 && t.plan !== "free";
          const undo = apply(t, { status: backToTrial ? "trial" : "active", statusNote: undefined, payment: t.payment === "none" ? "none" : "ok" });
          logActivity(t.id, { category: "lifecycle", action: "Tenant reactivated", detail: backToTrial ? "Returned to trial" : "Returned to active" });
          mockAction(`${t.name} reactivated`, { description: "Users can sign in again. The owner has been emailed.", undo });
        }}
      />

      <ConfirmDialog
        open={pending?.kind === "export"}
        onOpenChange={(v) => !v && close()}
        title={`Export all data for ${t?.name ?? "tenant"}?`}
        description={`Builds an encrypted archive of every record — employees, attendance, leave, payroll, documents and the audit trail — in open formats (CSV + JSON + original files). The download link goes to the tenant owner, ${t?.ownerEmail ?? ""}, and expires in 7 days.`}
        confirmLabel="Start export"
        onConfirm={() => {
          if (!t) return;
          logActivity(t.id, { category: "lifecycle", action: "Full data export requested", detail: `Link to ${t.ownerEmail}, expires in 7 days` });
          mockAction("Export queued", { description: `${t.name} · about ${Math.max(1, Math.round(t.storageUsedGb))} GB. The owner is emailed when it is ready.`, tone: "info" });
        }}
      />

      <ReasonDialog
        open={pending?.kind === "delete"}
        onOpenChange={(v) => !v && close()}
        title={`Schedule deletion of ${t?.name ?? "tenant"}?`}
        description={`The tenant is closed today and every user loses access. After a ${DELETION_RETENTION_DAYS}-day retention window all of its data — including backups — is permanently purged.`}
        confirmLabel="Schedule deletion"
        commentLabel="Reason"
        commentPlaceholder="e.g. Owner's written erasure request, ticket SUP-4520."
        typePhrase={t?.subdomain}
        onConfirm={(reason) => {
          if (!t) return;
          const undo = apply(t, { status: "scheduled_deletion", deletionScheduledAt: CONSOLE_TODAY, mrr: 0, statusNote: reason });
          const purge = purgeDate({ deletionScheduledAt: CONSOLE_TODAY })!;
          logActivity(t.id, { category: "lifecycle", action: "Deletion scheduled", detail: `Purge on ${fmtDate(purge)} — ${reason}` });
          mockAction(`${t.name} scheduled for deletion`, {
            description: `Access closed. Permanent purge on ${fmtDate(purge)} unless cancelled.`,
            tone: "warning",
            undo,
          });
        }}
      >
        <Alert tone="info" title="DPDP Act 2023 / GDPR">
          Erasure must follow the data principal&apos;s request or the end of the purpose. Offer the owner a full export
          first; the purge certificate is emailed to them when the window closes.
        </Alert>
      </ReasonDialog>

      <ConfirmDialog
        open={pending?.kind === "cancel_delete"}
        onOpenChange={(v) => !v && close()}
        title={`Cancel the scheduled deletion of ${t?.name ?? "tenant"}?`}
        description={`Nothing has been purged yet${t && purgeDate(t) ? ` — the purge was due ${fmtDate(purgeDate(t)!)}` : ""}. The tenant returns as Suspended; reactivate it to restore access.`}
        confirmLabel="Cancel deletion"
        onConfirm={() => {
          if (!t) return;
          const undo = apply(t, { status: "suspended", deletionScheduledAt: undefined, statusNote: "Deletion cancelled — awaiting reactivation." });
          logActivity(t.id, { category: "lifecycle", action: "Scheduled deletion cancelled", detail: "Tenant held as suspended" });
          mockAction(`Deletion of ${t.name} cancelled`, { description: "The tenant is suspended until you reactivate it.", undo });
        }}
      />
    </>
  );

  return { open, can, dialogs };
}
