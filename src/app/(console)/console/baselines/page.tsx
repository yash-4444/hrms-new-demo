"use client";

import * as React from "react";
import { CalendarDays, Info, Scale, Send } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { COUNTRY_META, type TenantCountry } from "@/mock/console-tenants";
import { BASELINE_HOLIDAYS, STATUTORY_RATES, holidayAudience, rateAudience, type BaselineHoliday, type BaselineOverride, type StatutoryRate } from "@/mock/console-baselines";
import { mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { HolidayDialog, RateVersionDialog } from "@/components/console/baselines-dialogs";
import { HolidaysTab } from "@/components/console/baselines-holidays";
import { RatesTab } from "@/components/console/baselines-rates";
import { OverridesSheet, PublishDialog, type PublishItem } from "@/components/console/baselines-publish";
import { PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";

type HolidayEdit = { holiday?: BaselineHoliday } | null;
type Overrides = { title: string; baseline: string; overrides: BaselineOverride[] } | null;

export default function BaselinesPage() {
  const loading = useFakeLoad();
  const { tenants } = useConsole();
  const [holidays, setHolidays] = React.useState<BaselineHoliday[]>(BASELINE_HOLIDAYS);
  const [rates, setRates] = React.useState<StatutoryRate[]>(STATUTORY_RATES);
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [tab, setTab] = React.useState("holidays");
  const [country, setCountry] = React.useState<TenantCountry>("IN");
  const [year, setYear] = React.useState(2026);
  const [holidayEdit, setHolidayEdit] = React.useState<HolidayEdit>(null);
  const [rateEdit, setRateEdit] = React.useState<StatutoryRate | null>(null);
  const [overrides, setOverrides] = React.useState<Overrides>(null);
  const [publishing, setPublishing] = React.useState(false);

  const payrollAudience = rateAudience(tenants).length;
  const drafts: PublishItem[] = [
    ...holidays
      .filter((h) => h.draft)
      .map((h) => ({ key: h.id, label: `${COUNTRY_META[h.country].label} · ${h.name}`, detail: notes[h.id] ?? fmtDate(h.date), audience: holidayAudience(tenants, h.country).length, overriders: h.overrides.length })),
    ...rates
      .filter((r) => r.draft)
      .map((r) => ({ key: r.id, label: `${r.kind} · ${r.component} (${r.scope}) v${r.version}`, detail: notes[r.id] ?? r.value, audience: payrollAudience, overriders: 0 })),
  ];

  const onEditHoliday = React.useCallback((h: BaselineHoliday) => setHolidayEdit({ holiday: h }), []);
  const onHolidayOverrides = React.useCallback(
    (h: BaselineHoliday) => setOverrides({ title: `${h.name} — ${fmtDate(h.date)}`, baseline: `${COUNTRY_META[h.country].label}, ${h.name} on ${fmtDate(h.date)}`, overrides: h.overrides }),
    [],
  );
  const onRateOverrides = React.useCallback(
    (r: StatutoryRate) => setOverrides({ title: `${r.kind} · ${r.component}`, baseline: `${r.value} (${r.scope}, v${r.version})`, overrides: r.overrides }),
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Reference baselines"
        description="Shared reference data every tenant inherits. A baseline row has no tenant; a tenant's own row overrides it for that tenant only. Changes are drafted, then published."
        actions={
          <Button size="sm" disabled={!drafts.length} onClick={() => setPublishing(true)}>
            <Send /> Publish{drafts.length ? ` ${drafts.length} change${drafts.length === 1 ? "" : "s"}` : ""}
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={12} />
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="holidays">
              <CalendarDays /> Holidays
            </TabsTrigger>
            <TabsTrigger value="rates">
              <Scale /> Statutory rates
            </TabsTrigger>
          </TabsList>
          <TabsContent value="holidays" className="flex flex-col gap-3">
            <Alert tone="info" icon={Info}>
              Dates that have passed are locked — attendance for those days was processed against the calendar as it stood. 2027 shows fixed-date holidays only until lunar dates are gazetted.
            </Alert>
            <HolidaysTab
              holidays={holidays}
              country={country}
              year={year}
              audience={holidayAudience(tenants, country).length}
              onCountry={setCountry}
              onYear={setYear}
              onAdd={() => setHolidayEdit({})}
              onEdit={onEditHoliday}
              onOverrides={onHolidayOverrides}
            />
          </TabsContent>
          <TabsContent value="rates" className="flex flex-col gap-3">
            <Alert tone="info" icon={Info}>
              India only. A rate in force is never edited — a change is a new version effective from a future date, and payroll stamps the version it used on every payslip. {payrollAudience} tenants run Indian payroll.
            </Alert>
            <RatesTab rates={rates} onNewVersion={setRateEdit} onOverrides={onRateOverrides} />
          </TabsContent>
        </Tabs>
      )}

      {holidayEdit && (
        <HolidayDialog
          country={holidayEdit.holiday?.country ?? country}
          year={holidayEdit.holiday ? Number(holidayEdit.holiday.date.slice(0, 4)) : year}
          holiday={holidayEdit.holiday}
          existing={holidays.filter((h) => h.country === (holidayEdit.holiday?.country ?? country))}
          onOpenChange={(v) => !v && setHolidayEdit(null)}
          onSave={(v) => {
            const prior = holidayEdit.holiday;
            if (prior) {
              setHolidays((hs) => hs.map((h) => (h.id === prior.id ? { ...h, ...v, draft: true } : h)));
              setNotes((n) => ({ ...n, [prior.id]: `Edited: ${prior.name}, ${fmtDate(prior.date)} → ${v.name}, ${fmtDate(v.date)}` }));
            } else {
              const id = `${country}-${v.date}-${holidays.length + 1}`;
              setHolidays((hs) => [...hs, { id, country, ...v, overrides: [], draft: true }]);
              setNotes((n) => ({ ...n, [id]: `Added for ${fmtDate(v.date)}` }));
            }
            setHolidayEdit(null);
            mockAction(prior ? "Holiday change saved as a draft" : `${v.name} added as a draft`, { description: "Publish to push it to tenants that inherit this calendar.", tone: "info" });
          }}
        />
      )}
      {rateEdit && (
        <RateVersionDialog
          rate={rateEdit}
          latestFrom={rates.filter((r) => r.series === rateEdit.series).reduce((a, r) => (r.effectiveFrom > a ? r.effectiveFrom : a), rateEdit.effectiveFrom)}
          onOpenChange={(v) => !v && setRateEdit(null)}
          onSave={(value, from, reason) => {
            const next: StatutoryRate = { ...rateEdit, id: `${rateEdit.series}-${rateEdit.version + 1}`, value, effectiveFrom: from, version: rateEdit.version + 1, overrides: [], draft: true };
            setRates((rs) => [...rs, next]);
            setNotes((n) => ({ ...n, [next.id]: `${value} from ${fmtDate(from)} — ${reason}` }));
            setRateEdit(null);
            mockAction(`${rateEdit.component} v${next.version} drafted`, { description: `Effective ${fmtDate(from)}. v${rateEdit.version} stays in force until then.`, tone: "info" });
          }}
        />
      )}
      <OverridesSheet
        title={overrides?.title ?? null}
        baseline={overrides?.baseline ?? ""}
        overrides={overrides?.overrides ?? []}
        tenants={tenants}
        onOpenChange={(v) => !v && setOverrides(null)}
      />
      <PublishDialog
        open={publishing}
        items={drafts}
        onOpenChange={setPublishing}
        onConfirm={() => {
          setHolidays((hs) => hs.map((h) => (h.draft ? { ...h, draft: false } : h)));
          setRates((rs) => rs.map((r) => (r.draft ? { ...r, draft: false } : r)));
          mockAction(`${drafts.length} baseline change${drafts.length === 1 ? "" : "s"} published`, { description: "Inheriting tenants see them on their next calendar or payroll read." });
        }}
      />
    </PageBody>
  );
}
