"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Activity, ArrowRight, CalendarClock, Check, Hourglass, LogOut, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, num } from "@/lib/format";
import { DEMO_TODAY, DEPARTMENTS, deptName } from "@/mock/org";
import { employeeByCode, employeeName } from "@/mock/employees";
import { LIFECYCLE_EVENTS, LIFECYCLE_LABEL, type LifecycleEvent, type LifecycleType } from "@/mock/masters";
import { EmployeeLink } from "@/components/org/bits";
import { LifecycleWizard } from "@/components/org/lifecycle-wizard";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Avatar, Badge, Field, Textarea } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";

type Row = LifecycleEvent & { employeeName: string; typeLabel: string; summary: string };

const toRow = (e: LifecycleEvent): Row => ({
  ...e,
  employeeName: employeeName(e.employeeCode),
  typeLabel: LIFECYCLE_LABEL[e.type],
  summary: e.changes.map((c) => `${c.field}: ${c.from} → ${c.to}`).join("; "),
});

const EXIT_TYPES: LifecycleType[] = ["resign", "terminate", "retire"];

export default function LifecyclePage() {
  return (
    <React.Suspense fallback={<TableSkeleton />}>
      <LifecycleEvents />
    </React.Suspense>
  );
}

function LifecycleEvents() {
  const loading = useFakeLoad();
  const { can, persona } = useApp();
  const canApprove = can("people.lifecycle", "A");
  /* ?employee=STL-0142 — deep link from the profile's "Record lifecycle event". */
  const searchParams = useSearchParams();
  const linkedEmployee = employeeByCode(searchParams.get("employee") ?? "")?.code;

  const [events, setEvents] = React.useState<LifecycleEvent[]>(LIFECYCLE_EVENTS);
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [dept, setDept] = React.useState("all");
  const [when, setWhen] = React.useState("all");
  const [wizardOpen, setWizardOpen] = React.useState(() => !!linkedEmployee && can("people.lifecycle", "C"));
  /* Pre-fill only the first, deep-linked open; "Record event" afterwards starts blank. */
  const [prefill, setPrefill] = React.useState(linkedEmployee);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectComment, setRejectComment] = React.useState("");
  const [rejectError, setRejectError] = React.useState<string | null>(null);

  const detail = events.find((e) => e.id === detailId) ?? null;

  const rows = React.useMemo(
    () =>
      events
        .filter(
          (e) =>
            (type === "all" || e.type === type) &&
            (status === "all" || e.status === status) &&
            (dept === "all" || employeeByCode(e.employeeCode)?.departmentId === dept) &&
            (when === "all" || (when === "upcoming" ? e.effectiveDate > DEMO_TODAY : e.effectiveDate <= DEMO_TODAY)),
        )
        .map(toRow),
    [events, type, status, dept, when],
  );

  const pending = events.filter((e) => e.status === "pending").length;
  const upcoming = events.filter((e) => e.effectiveDate > DEMO_TODAY && e.status !== "rejected").length;
  const thisMonth = events.filter((e) => e.effectiveDate.slice(0, 7) === DEMO_TODAY.slice(0, 7)).length;
  const exits = events.filter((e) => EXIT_TYPES.includes(e.type) && e.effectiveDate > DEMO_TODAY).length;

  const decide = (ev: LifecycleEvent, approve: boolean, comment?: string) => {
    const before = ev;
    const chain = ev.chain.map((s) => ({ ...s }));
    const idx = chain.findIndex((s) => s.status === "pending");
    if (idx >= 0) {
      chain[idx] = { ...chain[idx], status: approve ? "approved" : "rejected", at: `${DEMO_TODAY}T14:35:00`, comment };
      if (approve && chain[idx + 1]) chain[idx + 1] = { ...chain[idx + 1], status: "pending" };
    }
    const done = approve && !chain.some((s) => s.status === "pending" || s.status === "waiting");
    const next: LifecycleEvent = { ...ev, chain, status: approve ? (done ? "approved" : "pending") : "rejected" };
    setEvents((es) => es.map((e) => (e.id === ev.id ? next : e)));
    mockAction(
      approve ? (done ? `${ev.id} approved — change scheduled for ${fmtDate(ev.effectiveDate)}` : `${ev.id} approved at your step`) : `${ev.id} rejected`,
      {
        description: approve
          ? done
            ? `${employeeName(ev.employeeCode)}'s ${LIFECYCLE_LABEL[ev.type].toLowerCase()} is final. Payroll, reporting line and letters update on the effective date.`
            : `Moved to ${employeeName(chain[idx + 1]?.approverCode)} (${chain[idx + 1]?.step}).`
          : `Returned to ${employeeName(ev.initiatedBy)} with your comment.`,
        tone: approve ? "success" : "warning",
        undo: () => setEvents((es) => es.map((e) => (e.id === before.id ? before : e))),
      },
    );
  };

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "typeLabel",
        header: "Event",
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.typeLabel}</p>
            <p className="tnum text-[11px] text-muted-foreground">{row.original.id}</p>
          </div>
        ),
      },
      { accessorKey: "employeeName", header: "Employee", cell: ({ row }) => <EmployeeLink code={row.original.employeeCode} /> },
      {
        accessorKey: "effectiveDate",
        header: "Effective",
        cell: ({ row }) => (
          <div className="tnum leading-tight">
            <p className="text-xs">{fmtDate(row.original.effectiveDate)}</p>
            {row.original.effectiveDate > DEMO_TODAY && <p className="text-[11px] text-info-fg">Upcoming</p>}
          </div>
        ),
      },
      {
        accessorKey: "summary",
        header: "Change",
        enableSorting: false,
        cell: ({ row }) => {
          const c = row.original.changes[0];
          return (
            <div className="max-w-[300px] text-xs">
              <p className="text-[11px] text-muted-foreground">{c.field}</p>
              <p className="flex min-w-0 items-center gap-1">
                <span className="truncate text-muted-foreground">{c.from}</span>
                <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-label="to" />
                <span className="truncate font-medium">{c.to}</span>
              </p>
              {row.original.changes.length > 1 && <p className="text-[11px] text-muted-foreground">+{row.original.changes.length - 1} more</p>}
            </div>
          );
        },
      },
      {
        id: "approval",
        header: "Approval",
        accessorFn: (r) => r.status,
        cell: ({ row }) => {
          const done = row.original.chain.filter((s) => s.status === "approved").length;
          return (
            <div className="flex flex-col gap-1">
              <StatusBadge status={row.original.status} />
              <span className="tnum text-[11px] text-muted-foreground">
                {done}/{row.original.chain.length} steps
              </span>
            </div>
          );
        },
      },
      {
        id: "initiatedBy",
        header: "Initiated by",
        accessorFn: (r) => employeeName(r.initiatedBy),
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="text-xs">{employeeName(row.original.initiatedBy)}</p>
            <p className="tnum text-[11px] text-muted-foreground">{fmtDate(row.original.initiatedOn)}</p>
          </div>
        ),
      },
      { id: "dept", header: "Department", accessorFn: (r) => deptName(employeeByCode(r.employeeCode)?.departmentId ?? ""), cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
    ],
    [],
  );

  const pendingStep = detail?.chain.find((s) => s.status === "pending");

  return (
    <PageBody>
      <PageHeader
        title="Lifecycle Events"
        description="Every effective-dated change to an employee — confirmation, promotion, transfer, suspension, exit — with its before/after values and the approval trail."
        actions={
          <Gated menuKey="people.lifecycle" action="C">
            <Button size="sm" onClick={() => setWizardOpen(true)}>
              <Plus aria-hidden />
              Record event
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Awaiting approval" value={num(pending)} icon={Hourglass} tone={pending ? "warning" : "neutral"} onClick={() => setStatus("pending")} hint="Click to filter" />
        <StatTile label="Effective this month" value={num(thisMonth)} icon={CalendarClock} hint="September 2026" />
        <StatTile label="Scheduled ahead" value={num(upcoming)} icon={Activity} onClick={() => setWhen("upcoming")} hint="Future effective date" />
        <StatTile label="Exits in pipeline" value={num(exits)} icon={LogOut} onClick={() => setType("resign")} hint="Resignations, terminations, retirements" />
      </StatRow>

      <Section bodyClassName="p-3">
        {loading ? (
          <TableSkeleton />
        ) : (
          <DataTable<Row>
            columns={columns}
            data={rows}
            searchKeys={["employeeName", "employeeCode", "id", "summary"]}
            searchPlaceholder="Search employee, code or change…"
            getRowId={(r) => r.id}
            onRowClick={(r) => setDetailId(r.id)}
            exportName="lifecycle-events"
            filters={
              <>
                <FilterSelect label="Event" value={type} onValueChange={setType} options={(Object.keys(LIFECYCLE_LABEL) as LifecycleType[]).map((t) => ({ value: t, label: LIFECYCLE_LABEL[t] }))} width="w-[170px]" />
                <FilterSelect
                  label="Status"
                  value={status}
                  onValueChange={setStatus}
                  options={[
                    { value: "pending", label: "Pending" },
                    { value: "approved", label: "Approved" },
                    { value: "rejected", label: "Rejected" },
                    { value: "draft", label: "Draft" },
                  ]}
                />
                <FilterSelect label="Department" value={dept} onValueChange={setDept} options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))} width="w-[190px]" />
                <FilterSelect
                  label="When"
                  value={when}
                  onValueChange={setWhen}
                  options={[
                    { value: "past", label: "Effective" },
                    { value: "upcoming", label: "Upcoming" },
                  ]}
                />
              </>
            }
            emptyIcon={Activity}
            emptyTitle="No lifecycle events match"
            emptyDescription="Clear a filter, or record a new event for an employee."
          />
        )}
      </Section>

      <Sheet open={!!detail} onOpenChange={(v) => !v && setDetailId(null)}>
        <SheetContent>
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {LIFECYCLE_LABEL[detail.type]} · {detail.id}
                </SheetTitle>
                <SheetDescription>
                  Effective {fmtDate(detail.effectiveDate)} · initiated by {employeeName(detail.initiatedBy)} on {fmtDate(detail.initiatedOn)}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <EmployeeLink code={detail.employeeCode} size={32} />
                  <StatusBadge status={detail.status} size="md" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold">Changes</p>
                  <table className="w-full overflow-hidden rounded-md border border-border text-xs">
                    <tbody>
                      {detail.changes.map((c) => (
                        <tr key={c.field} className="border-b border-border last:border-0 align-top">
                          <td className="w-32 bg-subtle px-2 py-1.5 text-muted-foreground">{c.field}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{c.from}</td>
                          <td className="px-2 py-1.5 font-medium">{c.to}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {detail.remarks && <p className="mt-1.5 text-xs text-muted-foreground">{detail.remarks}</p>}
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold">Approval chain</p>
                  <ol className="relative flex flex-col gap-3 border-l border-border pl-4">
                    {detail.chain.map((s) => (
                      <li key={s.step} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[21px] top-1 flex size-2.5 rounded-full ring-2 ring-card",
                            s.status === "approved" ? "bg-success" : s.status === "rejected" ? "bg-destructive" : s.status === "pending" ? "bg-warning" : "bg-muted-foreground/40",
                          )}
                          aria-hidden
                        />
                        <div className="flex items-center gap-2">
                          <Avatar name={employeeName(s.approverCode)} size={22} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium">{employeeName(s.approverCode)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {s.step}
                              {s.at && ` · ${fmtDateTime(s.at)}`}
                            </p>
                          </div>
                          <StatusBadge status={s.status === "waiting" ? "not_started" : s.status} label={s.status === "waiting" ? "Waiting" : undefined} />
                        </div>
                        {s.comment && <p className="mt-1 rounded-md bg-subtle px-2 py-1 text-[11px]">“{s.comment}”</p>}
                      </li>
                    ))}
                  </ol>
                </div>
                {detail.status === "pending" && pendingStep && (
                  <Badge variant="muted" className="w-full justify-center whitespace-normal py-1.5 text-center">
                    Waiting on {employeeName(pendingStep.approverCode)} ({pendingStep.step}). You can act as {persona.role} in this demo.
                  </Badge>
                )}
              </SheetBody>
              {detail.status === "pending" && (
                <SheetFooter>
                  <Gated menuKey="people.lifecycle" action="A">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRejectComment("");
                        setRejectError(null);
                        setRejectOpen(true);
                      }}
                    >
                      <X aria-hidden />
                      Reject
                    </Button>
                  </Gated>
                  <Gated menuKey="people.lifecycle" action="A">
                    <Button onClick={() => decide(detail, true)} disabled={!canApprove}>
                      <Check aria-hidden />
                      Approve
                    </Button>
                  </Gated>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Reject {detail?.id}?</DialogTitle>
            <DialogDescription>
              The event goes back to {employeeName(detail?.initiatedBy)} and nothing changes for {employeeName(detail?.employeeCode)}. Your comment is recorded on the
              audit trail.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label="Comment" htmlFor="lc-reject" required error={rejectError ?? undefined}>
              <Textarea
                id="lc-reject"
                rows={3}
                value={rejectComment}
                aria-invalid={!!rejectError}
                onChange={(e) => {
                  setRejectComment(e.target.value);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="e.g. CTC exceeds the G4 band maximum — re-propose within band."
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectComment.trim().length < 10) {
                  setRejectError("Explain the rejection in at least 10 characters.");
                  return;
                }
                if (detail) decide(detail, false, rejectComment.trim());
                setRejectOpen(false);
              }}
            >
              Reject event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LifecycleWizard
        open={wizardOpen}
        onOpenChange={(v) => {
          setWizardOpen(v);
          if (!v) setPrefill(undefined);
        }}
        initiatorCode={persona.employeeId}
        initialEmployeeCode={prefill}
        onSubmit={(ev) => {
          const id = `LCE-26-${String(events.length + 1).padStart(4, "0")}`;
          setEvents((es) => [{ ...ev, id }, ...es]);
          mockAction(`${LIFECYCLE_LABEL[ev.type]} recorded for ${employeeName(ev.employeeCode)}`, {
            description: `${id} sent to ${employeeName(ev.chain[0]?.approverCode)} for approval. Effective ${fmtDate(ev.effectiveDate)}.`,
          });
          setDetailId(id);
        }}
      />
    </PageBody>
  );
}
