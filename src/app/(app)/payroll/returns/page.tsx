"use client";

import * as React from "react";
import { addDays, format, parseISO } from "date-fns";
import { AlarmClock, CalendarClock, FileCheck2, FileWarning } from "lucide-react";
import { fmtDate, inr, num } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { runById } from "@/mock/payroll";
import {
  form16Rows,
  monthStatutoryRecon,
  returnFilings,
  runPfTotal,
  runTdsTotal,
  type ReturnFiling,
} from "@/mock/finance-statutory";
import { mockAction } from "@/components/app-state";
import { ReconcileCheck } from "@/components/finance/kit";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { CardsSkeleton, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { FilingsTable } from "./filings-table";
import { FilingSheet, dueText } from "./filing-sheet";
import { MarkFiledDialog, type FiledDetails } from "./mark-filed-dialog";
import { Form16Tab } from "./form16-tab";

/* ============================================================================
   /payroll/returns — PF ECR, ESI, PT, Form 24Q, Form 16 and Form 12BA.

   Every figure is the sum of the pay runs it covers: the reconciliation strip
   proves PF + ESI + PT + TDS for a month equals that run's statutory total.
   ========================================================================== */

const RECON_MONTH = "2026-08";
const Q2_MONTHS = ["2026-07", "2026-08", "2026-09"];
const IN_30_DAYS = format(addDays(parseISO(DEMO_TODAY), 30), "yyyy-MM-dd");

export default function ReturnsPage() {
  const loading = useFakeLoad();
  const [filings, setFilings] = React.useState<ReturnFiling[]>(() => returnFilings());
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [filingFor, setFilingFor] = React.useState<ReturnFiling | null>(null);
  const f16 = React.useMemo(() => form16Rows(), []);
  const recon = React.useMemo(() => monthStatutoryRecon(RECON_MONTH), []);

  const open = filings.find((f) => f.id === openId) ?? null;
  const pending = filings.filter((f) => f.status !== "filed");
  const overdue = pending.filter((f) => f.dueDate < DEMO_TODAY);
  const in30 = pending.filter((f) => f.dueDate >= DEMO_TODAY && f.dueDate <= IN_30_DAYS);
  const next = [...pending].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0];
  const filedThisFy = filings.filter((f) => f.status === "filed" && (f.filedOn ?? "") >= "2026-04-01");
  const ecrAug = filings.find((f) => f.id === `ECR-${RECON_MONTH}`);
  const q2 = filings.find((f) => f.id === "24Q-2026-27-Q2");

  const generate = React.useCallback((targets: ReturnFiling[]) => {
    if (targets.length === 0) return;
    const ids = new Set(targets.map((t) => t.id));
    setFilings((prev) => prev.map((f) => (ids.has(f.id) ? { ...f, status: "generated", generatedOn: DEMO_TODAY } : f)));
    const openRun = targets.some((t) => {
      const run = runById(t.periodIds[t.periodIds.length - 1]);
      return t.form !== "FORM16" && t.form !== "12BA" && run && run.status !== "paid";
    });
    mockAction(
      targets.length === 1 ? `${targets[0].title} ${targets[0].periodLabel} generated` : `${num(targets.length)} return files generated`,
      {
        tone: openRun ? "warning" : "success",
        description: openRun
          ? "Built from the calculated September run — regenerate after the Finance Controller approves it."
          : targets.length === 1
            ? `${targets[0].fileName} · ${num(targets[0].records)} records · ${inr(targets[0].total, { decimals: false })}`
            : "Each file is validated against the portal's format before it is marked ready.",
        undo: () =>
          setFilings((prev) => prev.map((f) => (ids.has(f.id) ? { ...f, status: "due", generatedOn: null } : f))),
      },
    );
  }, []);

  const markFiled = (target: ReturnFiling, d: FiledDetails) => {
    setFilings((prev) =>
      prev.map((f) => (f.id === target.id ? { ...f, status: "filed", filedOn: d.filedOn, ackNo: d.ackNo } : f)),
    );
    mockAction(`${target.title} ${target.periodLabel} marked filed`, {
      description: `Acknowledgement ${d.ackNo} · filed ${fmtDate(d.filedOn)}. The record is now locked.`,
    });
  };

  return (
    <PageBody>
      <PageHeader
        title="Returns & forms"
        description="Statutory filings built straight from the pay runs — PF ECR, ESI, professional tax, Form 24Q, Form 16 and Form 12BA — with due-date countdowns from today."
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton rows={8} />
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile
              label="Next due"
              value={next ? fmtDate(next.dueDate) : "—"}
              icon={AlarmClock}
              tone={next && dueText(next).tone !== "muted" ? "warning" : "neutral"}
              hint={next ? `${next.title} ${next.periodLabel} · ${dueText(next).text}` : "Nothing pending"}
              onClick={next ? () => setOpenId(next.id) : undefined}
            />
            <StatTile label="Due in the next 30 days" value={num(in30.length)} icon={CalendarClock} hint={`${num(pending.length)} not yet filed in total`} />
            <StatTile
              label="Overdue"
              value={num(overdue.length)}
              icon={FileWarning}
              tone={overdue.length ? "critical" : "good"}
              hint={overdue.length ? overdue.map((f) => `${f.title} ${f.periodLabel}`).join(", ") : "Every past-due return is filed"}
            />
            <StatTile label="Filed in FY 2026-27" value={num(filedThisFy.length)} icon={FileCheck2} hint="With acknowledgement numbers on record" />
          </StatRow>

          <Section title="Reconciliation with the pay runs" description="Recomputed from the run rows every time this page loads.">
            <div className="flex flex-col gap-2">
              <ReconcileCheck
                label={`${runById(RECON_MONTH)?.label} statutory`}
                leftLabel={`ECR ${inr(recon.pf, { decimals: false })} + ESI ${inr(recon.esi, { decimals: false })} + PT ${inr(recon.pt, { decimals: false })} + TDS ${inr(recon.tds, { decimals: false })} =`}
                left={recon.sum}
                rightLabel="run statutory"
                right={recon.runStatutory}
              />
              {ecrAug && (
                <ReconcileCheck label="PF ECR August 2026" leftLabel="ECR EE" left={ecrAug.employeeShare} rightLabel="Σ run PF" right={runPfTotal(RECON_MONTH)} />
              )}
              {q2 && (
                <ReconcileCheck label="Form 24Q Q2" leftLabel="24Q TDS" left={q2.employeeShare} rightLabel="Jul + Aug + Sep TDS" right={runTdsTotal(Q2_MONTHS)} />
              )}
            </div>
          </Section>

          <Tabs defaultValue="calendar">
            <TabsList>
              <TabsTrigger value="calendar">Filing calendar</TabsTrigger>
              <TabsTrigger value="form16">Form 16 &amp; 12BA · FY 2025-26</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar" className="mt-3">
              <FilingsTable
                filings={filings}
                onOpen={(f) => setOpenId(f.id)}
                onGenerate={generate}
                onMarkFiled={setFilingFor}
              />
            </TabsContent>
            <TabsContent value="form16" className="mt-3">
              <Form16Tab rows={f16} filing={filings.find((f) => f.form === "FORM16")} />
            </TabsContent>
          </Tabs>
        </>
      )}

      <FilingSheet
        filing={open}
        onOpenChange={(v) => !v && setOpenId(null)}
        onGenerate={(f) => generate([f])}
        onMarkFiled={setFilingFor}
      />
      <MarkFiledDialog
        filing={filingFor}
        open={!!filingFor}
        onOpenChange={(v) => !v && setFilingFor(null)}
        onFiled={markFiled}
      />
    </PageBody>
  );
}
