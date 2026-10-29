"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, FileText, Lock, Mail, MailWarning, Send, Users } from "lucide-react";
import { inr, num } from "@/lib/format";
import { DEMO_NOW, DEPARTMENTS } from "@/mock/org";
import {
  OUTPUT_RUNS,
  payslipRegister,
  runIsApproved,
  sumBy,
  type PayslipRegRow,
} from "@/mock/finance-run";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, FilterSelect } from "@/components/ui/overlays";
import { Alert } from "@/components/ui/primitives";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { downloadFile, ReconcileCheck } from "@/components/finance/kit";
import { GatedBlocked, RunSelect } from "./run-select";
import { payslipColumns } from "./columns";

/* ============================================================================
   /payroll/payslips — the payslip register for one pay run. Publishing is a
   post-approval step: a run Finance has not approved cannot release payslips.
   ========================================================================== */

type Confirm = { kind: "publish" | "email"; rows: PayslipRegRow[]; clear?: () => void } | null;

export default function PayslipRegisterPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const [runId, setRunId] = React.useState(OUTPUT_RUNS[0].id);
  const [byRun, setByRun] = React.useState<Record<string, PayslipRegRow[]>>(() =>
    Object.fromEntries(OUTPUT_RUNS.map((r) => [r.id, payslipRegister(r.id)])),
  );
  const [pubFilter, setPubFilter] = React.useState("all");
  const [mailFilter, setMailFilter] = React.useState("all");
  const [deptFilter, setDeptFilter] = React.useState("all");
  const [confirm, setConfirm] = React.useState<Confirm>(null);

  const run = OUTPUT_RUNS.find((r) => r.id === runId)!;
  const approved = runIsApproved(run);
  const rows = byRun[runId];
  const blockReason = approved
    ? null
    : `${run.code} is ${run.status === "calculated" ? "Calculated" : run.status} — payslips can be published only after the Finance Controller approves the run.`;

  const filtered = rows.filter(
    (r) =>
      (pubFilter === "all" || (pubFilter === "published") === r.published) &&
      (mailFilter === "all" || r.emailState === mailFilter) &&
      (deptFilter === "all" || DEPARTMENTS.find((d) => d.id === deptFilter)?.name === r.department),
  );
  const pending = rows.filter((r) => !r.published);
  const published = rows.filter((r) => r.published);
  const emailed = rows.filter((r) => r.emailState === "emailed");
  const bounced = rows.filter((r) => r.emailState === "bounced");

  const patch = (codes: Set<string>, fn: (r: PayslipRegRow) => PayslipRegRow) =>
    setByRun((prev) => ({ ...prev, [runId]: prev[runId].map((r) => (codes.has(r.code) ? fn(r) : r)) }));

  const publish = (targets: PayslipRegRow[]) => {
    const codes = new Set(targets.filter((r) => !r.published).map((r) => r.code));
    patch(codes, (r) => ({
      ...r,
      published: true,
      publishedAt: DEMO_NOW,
      holdNote: null,
      emailState: "emailed",
      emailedAt: DEMO_NOW,
      bounceNote: null,
    }));
    mockAction(`Published ${num(codes.size)} payslip${codes.size === 1 ? "" : "s"} for ${run.label}`, {
      description: "Visible in self-service now, and emailed as password-protected PDFs (PAN first five + date of birth).",
    });
  };

  const email = (targets: PayslipRegRow[]) => {
    const codes = new Set(targets.filter((r) => r.published).map((r) => r.code));
    patch(codes, (r) => ({ ...r, emailState: "emailed", emailedAt: DEMO_NOW, bounceNote: null }));
    mockAction(`Emailed ${num(codes.size)} payslip${codes.size === 1 ? "" : "s"}`, {
      description: "Queued on the notification outbox; delivery receipts update the Email column.",
    });
  };

  const download = (targets: PayslipRegRow[]) =>
    targets.length === 1
      ? downloadFile(`Payslip_${targets[0].code}_${run.periodId}.pdf`, `${targets[0].name} · net ${inr(targets[0].net, { decimals: false })}`)
      : downloadFile(`Payslips_${run.code}_${targets.length}.zip`, `${num(targets.length)} password-protected PDFs.`);

  const columns = React.useMemo(
    () => payslipColumns({ runId, onEmail: (r) => setConfirm({ kind: "email", rows: r }), onDownload: download }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId],
  );

  return (
    <PageBody>
      <PageHeader
        title="Payslip register"
        description="Every payslip in a pay run — what it pays, whether employees can see it, and whether the email reached them. Net pay here is the run's net pay, employee for employee."
        actions={
          <>
            <RunSelect value={runId} onChange={setRunId} />
            <Gated menuKey="payroll.payslips" action="X">
              <Button size="sm" variant="outline" onClick={() => download(rows)}>
                <Download /> Download all
              </Button>
            </Gated>
            <GatedBlocked
              menuKey="payroll.payslips"
              action="X"
              reason={blockReason ?? (pending.length ? null : "Every payslip in this run is already published.")}
            >
              <Button
                size="sm"
                disabled={!approved || pending.length === 0}
                onClick={() => setConfirm({ kind: "publish", rows: pending })}
              >
                <Send /> Publish pending ({num(pending.length)})
              </Button>
            </GatedBlocked>
          </>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={10} />
        </>
      ) : (
        <>
          {!approved && (
            <Alert
              tone="warning"
              icon={Lock}
              title="Not yet publishable"
              action={
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/payroll/runs/${run.id}`}>Open the run</Link>
                </Button>
              }
            >
              {blockReason} Payroll Admin builds and locks the run; Lakshmi Pillai approves it. Until then these are
              draft figures and employees cannot see them.
            </Alert>
          )}

          <StatRow cols={4}>
            <StatTile label="Payslips in run" value={num(rows.length)} icon={Users} hint={`${run.code} · ${run.label}`} />
            <StatTile
              label="Published"
              value={`${num(published.length)} / ${num(rows.length)}`}
              icon={CheckCircle2}
              tone={published.length === rows.length ? "good" : "warning"}
              onClick={() => setPubFilter(published.length === rows.length ? "all" : "unpublished")}
              hint={pending.length ? `${num(pending.length)} not yet visible to employees` : "All visible in self-service"}
            />
            <StatTile
              label="Emailed"
              value={num(emailed.length)}
              icon={Mail}
              hint={bounced.length ? `${num(bounced.length)} bounced — filter to resend` : "No delivery failures"}
              tone={bounced.length ? "warning" : "neutral"}
              onClick={() => setMailFilter(bounced.length ? "bounced" : "all")}
            />
            <StatTile label="Net pay in register" value={inr(sumBy(rows, (r) => r.net), { decimals: false })} icon={FileText} tone="accent" />
          </StatRow>

          <ReconcileCheck
            label="Register reconciles to the run"
            leftLabel="Σ payslip net"
            left={sumBy(rows, (r) => r.net)}
            rightLabel={`${run.code} net pay`}
            right={run.totals.net}
          />

          <DataTable<PayslipRegRow>
            columns={columns}
            data={filtered}
            getRowId={(r) => r.code}
            searchKeys={["name", "code", "department"]}
            searchPlaceholder="Search name, code or department…"
            exportName={`payslip-register-${run.periodId}`}
            enableSelection
            onRowClick={(r) => router.push(`/payroll/runs/${run.id}/employee/${r.code}`)}
            rowTone={(r) => (r.emailState === "bounced" ? "warning" : r.net < 0 ? "danger" : undefined)}
            emptyIcon={MailWarning}
            emptyTitle="No payslip matches these filters"
            emptyDescription="Clear the published, email or department filter to see the whole run."
            emptyAction={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setPubFilter("all");
                  setMailFilter("all");
                  setDeptFilter("all");
                }}
              >
                Clear filters
              </Button>
            }
            filters={
              <>
                <FilterSelect
                  label="Published"
                  value={pubFilter}
                  onValueChange={setPubFilter}
                  options={[
                    { value: "published", label: "Published" },
                    { value: "unpublished", label: "Not published" },
                  ]}
                />
                <FilterSelect
                  label="Email"
                  value={mailFilter}
                  onValueChange={setMailFilter}
                  options={[
                    { value: "emailed", label: "Emailed" },
                    { value: "bounced", label: "Bounced" },
                    { value: "not_emailed", label: "Not emailed" },
                  ]}
                />
                <FilterSelect
                  label="Department"
                  value={deptFilter}
                  onValueChange={setDeptFilter}
                  width="w-[190px]"
                  options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))}
                />
              </>
            }
            bulkActions={(sel, clear) => (
              <>
                <GatedBlocked menuKey="payroll.payslips" action="X" reason={blockReason}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!approved || !sel.some((r) => !r.published)}
                    onClick={() => setConfirm({ kind: "publish", rows: sel.filter((r) => !r.published), clear })}
                  >
                    <Send /> Publish
                  </Button>
                </GatedBlocked>
                <Gated menuKey="payroll.payslips" action="X">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!sel.some((r) => r.published)}
                    onClick={() => setConfirm({ kind: "email", rows: sel.filter((r) => r.published), clear })}
                  >
                    <Mail /> Email
                  </Button>
                </Gated>
                <Gated menuKey="payroll.payslips" action="X">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      download(sel);
                      clear();
                    }}
                  >
                    <Download /> Download
                  </Button>
                </Gated>
              </>
            )}
          />
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={
          confirm?.kind === "publish"
            ? `Publish ${num(confirm.rows.length)} payslip${confirm.rows.length === 1 ? "" : "s"}?`
            : `Email ${num(confirm?.rows.length ?? 0)} payslip${confirm?.rows.length === 1 ? "" : "s"}?`
        }
        description={
          confirm?.kind === "publish"
            ? `Employees see their ${run.label} payslip in self-service immediately and receive it by email. A published payslip can be corrected only by an off-cycle run.`
            : "Each employee receives a password-protected PDF at their work address. Bounced addresses are retried three times."
        }
        confirmLabel={confirm?.kind === "publish" ? "Publish and email" : "Send emails"}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "publish") publish(confirm.rows);
          else email(confirm.rows);
          confirm.clear?.();
          setConfirm(null);
        }}
      />
    </PageBody>
  );
}
