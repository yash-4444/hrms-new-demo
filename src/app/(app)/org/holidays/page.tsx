"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays, format, getDay, getDaysInMonth, parseISO } from "date-fns";
import { CalendarDays, FileUp, Globe2, List, Sparkle, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDay, num } from "@/lib/format";
import { BRANCHES, DEMO_TODAY, branchById } from "@/mock/org";
import { EMPLOYEES } from "@/mock/employees";
import { HOLIDAY_ROWS, OPTIONAL_HOLIDAY_RULE, type HolidayRow, type HolidayScope } from "@/mock/masters";
import { MasterTable, type MasterField } from "@/components/org/master-table";
import { mockAction, useApp } from "@/components/app-state";
import { MutedCell } from "@/components/data-table";
import { Gated, Section } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, Checkbox, Hint, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";

const SCOPES: HolidayScope[] = ["National", "State", "Federal", "Company"];
const BRANCH_SCOPE = [
  { value: "IN-ALL", label: "All India branches" },
  ...BRANCHES.map((b) => ({ value: b.id, label: b.name })),
];
const IN_IDS = ["BLR", "PNQ", "HYD"];

const FIELDS: MasterField[] = [
  { name: "name", label: "Holiday name", required: true, wide: true },
  { name: "date", label: "Date", kind: "date", required: true, pattern: { re: /^2026-\d{2}-\d{2}$/, message: "Holiday master is for calendar year 2026." } },
  { name: "scope", label: "Scope", kind: "select", required: true, options: SCOPES.map((s) => ({ value: s, label: s })) },
  { name: "branchScope", label: "Applies to", kind: "select", required: true, options: BRANCH_SCOPE },
  { name: "optional", label: "Optional (employee picks)", kind: "switch", hint: `Counts towards the "choose ${OPTIONAL_HOLIDAY_RULE.choose} of ${OPTIONAL_HOLIDAY_RULE.poolSize}" rule.` },
  { name: "note", label: "Note", kind: "textarea", placeholder: "Why this differs from the baseline, notification reference…" },
];

const IMPORT_PREVIEW = [
  { date: "2026-03-31", name: "Mahavir Jayanti", scope: "State" as const, branch: "BLR" },
  { date: "2026-04-20", name: "Basava Jayanti", scope: "State" as const, branch: "BLR" },
  { date: "2026-08-21", name: "Varamahalakshmi Vratha", scope: "State" as const, branch: "BLR" },
  { date: "2026-03-14", name: "Stellar Foundation Day", scope: "Company" as const, branch: "BLR", duplicate: true },
];

const appliesTo = (r: HolidayRow) =>
  r.branchIds.length === 3 && IN_IDS.every((b) => r.branchIds.includes(b))
    ? "All India branches"
    : r.branchIds.map((b) => branchById(b)?.city ?? b).join(", ");

