"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlarmClock,
  Ban,
  Check,
  CheckCheck,
  CalendarDays,
  Paperclip,
  RotateCcw,
  UserRoundCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { days as daysLabel, fmtDate, fmtDateShort, num } from "@/lib/format";
import { DEPARTMENTS } from "@/mock/org";
import {
  LEAVE_APPLICATIONS,
  LEAVE_TYPES,
  balanceFor,
  type LeaveApplication,
  type LeaveStatus,
} from "@/mock/leave";
import { mockAction, useApp } from "@/components/app-state";
import { LeaveRiskChip, LeaveRiskNote } from "@/components/ai/embed/leave-ai-ui";
import { LEAVE_SLA_DAYS, isPastSla, leaveAgeDays } from "@/components/ai/embed/leave-ai";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Badge, Field, Hint, Textarea } from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterSelect,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";

type Decision = "approved" | "rejected" | "sent_back" | "cancelled";

const DECISIONS: {
  id: Decision;
  label: string;
  icon: React.ElementType;
  needsComment: boolean;
  tone: "default" | "destructive" | "outline";
  blurb: string;
}[] = [
  { id: "approved", label: "Approve", icon: Check, needsComment: false, tone: "default", blurb: "The days are deducted from the balance and the requester is notified." },
  { id: "rejected", label: "Reject", icon: X, needsComment: true, tone: "destructive", blurb: "The request is closed and the days are released back to the balance." },
  { id: "sent_back", label: "Send back", icon: RotateCcw, needsComment: true, tone: "outline", blurb: "Returned to the requester for changes. They can edit and resubmit." },
  { id: "cancelled", label: "Cancel", icon: Ban, needsComment: false, tone: "outline", blurb: "Withdraw the request entirely on the requester's behalf." },
];

