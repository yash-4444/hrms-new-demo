"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Undo2 } from "lucide-react";
import { inr } from "@/lib/format";
import { DEMO_NOW } from "@/mock/org";
import { BANK_ADVICE_BANKS, returnedCredits, sumBy } from "@/mock/finance-run";
import { mockAction, useApp } from "@/components/app-state";
import { Badge } from "@/components/ui/primitives";
import { DataTable, MutedCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { Gated } from "@/components/shell/page";
import { DownloadButton, MoneyCell } from "@/components/finance/kit";
import { AdviceWorkflow, type AdviceStage, type Stamp } from "./workflow";

/* The supplementary re-credit file for credits a beneficiary bank returned. */

type Returned = ReturnType<typeof returnedCredits>[number];

const COLUMNS: ColumnDef<Returned, unknown>[] = [
  { accessorKey: "name", header: "Employee", cell: ({ row }) => <PersonCell name={row.original.name} code={row.original.code} /> },
  { id: "bank", accessorFn: (r) => BANK_ADVICE_BANKS[r.bank].name, header: "Bank" },
  {
    accessorKey: "returnCode",
    header: "Return",
    cell: ({ row }) => (
      <span className="flex flex-col gap-0.5">
        <Badge variant="outline" className="w-fit font-mono">
          {row.original.returnCode}
        </Badge>
        <span className="text-[11px] text-muted-foreground">{row.original.returnNote}</span>
      </span>
    ),
  },
  { accessorKey: "account", header: "New account", cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell> },
  {
    accessorKey: "amount",
    header: () => <span className="block text-right">Amount</span>,
    cell: ({ getValue }) => <MoneyCell value={Number(getValue())} />,
  },
];

export function ReturnedCredits({ runId, periodId }: { runId: string; periodId: string }) {
  const { persona } = useApp();
  const rows = React.useMemo(() => returnedCredits(runId), [runId]);
  const [stage, setStage] = React.useState<AdviceStage>("ready");
  const [maker, setMaker] = React.useState<Stamp | null>(null);
  const [checker, setChecker] = React.useState<Stamp | null>(null);
  const total = sumBy(rows, (r) => r.amount);
  const fileName = `HDFC_SAL_${periodId.replace("-", "")}_RECREDIT_NEFT.txt`;

  return (
    <div className="flex flex-col gap-3">
      <AdviceWorkflow
        subject="the re-credit file"
        stage={stage}
        maker={maker}
        checker={checker}
        blockReason=""
        onGenerate={() => {
          setStage("generated");
          setMaker({ by: persona.name, at: DEMO_NOW });
          mockAction(`Generated ${fileName}`, {
            description: `${rows.length} credits · ${inr(total, { decimals: false })}. Awaiting the Finance Controller's approval.`,
          });
        }}
        onApprove={() => {
          setStage("approved");
          setChecker({ by: persona.name, at: DEMO_NOW });
          mockAction("Re-credit file approved", { description: "Released for upload on HDFC ENet." });
        }}
        onReject={(comment) => {
          setStage("ready");
          setMaker(null);
          mockAction("Re-credit file rejected", { description: comment, tone: "warning" });
        }}
      />
      <DataTable<Returned>
        columns={COLUMNS}
        data={rows}
        getRowId={(r) => r.code}
        exportName={`returned-credits-${periodId}`}
        emptyIcon={Undo2}
        emptyTitle="No returned credits"
        emptyDescription="Every credit in this run was accepted by the beneficiary bank."
        toolbar={
          <Gated menuKey="payroll.bank_advice" action="X">
            <DownloadButton
              fileName={fileName}
              description={`${rows.length} credits · ${inr(total, { decimals: false })}`}
              disabled={stage === "ready"}
            />
          </Gated>
        }
      />
      <p className="text-xs text-muted-foreground">
        These credits were part of the original files, so they are already inside the reconciled total above — the
        re-credit file moves the same {inr(total, { decimals: false })}, it does not add to it.
      </p>
    </div>
  );
}