export default function HolidaysPage() {
  const { can } = useApp();
  const [rows, setRows] = React.useState<HolidayRow[]>(HOLIDAY_ROWS);
  const [view, setView] = React.useState<"list" | "calendar">("list");
  const [branch, setBranch] = React.useState("all");
  const [source, setSource] = React.useState("all");
  const [choose, setChoose] = React.useState(String(OPTIONAL_HOLIDAY_RULE.choose));
  const [deleting, setDeleting] = React.useState<HolidayRow | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importPick, setImportPick] = React.useState<Set<string>>(new Set(IMPORT_PREVIEW.filter((p) => !p.duplicate).map((p) => p.name)));

  const filtered = rows.filter(
    (r) => (branch === "all" || r.branchIds.includes(branch)) && (source === "all" || r.source === source),
  );
  const optionalPool = rows.filter((r) => r.optional && r.active && r.country === "IN");
  const upcoming = rows.filter((r) => r.active && r.date >= DEMO_TODAY && (branch === "all" || r.branchIds.includes(branch)))[0];
  const inEmployees = EMPLOYEES.filter((e) => e.branchId !== "EWR").length;
  const chosen = Math.round(inEmployees * 0.83);

  const columns = React.useMemo<ColumnDef<HolidayRow, unknown>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => (
          <div className="tnum leading-tight">
            <p className="font-medium text-foreground">{fmtDate(row.original.date)}</p>
            <p className="text-[11px] text-muted-foreground">{format(parseISO(row.original.date), "EEEE")}</p>
          </div>
        ),
      },
      {
        accessorKey: "name",
        header: "Holiday",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[280px]">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              {row.original.name}
              {row.original.optional && <Badge variant="outline">Optional</Badge>}
            </p>
            {row.original.note && <p className="truncate text-[11px] text-muted-foreground">{row.original.note}</p>}
          </div>
        ),
      },
      { accessorKey: "scope", header: "Scope", cell: ({ getValue }) => <Badge variant="muted">{getValue() as string}</Badge> },
      { id: "applies", header: "Applies to", accessorFn: appliesTo, cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ getValue }) =>
          getValue() === "baseline" ? (
            <Hint text="From the shared country library maintained by the platform. Edits create a tenant override.">
              <Badge variant="muted">
                <Globe2 className="size-3" aria-hidden />
                Baseline
              </Badge>
            </Hint>
          ) : (
            <Hint text="Stellar's own row, or an edit of a baseline holiday. Only this tenant sees it.">
              <Badge variant="soft">
                <Sparkle className="size-3" aria-hidden />
                Tenant override
              </Badge>
            </Hint>
          ),
      },
    ],
    [],
  );

  return (
    <>
      <MasterTable<HolidayRow>
        menuKey="org.holidays"
        title="Holiday Master"
        description="2026 holidays per country and branch. Baseline rows come from the shared country library; anything Stellar adds or edits is stored as a tenant override and stamped on attendance at the time."
        noun="holiday"
        plural="holidays"
        icon={CalendarDays}
        rows={rows}
        onRowsChange={setRows}
        columns={columns}
        fields={FIELDS}
        hideTable={view === "calendar"}
        tableTitle="Holidays · 2026"
        searchKeys={["name", "scope", "note"]}
        filter={(r) => (branch === "all" || r.branchIds.includes(branch)) && (source === "all" || r.source === source)}
        filters={
          <FilterSelect
            label="Source"
            value={source}
            onValueChange={setSource}
            options={[
              { value: "baseline", label: "Baseline" },
              { value: "override", label: "Tenant override" },
            ]}
            width="w-[170px]"
          />
        }
        headerActions={
          <Gated menuKey="org.holidays" action="C">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload aria-hidden />
              Import
            </Button>
          </Gated>
        }
        rowActions={(r) =>
          r.source === "override" ? (
            <DropdownMenuItem destructive disabled={!can("org.holidays", "D")} onSelect={() => setDeleting(r)}>
              <Trash2 aria-hidden />
              Delete override{!can("org.holidays", "D") && " (no delete grant)"}
            </DropdownMenuItem>
          ) : null
        }
        deactivateWarning={(r) =>
          r.source === "baseline" ? `${r.name} is a baseline holiday — deactivating hides it for Stellar only; other tenants keep it.` : undefined
        }
        toValues={(r) => ({
          name: r?.name ?? "",
          date: r?.date ?? "",
          scope: r?.scope ?? "Company",
          branchScope: r ? (r.branchIds.length > 1 ? "IN-ALL" : r.branchIds[0]) : "IN-ALL",
          optional: String(r?.optional ?? false),
          note: r?.note ?? "",
        })}
        fromValues={(v, existing, all) => {
          const branchIds = v.branchScope === "IN-ALL" ? IN_IDS : [v.branchScope];
          return {
            id: existing?.id ?? `HOL-${String(all.length + 1).padStart(3, "0")}`,
            name: v.name,
            date: v.date,
            country: branchIds.includes("EWR") ? "US" : "IN",
            scope: v.scope as HolidayScope,
            branchIds,
            optional: v.optional === "true",
            source: "override",
            note: v.note || (existing?.source === "baseline" ? "Edited from the baseline row." : undefined),
          };
        }}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Section
            title="Optional holidays"
            description={`India branches · selection closes ${fmtDate(OPTIONAL_HOLIDAY_RULE.deadline)}`}
            className="lg:col-span-2"
            actions={
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Employees choose</span>
                <Select
                  value={choose}
                  onValueChange={(v) => {
                    setChoose(v);
                    mockAction(`Optional-holiday rule updated: choose ${v} of ${optionalPool.length}`, {
                      description: "Applies from the 2027 selection window; 2026 choices already made are honoured.",
                    });
                  }}
                  disabled={!can("org.holidays", "E")}
                >
                  <SelectTrigger size="sm" className="w-[64px]" aria-label="Number of optional holidays each employee may choose">
                    {choose}
                  </SelectTrigger>
                  <SelectContent>
                    {["1", "2", "3"].map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">of {optionalPool.length}</span>
              </div>
            }
          >
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {optionalPool.map((h) => {
                const takers = Math.round(chosen * ((h.name.length % 5) + 2) / 10);
                return (
                  <li key={h.id} className="rounded-md border border-dashed border-border px-2.5 py-1.5">
                    <p className="text-xs font-medium">{h.name}</p>
                    <p className="tnum text-[11px] text-muted-foreground">
                      {fmtDay(h.date)} · {num(takers)} opted in
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {num(chosen)} of {num(inEmployees)} India employees have made their picks; reminders go to the rest on the 25th.
            </p>
          </Section>
          <Section title="Next holiday" description={branch === "all" ? "Any branch" : branchById(branch)?.name}>
            {upcoming ? (
              <div>
                <p className="text-base font-semibold">{upcoming.name}</p>
                <p className="tnum text-xs text-muted-foreground">
                  {fmtDay(upcoming.date)} · {appliesTo(upcoming)}
                </p>
                <p className="tnum mt-2 text-xs">
                  {rows.filter((r) => r.active && !r.optional && r.date >= DEMO_TODAY && (branch === "all" || r.branchIds.includes(branch))).length} mandatory holidays left in 2026
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No holidays left in 2026.</p>
            )}
          </Section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <FilterSelect label="Branch" value={branch} onValueChange={setBranch} options={BRANCHES.map((b) => ({ value: b.id, label: b.name }))} width="w-[230px]" />
          <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar")}>
            <TabsList>
              <TabsTrigger value="list">
                <List className="size-3.5" aria-hidden />
                List
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <CalendarDays className="size-3.5" aria-hidden />
                Calendar
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {view === "calendar" && <YearCalendar rows={filtered.filter((r) => r.active)} />}
      </MasterTable>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description="This removes Stellar's override. Where it replaced a baseline holiday, the baseline row applies again. Attendance already stamped with this holiday is not changed."
        confirmLabel="Delete override"
        destructive
        onConfirm={() => {
          if (!deleting) return;
          const gone = deleting;
          setRows((rs) => rs.filter((r) => r.id !== gone.id));
          mockAction(`${gone.name} deleted`, { tone: "warning", undo: () => setRows((rs) => [...rs, gone].sort((a, b) => a.date.localeCompare(b.date))) });
        }}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Import holidays</DialogTitle>
            <DialogDescription>Upload a CSV with date, name, scope and branch. Rows are validated before anything is saved.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-md border border-dashed border-border bg-subtle px-3 py-3">
              <FileUp className="size-5 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium">karnataka-state-holidays-2026.csv</p>
                <p className="text-[11px] text-muted-foreground">4 rows · 2 KB · uploaded just now</p>
              </div>
              <Badge variant="soft">Parsed</Badge>
            </div>
            <ul className="divide-y divide-border rounded-md border border-border">
              {IMPORT_PREVIEW.map((p) => (
                <li key={p.name} className={cn("flex items-center gap-2.5 px-3 py-2", p.duplicate && "bg-warning-soft/40")}>
                  <Checkbox
                    aria-label={`Import ${p.name}`}
                    checked={importPick.has(p.name)}
                    disabled={p.duplicate}
                    onCheckedChange={(v) =>
                      setImportPick((s) => {
                        const n = new Set(s);
                        if (v) n.add(p.name);
                        else n.delete(p.name);
                        return n;
                      })
                    }
                  />
                  <span className="tnum w-24 text-xs">{fmtDate(p.date)}</span>
                  <span className="flex-1 text-xs font-medium">{p.name}</span>
                  <Badge variant="muted">{p.scope}</Badge>
                  <span className="text-[11px] text-muted-foreground">{p.duplicate ? "Already exists — skipped" : branchById(p.branch)?.city}</span>
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!importPick.size}
              onClick={() => {
                const add = IMPORT_PREVIEW.filter((p) => importPick.has(p.name) && !p.duplicate).map<HolidayRow>((p, i) => ({
                  id: `HOL-I${String(rows.length + i + 1).padStart(3, "0")}`,
                  date: p.date,
                  name: p.name,
                  country: "IN",
                  scope: p.scope,
                  branchIds: [p.branch],
                  optional: false,
                  source: "override",
                  note: "Imported from karnataka-state-holidays-2026.csv",
                  active: true,
                  updatedBy: "Priya Menon",
                  updatedAt: `${DEMO_TODAY}T14:35:00`,
                }));
                setRows((rs) => [...rs, ...add].sort((a, b) => a.date.localeCompare(b.date)));
                setImportOpen(false);
                mockAction(`${add.length} holidays imported`, { description: "Added as tenant overrides for Bengaluru HQ. 1 duplicate skipped." });
              }}
            >
              Import {importPick.size} holidays
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------- calendar view */

const MONTHS = Array.from({ length: 12 }, (_, i) => i);

function YearCalendar({ rows }: { rows: HolidayRow[] }) {
  const byDate = new Map<string, HolidayRow[]>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);
  return (
    <Section title="2026 at a glance" description="Filled = mandatory · outlined = optional · ring = today">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MONTHS.map((m) => {
          const first = parseISO(`2026-${String(m + 1).padStart(2, "0")}-01`);
          const lead = (getDay(first) + 6) % 7; // Monday-first
          const days = getDaysInMonth(first);
          return (
            <div key={m}>
              <p className="mb-1 text-xs font-semibold">{format(first, "MMMM")}</p>
              <div className="grid grid-cols-7 gap-0.5 text-center text-[10px]">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i} className="font-semibold text-muted-foreground" aria-hidden>
                    {d}
                  </span>
                ))}
                {Array.from({ length: lead }).map((_, i) => (
                  <span key={`b${i}`} />
                ))}
                {Array.from({ length: days }, (_, d) => {
                  const date = format(addDays(first, d), "yyyy-MM-dd");
                  const hs = byDate.get(date);
                  const optional = hs?.every((h) => h.optional);
                  const weekend = [0, 6].includes(getDay(addDays(first, d)));
                  const cell = (
                    <span
                      className={cn(
                        "tnum flex h-6 items-center justify-center rounded",
                        weekend && !hs && "text-muted-foreground",
                        hs && !optional && "bg-primary font-semibold text-primary-foreground",
                        hs && optional && "border border-dashed border-primary font-semibold text-primary",
                        date === DEMO_TODAY && "ring-2 ring-ring",
                      )}
                      aria-label={hs ? `${fmtDate(date)}: ${hs.map((h) => h.name).join(", ")}` : undefined}
                      tabIndex={hs ? 0 : undefined}
                    >
                      {d + 1}
                    </span>
                  );
                  return hs ? (
                    <Hint key={date} text={hs.map((h) => `${h.name}${h.optional ? " (optional)" : ""} — ${appliesTo(h)}`).join(" · ")}>
                      {cell}
                    </Hint>
                  ) : (
                    <React.Fragment key={date}>{cell}</React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