export default function LeaveApprovalsPage() {
  const loading = useFakeLoad();
  const { persona, markDecided } = useApp();

  const [rows, setRows] = React.useState<LeaveApplication[]>(LEAVE_APPLICATIONS);
  const [status, setStatus] = React.useState("pending");
  const [department, setDepartment] = React.useState("all");
  const [typeCode, setTypeCode] = React.useState("all");
  const [range, setRange] = React.useState("all");
  const [active, setActive] = React.useState<LeaveApplication | null>(null);
  const [decision, setDecision] = React.useState<Decision>("approved");
  const [comment, setComment] = React.useState("");
  const [commentError, setCommentError] = React.useState<string | null>(null);

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  /* The sidebar badge is the persona's cross-module inbox; deciding leave here
     marks the matching inbox items decided, so /approvals agrees. */
  const decided = (ids: string[]) => markDecided(ids.map((id) => `leave:${id}`));

  const filtered = React.useMemo(() => {
    const today = "2026-09-16";
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (department !== "all" && r.departmentId !== department) return false;
      if (typeCode !== "all" && r.typeCode !== typeCode) return false;
      if (range === "upcoming" && r.fromDate < today) return false;
      if (range === "past" && r.toDate >= today) return false;
      if (range === "backdated" && !r.isBackdated) return false;
      if (range === "past_sla" && !isPastSla(r)) return false;
      return true;
    });
  }, [rows, status, department, typeCode, range]);

  const openDecision = (app: LeaveApplication, d: Decision) => {
    setActive(app);
    setDecision(d);
    setComment("");
    setCommentError(null);
  };

  const submitDecision = () => {
    if (!active) return;
    const def = DECISIONS.find((d) => d.id === decision)!;
    const wasPending = active.status === "pending";
    if (def.needsComment && comment.trim().length < 10) {
      setCommentError(
        `A comment of at least 10 characters is required to ${def.label.toLowerCase()} a request. You have ${comment.trim().length}.`,
      );
      return;
    }
    setRows((rs) =>
      rs.map((r) =>
        r.id === active.id
          ? {
              ...r,
              status: decision as LeaveStatus,
              decidedOn: "2026-09-16",
              decisionComment: comment.trim() || null,
              approverName: persona.name,
            }
          : r,
      ),
    );
    mockAction(`${def.label}d — ${active.employeeName}`, {
      description: `${active.typeName} · ${fmtDateShort(active.fromDate)}–${fmtDateShort(active.toDate)} · ${daysLabel(active.days)}`,
      tone: decision === "approved" ? "success" : decision === "rejected" ? "warning" : "info",
    });
    if (wasPending) decided([active.id]);
    setActive(null);
  };

  const bulkDecide = (selected: LeaveApplication[], clear: () => void) => {
    const ids = new Set(selected.map((s) => s.id));
    decided(selected.filter((s) => s.status === "pending").map((s) => s.id));
    setRows((rs) =>
      rs.map((r) =>
        ids.has(r.id)
          ? { ...r, status: "approved" as LeaveStatus, decidedOn: "2026-09-16", approverName: persona.name }
          : r,
      ),
    );
    mockAction(`Approved ${selected.length} request${selected.length === 1 ? "" : "s"}`, {
      description: `${num(selected.reduce((a, b) => a + b.days, 0))} days across ${new Set(selected.map((s) => s.departmentId)).size} departments.`,
    });
    clear();
  };

  const columns = React.useMemo<ColumnDef<LeaveApplication, unknown>[]>(
    () => [
      {
        accessorKey: "employeeName",
        header: "Requester",
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Avatar name={row.original.employeeName} size={24} />
            <span className="flex flex-col">
              <Link
                href={`/employees/${row.original.employeeCode}`}
                className="font-medium hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {row.original.employeeName}
              </Link>
              <span className="font-mono text-[10px] text-muted-foreground">
                {row.original.employeeCode} · {row.original.department}
              </span>
            </span>
          </span>
        ),
      },
      {
        accessorKey: "typeName",
        header: "Type",
        cell: ({ row }) => <Badge variant="muted">{row.original.typeName}</Badge>,
      },
      {
        accessorKey: "fromDate",
        header: "Dates",
        cell: ({ row }) => (
          <span className="tnum flex flex-col">
            <span>
              {fmtDateShort(row.original.fromDate)} – {fmtDateShort(row.original.toDate)}
            </span>
            {row.original.sandwichDays > 0 && (
              <span className="text-[10px] text-muted-foreground">
                spans {row.original.sandwichDays} non-working day
                {row.original.sandwichDays === 1 ? "" : "s"}
              </span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "days",
        header: "Days",
        cell: ({ row }) => (
          <NumCell>
            {row.original.days}
            {(row.original.halfDayFirst || row.original.halfDaySecond) && (
              <span className="ml-1 text-[10px] text-muted-foreground">½</span>
            )}
          </NumCell>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="flex max-w-[260px] items-center gap-1">
            <span className="truncate text-muted-foreground">{row.original.reason}</span>
            {row.original.documentName && (
              <Hint text={row.original.documentName}>
                <Paperclip className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              </Hint>
            )}
          </span>
        ),
      },
      {
        accessorKey: "appliedOn",
        header: "Applied",
        cell: ({ row }) => {
          const age = leaveAgeDays(row.original.appliedOn);
          return (
            <span className="tnum flex items-center gap-1">
              {fmtDateShort(row.original.appliedOn)}
              {isPastSla(row.original) && (
                <Hint text={`Waiting ${age} days — past the ${LEAVE_SLA_DAYS * 24}-hour decision SLA (§7.2)`}>
                  <Badge variant="outline" className="border-warning/30 text-warning-fg">
                    <AlarmClock className="size-3" aria-hidden /> {age}d
                  </Badge>
                </Hint>
              )}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "ai",
        header: "AI check",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === "pending" ? (
            <LeaveRiskChip application={row.original} />
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          ),
      },
      {
        id: "actions",
        header: "Decision",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) =>
          row.original.status === "pending" ? (
            <span className="flex gap-1">
              <Gated menuKey="team.leave_approvals" action="A">
                <Button size="sm" onClick={() => openDecision(row.original, "approved")}>
                  Approve
                </Button>
              </Gated>
              <Gated menuKey="team.leave_approvals" action="A">
                <Button variant="outline" size="sm" onClick={() => openDecision(row.original, "rejected")}>
                  Reject
                </Button>
              </Gated>
              <Gated menuKey="team.leave_approvals" action="A">
                <Button variant="ghost" size="sm" onClick={() => openDecision(row.original, "sent_back")}>
                  Send back
                </Button>
              </Gated>
            </span>
          ) : (
            <span className="flex flex-col text-[10px] text-muted-foreground">
              <span>{row.original.approverName}</span>
              {row.original.decidedOn && <span className="tnum">{fmtDateShort(row.original.decidedOn)}</span>}
            </span>
          ),
      },
    ],
    [],
  );

  const byDept = React.useMemo(
    () =>
      DEPARTMENTS.map((d) => ({
        name: d.name,
        pending: rows.filter((r) => r.departmentId === d.id && r.status === "pending").length,
        approved: rows.filter((r) => r.departmentId === d.id && r.status === "approved").length,
      })).filter((d) => d.pending + d.approved > 0),
    [rows],
  );

  const activeBalance = active ? balanceFor(active.employeeCode, active.typeCode) : null;
  const activeDef = DECISIONS.find((d) => d.id === decision)!;

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Leave approvals" description="Loading the queue…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Leave approvals"
        description="Every leave request routed to you. Reject and Send back both require a comment — the requester sees it."
        actions={
          pendingCount > 0 ? (
            <Gated menuKey="team.leave_approvals" action="A">
              <Button
                size="sm"
                onClick={() => {
                  setRows((rs) =>
                    rs.map((r) =>
                      r.status === "pending"
                        ? { ...r, status: "approved" as LeaveStatus, decidedOn: "2026-09-16", approverName: persona.name }
                        : r,
                    ),
                  );
                  mockAction(`Approved all ${pendingCount} pending requests`, {
                    description: "Every requester has been notified.",
                  });
                  decided(rows.filter((r) => r.status === "pending").map((r) => r.id));
                }}
              >
                <CheckCheck /> Approve all pending
              </Button>
            </Gated>
          ) : null
        }
      />

      <StatRow cols={4}>
        <StatTile
          label="Leave requests awaiting decision"
          value={num(pendingCount)}
          icon={UserRoundCheck}
          tone={pendingCount > 0 ? "warning" : "good"}
          hint="Leave only — the sidebar badge counts every module's approvals"
          onClick={() => setStatus("pending")}
        />
        <StatTile
          label="Days requested"
          value={num(rows.filter((r) => r.status === "pending").reduce((a, b) => a + b.days, 0))}
          icon={CalendarDays}
          hint="Across all pending requests"
        />
        <StatTile
          label="Approved this cycle"
          value={num(rows.filter((r) => r.status === "approved").length)}
          icon={Check}
          tone="good"
          onClick={() => setStatus("approved")}
        />
        <StatTile
          label="Past SLA"
          value={num(rows.filter(isPastSla).length)}
          icon={AlarmClock}
          tone={rows.some(isPastSla) ? "critical" : "good"}
          hint={`Pending ${LEAVE_SLA_DAYS * 24} h or more — escalates to the skip-level manager (§7.2)`}
          onClick={() => {
            setStatus("pending");
            setRange("past_sla");
          }}
        />
      </StatRow>

      <Section
        title="Request queue"
        description="The ✨ AI check flags balance, team overlap, Monday/Friday patterns and backdating. AI recommends; you decide."
        bodyClassName="p-4"
      >
        <DataTable
          columns={columns}
          data={filtered}
          searchKeys={["employeeName", "employeeCode", "reason", "typeName", "department"]}
          searchPlaceholder="Search requests…"
          exportName="leave-approvals"
          getRowId={(r) => r.id}
          enableSelection
          pageSize={12}
          emptyIcon={CheckCheck}
          emptyTitle="Nothing in this view"
          emptyDescription="Change the status filter, or enjoy inbox zero."
          bulkActions={(selected, clear) => (
            <>
              <Gated menuKey="team.leave_approvals" action="A">
                <Button size="sm" onClick={() => bulkDecide(selected, clear)}>
                  <CheckCheck /> Approve selected
                </Button>
              </Gated>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  mockAction(`Reminder sent to ${selected.length} requester(s)`, {
                    description: "They will be asked to add supporting detail.",
                  });
                  clear();
                }}
              >
                Request more info
              </Button>
            </>
          )}
          filters={
            <>
              <FilterSelect
                label="Status"
                value={status}
                onValueChange={setStatus}
                allLabel="All statuses"
                width="w-[160px]"
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                  { value: "sent_back", label: "Sent back" },
                  { value: "cancelled", label: "Cancelled" },
                  { value: "withdrawn", label: "Withdrawn" },
                ]}
              />
              <FilterSelect
                label="Dept"
                value={department}
                onValueChange={setDepartment}
                allLabel="All departments"
                width="w-[180px]"
                options={DEPARTMENTS.map((d) => ({ value: d.id, label: d.name }))}
              />
              <FilterSelect
                label="Type"
                value={typeCode}
                onValueChange={setTypeCode}
                allLabel="All types"
                width="w-[170px]"
                options={LEAVE_TYPES.map((t) => ({ value: t.code, label: t.name }))}
              />
              <FilterSelect
                label="When"
                value={range}
                onValueChange={setRange}
                allLabel="Any date"
                width="w-[150px]"
                options={[
                  { value: "upcoming", label: "Upcoming" },
                  { value: "past", label: "Already taken" },
                  { value: "backdated", label: "Backdated" },
                  { value: "past_sla", label: "Past SLA" },
                ]}
              />
            </>
          }
        />
      </Section>

      <BarCompareChart
        title="Requests by department"
        description="Pending versus already approved, across the current window."
        data={byDept}
        xKey="name"
        series={[
          { key: "pending", label: "Pending" },
          { key: "approved", label: "Approved" },
        ]}
        stacked
        horizontal
        height={280}
        onBarClick={(row) => {
          const d = DEPARTMENTS.find((x) => x.name === row.name);
          if (d) setDepartment(d.id);
        }}
      />

      {/* ----------------------------------------------- decision dialog */}
      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent size="md">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>Decide · {active.employeeName}</DialogTitle>
                <DialogDescription>
                  {active.typeName} · {fmtDate(active.fromDate)} – {fmtDate(active.toDate)} ·{" "}
                  {daysLabel(active.days)} deducted
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-3">
                <div className="rounded-md border border-border bg-subtle p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Requester&apos;s reason
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">{active.reason}</p>
                  {active.documentName && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Paperclip className="size-3" aria-hidden /> {active.documentName}
                    </p>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  {[
                    ["Applied on", fmtDate(active.appliedOn)],
                    ["Calendar days", String(active.calendarDays)],
                    ["Deducted", String(active.days)],
                    ["Balance after", activeBalance ? String(activeBalance.available) : "—"],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                      <dd className="tnum mt-0.5 text-xs font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>

                {active.status === "pending" && <LeaveRiskNote application={active} />}

                {active.isBackdated && (
                  <Alert tone="warning" title="Backdated request">
                    These dates are in the past. Approving will adjust an attendance period that may
                    already have been finalised.
                  </Alert>
                )}
                {activeBalance && activeBalance.available < active.days && (
                  <Alert tone="danger" title="Insufficient balance">
                    {active.employeeName} has {activeBalance.available} day(s) of {active.typeName}{" "}
                    available but requested {active.days}. Approving will push the balance negative or
                    convert the excess to loss of pay.
                  </Alert>
                )}

                <div>
                  <p className="mb-1.5 text-xs font-medium">Decision</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DECISIONS.map((d) => (
                      <Button
                        key={d.id}
                        type="button"
                        size="sm"
                        variant={
                          decision === d.id
                            ? d.id === "rejected"
                              ? "destructive"
                              : "default"
                            : "outline"
                        }
                        aria-pressed={decision === d.id}
                        onClick={() => {
                          setDecision(d.id);
                          setCommentError(null);
                        }}
                      >
                        <d.icon /> {d.label}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{activeDef.blurb}</p>
                </div>

                <Field
                  label={`Comment${activeDef.needsComment ? " (required)" : " (optional)"}`}
                  htmlFor="decision-comment"
                  required={activeDef.needsComment}
                  error={commentError ?? undefined}
                  hint={
                    activeDef.needsComment
                      ? `${comment.trim().length}/10 characters minimum — the requester will see this.`
                      : "Visible to the requester."
                  }
                >
                  <Textarea
                    id="decision-comment"
                    value={comment}
                    onChange={(e) => {
                      setComment(e.target.value);
                      if (commentError) setCommentError(null);
                    }}
                    aria-invalid={!!commentError}
                    placeholder={
                      activeDef.needsComment
                        ? "Explain what needs to change, or why this cannot be approved…"
                        : "Anything the requester should know…"
                    }
                  />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setActive(null)}>
                  Cancel
                </Button>
                <Button
                  variant={decision === "rejected" ? "destructive" : "default"}
                  onClick={submitDecision}
                >
                  <activeDef.icon /> {activeDef.label}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
