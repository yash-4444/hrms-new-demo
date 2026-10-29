"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { FileCheck2, FileCog, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, num } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { runById } from "@/mock/payroll";
import {
  RETURN_FORM_META,
  ecrChallan,
  returnLinesFor,
  runPfTotal,
  runTdsTotal,
  sumLines,
  type ReturnFiling,
  type ReturnLine,
} from "@/mock/finance-statutory";
import { DownloadButton, FinStatus, MoneyCell, ReconcileCheck } from "@/components/finance/kit";
import { DataTable } from "@/components/data-table";
import { PersonCell, DetailList, DetailRow } from "@/components/people/person-cell";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { Gated } from "@/components/shell/page";

/** "in 29 days" / "due today" / "3 days overdue" / "filed 12 Sep 2026". */
export function dueText(f: ReturnFiling) {
  if (f.status === "filed" && f.filedOn) return { text: `Filed ${fmtDate(f.filedOn)}`, tone: "muted" as const };
  const d = differenceInCalendarDays(parseISO(f.dueDate), parseISO(DEMO_TODAY));
  if (d < 0) return { text: `${num(-d)} day${d === -1 ? "" : "s"} overdue`, tone: "danger" as const };
  if (d === 0) return { text: "Due today", tone: "danger" as const };
  return { text: `in ${num(d)} day${d === 1 ? "" : "s"}`, tone: d <= 7 ? ("warning" as const) : ("muted" as const) };
}

export const DUE_TONE_CLASS = {
  muted: "text-muted-foreground",
  warning: "text-warning-fg font-medium",
  danger: "text-destructive-fg font-medium",
};

const ID_LABEL: Record<ReturnFiling["form"], string> = { ECR: "UAN", ESI: "IP number", PT: "PAN", "24Q": "PAN", FORM16: "PAN", "12BA": "PAN" };
const EE_LABEL: Record<ReturnFiling["form"], string> = { ECR: "EE PF", ESI: "EE ESI", PT: "PT", "24Q": "TDS", FORM16: "TDS", "12BA": "Perquisite" };
const WAGE_LABEL: Record<ReturnFiling["form"], string> = { ECR: "EPF wages", ESI: "ESI wages", PT: "Gross", "24Q": "Gross paid", FORM16: "Gross salary", "12BA": "Gross salary" };

