"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { Coins, Plus, TrendingUp } from "lucide-react";
import { fmtDate, fmtMonth } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { CURRENCIES, FX_RATES, type Currency, type FxRate } from "@/mock/platform";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { TrendLineChart } from "@/components/charts";
import { ChartSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";
import { TonePill, useDirtyGuard } from "@/components/platform/kit";

const rateSchema = z.object({
  from: z.string().min(1, "Pick a currency"),
  rate: z.coerce.number<string>().positive("The rate must be above zero").max(10000, "That rate looks wrong — check the decimal point"),
  effectiveFrom: z.string().min(1, "Pick the effective date").refine((d) => d >= "2026-04-01", "Rates before FY 2026-27 are locked"),
  source: z.enum(["RBI reference rate", "FBIL", "Manual"]),
});
type RateValues = z.input<typeof rateSchema>;

export default function CurrenciesPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [rates, setRates] = React.useState<FxRate[]>(FX_RATES);
  const [currencyFilter, setCurrencyFilter] = React.useState("all");
  const [addOpen, setAddOpen] = React.useState(false);

  const foreign = CURRENCIES.filter((c) => !c.isBase);
  const latest = (code: string) => rates.filter((r) => r.from === code && r.effectiveFrom <= DEMO_TODAY).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];

  const trend = React.useMemo(() => {
    const months = [...new Set(rates.map((r) => r.effectiveFrom))].sort();
    return months.map((m) => ({
      month: m,
      ...Object.fromEntries(["USD", "EUR", "GBP"].map((c) => [c, rates.find((r) => r.from === c && r.effectiveFrom === m)?.rate ?? null])),
    })) as Record<string, string | number>[];
  }, [rates]);

  const form = useForm<RateValues, unknown, z.output<typeof rateSchema>>({
    resolver: zodResolver(rateSchema),
    defaultValues: { from: "USD", rate: "", effectiveFrom: "2026-10-01", source: "RBI reference rate" },
  });
  const close = () => {
    setAddOpen(false);
    form.reset();
  };
  const guard = useDirtyGuard(form.formState.isDirty, close);

  const onAdd = form.handleSubmit((v) => {
    if (rates.some((r) => r.from === v.from && r.effectiveFrom === v.effectiveFrom)) {
      form.setError("effectiveFrom", { message: `A ${v.from} rate already exists for ${fmtDate(v.effectiveFrom)}. Rates are effective-dated — add a new date instead of editing.` });
      return;
    }
    setRates((prev) => [{ id: `FX-N-${prev.length}`, from: v.from, to: "INR", rate: v.rate, effectiveFrom: v.effectiveFrom, source: v.source, enteredBy: persona.name }, ...prev]);
    mockAction(`1 ${v.from} = ₹${v.rate.toFixed(4)} from ${fmtDate(v.effectiveFrom)}`, {
      description: "Claims and payroll lines dated on or after this day convert at the new rate. Earlier rows keep the rate stamped on them.",
    });
    close();
  });

  const currencyCols: ColumnDef<Currency, unknown>[] = [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span> },
    { accessorKey: "name", header: "Currency", cell: ({ row }) => <span className="text-xs">{row.original.symbol} · {row.original.name}</span> },
    { accessorKey: "minorUnits", header: "Minor units", cell: ({ row }) => <NumCell>{row.original.minorUnits}</NumCell> },
    { accessorKey: "rounding", header: "Rounding", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.rounding}</span> },
    {
      id: "rate",
      header: "Current rate (→ INR)",
      cell: ({ row }) => {
        if (row.original.isBase) return <TonePill tone="accent">Base currency</TonePill>;
        const r = latest(row.original.code);
        return r ? <NumCell>₹{r.rate.toFixed(4)}</NumCell> : <span className="text-xs text-muted-foreground">No rate</span>;
      },
    },
    { accessorKey: "active", header: "Status", cell: ({ row }) => (row.original.active ? <TonePill tone="success">Active</TonePill> : <TonePill tone="neutral">Inactive</TonePill>) },
  ];

  const rateCols: ColumnDef<FxRate, unknown>[] = [
    { accessorKey: "from", header: "Pair", cell: ({ row }) => <span className="font-mono text-xs">{row.original.from} → INR</span> },
    { accessorKey: "rate", header: "Rate", cell: ({ row }) => <NumCell>₹{row.original.rate.toFixed(4)}</NumCell> },
    { accessorKey: "effectiveFrom", header: "Effective from", cell: ({ row }) => <span className="tnum text-xs">{fmtDate(row.original.effectiveFrom)}</span> },
    {
      id: "state",
      header: "State",
      cell: ({ row }) => {
        const r = row.original;
        if (r.effectiveFrom > DEMO_TODAY) return <TonePill tone="info">Scheduled</TonePill>;
        return latest(r.from)?.id === r.id ? <TonePill tone="success">Current</TonePill> : <TonePill tone="neutral">Superseded</TonePill>;
      },
    },
    { accessorKey: "source", header: "Source", cell: ({ row }) => <span className="text-xs">{row.original.source}</span> },
    { accessorKey: "enteredBy", header: "Entered by", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.enteredBy}</span> },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Currencies & FX"
        description="Currency master and effective-dated exchange rates to INR. A rate is never edited in place — a new row takes over from its effective date, and every converted amount keeps the rate it was stamped with."
        actions={
          <Gated menuKey="admin.currencies" action="C">
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Add rate
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <TableSkeleton rows={5} />
          <ChartSkeleton height={200} />
        </>
      ) : (
        <>
          <Section title="Currency master">
            <DataTable columns={currencyCols} data={CURRENCIES} searchKeys={["code", "name"]} searchPlaceholder="Search currencies…" exportName="currencies" emptyIcon={Coins} emptyTitle="No currencies" pageSize={10} />
          </Section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
            <Section title="Exchange rates" description="Monthly RBI reference rates, loaded on the 1st.">
              <DataTable
                columns={rateCols}
                data={rates.filter((r) => currencyFilter === "all" || r.from === currencyFilter)}
                searchKeys={["from", "source", "enteredBy"]}
                filters={<FilterSelect label="Currency" value={currencyFilter} onValueChange={setCurrencyFilter} options={foreign.map((c) => ({ value: c.code, label: c.code }))} />}
                exportName="fx-rates"
                emptyIcon={TrendingUp}
                emptyTitle="No rates"
                emptyDescription="Add a rate to start converting this currency."
                pageSize={10}
              />
            </Section>
            <TrendLineChart
              title="INR per unit, FY 2026-27"
              description="USD, EUR and GBP"
              data={trend}
              xKey="month"
              series={[
                { key: "USD", label: "USD" },
                { key: "EUR", label: "EUR" },
                { key: "GBP", label: "GBP" },
              ]}
              height={240}
              valueFormat={(v) => `₹${v.toFixed(2)}`}
              xLabelFormat={(v) => fmtMonth(v)}
            />
          </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={guard.onOpenChange}>
        <DialogContent size="sm">
          <form onSubmit={onAdd} noValidate>
            <DialogHeader>
              <DialogTitle>Add exchange rate</DialogTitle>
              <DialogDescription>Rate to INR, effective from the chosen date onwards.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Currency" required error={form.formState.errors.from?.message}>
                <Controller
                  control={form.control}
                  name="from"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {foreign.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} · {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Rate (₹ per unit)" htmlFor="fx-rate" required error={form.formState.errors.rate?.message}>
                <Input id="fx-rate" inputMode="decimal" placeholder="84.0600" {...form.register("rate")} aria-invalid={!!form.formState.errors.rate} />
              </Field>
              <Field label="Effective from" htmlFor="fx-date" required error={form.formState.errors.effectiveFrom?.message}>
                <Input id="fx-date" type="date" {...form.register("effectiveFrom")} aria-invalid={!!form.formState.errors.effectiveFrom} />
              </Field>
              <Field label="Source" required>
                <Controller
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["RBI reference rate", "FBIL", "Manual"].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guard.onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Add rate</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard.guard}
    </PageBody>
  );
}
