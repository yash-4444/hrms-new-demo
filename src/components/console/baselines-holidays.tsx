"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, Lock, Pencil, Plus, Users } from "lucide-react";
import { fmtDay, num } from "@/lib/format";
import { COUNTRY_META, CONSOLE_TODAY, type TenantCountry } from "@/mock/console-tenants";
import { BASELINE_YEARS, type BaselineHoliday } from "@/mock/console-baselines";
import { KIND_LABEL } from "@/components/console/baselines-dialogs";
import { DataTable } from "@/components/data-table";
import { TonePill } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/overlays";

/* Reference Baselines — the Holidays tab: one country's baseline calendar
   for one year. Past dates are locked (attendance already processed them). */

export function HolidaysTab({
  holidays,
  country,
  year,
  audience,
  onCountry,
  onYear,
  onAdd,
  onEdit,
  onOverrides,
}: {
  holidays: BaselineHoliday[];
  country: TenantCountry;
  year: number;
  /** Tenants reading this country's calendar. */
  audience: number;
  onCountry: (c: TenantCountry) => void;
  onYear: (y: number) => void;
  onAdd: () => void;
  onEdit: (h: BaselineHoliday) => void;
  onOverrides: (h: BaselineHoliday) => void;
}) {
  const rows = holidays.filter((h) => h.country === country && h.date.startsWith(String(year))).sort((a, b) => a.date.localeCompare(b.date));

  const columns = React.useMemo<ColumnDef<BaselineHoliday, unknown>[]>(
    () => [
      { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="tnum whitespace-nowrap text-xs">{fmtDay(row.original.date)}</span> },
      {
        accessorKey: "name",
        header: "Holiday",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              {row.original.name}
              {row.original.draft && <TonePill tone="accent">Draft</TonePill>}
            </p>
            {row.original.region && <p className="text-[11px] text-muted-foreground">{row.original.region}</p>}
          </div>
        ),
      },
      {
        accessorKey: "kind",
        header: "Type",
        cell: ({ row }) => <TonePill tone={row.original.kind === "national" ? "info" : row.original.kind === "regional" ? "accent" : "neutral"}>{KIND_LABEL[row.original.kind]}</TonePill>,
      },
      {
        id: "overrides",
        header: "Overridden by",
        accessorFn: (h) => h.overrides.length,
        cell: ({ row }) =>
          row.original.overrides.length ? (
            <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => onOverrides(row.original)}>
              <Users /> {row.original.overrides.length} tenant{row.original.overrides.length === 1 ? "" : "s"}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          ),
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) =>
          row.original.date <= CONSOLE_TODAY ? (
            <span className="flex justify-end">
              <TonePill tone="neutral" icon={Lock}>
                Past — locked
              </TonePill>
            </span>
          ) : (
            <div className="flex justify-end">
              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${row.original.name}`} onClick={() => onEdit(row.original)}>
                <Pencil />
              </Button>
            </div>
          ),
      },
    ],
    [onEdit, onOverrides],
  );

  return (
    <DataTable
      key={`${country}-${year}`}
      columns={columns}
      data={rows}
      searchKeys={["name", "region"]}
      searchPlaceholder="Search holidays…"
      filters={
        <>
          <Select value={country} onValueChange={(v) => onCountry(v as TenantCountry)}>
            <SelectTrigger size="sm" aria-label="Country" className="w-[190px]">
              <span className="truncate">
                <span className="text-muted-foreground">Country: </span>
                {COUNTRY_META[country].label}
              </span>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(COUNTRY_META) as TenantCountry[]).map((c) => (
                <SelectItem key={c} value={c}>
                  {COUNTRY_META[c].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => onYear(Number(v))}>
            <SelectTrigger size="sm" aria-label="Year" className="w-[110px]">
              <span>
                <span className="text-muted-foreground">Year: </span>
                {year}
              </span>
            </SelectTrigger>
            <SelectContent>
              {BASELINE_YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">
            <span className="tnum">{num(audience)}</span> tenants read this calendar
          </span>
        </>
      }
      toolbar={
        <Button size="sm" onClick={onAdd}>
          <Plus /> Add holiday
        </Button>
      }
      getRowId={(h) => h.id}
      enableColumnFilters={false}
      pageSize={20}
      exportName={`baseline-holidays-${country}-${year}`}
      canExport
      emptyIcon={CalendarDays}
      emptyTitle={`No ${year} baseline holidays yet`}
      emptyDescription={year > 2026 ? "Lunar-calendar holidays are added once the government gazette is out." : "Add the first holiday for this country."}
    />
  );
}
