"use client";

import * as React from "react";
import { addDays, format, parseISO } from "date-fns";
import { History } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { COUNTRY_META, CONSOLE_TODAY, type TenantCountry } from "@/mock/console-tenants";
import type { BaselineHoliday, HolidayKind, StatutoryRate } from "@/mock/console-baselines";
import { Button } from "@/components/ui/button";
import { Alert, Field, Input, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/overlays";

/* Reference Baselines — add / edit a baseline holiday, and draft a new
   version of a statutory rate. Both are rendered only while open. Neither
   can touch a date that has passed: attendance and payroll have already
   stamped the old value on their rows. */

export const KIND_LABEL: Record<HolidayKind, string> = { national: "National", regional: "Regional", optional: "Optional" };

const tomorrow = format(addDays(parseISO(CONSOLE_TODAY), 1), "yyyy-MM-dd");

export function HolidayDialog({
  country,
  year,
  holiday,
  existing,
  onOpenChange,
  onSave,
}: {
  country: TenantCountry;
  year: number;
  /** Set when editing. */
  holiday?: BaselineHoliday;
  existing: BaselineHoliday[];
  onOpenChange: (v: boolean) => void;
  onSave: (h: Pick<BaselineHoliday, "date" | "name" | "kind" | "region">) => void;
}) {
  const [date, setDate] = React.useState(holiday?.date ?? (year === Number(CONSOLE_TODAY.slice(0, 4)) ? tomorrow : `${year}-01-01`));
  const [name, setName] = React.useState(holiday?.name ?? "");
  const [kind, setKind] = React.useState<HolidayKind>(holiday?.kind ?? "national");
  const [region, setRegion] = React.useState(holiday?.region ?? "");
  const [touched, setTouched] = React.useState(false);

  const dateError = !date.startsWith(String(year))
    ? `Pick a date in ${year}`
    : date <= CONSOLE_TODAY
      ? "Only future dates — past attendance has already been processed"
      : undefined;
  const nameError =
    name.trim().length < 3
      ? "Enter the holiday's name"
      : existing.some((h) => h.id !== holiday?.id && h.date === date && h.name.toLowerCase() === name.trim().toLowerCase())
        ? "This holiday is already on the calendar for that date"
        : undefined;
  const regionError = kind === "regional" && region.trim().length < 2 ? "Name the state or region" : undefined;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{holiday ? "Edit baseline holiday" : "Add baseline holiday"}</DialogTitle>
          <DialogDescription>
            {COUNTRY_META[country].label} · {year}. Saved as a draft; tenants see it only after you publish.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Date" htmlFor="bh-date" required error={touched ? dateError : undefined}>
            <Input id="bh-date" type="date" min={tomorrow} max={`${year}-12-31`} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={touched && !!dateError} />
          </Field>
          <Field label="Type" required>
            <Select value={kind} onValueChange={(v) => setKind(v as HolidayKind)}>
              <SelectTrigger aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABEL) as HolidayKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Name" htmlFor="bh-name" required error={touched ? nameError : undefined} className="sm:col-span-2">
            <Input id="bh-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={touched && !!nameError} />
          </Field>
          {kind === "regional" && (
            <Field label="States / regions" htmlFor="bh-region" required error={touched ? regionError : undefined} className="sm:col-span-2">
              <Input id="bh-region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Kerala" aria-invalid={touched && !!regionError} />
            </Field>
          )}
          {holiday && holiday.overrides.length > 0 && (
            <Alert tone="info" className="sm:col-span-2">
              {holiday.overrides.length} tenant{holiday.overrides.length === 1 ? " overrides" : "s override"} this holiday; their own version is kept.
            </Alert>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true);
              if (dateError || nameError || regionError) return;
              onSave({ date, name: name.trim(), kind, region: kind === "regional" ? region.trim() : undefined });
            }}
          >
            Save draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RateVersionDialog({
  rate,
  latestFrom,
  onOpenChange,
  onSave,
}: {
  rate: StatutoryRate;
  /** Effective date of the newest version in the series; the new one must follow it. */
  latestFrom: string;
  onOpenChange: (v: boolean) => void;
  onSave: (value: string, effectiveFrom: string, reason: string) => void;
}) {
  const firstOfNextMonth = format(new Date(Number(CONSOLE_TODAY.slice(0, 4)), Number(CONSOLE_TODAY.slice(5, 7)), 1), "yyyy-MM-dd");
  const [value, setValue] = React.useState(rate.value);
  const [from, setFrom] = React.useState(firstOfNextMonth > latestFrom ? firstOfNextMonth : format(addDays(parseISO(latestFrom), 1), "yyyy-MM-dd"));
  const [reason, setReason] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const valueError = value.trim().length < 2 ? "Enter the new rate" : value.trim() === rate.value ? "Unchanged — enter the new value" : undefined;
  const fromError = from <= CONSOLE_TODAY ? "Must be a future date — history is never edited" : from <= latestFrom ? `Must be after ${fmtDate(latestFrom)}, the newest version` : undefined;
  const reasonError = reason.trim().length < 5 ? "Cite the notification or circular (5+ characters)" : undefined;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>New version — {rate.component}</DialogTitle>
          <DialogDescription>
            {rate.kind} · {rate.scope}. Creates v{rate.version + 1}; v{rate.version} stays in force until the day before it and is never edited.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <Alert tone="neutral" icon={History}>
            Current: <span className="font-medium">{rate.value}</span> since {fmtDate(rate.effectiveFrom)}
          </Alert>
          <Field label="New value" htmlFor="rv-value" required error={touched ? valueError : undefined}>
            <Input id="rv-value" value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={touched && !!valueError} />
          </Field>
          <Field label="Effective from" htmlFor="rv-from" required error={touched ? fromError : undefined} hint="Pay periods starting on or after this date use the new version.">
            <Input id="rv-from" type="date" min={tomorrow} value={from} onChange={(e) => setFrom(e.target.value)} aria-invalid={touched && !!fromError} />
          </Field>
          <Field label="Source / reason" htmlFor="rv-reason" required error={touched ? reasonError : undefined}>
            <Textarea id="rv-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. EPFO circular, state gazette notification number." aria-invalid={touched && !!reasonError} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true);
              if (valueError || fromError || reasonError) return;
              onSave(value.trim(), from, reason.trim());
            }}
          >
            Save draft v{rate.version + 1}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
