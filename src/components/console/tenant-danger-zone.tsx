"use client";

import * as React from "react";
import { Ban, Download, Play, Trash2, Undo2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { DELETION_RETENTION_DAYS, daysFromToday, purgeDate, type ConsoleTenant } from "@/mock/console-tenants";
import { tenantActionBlock, type TenantActionKind } from "@/components/console/tenant-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Hint, Progress } from "@/components/ui/primitives";

/* Tenant detail — Danger zone. Suspend, export everything, and schedule
   deletion with a visible retention countdown before the irreversible purge. */

function Row({
  title,
  body,
  action,
}: {
  title: string;
  body: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 max-w-2xl flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <div className="mt-0.5 text-xs text-muted-foreground">{body}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export function TenantDangerZoneTab({
  tenant: t,
  onAction,
}: {
  tenant: ConsoleTenant;
  onAction: (kind: TenantActionKind) => void;
}) {
  const purge = purgeDate(t);
  const daysLeft = purge ? Math.max(0, daysFromToday(purge)) : null;
  const gated = (kind: TenantActionKind, button: React.ReactElement<{ disabled?: boolean }>) => {
    const why = tenantActionBlock(kind, t);
    return why ? (
      <Hint text={why}>
        <span className="inline-flex cursor-not-allowed">{React.cloneElement(button, { disabled: true })}</span>
      </Hint>
    ) : (
      button
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {purge && daysLeft !== null && (
        <Alert
          tone="danger"
          icon={Trash2}
          title={`Permanent purge in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — ${fmtDate(purge)}`}
          action={
            <Button size="sm" variant="outline" onClick={() => onAction("cancel_delete")}>
              <Undo2 /> Cancel deletion
            </Button>
          }
        >
          <p>
            Deletion was scheduled on {fmtDate(t.deletionScheduledAt!)}. Until the purge the data is retained, encrypted
            and inaccessible to everyone, including the tenant.
          </p>
          <Progress
            value={((DELETION_RETENTION_DAYS - daysLeft) / DELETION_RETENTION_DAYS) * 100}
            tone="danger"
            className="mt-2 bg-card/60"
            aria-label={`${DELETION_RETENTION_DAYS - daysLeft} of ${DELETION_RETENTION_DAYS} retention days elapsed`}
          />
        </Alert>
      )}

      <Card className="divide-y divide-border border-destructive/40">
        <div className="px-4 py-2.5">
          <h2 className="text-sm font-semibold text-destructive-fg">Danger zone</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Every action here is recorded in the platform audit log and the tenant&apos;s own trail.</p>
        </div>
        {t.status === "suspended" ? (
          <Row
            title="Reactivate tenant"
            body="Users can sign in again and paused jobs (pay runs, leave accrual, reminders) resume."
            action={
              <Button size="sm" variant="outline" onClick={() => onAction("reactivate")}>
                <Play /> Reactivate
              </Button>
            }
          />
        ) : (
          <Row
            title="Suspend tenant"
            body="Signs every user out and blocks sign-in with a suspension notice. Nothing is deleted. Requires a reason, which the owner sees."
            action={gated(
              "suspend",
              <Button size="sm" variant="outline" className="border-destructive/40 text-destructive-fg hover:bg-destructive-soft" onClick={() => onAction("suspend")}>
                <Ban /> Suspend
              </Button>,
            )}
          />
        )}
        <Row
          title="Export all data"
          body="An encrypted archive of every record and file, in open formats, sent to the tenant owner. Offer this before any deletion — it satisfies the right to data portability."
          action={gated(
            "export",
            <Button size="sm" variant="outline" onClick={() => onAction("export")}>
              <Download /> Export everything
            </Button>,
          )}
        />
        <Row
          title="Schedule deletion"
          body={
            <>
              Closes the tenant today; after a {DELETION_RETENTION_DAYS}-day retention window all data and backups are
              permanently purged and a deletion certificate is sent to the owner. Under India&apos;s DPDP Act 2023 (s.8(7))
              and the GDPR (Art. 17), personal data must be erased once its purpose ends or on the principal&apos;s request —
              the window exists only to undo a mistake.
            </>
          }
          action={gated(
            "delete",
            <Button size="sm" variant="destructive" onClick={() => onAction("delete")}>
              <Trash2 /> Schedule deletion
            </Button>,
          )}
        />
      </Card>
    </div>
  );
}
