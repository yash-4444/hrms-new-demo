"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, inr, num } from "@/lib/format";
import {
  AUTO_MAPPING,
  HRMS_FIELDS,
  IMPORT_SOURCE_COLUMNS,
  IMPORT_SUMMARY,
  SAMPLE_IMPORT_ROWS,
  type ImportOutcome,
  type ImportRow,
} from "@/mock/people-extras";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { BarCompareChart, ShareBar } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert, Badge, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";

/* ============================================================================
   /employees/import — upload -> column mapping -> dry-run validation report.

   Nothing here writes: the dry run is the whole point. "Commit import" fires a
   toast and leaves the 340 seeded employees exactly as they were.
   ========================================================================== */

type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string; hint: string }[] = [
  { n: 1, label: "Upload", hint: "Pick the spreadsheet" },
  { n: 2, label: "Map columns", hint: "Source column to HRMS field" },
  { n: 3, label: "Dry-run validation", hint: "What would happen on commit" },
];

/** Source column header -> the key it reads from on a parsed row. */
const SOURCE_TO_ROW_KEY: Record<string, keyof ImportRow> = {
  "Emp Code": "code",
  "Full Name": "name",
  "Work Email": "email",
  Mobile: "phone",
  Department: "department",
  Branch: "branch",
  Designation: "designation",
  Grade: "grade",
  "Date of Joining": "joiningDate",
  "Annual CTC": "ctc",
  PAN: "pan",
  "Manager Code": "managerCode",
  "Cost Centre": "costCentre",
};

const OUTCOME_META: Record<ImportOutcome, { status: string; label: string }> = {
  create: { status: "approved", label: "Will create" },
  update: { status: "pending", label: "Will update" },
  reject: { status: "rejected", label: "Rejected" },
};

const fieldByKey = new Map(HRMS_FIELDS.map((f) => [f.key, f]));
const REQUIRED_FIELDS = HRMS_FIELDS.filter((f) => f.required);

const defaultMapping = () =>
  Object.fromEntries(
    IMPORT_SOURCE_COLUMNS.map((c) => [c as string, AUTO_MAPPING[c]?.field ?? "__ignore"]),
  ) as Record<string, string>;

/* ------------------------------------------------------------------ stepper */

