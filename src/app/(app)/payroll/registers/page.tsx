"use client";

import * as React from "react";
import { FileCog } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { DEMO_NOW } from "@/mock/org";
import { OUTPUT_RUNS, runIsApproved } from "@/mock/finance-run";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { DownloadButton, FinStatus } from "@/components/finance/kit";
import { RunSelect } from "../payslips/run-select";
import { PfRegister, SalaryRegister } from "./salary-pf";
import { EsiRegister, LwfRegister, PtRegister } from "./esi-pt-lwf";
import { VarianceRegister } from "./variance";

/* ============================================================================
   /payroll/registers — statutory and management registers for one pay run.
   Each register is read straight off the run's computed amounts, and each
   carries a visible check that it adds back to the run totals.
   ========================================================================== */

const REGISTERS = [
  { id: "salary", label: "Salary", file: "Salary_Register", ext: "xlsx" },
  { id: "pf", label: "PF", file: "PF_Register", ext: "xlsx" },
  { id: "esi", label: "ESI", file: "ESI_Register", ext: "xlsx" },
  { id: "pt", label: "PT", file: "PT_Register", ext: "xlsx" },
  { id: "lwf", label: "LWF", file: "LWF_Register", ext: "xlsx" },
  { id: "variance", label: "Variance", file: "Variance_Register", ext: "xlsx" },
] as const;

type RegisterId = (typeof REGISTERS)[number]["id"];
type GenStamp = { by: string; at: string };

function seedStamps(): Record<string, GenStamp> {
  const out: Record<string, GenStamp> = {};
  for (const run of OUTPUT_RUNS) {
    if (!runIsApproved(run)) continue;
    for (const r of REGISTERS) out[`${run.id}|${r.id}`] = { by: "Rahul Desai", at: `${run.payDate}T19:10:00` };
  }
  return out;
}

export default function PayrollRegistersPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [runId, setRunId] = React.useState(OUTPUT_RUNS[0].id);
  const [tab, setTab] = React.useState<RegisterId>("salary");
  const [stamps, setStamps] = React.useState<Record<string, GenStamp>>(seedStamps);

  const run = OUTPUT_RUNS.find((r) => r.id === runId)!;
  const reg = REGISTERS.find((r) => r.id === tab)!;
  const stamp = stamps[`${runId}|${tab}`];
  const fileName = `${reg.file}_${run.periodId.replace("-", "")}.${reg.ext}`;

  const generate = () => {
    setStamps((s) => ({ ...s, [`${runId}|${tab}`]: { by: persona.name, at: DEMO_NOW } }));
    mockAction(`${reg.label} register generated for ${run.label}`, {
      description: runIsApproved(run)
        ? `${fileName} regenerated from the approved run.`
        : `${fileName} is a draft — ${run.code} is not yet approved, so figures may still change.`,
    });
  };

  return (
    <PageBody>
      <PageHeader
        title="Payroll registers"
        description="Salary, PF, ESI, PT, LWF and variance registers for a pay run. Every register is generated from the same computed amounts as the run, and shows the check that proves it."
        actions={<RunSelect value={runId} onChange={setRunId} />}
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={10} />
        </>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as RegisterId)} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList aria-label="Register">
              {REGISTERS.map((r) => (
                <TabsTrigger key={r.id} value={r.id}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex flex-wrap items-center gap-1.5">
              {stamp ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FinStatus status="generated" />
                  {stamp.by} · {fmtDateTime(stamp.at)}
                </span>
              ) : (
                <FinStatus status="not_started" />
              )}
              <Gated menuKey="payroll.registers" action="X">
                <Button size="sm" variant={stamp ? "outline" : "default"} onClick={generate}>
                  <FileCog /> {stamp ? "Regenerate" : "Generate"}
                </Button>
              </Gated>
              <Gated menuKey="payroll.registers" action="X">
                <DownloadButton
                  fileName={fileName}
                  description={`${reg.label} register · ${run.code} · ${run.label}`}
                  disabled={!stamp}
                />
              </Gated>
            </div>
          </div>

          <TabsContent value="salary">
            <SalaryRegister run={run} />
          </TabsContent>
          <TabsContent value="pf">
            <PfRegister run={run} />
          </TabsContent>
          <TabsContent value="esi">
            <EsiRegister run={run} />
          </TabsContent>
          <TabsContent value="pt">
            <PtRegister run={run} />
          </TabsContent>
          <TabsContent value="lwf">
            <LwfRegister run={run} />
          </TabsContent>
          <TabsContent value="variance">
            <VarianceRegister run={run} />
          </TabsContent>
        </Tabs>
      )}
    </PageBody>
  );
}
