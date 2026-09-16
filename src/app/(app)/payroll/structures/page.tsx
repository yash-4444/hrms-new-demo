"use client";

import * as React from "react";
import {
  BadgeIndianRupee,
  Check,
  FileSpreadsheet,
  RotateCcw,
  Save,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr, inrCompact, num, pct } from "@/lib/format";
import { GRADES } from "@/mock/org";
import {
  SALARY_STRUCTURES,
  previewStructure,
  ratesForGrade,
  structureForGrade,
  type ComponentRates,
} from "@/mock/payroll";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Badge, Input, Label } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/overlays";
import { DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  CardsSkeleton,
  Gated,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";

/* ============================================================================
   /payroll/structures — the component builder.

   Editing a rate or the CTC recomputes the whole breakup live, and the footer
   asserts that gross + employer cost === monthly CTC. Special Allowance is the
   balancing figure, so it absorbs every change and the identity always holds.
   ========================================================================== */

const RATE_FIELDS: {
  key: keyof ComponentRates;
  label: string;
  suffix: string;
  step: number;
  hint: string;
}[] = [
  { key: "basicPct", label: "Basic", suffix: "% of CTC", step: 1, hint: "Drives PF, gratuity and HRA exemption." },
  { key: "hraPct", label: "HRA", suffix: "% of Basic", step: 1, hint: "50% for metro postings, 40% otherwise." },
  { key: "conveyance", label: "Conveyance", suffix: "₹ / month", step: 100, hint: "Flat monthly allowance." },
  { key: "medical", label: "Medical", suffix: "₹ / month", step: 50, hint: "Flat monthly allowance." },
  { key: "ltaPct", label: "LTA", suffix: "% of Basic", step: 0.5, hint: "Exempt twice in a four-year block." },
  { key: "perfPct", label: "Performance pay", suffix: "% of CTC", step: 1, hint: "Variable; paid on achievement." },
];

export default function StructuresPage() {
  const loading = useFakeLoad();
  const [gradeId, setGradeId] = React.useState("G3");
  const [ctc, setCtc] = React.useState(1500000);
  const [rates, setRates] = React.useState<ComponentRates>(() => ratesForGrade("G3"));
  const [dirty, setDirty] = React.useState(false);

  const structure = structureForGrade(gradeId);
  const preview = React.useMemo(() => previewStructure(gradeId, ctc, rates), [gradeId, ctc, rates]);

  const selectGrade = (id: string) => {
    const g = GRADES.find((x) => x.id === id)!;
    setGradeId(id);
    setRates(ratesForGrade(id));
    setCtc(Math.round((g.minCtc + g.maxCtc) / 2 / 10000) * 10000);
    setDirty(false);
  };

  const setRate = (key: keyof ComponentRates, value: number) => {
    setRates((r) => ({ ...r, [key]: value }));
    setDirty(true);
  };

  const reset = () => {
    setRates(ratesForGrade(gradeId));
    setDirty(false);
    mockAction("Reverted to the saved template", { description: structure.name });
  };

  const inBand = ctc >= structure.ctcBand.min && ctc <= structure.ctcBand.max;

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Salary structures" description="Loading templates…" />
        <CardsSkeleton count={4} />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Salary structures"
        description="One template per grade. Edit a rate and the breakup below recalculates live — Special Allowance is the balancing figure, so the total always reconciles to CTC."
        actions={
          <>
            {dirty && (
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw /> Revert
              </Button>
            )}
            <Gated menuKey="payroll.structures" action="E">
              <Button
                size="sm"
                disabled={!dirty}
                onClick={() => {
                  setDirty(false);
                  mockAction(`${structure.name} saved`, {
                    description: `Applies to ${num(structure.employeeCount)} employees from the next pay run.`,
                  });
                }}
              >
                <Save /> Save template
              </Button>
            </Gated>
          </>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Templates" value={num(SALARY_STRUCTURES.length)} icon={FileSpreadsheet} hint="One per grade, G1 to G7" />
        <StatTile
          label="Employees on this template"
          value={num(structure.employeeCount)}
          icon={Users}
          hint={structure.name}
        />
        <StatTile
          label="Monthly CTC at preview"
          value={inr(preview.monthlyCtc, { decimals: false })}
          icon={BadgeIndianRupee}
          tone="accent"
        />
        <StatTile
          label="Estimated take-home"
          value={inr(preview.estimatedNet, { decimals: false })}
          icon={BadgeIndianRupee}
          hint={`After PF ${inrCompact(preview.estimatedDeductions.pf)}, PT ${inr(preview.estimatedDeductions.pt, { decimals: false })}, TDS ${inrCompact(preview.estimatedDeductions.tds)}`}
        />
      </StatRow>

      {/* grade picker */}
      <Section title="Grade templates" description="Pick a grade to load its template into the builder.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {SALARY_STRUCTURES.map((s) => {
            const g = GRADES.find((x) => x.id === s.gradeId)!;
            const active = s.gradeId === gradeId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectGrade(s.gradeId)}
                aria-pressed={active}
                className={cn(
                  "rounded-md border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary/40 bg-primary-soft"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold">{s.gradeId}</span>
                  {active && <Check className="size-3 text-primary" aria-hidden />}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                  {g.label.split(" · ")[1]}
                </span>
                <span className="tnum mt-1 block text-[10px] text-muted-foreground">
                  {num(s.employeeCount)} people
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* ------------------------------------------------ the builder */}
        <Section
          title="Component builder"
          description={`${structure.name} · effective ${fmtDate(structure.effectiveFrom)}`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ctc">Annual CTC to preview</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="ctc"
                  type="number"
                  step={10000}
                  value={ctc}
                  onChange={(e) => setCtc(Math.max(0, Number(e.target.value) || 0))}
                  className="tnum"
                />
                <Badge variant="muted" className="shrink-0">
                  {inrCompact(ctc)}
                </Badge>
              </div>
              <p className={cn("text-[11px]", inBand ? "text-muted-foreground" : "text-warning-fg")}>
                Grade band {inrCompact(structure.ctcBand.min)} – {inrCompact(structure.ctcBand.max)}
                {inBand ? "" : " · this CTC sits outside the band"}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 border-t border-border pt-3">
              {RATE_FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={f.key}>{f.label}</Label>
                    <span className="text-[10px] text-muted-foreground">{f.suffix}</span>
                  </div>
                  <Input
                    id={f.key}
                    type="number"
                    step={f.step}
                    value={rates[f.key]}
                    onChange={(e) => setRate(f.key, Number(e.target.value) || 0)}
                    className="tnum h-7"
                  />
                  <p className="text-[10px] text-muted-foreground">{f.hint}</p>
                </div>
              ))}
            </div>

            <Alert tone="neutral" className="mt-1">
              Special Allowance is the <strong>balancing figure</strong>. Raise any component above
              and Special Allowance falls by the same amount, so monthly gross plus employer cost
              always equals monthly CTC.
            </Alert>
          </div>
        </Section>

        {/* ------------------------------------------- the live preview */}
        <div className="flex flex-col gap-3">
          <Section
            title="Live CTC breakup"
            description={`${inr(ctc, { decimals: false })} per annum · ${inr(preview.monthlyCtc, { decimals: false })} per month`}
            bodyClassName="p-0"
          >
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-subtle">
                  <tr className="border-b border-border">
                    <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Component
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Formula
                    </th>
                    <th scope="col" data-numeric className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Monthly
                    </th>
                    <th scope="col" data-numeric className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Annual
                    </th>
                    <th scope="col" data-numeric className="px-3 py-2 text-right font-medium text-muted-foreground">
                      % of CTC
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border bg-muted/40">
                    <td colSpan={5} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Employee earnings
                    </td>
                  </tr>
                  {preview.earnings.map((r) => (
                    <tr key={r.code} className="border-b border-border/60">
                      <td className="px-3 py-1.5">
                        <span className="font-medium">{r.label}</span>
                        <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{r.code}</span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{r.formula}</td>
                      <td data-numeric className="px-3 py-1.5 text-right font-medium">
                        {inr(r.monthly, { decimals: false })}
                      </td>
                      <td data-numeric className="px-3 py-1.5 text-right text-muted-foreground">
                        {inr(r.annual, { decimals: false })}
                      </td>
                      <td data-numeric className="px-3 py-1.5 text-right text-muted-foreground">
                        {pct((r.annual / ctc) * 100)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-border bg-subtle font-semibold">
                    <td className="px-3 py-1.5" colSpan={2}>
                      Monthly gross
                    </td>
                    <td data-numeric className="px-3 py-1.5 text-right">
                      {inr(preview.monthlyGross, { decimals: false })}
                    </td>
                    <td data-numeric className="px-3 py-1.5 text-right">
                      {inr(preview.annualGross, { decimals: false })}
                    </td>
                    <td data-numeric className="px-3 py-1.5 text-right">
                      {pct((preview.annualGross / ctc) * 100)}
                    </td>
                  </tr>

                  <tr className="border-b border-border bg-muted/40">
                    <td colSpan={5} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Employer contributions
                    </td>
                  </tr>
                  {preview.employer.map((r) => (
                    <tr key={r.code} className="border-b border-border/60">
                      <td className="px-3 py-1.5">
                        <span className="font-medium">{r.label}</span>
                        <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{r.code}</span>
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{r.formula}</td>
                      <td data-numeric className="px-3 py-1.5 text-right font-medium">
                        {inr(r.monthly, { decimals: false })}
                      </td>
                      <td data-numeric className="px-3 py-1.5 text-right text-muted-foreground">
                        {inr(r.annual, { decimals: false })}
                      </td>
                      <td data-numeric className="px-3 py-1.5 text-right text-muted-foreground">
                        {pct((r.annual / ctc) * 100)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-border bg-subtle font-semibold">
                    <td className="px-3 py-1.5" colSpan={2}>
                      Monthly employer cost
                    </td>
                    <td data-numeric className="px-3 py-1.5 text-right">
                      {inr(preview.monthlyEmployer, { decimals: false })}
                    </td>
                    <td data-numeric className="px-3 py-1.5 text-right">
                      {inr(preview.annualEmployer, { decimals: false })}
                    </td>
                    <td data-numeric className="px-3 py-1.5 text-right">
                      {pct((preview.annualEmployer / ctc) * 100)}
                    </td>
                  </tr>

                  <tr className="bg-primary-soft font-semibold text-primary-soft-foreground">
                    <td className="px-3 py-2" colSpan={2}>
                      Total cost to company
                    </td>
                    <td data-numeric className="px-3 py-2 text-right">
                      {inr(preview.monthlyTotal, { decimals: false })}
                    </td>
                    <td data-numeric className="px-3 py-2 text-right">
                      {inr(preview.monthlyTotal * 12, { decimals: false })}
                    </td>
                    <td data-numeric className="px-3 py-2 text-right">
                      {pct(((preview.monthlyTotal * 12) / ctc) * 100)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              className={cn(
                "flex items-center gap-2 border-t border-border px-3 py-2 text-xs",
                preview.balances ? "text-success-fg" : "text-destructive-fg",
              )}
            >
              <Check className="size-3.5" aria-hidden />
              {preview.balances
                ? `Reconciles: gross ${inr(preview.monthlyGross, { decimals: false })} + employer ${inr(preview.monthlyEmployer, { decimals: false })} = monthly CTC ${inr(preview.monthlyCtc, { decimals: false })}.`
                : `Does not reconcile — off by ${inr(Math.abs(preview.monthlyTotal - preview.monthlyCtc))}.`}
            </div>
          </Section>

          <DonutChart
            title="Where the CTC goes"
            description="Annual split across every earning component and the employer's statutory contribution."
            data={[
              ...preview.earnings.map((r) => ({ name: r.label, value: r.annual })),
              { name: "Employer cost", value: preview.annualEmployer },
            ]}
            valueFormat={(v) => inr(v, { decimals: false })}
            centreValue={inrCompact(ctc)}
            centreLabel="annual CTC"
            height={260}
          />
        </div>
      </div>
    </PageBody>
  );
}