function Stepper({
  step,
  maxReached,
  onJump,
}: {
  step: Step;
  maxReached: Step;
  onJump: (s: Step) => void;
}) {
  return (
    <ol className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-0">
      {STEPS.map((s, i) => {
        const done = s.n < step;
        const current = s.n === step;
        const reachable = s.n <= maxReached;
        return (
          <li key={s.n} className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              disabled={!reachable || current}
              onClick={() => onJump(s.n)}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors",
                reachable && !current && "hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                !reachable && "cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "tnum flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "border-success/30 bg-success-soft text-success-fg",
                  current && "border-primary bg-primary text-primary-foreground",
                  !done && !current && "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : s.n}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block truncate text-xs font-medium",
                    current ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">{s.hint}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn("hidden h-px flex-1 sm:block", done ? "bg-success/40" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ================================================================== page */

export default function BulkImportPage() {
  const loading = useFakeLoad();
  const [step, setStep] = React.useState<Step>(1);
  const [maxReached, setMaxReached] = React.useState<Step>(1);
  const [fileLoaded, setFileLoaded] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [mapping, setMapping] = React.useState<Record<string, string>>(defaultMapping);
  const [outcomeFilter, setOutcomeFilter] = React.useState<"all" | ImportOutcome>("all");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const goto = (s: Step) => {
    setStep(s);
    setMaxReached((m) => (s > m ? s : m));
  };

  const loadSample = () => {
    setFileLoaded(true);
    setMapping(defaultMapping());
    mockAction("Sample file loaded", {
      description: `${IMPORT_SUMMARY.fileName} — ${IMPORT_SUMMARY.totalRows} rows, ${IMPORT_SOURCE_COLUMNS.length} columns detected on sheet "${IMPORT_SUMMARY.sheetName}".`,
    });
  };

  /* -------------------------------------------------------- mapping stats */

  const mappedFieldKeys = React.useMemo(
    () => new Set(Object.values(mapping).filter((k) => k !== "__ignore")),
    [mapping],
  );
  const missingRequired = React.useMemo(
    () => REQUIRED_FIELDS.filter((f) => !mappedFieldKeys.has(f.key)),
    [mappedFieldKeys],
  );
  /** Columns still sitting on what the auto-detector proposed. Recomputes live. */
  const onAutoMatch = IMPORT_SOURCE_COLUMNS.filter(
    (c) => mapping[c] === (AUTO_MAPPING[c]?.field ?? "__ignore"),
  ).length;
  const unmapped = IMPORT_SOURCE_COLUMNS.filter((c) => mapping[c] === "__ignore").length;

  /** Two source columns pointing at one HRMS field — the second would clobber the first. */
  const duplicateFields = React.useMemo(() => {
    const seen = new Map<string, string[]>();
    for (const c of IMPORT_SOURCE_COLUMNS) {
      const k = mapping[c] ?? "__ignore";
      if (k === "__ignore") continue;
      seen.set(k, [...(seen.get(k) ?? []), c]);
    }
    return [...seen.entries()].filter(([, cols]) => cols.length > 1);
  }, [mapping]);

  /* ------------------------------------------------------------ dry run */

  /**
   * The report is DERIVED from the current mapping, not read off the fixture.
   * Unmap a required field and every row that needed it flips to rejected —
   * the stat row, the chart, the table and the commit dialog all follow.
   * With the auto-detected mapping intact this reproduces the fixture split
   * exactly.
   */
  const derivedRows = React.useMemo<ImportRow[]>(() => {
    if (missingRequired.length === 0) return SAMPLE_IMPORT_ROWS;
    const names = missingRequired.map((f) => `"${f.label}"`).join(", ");
    const reason = `Required field${missingRequired.length === 1 ? "" : "s"} ${names} ${
      missingRequired.length === 1 ? "is" : "are"
    } not mapped to any source column. Every row depends on it, so nothing in this file can be written.`;
    return SAMPLE_IMPORT_ROWS.map((r) =>
      r.outcome === "reject" ? r : { ...r, outcome: "reject" as const, reason, changes: [] },
    );
  }, [missingRequired]);

  const derived = React.useMemo(
    () => ({
      totalRows: derivedRows.length,
      create: derivedRows.filter((r) => r.outcome === "create").length,
      update: derivedRows.filter((r) => r.outcome === "update").length,
      reject: derivedRows.filter((r) => r.outcome === "reject").length,
    }),
    [derivedRows],
  );

  const filteredRows = React.useMemo(
    () =>
      outcomeFilter === "all" ? derivedRows : derivedRows.filter((r) => r.outcome === outcomeFilter),
    [derivedRows, outcomeFilter],
  );

  const splitData = [
    { outcome: "Will create", rows: derived.create },
    { outcome: "Will update", rows: derived.update },
    { outcome: "Rejected", rows: derived.reject },
  ];

  const columns = React.useMemo<ColumnDef<ImportRow, unknown>[]>(
    () => [
      {
        accessorKey: "rowNumber",
        header: "Row",
        size: 56,
        cell: ({ row }) => <span className="tnum text-muted-foreground">{row.original.rowNumber}</span>,
      },
      {
        accessorKey: "outcome",
        header: "Outcome",
        size: 110,
        cell: ({ row }) => (
          <StatusBadge
            status={OUTCOME_META[row.original.outcome].status}
            label={OUTCOME_META[row.original.outcome].label}
          />
        ),
      },
      {
        accessorKey: "code",
        header: "Employee code",
        size: 108,
        cell: ({ row }) => <span className="tnum font-medium">{row.original.code}</span>,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <span className="whitespace-nowrap font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "email",
        header: "Work email",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "department",
        header: "Department",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.department}</span>,
      },
      {
        accessorKey: "branch",
        header: "Branch",
        cell: ({ row }) => <span className="whitespace-nowrap">{row.original.branch}</span>,
      },
      {
        accessorKey: "grade",
        header: "Grade",
        size: 64,
        cell: ({ row }) => <span className="tnum">{row.original.grade}</span>,
      },
      {
        accessorKey: "joiningDate",
        header: "Joining date",
        size: 96,
        cell: ({ row }) => <span className="tnum whitespace-nowrap">{row.original.joiningDate}</span>,
      },
      {
        accessorKey: "ctc",
        header: "Annual CTC",
        size: 108,
        cell: ({ row }) => {
          const n = Number(row.original.ctc);
          return (
            <span className="tnum block text-right font-medium">
              {row.original.ctc === "" || Number.isNaN(n) ? "—" : inr(n, { decimals: false })}
            </span>
          );
        },
      },
      {
        id: "details",
        header: "Details",
        accessorFn: (r) =>
          r.outcome === "reject" ? (r.reason ?? "") : r.changes.length ? r.changes.join("; ") : "New record",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          if (r.outcome === "reject") {
            return (
              <span role="alert" className="block min-w-[280px] whitespace-normal text-xs text-destructive-fg">
                {r.reason}
              </span>
            );
          }
          if (r.outcome === "update") {
            return (
              <ul className="min-w-[280px] whitespace-normal">
                {r.changes.map((c) => (
                  <li key={c} className="text-xs text-muted-foreground">
                    {c}
                  </li>
                ))}
              </ul>
            );
          }
          return <span className="text-xs text-muted-foreground">New record</span>;
        },
      },
    ],
    [],
  );

  /* --------------------------------------------------------------- render */

  const headerActions = (
    <>
      <Button variant="outline" size="sm" asChild>
        <Link href="/employees">
          <ChevronLeft /> Back to directory
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          mockAction("Template downloaded", {
            description: "stellar_employee_import_template.xlsx — 13 columns with the validation rules on sheet 2.",
          })
        }
      >
        <Download /> Download template
      </Button>
    </>
  );

  return (
    <PageBody>
      <PageHeader
        title="Bulk import employees"
        description="Upload a spreadsheet, confirm how its columns map onto HRMS fields, then review a dry run before anything is written. Nothing is committed until the final step."
        actions={headerActions}
      />

      {loading ? (
        <CardsSkeleton count={3} height={120} />
      ) : (
        <>
          <Stepper step={step} maxReached={maxReached} onJump={goto} />

          {/* ------------------------------------------------- step 1 */}
          {step === 1 && (
            <>
              <Section
                title="Source file"
                description="Accepts .xlsx and .csv up to 5 MB. The first sheet is read unless a sheet name is given."
              >
                {fileLoaded ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-subtle p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
                      <FileSpreadsheet className="size-4.5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{IMPORT_SUMMARY.fileName}</p>
                      <p className="tnum mt-0.5 text-xs text-muted-foreground">
                        {num(IMPORT_SUMMARY.sizeKb)} KB · sheet &ldquo;{IMPORT_SUMMARY.sheetName}&rdquo; ·{" "}
                        {IMPORT_SUMMARY.totalRows} rows detected · {IMPORT_SOURCE_COLUMNS.length} columns detected
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Uploaded {fmtDateTime(IMPORT_SUMMARY.uploadedAt)}
                      </p>
                    </div>
                    <StatusBadge status="completed" label="Parsed" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove uploaded file"
                      onClick={() => {
                        setFileLoaded(false);
                        setMaxReached(1);
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      loadSample();
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors",
                      dragging ? "border-primary bg-primary-soft/40" : "border-border bg-subtle",
                    )}
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Upload className="size-5" aria-hidden />
                    </span>
                    <p className="text-sm font-medium text-foreground">Drag a .xlsx or .csv file here</p>
                    <p className="text-xs text-muted-foreground">
                      The demo does not read your disk — drop anything, or load the prepared sample.
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">or</p>
                    <Button size="sm" onClick={loadSample}>
                      <FileSpreadsheet /> Use sample file
                    </Button>
                  </div>
                )}
              </Section>

              <Alert tone="info" icon={ShieldCheck} title="What the importer validates">
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  <li>Employee code must be unique — a code already in use is rejected, never overwritten.</li>
                  <li>Work email must be unique across the tenant.</li>
                  <li>Department and branch must already exist; the importer never creates masters.</li>
                  <li>
                    Joining date must be <span className="font-medium">dd-MM-yyyy</span> and a real calendar day.
                  </li>
                  <li>PAN is checksum validated; leave it blank for non-resident hires.</li>
                  <li>Manager code, when given, must resolve to an active employee.</li>
                </ul>
              </Alert>

              <div className="flex justify-end">
                <Button disabled={!fileLoaded} onClick={() => goto(2)}>
                  Continue to mapping <ChevronRight />
                </Button>
              </div>
            </>
          )}

          {/* ------------------------------------------------- step 2 */}
          {step === 2 && (
            <>
              {missingRequired.length > 0 && (
                <Alert tone="warning" icon={AlertTriangle} title="Required fields are not mapped">
                  {missingRequired.map((f) => f.label).join(", ")} must be mapped to a source column before the
                  dry run can be produced.
                </Alert>
              )}

              {duplicateFields.length > 0 && (
                <Alert tone="warning" icon={AlertTriangle} title="Two columns map to the same field">
                  {duplicateFields
                    .map(
                      ([key, cols]) =>
                        `${cols.join(" and ")} both map to ${fieldByKey.get(key)?.label ?? key}`,
                    )
                    .join("; ")}
                  . The right-most column wins — map one of them to &ldquo;Do not import&rdquo; instead.
                </Alert>
              )}

              <Section
                title="Column mapping"
                description={`${onAutoMatch} of ${IMPORT_SOURCE_COLUMNS.length} columns on the auto-detected mapping · ${REQUIRED_FIELDS.length - missingRequired.length} of ${REQUIRED_FIELDS.length} required fields mapped · ${unmapped} column${unmapped === 1 ? "" : "s"} skipped`}
                actions={
                  <Button variant="outline" size="sm" onClick={() => setMapping(defaultMapping())}>
                    <Columns3 /> Reset to auto-detected
                  </Button>
                }
                bodyClassName="p-0"
              >
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="w-full caption-bottom text-xs">
                    <caption className="sr-only">
                      Mapping of each spreadsheet column onto an HRMS field
                    </caption>
                    <thead className="bg-subtle">
                      <tr className="border-b border-border">
                        <th scope="col" className="h-8 px-2.5 text-left font-medium text-muted-foreground">
                          Source column
                        </th>
                        <th scope="col" className="h-8 px-2.5 text-left font-medium text-muted-foreground">
                          Sample value (row 2)
                        </th>
                        <th scope="col" className="h-8 px-2.5 text-left font-medium text-muted-foreground">
                          HRMS field
                        </th>
                        <th scope="col" className="h-8 px-2.5 text-left font-medium text-muted-foreground">
                          Auto-match
                        </th>
                        <th scope="col" className="h-8 px-2.5 text-left font-medium text-muted-foreground">
                          Required
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {IMPORT_SOURCE_COLUMNS.map((col) => {
                        const confidence = AUTO_MAPPING[col]?.confidence ?? 0;
                        const selectedKey = mapping[col] ?? "__ignore";
                        const field = fieldByKey.get(selectedKey);
                        const sample = String(SAMPLE_IMPORT_ROWS[0][SOURCE_TO_ROW_KEY[col]] ?? "");
                        return (
                          <tr key={col} className="border-b border-border last:border-0">
                            <td className="px-2.5 py-1.5 align-middle font-medium text-foreground">{col}</td>
                            <td className="max-w-[200px] truncate px-2.5 py-1.5 align-middle text-muted-foreground">
                              {sample || "—"}
                            </td>
                            <td className="px-2.5 py-1.5 align-middle">
                              <Select
                                value={selectedKey}
                                onValueChange={(v) => setMapping((m) => ({ ...m, [col]: v }))}
                              >
                                <SelectTrigger size="sm" aria-label={`HRMS field for ${col}`} className="w-[200px]">
                                  <span className="truncate">{field?.label ?? "— Do not import —"}</span>
                                </SelectTrigger>
                                <SelectContent>
                                  {HRMS_FIELDS.map((f) => (
                                    <SelectItem key={f.key} value={f.key}>
                                      {f.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {field && field.key !== "__ignore" && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{field.hint}</p>
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 align-middle">
                              <StatusBadge
                                status={confidence >= 90 ? "approved" : confidence >= 70 ? "pending" : "draft"}
                                label={`${confidence}% auto-matched`}
                              />
                            </td>
                            <td className="px-2.5 py-1.5 align-middle">
                              {field?.required ? (
                                <Badge variant="soft">Required</Badge>
                              ) : (
                                <span className="text-muted-foreground">Optional</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Section>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft /> Back
                </Button>
                <Button disabled={missingRequired.length > 0} onClick={() => goto(3)}>
                  <ShieldCheck /> Run dry-run validation
                </Button>
              </div>
            </>
          )}

          {/* ------------------------------------------------- step 3 */}
          {step === 3 && (
            <>
              {missingRequired.length > 0 && (
                <Alert tone="warning" icon={AlertTriangle} title="Mapping is incomplete — the whole file fails">
                  {missingRequired.map((f) => f.label).join(", ")}{" "}
                  {missingRequired.length === 1 ? "is" : "are"} not mapped to any source column, so every row
                  below is rejected.{" "}
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Go back and fix the mapping
                  </button>
                  .
                </Alert>
              )}

              <StatRow cols={4}>
                <StatTile
                  compact
                  label="Rows read"
                  value={num(derived.totalRows)}
                  hint={`From ${IMPORT_SUMMARY.fileName}`}
                  icon={FileSpreadsheet}
                />
                <StatTile
                  compact
                  tone="good"
                  label="Would be created"
                  value={num(derived.create)}
                  hint="New employee records"
                  icon={Check}
                />
                <StatTile
                  compact
                  tone="accent"
                  label="Would be updated"
                  value={num(derived.update)}
                  hint="Existing codes matched"
                  icon={FileText}
                />
                <StatTile
                  compact
                  tone="critical"
                  label="Would be rejected"
                  value={num(derived.reject)}
                  hint="Skipped — see the reason per row"
                  icon={AlertTriangle}
                />
              </StatRow>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <BarCompareChart
                  title="Dry-run outcome split"
                  description={`What committing ${IMPORT_SUMMARY.fileName} would do to the ${derived.totalRows} rows read from sheet "${IMPORT_SUMMARY.sheetName}", under the current column mapping.`}
                  data={splitData}
                  xKey="outcome"
                  series={[{ key: "rows", label: "Rows" }]}
                  height={200}
                  valueFormat={(v) => num(v)}
                  footnote="A dry run reads the file and resolves every reference. It writes nothing."
                />

                <Section
                  title="Proportion of the file"
                  description="Rejected rows are skipped whole — a partial row is never written."
                >
                  <ShareBar
                    height={10}
                    segments={[
                      { key: "create", label: "Will create", value: derived.create, status: "good" },
                      { key: "update", label: "Will update", value: derived.update, status: "warning" },
                      { key: "reject", label: "Rejected", value: derived.reject, status: "critical" },
                    ]}
                    valueFormat={(v) => `${num(v)} rows`}
                  />
                  <dl className="mt-4 divide-y divide-border border-t border-border">
                    <div className="flex items-center justify-between gap-4 py-1.5">
                      <dt className="text-xs text-muted-foreground">Validation rules applied</dt>
                      <dd className="tnum text-xs font-medium">6</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-1.5">
                      <dt className="text-xs text-muted-foreground">Columns mapped</dt>
                      <dd className="tnum text-xs font-medium">
                        {IMPORT_SOURCE_COLUMNS.length - unmapped} of {IMPORT_SOURCE_COLUMNS.length}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-1.5">
                      <dt className="text-xs text-muted-foreground">Pass rate</dt>
                      <dd className="tnum text-xs font-medium">
                        {(((derived.create + derived.update) / derived.totalRows) * 100).toFixed(1)}%
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-1.5">
                      <dt className="text-xs text-muted-foreground">Dry run completed</dt>
                      <dd className="tnum text-xs font-medium">{fmtDateTime(IMPORT_SUMMARY.uploadedAt)}</dd>
                    </div>
                  </dl>
                </Section>
              </div>

              {derived.reject > 0 ? (
                <Alert tone="danger" icon={AlertTriangle} title="Rejected rows will be skipped">
                  {derived.reject} of {derived.totalRows} rows will be rejected and skipped. Fix them in the
                  source file and re-upload — a dry run never writes anything.
                </Alert>
              ) : (
                <Alert tone="success" icon={Check} title="Every row passed validation">
                  All {derived.totalRows} rows resolved cleanly against the current mapping. Committing will
                  create {derived.create} and update {derived.update} records.
                </Alert>
              )}

              <Section
                title="Row-by-row report"
                description="Every rejection carries the exact reason the validator produced."
                actions={
                  <Tabs
                    value={outcomeFilter}
                    onValueChange={(v) => setOutcomeFilter(v as "all" | ImportOutcome)}
                  >
                    <TabsList>
                      <TabsTrigger value="all">All ({derived.totalRows})</TabsTrigger>
                      <TabsTrigger value="create">Created ({derived.create})</TabsTrigger>
                      <TabsTrigger value="update">Updated ({derived.update})</TabsTrigger>
                      <TabsTrigger value="reject">Rejected ({derived.reject})</TabsTrigger>
                    </TabsList>
                  </Tabs>
                }
                bodyClassName="p-3"
              >
                <DataTable<ImportRow>
                  columns={columns}
                  data={filteredRows}
                  getRowId={(r) => String(r.rowNumber)}
                  searchKeys={["code", "name", "email", "reason"]}
                  searchPlaceholder="Search code, name, email or reason…"
                  exportName="import-dry-run"
                  pageSize={25}
                  dense
                  rowTone={(r) =>
                    r.outcome === "reject" ? "danger" : r.outcome === "update" ? "warning" : undefined
                  }
                  emptyIcon={FileSpreadsheet}
                  emptyTitle="No rows in this bucket"
                  emptyDescription="Switch the filter above to see the rest of the file."
                />
              </Section>

              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft /> Back to mapping
                </Button>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      mockAction("Error report downloaded", {
                        description: `import_errors_${IMPORT_SUMMARY.sheetName.toLowerCase().replace(/\s+/g, "_")}.csv — ${derived.reject} rejected row${derived.reject === 1 ? "" : "s"} with their reasons.`,
                      })
                    }
                  >
                    <Download /> Download error report
                  </Button>
                  <Gated menuKey="people.import" action="X">
                    <Button
                      disabled={derived.create + derived.update === 0}
                      onClick={() => setConfirmOpen(true)}
                    >
                      <Check /> Commit import
                    </Button>
                  </Gated>
                </div>
              </div>

              <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Commit this import?"
                confirmLabel="Commit import"
                description={
                  <>
                    {derived.create} employee record{derived.create === 1 ? "" : "s"} will be created and{" "}
                    {derived.update} existing record{derived.update === 1 ? "" : "s"} will be updated.{" "}
                    {derived.reject} rejected row{derived.reject === 1 ? "" : "s"} will be skipped and written
                    to the error report. This step cannot be undone from the UI.
                  </>
                }
                onConfirm={() =>
                  mockAction("Import committed", {
                    description: `${derived.create} employees created, ${derived.update} updated, ${derived.reject} rejected rows skipped. In the demo nothing is persisted.`,
                  })
                }
              />
            </>
          )}
        </>
      )}
    </PageBody>
  );
}