export function FilingSheet({
  filing,
  onOpenChange,
  onGenerate,
  onMarkFiled,
}: {
  filing: ReturnFiling | null;
  onOpenChange: (v: boolean) => void;
  onGenerate: (f: ReturnFiling) => void;
  onMarkFiled: (f: ReturnFiling) => void;
}) {
  const lines = React.useMemo(() => (filing ? returnLinesFor(filing) : []), [filing]);
  const form = filing?.form ?? "ECR";
  const hasEr = form === "ECR" || form === "ESI";

  const columns = React.useMemo<ColumnDef<ReturnLine, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Employee", cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.code} size={22} /> },
      { accessorKey: "idNo", header: ID_LABEL[form], cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.idNo}</span> },
      { accessorKey: "wages", header: WAGE_LABEL[form], cell: ({ row }) => <MoneyCell value={row.original.wages} /> },
      { accessorKey: "ee", header: EE_LABEL[form], cell: ({ row }) => <MoneyCell value={row.original.ee} /> },
      ...(hasEr
        ? [{ accessorKey: "er", header: "ER share", cell: ({ row }) => <MoneyCell value={row.original.er} /> } as ColumnDef<ReturnLine, unknown>]
        : []),
      { accessorKey: "detail", header: "Detail", cell: ({ row }) => <span className="text-[11px] text-muted-foreground">{row.original.detail}</span> },
    ],
    [form, hasEr],
  );

  if (!filing) return <Sheet open={false} onOpenChange={onOpenChange} />;

  const due = dueText(filing);
  const run = runById(filing.periodIds[filing.periodIds.length - 1]);
  const openRun = filing.form !== "FORM16" && filing.form !== "12BA" && run && run.status !== "paid" ? run : null;
  const challan = filing.form === "ECR" ? ecrChallan(filing.periodIds[0]) : null;
  const eeSum = sumLines(lines, "ee");

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent width="sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>
            {filing.title} · {filing.periodLabel}
          </SheetTitle>
          <SheetDescription>
            {RETURN_FORM_META[filing.form].authority} · {filing.fy} · {filing.fileName}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <FinStatus status={filing.status} />
            <span className={cn("text-xs", DUE_TONE_CLASS[due.tone])}>
              Due {fmtDate(filing.dueDate)} · {due.text}
            </span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {filing.status === "due" && (
                <Gated menuKey="payroll.returns" action="X">
                  <Button size="sm" onClick={() => onGenerate(filing)}>
                    <FileCog /> Generate file
                  </Button>
                </Gated>
              )}
              {filing.status === "generated" && (
                <Gated menuKey="payroll.returns" action="X">
                  <Button size="sm" onClick={() => onMarkFiled(filing)}>
                    <FileCheck2 /> Mark filed
                  </Button>
                </Gated>
              )}
              <Gated menuKey="payroll.returns" action="X">
                <DownloadButton
                  fileName={filing.fileName}
                  disabled={filing.status === "due"}
                  description={`${num(filing.records)} records · ${inr(filing.total, { decimals: false })}`}
                />
              </Gated>
            </div>
          </div>

          {openRun && (
            <Alert tone="warning" title={`${openRun.label} run is ${openRun.status}, not yet paid`}>
              Generating now builds the file from the calculated run. Regenerate after the Finance Controller approves it if
              anything changes.
            </Alert>
          )}
          {filing.records === 0 && (
            <Alert tone="info" title="Nil return">
              No employee falls under this levy for the period. The portal still expects a nil filing.
            </Alert>
          )}

          <DetailList className="rounded-md border border-border px-3">
            <DetailRow label="Records">{num(filing.records)}</DetailRow>
            <DetailRow label={EE_LABEL[filing.form]}>{inr(filing.employeeShare, { decimals: false })}</DetailRow>
            {challan && (
              <>
                <DetailRow label="ER — EPS 8.33%">{inr(challan.eps, { decimals: false })}</DetailRow>
                <DetailRow label="ER — EPF difference">{inr(challan.erEpf, { decimals: false })}</DetailRow>
                <DetailRow label="EDLI 0.5% + admin 0.5%">{inr(challan.edli + challan.admin, { decimals: false })}</DetailRow>
              </>
            )}
            {filing.form === "ESI" && <DetailRow label="ER ESI 3.25%">{inr(filing.employerShare, { decimals: false })}</DetailRow>}
            <DetailRow label="Total remittance">{inr(filing.total, { decimals: false })}</DetailRow>
            {filing.generatedOn && <DetailRow label="Generated">{fmtDate(filing.generatedOn)}</DetailRow>}
            {filing.ackNo && <DetailRow label="Acknowledgement"><span className="font-mono">{filing.ackNo}</span></DetailRow>}
          </DetailList>

          <ReconcileCheck label="File totals" leftLabel="Σ lines" left={eeSum} rightLabel="filing" right={filing.employeeShare} />
          {filing.form === "ECR" && (
            <ReconcileCheck label="Matches the pay run" leftLabel="ECR EE" left={eeSum} rightLabel={`Σ ${filing.periodLabel} run PF`} right={runPfTotal(filing.periodIds[0])} />
          )}
          {filing.form === "24Q" && (
            <ReconcileCheck
              label="Matches the pay runs"
              leftLabel="24Q TDS"
              left={eeSum}
              rightLabel={filing.periodIds.map((p) => runById(p)?.label.slice(0, 3) ?? p).join(" + ") + " TDS"}
              right={runTdsTotal(filing.periodIds)}
            />
          )}

          <DataTable<ReturnLine>
            columns={columns}
            data={lines}
            getRowId={(l) => l.code}
            searchKeys={["name", "code", "idNo"]}
            searchPlaceholder="Search name, code or ID…"
            exportName={filing.fileName.replace(/\.[a-z0-9]+$/i, "")}
            pageSize={10}
            dense
            emptyIcon={Users}
            emptyTitle="No contributors this period"
            emptyDescription="Every employee is outside this levy, so the return is filed as nil."
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
