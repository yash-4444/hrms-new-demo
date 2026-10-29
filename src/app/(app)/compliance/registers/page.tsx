"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpenCheck, Download, FileCog, Loader2 } from "lucide-react";
import { fmtDateTime, num } from "@/lib/format";
import { STATUTORY_REGISTERS, type StatutoryRegister } from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Progress } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { TonePill, useSimulatedTask } from "@/components/platform/kit";

const PERIODS = [
  { value: "2026-08", label: "August 2026" },
  { value: "2026-07", label: "July 2026" },
  { value: "2026-06", label: "June 2026" },
  { value: "2026-05", label: "May 2026" },
  { value: "2026-04", label: "April 2026" },
  { value: "FY2025-26", label: "FY 2025-26 (annual)" },
];

export default function RegistersPage() {
  const loading = useFakeLoad();
  const [period, setPeriod] = React.useState("2026-08");
  const [actFilter, setActFilter] = React.useState("all");
  const [generated, setGenerated] = React.useState<Record<string, string>>({});
  const task = useSimulatedTask(2000);

  const acts = [...new Set(STATUTORY_REGISTERS.map((r) => r.act))];
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;
  const data = STATUTORY_REGISTERS.filter((r) => actFilter === "all" || r.act === actFilter);

  const generate = (r: StatutoryRegister) =>
    task.start(r.id, () => {
      setGenerated((g) => ({ ...g, [`${r.id}:${period}`]: "2026-09-16T14:35:00" }));
      mockAction(`${r.form} — ${r.name} generated for ${periodLabel}`, {
        description: `${num(r.rows)} rows from locked payroll and attendance. Digitally signed PDF + XLSX are ready to download.`,
      });
    });

  const columns: ColumnDef<StatutoryRegister, unknown>[] = [
    {
      accessorKey: "name",
      header: "Register",
      cell: ({ row }) => (
        <div className="text-xs">
          <p className="font-medium">{row.original.name}</p>
          <p className="text-[11px] text-muted-foreground">{row.original.form}</p>
        </div>
      ),
    },
    { accessorKey: "act", header: "Statute", cell: ({ row }) => <p className="max-w-[280px] text-xs text-muted-foreground">{row.original.act}</p> },
    { accessorKey: "frequency", header: "Frequency", cell: ({ row }) => <span className="text-xs">{row.original.frequency}</span> },
    { accessorKey: "scope", header: "Covers", cell: ({ row }) => <span className="text-xs">{row.original.scope}</span> },
    { accessorKey: "rows", header: "Rows", cell: ({ row }) => <NumCell>{num(row.original.rows)}</NumCell> },
    {
      id: "status",
      header: `Status · ${periodLabel}`,
      cell: ({ row }) => {
        const r = row.original;
        if (task.runningKey === r.id)
          return (
            <div className="w-[140px]">
              <Progress value={task.progress} aria-label={`Generating ${r.name}`} />
              <p className="mt-1 text-[11px] text-muted-foreground">Generating… {task.progress}%</p>
            </div>
          );
        const at = generated[`${r.id}:${period}`] ?? (period === "2026-08" ? r.lastGeneratedAt : null);
        return at ? <TonePill tone="success">Generated {fmtDateTime(at)}</TonePill> : <MutedCell>Not generated</MutedCell>;
      },
    },
    {
      id: "__a",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const r = row.original;
        const at = generated[`${r.id}:${period}`] ?? (period === "2026-08" ? r.lastGeneratedAt : null);
        return (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Gated menuKey="compliance.registers" action="X">
              <Button size="sm" variant="outline" disabled={!!task.runningKey} onClick={() => generate(r)}>
                {task.runningKey === r.id ? <Loader2 className="animate-spin" /> : <FileCog />} {at ? "Regenerate" : "Generate"}
              </Button>
            </Gated>
            <Gated menuKey="compliance.registers" action="X">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Download ${r.name}`}
                disabled={!at}
                onClick={() => mockAction(`Downloading ${r.form.replace(/\W+/g, "-")}_${period}.pdf`, { description: "Signed with the establishment's DSC. An XLSX copy is included.", tone: "info" })}
              >
                <Download />
              </Button>
            </Gated>
          </div>
        );
      },
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Statutory Registers"
        description="Registers an inspector can ask for under the Shops & Establishments Acts, the Code on Wages, EPF, ESI and the Maternity Benefit Act — generated from locked payroll and attendance, never typed by hand."
        actions={<FilterSelect label="Period" value={period} onValueChange={(v) => v !== "all" && setPeriod(v)} options={PERIODS} allLabel="Choose period" width="w-[220px]" />}
      />

      {loading ? (
        <TableSkeleton />
      ) : (
        <>
          <Alert tone="info" icon={BookOpenCheck} title="Registers are maintained electronically">
            Karnataka permits electronic registers under Rule 24-A. Keep a signed copy at each establishment for inspection; the download includes the establishment registration number.
          </Alert>
          <DataTable
            columns={columns}
            data={data}
            searchKeys={["name", "form", "act", "scope"]}
            searchPlaceholder="Search registers…"
            filters={<FilterSelect label="Statute" value={actFilter} onValueChange={setActFilter} width="w-[260px]" options={acts.map((a) => ({ value: a, label: a }))} />}
            exportName="statutory-registers"
            emptyIcon={BookOpenCheck}
            emptyTitle="No registers match"
            emptyDescription="Clear the statute filter to see every register."
          />
        </>
      )}
    </PageBody>
  );
}
