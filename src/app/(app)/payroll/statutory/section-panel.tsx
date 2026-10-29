"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, History, PencilLine } from "lucide-react";
import { fmtDate, fmtDateTime, inr, pct } from "@/lib/format";
import { PT_SLABS, TAX_SLABS } from "@/mock/payroll";
import { statCurrent, statHistory, statVersionStatus, type StatSection, type StatVersion } from "@/mock/finance-statutory";
import { FinStatus } from "@/components/finance/kit";
import { DataTable, MutedCell } from "@/components/data-table";
import { DetailList, DetailRow } from "@/components/people/person-cell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { Gated, Section } from "@/components/shell/page";

/* ============================================================================
   One statutory section: what is in force, every version, and what changed.
   ========================================================================== */

const ptStateFor: Partial<Record<StatSection["id"], string>> = {
  pt_ka: "Karnataka",
  pt_mh: "Maharashtra",
  pt_ts: "Telangana",
};

export function SectionPanel({
  section,
  usage,
  onEdit,
}: {
  section: StatSection;
  usage?: React.ReactNode;
  onEdit: () => void;
}) {
  const current = statCurrent(section);
  const history = statHistory(section);
  const ptSlab = PT_SLABS.find((s) => s.state === ptStateFor[section.id]);

  const versionColumns = React.useMemo<ColumnDef<StatVersion, unknown>[]>(
    () => [
      {
        accessorKey: "version",
        header: "Version",
        cell: ({ row }) => <span className="font-mono text-xs">v{row.original.version}</span>,
      },
      {
        accessorKey: "effectiveFrom",
        header: "Effective from",
        cell: ({ row }) => <span className="tnum text-xs">{fmtDate(row.original.effectiveFrom)}</span>,
      },
      {
        id: "effectiveTo",
        header: "Effective to",
        cell: ({ row }) => {
          const next = section.versions.find((v) => v.version === row.original.version + 1);
          return next ? (
            <span className="tnum text-xs">{fmtDate(next.effectiveFrom)}</span>
          ) : (
            <MutedCell>Open-ended</MutedCell>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <FinStatus status={statVersionStatus(section, row.original)} />,
      },
      { accessorKey: "changedBy", header: "Changed by" },
      {
        accessorKey: "note",
        header: "Reason",
        cell: ({ row }) => <span className="line-clamp-2 text-xs text-muted-foreground">{row.original.note}</span>,
      },
    ],
    [section],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section
          title={section.title}
          description={`${section.authority} · v${current.version} in force since ${fmtDate(current.effectiveFrom)}`}
          actions={
            <Gated menuKey="payroll.statutory" action="E">
              <Button size="sm" variant="outline" onClick={onEdit}>
                <PencilLine /> New version
              </Button>
            </Gated>
          }
        >
          <p className="mb-2 text-xs text-muted-foreground">{section.blurb}</p>
          <DetailList>
            {section.params.map((p) => (
              <DetailRow key={p.key} label={p.label}>
                <span className="tnum">{current.values[p.key]}</span>
                {p.unit && <span className="ml-1 font-normal text-muted-foreground">{p.unit}</span>}
              </DetailRow>
            ))}
          </DetailList>
          {usage && <div className="mt-3">{usage}</div>}
        </Section>

        <Section title="Change history" description="Who changed what, and from which value.">
          <ol className="flex flex-col gap-3" aria-label={`${section.title} change history`}>
            {history.map((h) => (
              <li key={h.version} className="relative border-l-2 border-border pl-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="muted" className="font-mono">
                    v{h.version}
                  </Badge>
                  <span className="text-xs font-medium">Effective {fmtDate(h.effectiveFrom)}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  <History className="mr-1 inline size-3 align-[-2px]" aria-hidden />
                  {h.changedBy} · {fmtDateTime(h.changedOn)}
                </p>
                <p className="mt-1 text-xs">{h.note}</p>
                {h.diffs.length > 0 && h.version > 1 && (
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {h.diffs.map((d) => (
                      <li key={d.label} className="flex flex-wrap items-center gap-1 text-[11px]">
                        <span className="text-muted-foreground">{d.label}:</span>
                        <span className="tnum line-through decoration-muted-foreground/60">{d.from}</span>
                        <ArrowRight className="size-3 text-muted-foreground" aria-label="changed to" />
                        <span className="tnum font-medium">{d.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {h.version === 1 && <p className="mt-1 text-[11px] text-muted-foreground">Initial configuration.</p>}
              </li>
            ))}
          </ol>
        </Section>
      </div>

      {ptSlab && (
        <Section title={`${ptSlab.state} slabs`} description={ptSlab.rule} bodyClassName="p-0">
          <table className="w-full text-xs">
            <caption className="sr-only">{ptSlab.state} professional tax slabs</caption>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Monthly gross</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">PT</th>
              </tr>
            </thead>
            <tbody>
              {ptSlab.bands.map((b) => (
                <tr key={b.label} className="border-t border-border">
                  <td className="px-4 py-2">{b.label}</td>
                  <td className="tnum px-4 py-2 text-right font-medium">{b.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {section.id === "tds" && (
        <Section title="New regime slabs" description="Applied by the run to projected annual taxable income." bodyClassName="p-0">
          <table className="w-full text-xs">
            <caption className="sr-only">Income-tax slabs, new regime</caption>
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 text-left font-medium">Taxable income</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {TAX_SLABS.map((s) => (
                <tr key={s.from} className="border-t border-border">
                  <td className="tnum px-4 py-2">
                    {s.to === null
                      ? `Above ${inr(s.from, { decimals: false })}`
                      : `${inr(s.from, { decimals: false })} – ${inr(s.to, { decimals: false })}`}
                  </td>
                  <td className="tnum px-4 py-2 text-right font-medium">{s.rate === 0 ? "Nil" : pct(s.rate * 100, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      <Section title="Versions" description="Effective-dated. A run always uses the version in force on its period start." bodyClassName="p-3">
        <DataTable<StatVersion>
          columns={versionColumns}
          data={[...section.versions].reverse()}
          getRowId={(v) => `v${v.version}`}
          exportName={`statutory-${section.id}-versions`}
          pageSize={10}
          dense
          emptyIcon={History}
          emptyTitle="No versions recorded"
          emptyDescription="Create the first version to start applying this levy in pay runs."
        />
      </Section>
    </div>
  );
}
