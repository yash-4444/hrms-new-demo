"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight, Globe2, MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";
import { COUNTRIES, type City, type Country, type StateRegion } from "@/mock/platform";
import { mockAction } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/primitives";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Facts, TonePill, useDirtyGuard } from "@/components/platform/kit";

const citySchema = z.object({ name: z.string().trim().min(2, "Enter the city name").max(60, "Keep it under 60 characters") });

export default function GeoPage() {
  const loading = useFakeLoad();
  const [countries, setCountries] = React.useState<Country[]>(COUNTRIES);
  const [iso, setIso] = React.useState("IN");
  const [stateCode, setStateCode] = React.useState<string | null>("KA");
  const [addOpen, setAddOpen] = React.useState(false);

  const country = countries.find((c) => c.iso2 === iso)!;
  const state = country.states.find((s) => s.code === stateCode) ?? null;

  const form = useForm<z.infer<typeof citySchema>>({ resolver: zodResolver(citySchema), defaultValues: { name: "" } });
  const close = () => {
    setAddOpen(false);
    form.reset();
  };
  const guard = useDirtyGuard(form.formState.isDirty, close);

  const onAdd = form.handleSubmit((v) => {
    if (!state) return;
    if (state.cities.some((c) => c.name.toLowerCase() === v.name.toLowerCase())) {
      form.setError("name", { message: `${v.name} already exists in ${state.name}` });
      return;
    }
    setCountries((prev) =>
      prev.map((c) =>
        c.iso2 !== iso ? c : { ...c, states: c.states.map((s) => (s.code === state.code ? { ...s, cities: [...s.cities, { name: v.name, headcount: 0 }] } : s)) },
      ),
    );
    mockAction(`${v.name} added to ${state.name}`, { description: "Available for work locations and employee addresses." });
    close();
  });

  const stateCols: ColumnDef<StateRegion, unknown>[] = [
    { accessorKey: "name", header: country.iso2 === "IN" ? "State / UT" : "State", cell: ({ row }) => <span className="text-xs font-medium">{row.original.name}</span> },
    { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="font-mono text-[11px]">{country.iso2}-{row.original.code}</span> },
    { accessorKey: "ptSlab", header: country.iso2 === "IN" ? "Professional tax" : "State tax", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.ptSlab}</span> },
    { accessorKey: "lwf", header: country.iso2 === "IN" ? "Labour welfare fund" : "Disability / leave", cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.lwf}</span> },
    { id: "cities", header: "Cities", cell: ({ row }) => <NumCell>{row.original.cities.length}</NumCell> },
    { id: "hc", header: "Employees", cell: ({ row }) => <NumCell>{num(row.original.cities.reduce((t, c) => t + c.headcount, 0))}</NumCell> },
    { id: "__go", header: "", enableHiding: false, cell: () => <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden /> },
  ];

  const cityCols: ColumnDef<City, unknown>[] = [
    { accessorKey: "name", header: "City", cell: ({ row }) => <span className="text-xs font-medium">{row.original.name}</span> },
    { accessorKey: "headcount", header: "Employees", cell: ({ row }) => <NumCell>{num(row.original.headcount)}</NumCell> },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Geography"
        description="Countries, states and cities with the statutory attributes payroll and attendance resolve from. Country rows are the platform baseline; the employee's work country is stamped on each record, never re-resolved later."
      />

      {loading ? (
        <TableSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {countries.map((c) => (
              <Card
                key={c.iso2}
                role="button"
                tabIndex={0}
                aria-pressed={c.iso2 === iso}
                onClick={() => {
                  setIso(c.iso2);
                  setStateCode(c.states[0]?.code ?? null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIso(c.iso2);
                    setStateCode(c.states[0]?.code ?? null);
                  }
                }}
                className={cn("cursor-pointer p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", c.iso2 === iso && "border-primary ring-1 ring-primary/30")}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold">
                    <Globe2 className="size-4 text-muted-foreground" aria-hidden /> {c.name}
                  </p>
                  <TonePill tone="neutral">Platform baseline</TonePill>
                </div>
                <Facts
                  cols={3}
                  items={[
                    { label: "ISO", value: <span className="font-mono">{c.iso2} / {c.iso3}</span> },
                    { label: "Currency", value: c.currency },
                    { label: "Dial code", value: c.dialCode },
                    { label: "Default timezone", value: c.timezone },
                    { label: "Financial year", value: `Starts ${c.fyStart}` },
                    { label: "Week starts", value: c.weekStart },
                  ]}
                />
                <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Statutory regime: </span>
                  {c.regime}
                </p>
              </Card>
            ))}
          </div>

          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{country.name}</span>
            {state && (
              <>
                <ChevronRight className="size-3.5" aria-hidden />
                <span className="text-foreground">{state.name}</span>
              </>
            )}
          </nav>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
            <Section title={`States in ${country.name}`} description="Click a state to see its cities.">
              <DataTable
                key={iso}
                columns={stateCols}
                data={country.states}
                searchKeys={["name", "code"]}
                searchPlaceholder="Search states…"
                onRowClick={(s) => setStateCode(s.code)}
                getRowId={(s) => s.code}
                exportName={`states-${iso}`}
                emptyIcon={MapPin}
                emptyTitle="No states configured"
                emptyDescription="Add states before creating work locations in this country."
              />
            </Section>
            <Section
              title={state ? `Cities in ${state.name}` : "Cities"}
              actions={
                state && (
                  <Gated menuKey="admin.geo" action="C">
                    <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                      <Plus /> Add city
                    </Button>
                  </Gated>
                )
              }
            >
              <DataTable
                key={`${iso}-${state?.code}`}
                columns={cityCols}
                data={state?.cities ?? []}
                searchKeys={["name"]}
                searchPlaceholder="Search cities…"
                exportName={`cities-${state?.code ?? ""}`}
                emptyIcon={MapPin}
                emptyTitle={state ? "No cities yet" : "Pick a state"}
                emptyDescription={state ? "Add the first city for this state." : "Select a state on the left to see its cities."}
                pageSize={10}
              />
            </Section>
          </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={guard.onOpenChange}>
        <DialogContent size="sm">
          <form onSubmit={onAdd} noValidate>
            <DialogHeader>
              <DialogTitle>Add a city to {state?.name}</DialogTitle>
              <DialogDescription>The city inherits {state?.name}&apos;s professional tax and LWF rules.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field label="City name" htmlFor="geo-city" required error={form.formState.errors.name?.message}>
                <Input id="geo-city" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => guard.onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Add city</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard.guard}
    </PageBody>
  );
}
