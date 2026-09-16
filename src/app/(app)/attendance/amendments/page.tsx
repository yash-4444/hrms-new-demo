"use client";

import * as React from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CheckCheck,
  ClipboardCheck,
  FileClock,
  FileUp,
  Hourglass,
  Paperclip,
  Pencil,
  RotateCcw,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Alert,
  Field,
  Input,
  Textarea,
  Badge,
} from "@/components/ui/primitives";
import {
  ConfirmDialog,
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
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { StatusBadge, TONE_DOT, statusDef } from "@/components/ui/status-badge";
import { DataTable, MutedCell } from "@/components/data-table";
import { mockAction, useApp } from "@/components/app-state";
import {
  CardsSkeleton,
  Gated,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  AMENDMENT_TYPES,
  amendmentTypeLabel,
  amendmentsFor,
  canCancelAmendment,
  canEditAmendment,
  resolveAttendanceCode,
  type Amendment,
  type AmendmentAttachment,
  type AmendmentStatus,
  type AmendmentType,
} from "@/mock/attendance";
import { DEMO_TODAY } from "@/mock/org";

const REASON_MIN = 10;
const REASON_MAX = 400;

const schema = z
  .object({
    type: z.enum(["missed_punch_in", "missed_punch_out", "correction", "manual_entry"]),
    date: z.string().min(1, "Pick the date you are regularising."),
    inTime: z.string(),
    outTime: z.string(),
    reason: z
      .string()
      .trim()
      .min(REASON_MIN, `Give your manager at least ${REASON_MIN} characters of context.`)
      .max(REASON_MAX, `Keep it under ${REASON_MAX} characters.`),
  })
  .superRefine((v, ctx) => {
    if (!v.inTime && !v.outTime) {
      ctx.addIssue({
        code: "custom",
        message: "Provide at least one proposed time.",
        path: ["inTime"],
      });
    }
    if (v.inTime && v.outTime && v.outTime <= v.inTime) {
      ctx.addIssue({
        code: "custom",
        message: "The punch-out must be after the punch-in.",
        path: ["outTime"],
      });
    }
    if (v.date > DEMO_TODAY) {
      ctx.addIssue({
        code: "custom",
        message: "A future date cannot be regularised.",
        path: ["date"],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const STATUS_FILTERS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "sent_back", label: "Sent back" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

export default function AmendmentsPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const code = resolveAttendanceCode(persona.employeeId);

  const [list, setList] = React.useState<Amendment[]>(() => amendmentsFor(code));
  const [status, setStatus] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Amendment | null>(null);
  const [detail, setDetail] = React.useState<Amendment | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<Amendment | null>(null);
  const [files, setFiles] = React.useState<AmendmentAttachment[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setList(amendmentsFor(code));
  }, [code]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    defaultValues: {
      type: "missed_punch_out",
      date: DEMO_TODAY,
      inTime: "09:30",
      outTime: "18:30",
      reason: "",
    },
  });
  const reason = form.watch("reason") ?? "";
  const reasonShort = reason.trim().length < REASON_MIN;

  const rows = React.useMemo(
    () =>
      list.filter(
        (a) => (status === "all" || a.status === status) && (type === "all" || a.type === type),
      ),
    [list, status, type],
  );

  const counts = React.useMemo(() => {
    const c: Record<string, number> = {};
    for (const a of list) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [list]);

  const openNew = () => {
    setEditing(null);
    setFiles([]);
    form.reset({
      type: "missed_punch_out",
      date: DEMO_TODAY,
      inTime: "09:30",
      outTime: "18:30",
      reason: "",
    });
    setOpen(true);
  };

  const openEdit = (a: Amendment) => {
    setEditing(a);
    setFiles(a.attachments);
    form.reset({
      type: a.type,
      date: a.date,
      inTime: a.proposedIn ? a.proposedIn.slice(11, 16) : "",
      outTime: a.proposedOut ? a.proposedOut.slice(11, 16) : "",
      reason: a.reason,
    });
    setOpen(true);
  };

  const addFiles = (names: string[]) => {
    if (!names.length) return;
    setFiles((f) => [
      ...f,
      ...names.map((name, i) => ({ name, sizeKb: 120 + ((name.length * 37 + i * 53) % 1800) })),
    ]);
  };

  const onSubmit = form.handleSubmit((v) => {
    const proposedIn = v.inTime ? `${v.date}T${v.inTime}:00` : null;
    const proposedOut = v.outTime ? `${v.date}T${v.outTime}:00` : null;
    const now = `${DEMO_TODAY}T09:05:00`;

    if (editing) {
      setList((l) =>
        l.map((a) =>
          a.id === editing.id
            ? {
                ...a,
                type: v.type as AmendmentType,
                date: v.date,
                proposedIn,
                proposedOut,
                reason: v.reason.trim(),
                attachments: files,
                status: "pending" as AmendmentStatus,
                timeline: [
                  ...a.timeline,
                  {
                    at: now,
                    actor: persona.name,
                    action: "Updated and resubmitted the request",
                    status: "pending" as const,
                  },
                ],
              }
            : a,
        ),
      );
      mockAction(`${editing.id} resubmitted`, {
        description: `${fmtDate(v.date)} · routed back to your approver for a decision.`,
      });
    } else {
      const id = `REG-${String(1900 + list.length).padStart(4, "0")}`;
      const fresh: Amendment = {
        id,
        code,
        employeeName: persona.name,
        department: persona.department,
        type: v.type as AmendmentType,
        date: v.date,
        originalIn: null,
        originalOut: null,
        proposedIn,
        proposedOut,
        reason: v.reason.trim(),
        status: "pending",
        raisedAt: now,
        approverCode: null,
        approver: persona.id === "employee" ? "Vikram Shah" : "Priya Menon",
        attachments: files,
        timeline: [
          { at: now, actor: persona.name, action: "Raised regularisation request", status: "submitted" },
          {
            at: now,
            actor: "Workflow engine",
            action: `Routed to ${persona.id === "employee" ? "Vikram Shah" : "Priya Menon"} for approval`,
            status: "pending",
          },
        ],
      };
      setList((l) => [fresh, ...l]);
      mockAction(`${id} submitted`, {
        description: `${amendmentTypeLabel(v.type as AmendmentType)} for ${fmtDate(v.date)} — your approver has been notified.`,
      });
    }

    setOpen(false);
    setEditing(null);
    setFiles([]);
    form.reset();
  });

  const cancelRequest = (a: Amendment) => {
    setList((l) =>
      l.map((x) =>
        x.id === a.id
          ? {
              ...x,
              status: "cancelled" as AmendmentStatus,
              timeline: [
                ...x.timeline,
                {
                  at: `${DEMO_TODAY}T09:05:00`,
                  actor: persona.name,
                  action: "Withdrew the request",
                  status: "cancelled" as const,
                },
              ],
            }
          : x,
      ),
    );
    mockAction(`${a.id} cancelled`, {
      tone: "warning",
      description: "The request is withdrawn; the day record is unchanged.",
    });
  };

  const columns = React.useMemo<ColumnDef<Amendment, unknown>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Request",
        cell: ({ row }) => <span className="tnum font-medium">{row.original.id}</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => <MutedCell>{amendmentTypeLabel(row.original.type)}</MutedCell>,
      },
      {
        accessorKey: "date",
        header: "For date",
        cell: ({ row }) => <span className="tnum">{fmtDate(row.original.date)}</span>,
      },
      {
        id: "proposed",
        header: "Proposed",
        accessorFn: (a) => `${a.proposedIn ?? ""} ${a.proposedOut ?? ""}`,
        cell: ({ row }) => (
          <span className="tnum">
            {row.original.proposedIn ? fmtTime(row.original.proposedIn) : "—"} –{" "}
            {row.original.proposedOut ? fmtTime(row.original.proposedOut) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="line-clamp-1 block max-w-[300px] text-muted-foreground">
            {row.original.reason}
          </span>
        ),
      },
      {
        id: "docs",
        header: "Docs",
        enableSorting: false,
        accessorFn: (a) => a.attachments.length,
        cell: ({ row }) =>
          row.original.attachments.length ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Paperclip className="size-3" aria-hidden />
              <span className="tnum">{row.original.attachments.length}</span>
            </span>
          ) : (
            <MutedCell>—</MutedCell>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "approver",
        header: "Approver",
        cell: ({ row }) => <MutedCell>{row.original.approver}</MutedCell>,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDetail(a);
                }}
              >
                Timeline
              </Button>
              {canEditAmendment(a.status) ? (
                <Gated menuKey="time.amendments" action="E">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Edit ${a.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(a);
                    }}
                  >
                    <Pencil /> Edit
                  </Button>
                </Gated>
              ) : null}
              {canCancelAmendment(a.status) ? (
                <Gated menuKey="time.amendments" action="D">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Cancel ${a.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCancelTarget(a);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </Gated>
              ) : null}
              {!canEditAmendment(a.status) && !canCancelAmendment(a.status) && (
                <span className="text-xs text-muted-foreground">Closed</span>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Regularisation Requests"
        description={`${persona.name} · ${persona.employeeId}. Missed punches can be regularised within 7 days of the event, up to 3 times a month.`}
        actions={
          <Gated menuKey="time.amendments" action="C">
            <Button size="sm" onClick={openNew}>
              <FileClock /> New Request
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <CardsSkeleton count={4} />
      ) : (
        <StatRow cols={4}>
          <StatTile
            label="Pending with approver"
            value={counts.pending ?? 0}
            icon={Hourglass}
            tone={(counts.pending ?? 0) > 0 ? "warning" : "neutral"}
            hint="Awaiting a decision"
            onClick={() => setStatus(status === "pending" ? "all" : "pending")}
          />
          <StatTile
            label="Approved"
            value={counts.approved ?? 0}
            icon={CheckCheck}
            tone="good"
            hint="Written back onto the day record"
            onClick={() => setStatus(status === "approved" ? "all" : "approved")}
          />
          <StatTile
            label="Sent back"
            value={counts.sent_back ?? 0}
            icon={RotateCcw}
            tone={(counts.sent_back ?? 0) > 0 ? "serious" : "neutral"}
            hint="Needs more detail from you"
            onClick={() => setStatus(status === "sent_back" ? "all" : "sent_back")}
          />
          <StatTile
            label="Rejected"
            value={counts.rejected ?? 0}
            icon={XCircle}
            tone={(counts.rejected ?? 0) > 0 ? "critical" : "neutral"}
            hint="Closed without a change"
            onClick={() => setStatus(status === "rejected" ? "all" : "rejected")}
          />
        </StatRow>
      )}

      {(counts.sent_back ?? 0) > 0 && (
        <Alert
          tone="warning"
          icon={RotateCcw}
          title={`${counts.sent_back} request${counts.sent_back === 1 ? "" : "s"} sent back to you`}
          action={
            <Button variant="outline" size="sm" onClick={() => setStatus("sent_back")}>
              Show them
            </Button>
          }
        >
          Your approver asked for more detail. Edit the request and resubmit — the 7-day window is
          paused while a request is with you.
        </Alert>
      )}

      <Section
        title="My requests"
        description={`${rows.length} of ${list.length} requests. Click a row to see the full status timeline.`}
        actions={
          status !== "all" || type !== "all" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus("all");
                setType("all");
              }}
            >
              <X /> Clear filters
            </Button>
          ) : null
        }
      >
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          getRowId={(a) => a.id}
          searchKeys={["id", "reason"]}
          searchPlaceholder="Search request or reason…"
          onRowClick={(a) => setDetail(a)}
          exportName="my-regularisations"
          emptyIcon={ClipboardCheck}
          emptyTitle="No regularisation requests"
          emptyDescription="Raise one when a punch is missing — you have 7 days from the event."
          emptyAction={
            <Gated menuKey="time.amendments" action="C">
              <Button size="sm" onClick={openNew}>
                <FileClock /> New Request
              </Button>
            </Gated>
          }
          filters={
            <>
              <FilterSelect
                label="Status"
                value={status}
                onValueChange={setStatus}
                options={STATUS_FILTERS}
                width="w-[165px]"
              />
              <FilterSelect
                label="Type"
                value={type}
                onValueChange={setType}
                options={AMENDMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                width="w-[195px]"
              />
            </>
          }
        />
      </Section>

      {/* ------------------------------------------------- new / edit dialog */}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.id}` : "New regularisation request"}</DialogTitle>
            <DialogDescription>
              Tell your approver what happened and what the punch should have been. Requests older
              than 7 days are auto-rejected by the workflow.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate>
            <DialogBody className="flex flex-col gap-3.5">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field, fieldState }) => (
                    <Field
                      label="Request type"
                      required
                      error={fieldState.error?.message}
                      hint={AMENDMENT_TYPES.find((t) => t.value === field.value)?.help}
                    >
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger aria-label="Request type">
                          <SelectValue placeholder="Choose a type" />
                        </SelectTrigger>
                        <SelectContent>
                          {AMENDMENT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                <Field
                  label="Date being regularised"
                  htmlFor="reg-date"
                  required
                  error={form.formState.errors.date?.message}
                  hint="Within the last 7 days"
                >
                  <Input
                    id="reg-date"
                    type="date"
                    max={DEMO_TODAY}
                    aria-invalid={!!form.formState.errors.date}
                    {...form.register("date")}
                  />
                </Field>
                <Field
                  label="Proposed punch-in"
                  htmlFor="reg-in"
                  error={form.formState.errors.inTime?.message}
                >
                  <Input
                    id="reg-in"
                    type="time"
                    aria-invalid={!!form.formState.errors.inTime}
                    {...form.register("inTime")}
                  />
                </Field>
                <Field
                  label="Proposed punch-out"
                  htmlFor="reg-out"
                  error={form.formState.errors.outTime?.message}
                >
                  <Input
                    id="reg-out"
                    type="time"
                    aria-invalid={!!form.formState.errors.outTime}
                    {...form.register("outTime")}
                  />
                </Field>
              </div>

              <Field
                label="Reason"
                htmlFor="reg-reason"
                required
                error={form.formState.errors.reason?.message}
                hint={
                  <span
                    className={cn(
                      "tnum",
                      reasonShort ? "text-warning-fg" : "text-muted-foreground",
                    )}
                  >
                    {reason.trim().length} / {REASON_MIN} characters minimum
                    {reasonShort
                      ? ` — ${REASON_MIN - reason.trim().length} more to go`
                      : " — good to submit"}
                  </span>
                }
              >
                <Textarea
                  id="reg-reason"
                  rows={3}
                  maxLength={REASON_MAX}
                  placeholder="e.g. Client escalation call ran past midnight and the Gate 2 reader was already shut down."
                  aria-invalid={!!form.formState.errors.reason}
                  {...form.register("reason")}
                />
              </Field>

              <Field label="Supporting documents" hint="PDF, PNG or EML up to 5 MB each. Optional.">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    addFiles(Array.from(e.dataTransfer.files).map((f) => f.name));
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-5 text-center transition-colors",
                    dragging ? "border-primary bg-primary-soft/40" : "border-border bg-subtle",
                  )}
                >
                  <FileUp className="size-5 text-muted-foreground" aria-hidden />
                  <p className="text-xs text-muted-foreground">
                    Drag a file here, or{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => fileRef.current?.click()}
                    >
                      browse your device
                    </button>
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    className="sr-only"
                    aria-label="Attach supporting documents"
                    onChange={(e) => {
                      addFiles(Array.from(e.target.files ?? []).map((f) => f.name));
                      e.target.value = "";
                    }}
                  />
                </div>
              </Field>

              {files.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5"
                    >
                      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-xs">{f.name}</span>
                      <span className="tnum text-xs text-muted-foreground">{f.sizeKb} KB</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">{editing ? "Resubmit request" : "Submit request"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --------------------------------------------------- timeline drawer */}
      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        {detail && (
          <SheetContent width="sm:max-w-md" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="tnum">{detail.id}</span>
                <StatusBadge status={detail.status} />
              </SheetTitle>
              <SheetDescription>
                {amendmentTypeLabel(detail.type)} for {fmtDate(detail.date)} · raised{" "}
                {fmtDateTime(detail.raisedAt)}
              </SheetDescription>
            </SheetHeader>

            <SheetBody className="flex flex-col gap-4">
              <div className="rounded-md border border-border bg-subtle p-2.5">
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-muted-foreground">Recorded in</dt>
                  <dd className="tnum text-right font-medium">
                    {detail.originalIn ? fmtTime(detail.originalIn) : "— missing —"}
                  </dd>
                  <dt className="text-muted-foreground">Recorded out</dt>
                  <dd className="tnum text-right font-medium">
                    {detail.originalOut ? fmtTime(detail.originalOut) : "— missing —"}
                  </dd>
                  <dt className="text-muted-foreground">Proposed in</dt>
                  <dd className="tnum text-right font-medium text-primary">
                    {detail.proposedIn ? fmtTime(detail.proposedIn) : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Proposed out</dt>
                  <dd className="tnum text-right font-medium text-primary">
                    {detail.proposedOut ? fmtTime(detail.proposedOut) : "—"}
                  </dd>
                  <dt className="text-muted-foreground">Approver</dt>
                  <dd className="text-right font-medium">{detail.approver}</dd>
                </dl>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Reason
                </p>
                <p className="text-xs text-foreground">{detail.reason}</p>
              </div>

              {detail.attachments.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Attachments
                  </p>
                  <ul className="flex flex-col gap-1">
                    {detail.attachments.map((f) => (
                      <li key={f.name} className="flex items-center gap-2 text-xs">
                        <Paperclip className="size-3 text-muted-foreground" aria-hidden />
                        <button
                          type="button"
                          className="truncate text-primary underline-offset-2 hover:underline"
                          onClick={() =>
                            mockAction("Preview opened", {
                              tone: "info",
                              description: `${f.name} · ${f.sizeKb} KB — files are not stored in the demo.`,
                            })
                          }
                        >
                          {f.name}
                        </button>
                        <span className="tnum ml-auto text-muted-foreground">{f.sizeKb} KB</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Status timeline
                </p>
                <ol className="relative flex flex-col gap-3 pl-4">
                  <span className="absolute left-[3px] top-1 h-[calc(100%-0.5rem)] w-px bg-border" aria-hidden />
                  {detail.timeline.map((ev, i) => (
                    <li key={i} className="relative">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -left-4 top-1 size-[7px] rounded-full ring-2 ring-card",
                          TONE_DOT[statusDef(ev.status).tone],
                        )}
                      />
                      <p className="text-xs font-medium text-foreground">{ev.action}</p>
                      <p className="tnum text-[11px] text-muted-foreground">
                        {ev.actor} · {fmtDateTime(ev.at)}
                      </p>
                      {ev.note && (
                        <p className="mt-1 rounded-md border border-border bg-subtle px-2 py-1 text-[11px] text-muted-foreground">
                          “{ev.note}”
                        </p>
                      )}
                    </li>
                  ))}
                  {detail.status === "pending" && (
                    <li className="relative">
                      <span
                        aria-hidden
                        className="absolute -left-4 top-1 size-[7px] rounded-full bg-input ring-2 ring-card"
                      />
                      <p className="text-xs font-medium text-muted-foreground">
                        Awaiting {detail.approver}&rsquo;s decision
                      </p>
                      <Badge variant="muted" className="mt-1">
                        SLA: 2 working days
                      </Badge>
                    </li>
                  )}
                </ol>
              </div>
            </SheetBody>

            <SheetFooter>
              <Button variant="outline" onClick={() => setDetail(null)}>
                Close
              </Button>
              {canEditAmendment(detail.status) && (
                <Gated menuKey="time.amendments" action="E">
                  <Button
                    onClick={() => {
                      const a = detail;
                      setDetail(null);
                      openEdit(a);
                    }}
                  >
                    <Pencil /> Edit &amp; resubmit
                  </Button>
                </Gated>
              )}
              {canCancelAmendment(detail.status) && (
                <Gated menuKey="time.amendments" action="D">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const a = detail;
                      setDetail(null);
                      setCancelTarget(a);
                    }}
                  >
                    <Trash2 /> Cancel request
                  </Button>
                </Gated>
              )}
            </SheetFooter>
          </SheetContent>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(v) => !v && setCancelTarget(null)}
        title={`Cancel ${cancelTarget?.id ?? ""}?`}
        description={
          cancelTarget
            ? `The request for ${fmtDate(cancelTarget.date)} will be withdrawn and the day record left as it is. You can raise a fresh request while the 7-day window is open.`
            : undefined
        }
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => {
          if (cancelTarget) cancelRequest(cancelTarget);
          setCancelTarget(null);
        }}
      />
    </PageBody>
  );
}
