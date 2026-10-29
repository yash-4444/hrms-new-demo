"use client";

import * as React from "react";
import Link from "next/link";
import { Banknote, FileStack, Landmark, Lock, Undo2, UserX } from "lucide-react";
import { inr, num } from "@/lib/format";
import { DEMO_NOW } from "@/mock/org";
import { OUTPUT_RUNS, RTGS_THRESHOLD, bankAdviceFor, runIsApproved } from "@/mock/finance-run";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { DownloadButton, ReconcileCheck } from "@/components/finance/kit";
import { RunSelect } from "../payslips/run-select";
import { AdviceWorkflow, type AdviceStage, type Stamp } from "./workflow";
import { FilesTable, HeldTable } from "./files";
import { ReturnedCredits } from "./returned";

/* ============================================================================
   /payroll/bank-advice — salary credit files per bank and mode. The files plus
   the held salaries always add back to the run's net pay, and a file reaches
   the bank only after a second person (the Finance Controller) approves it.
   ========================================================================== */

interface Batch {
  stage: AdviceStage;
  maker: Stamp | null;
  checker: Stamp | null;
}

function seed(): Record<string, Batch> {
  return Object.fromEntries(
    OUTPUT_RUNS.map((run) => {
      const h = bankAdviceFor(run.id).history;
      const batch: Batch = h
        ? { stage: "paid", maker: { by: h.generatedBy, at: h.generatedAt }, checker: { by: h.approvedBy, at: h.approvedAt } }
        : { stage: runIsApproved(run) ? "ready" : "blocked", maker: null, checker: null };
      return [run.id, batch];
    }),
  );
}

const FILE_STATUS: Record<AdviceStage, string> = {
  blocked: "draft",
  ready: "not_started",
  generated: "maker_done",
  approved: "approved",
  paid: "paid",
};

export default function BankAdvicePage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [runId, setRunId] = React.useState(OUTPUT_RUNS[0].id);
  const [batches, setBatches] = React.useState<Record<string, Batch>>(seed);

  const run = OUTPUT_RUNS.find((r) => r.id === runId)!;
  const advice = React.useMemo(() => bankAdviceFor(runId), [runId]);
  const batch = batches[runId];
  const set = (b: Partial<Batch>) => setBatches((s) => ({ ...s, [runId]: { ...s[runId], ...b } }));
  const records = advice.files.reduce((n, f) => n + f.count, 0);
  const rtgs = advice.files.filter((f) => f.mode === "RTGS").reduce((n, f) => n + f.count, 0);
  const canDownload = batch.stage !== "blocked" && batch.stage !== "ready";
  const blockReason = `${run.code} is ${run.status === "calculated" ? "Calculated" : run.status}, not approved — bank files can be cut only from an approved run.`;
  const zipName = `BankAdvice_${run.code}.zip`;

  return (
    <PageBody>
      <PageHeader
        title="Bank advice"
        description={`Salary credit files in each bank's upload format, split NEFT / RTGS (RTGS for a credit of ${inr(RTGS_THRESHOLD, { decimals: false })} or more). Payroll Admin generates; the Finance Controller approves before anything reaches the bank.`}
        actions={
          <>
            <RunSelect value={runId} onChange={setRunId} />
            <Gated menuKey="payroll.bank_advice" action="X">
              <DownloadButton
                fileName={zipName}
                label="Download all"
                description={`${advice.files.length} files · ${num(records)} records · ${inr(advice.filesTotal, { decimals: false })}`}
                disabled={!canDownload}
              />
            </Gated>
          </>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={8} />
        </>
      ) : (
        <>
          {batch.stage === "blocked" && (
            <Alert
              tone="warning"
              icon={Lock}
              title="Generation is blocked until the run is approved"
              action={
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/payroll/runs/${run.id}`}>Open {run.code}</Link>
                </Button>
              }
            >
              {blockReason} The figures below are a preview of what the files will contain, computed from the current
              run.
            </Alert>
          )}

          <AdviceWorkflow
            subject={`the ${run.label} bank advice`}
            stage={batch.stage}
            maker={batch.maker}
            checker={batch.checker}
            blockReason={blockReason}
            onGenerate={() => {
              set({ stage: "generated", maker: { by: persona.name, at: DEMO_NOW } });
              mockAction(`Generated ${advice.files.length} bank files for ${run.label}`, {
                description: `${num(records)} credits · ${inr(advice.filesTotal, { decimals: false })}. Sent to the Finance Controller for approval.`,
              });
            }}
            onApprove={() => {
              set({ stage: "approved", checker: { by: persona.name, at: DEMO_NOW } });
              mockAction(`Approved the ${run.label} bank advice`, {
                description: "Files released for upload to the banks' corporate portals.",
              });
            }}
            onReject={(comment) => {
              set({ stage: "ready", maker: null });
              mockAction("Bank advice rejected", { description: comment, tone: "warning" });
            }}
          />

          <StatRow cols={4}>
            <StatTile label="Bank files" value={num(advice.files.length)} icon={FileStack} hint="HDFC · ICICI · SBI · Citi" />
            <StatTile label="Credits" value={num(records)} icon={Landmark} hint={`${num(rtgs)} by RTGS, ${num(records - rtgs)} by NEFT`} />
            <StatTile label="Amount in files" value={inr(advice.filesTotal, { decimals: false })} icon={Banknote} tone="accent" />
            <StatTile
              label="Held back"
              value={num(advice.held.length)}
              icon={UserX}
              tone={advice.held.length ? "warning" : "neutral"}
              hint={`${inr(advice.heldTotal, { decimals: false })} net not credited`}
            />
          </StatRow>

          <ReconcileCheck
            label="Bank advice reconciles to the run"
            leftLabel="Σ files + Σ held"
            left={advice.filesTotal + advice.heldTotal}
            rightLabel={`${run.code} net pay`}
            right={run.totals.net}
          />

          <Section title="Files" description="Click a file to see every credit in it." bodyClassName="p-3">
            <FilesTable
              files={advice.files}
              fileStatus={FILE_STATUS[batch.stage]}
              canDownload={canDownload}
              exportName={`bank-advice-${run.periodId}`}
            />
          </Section>

          <Section
            title="Held salaries"
            description="Not in any file. Missing-bank salaries are paid by an off-cycle file once the account is verified; negative nets carry forward."
            bodyClassName="p-3"
          >
            <HeldTable held={advice.held} exportName={`bank-advice-held-${run.periodId}`} />
          </Section>

          {run.status === "paid" && (
            <Section
              title="Returned credits"
              description="Credits the beneficiary bank bounced after upload. A supplementary file re-credits them — through the same maker-checker."
              actions={<Undo2 className="size-4 text-muted-foreground" aria-hidden />}
              bodyClassName="p-3"
            >
              <ReturnedCredits runId={run.id} periodId={run.periodId} />
            </Section>
          )}
        </>
      )}
    </PageBody>
  );
}
