"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, ClipboardList, Hourglass, ListOrdered, MoreHorizontal, UserPlus, X } from "lucide-react";
import { fmtDate, fmtDay, inr, num } from "@/lib/format";
import { EMPLOYEES, employeeName, reporteesOf } from "@/mock/employees";
import { courseById } from "@/mock/growth";
import { ENROL_REQUESTS, TRAINING_SESSIONS, type EnrolRequest, type EnrolRequestStatus } from "@/mock/engage";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { DecisionDialog, personLine } from "@/components/engage/kit";
import { NominateDialog } from "@/components/engage/learning-nominate";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FilterSelect,
} from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";

const STATUS_LABEL: Record<EnrolRequestStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  waitlisted: "Waitlisted",
  rejected: "Rejected",
  cancelled: "Cancelled",
};
const sessionById = (id: string | null) => TRAINING_SESSIONS.find((s) => s.id === id);

export default function EnrollmentsPage() {
  const loading = useFakeLoad();
  const { role, persona, can } = useApp();
  const canApprove = can("growth.enrollments", "A");
  const canEdit = can("growth.enrollments", "E");
  const [requests, setRequests] = React.useState<EnrolRequest[]>(ENROL_REQUESTS);
  const [status, setStatus] = React.useState("all");
  const [source, setSource] = React.useState("all");
  const [rejecting, setRejecting] = React.useState<EnrolRequest[] | null>(null);
  const [cancelling, setCancelling] = React.useState<EnrolRequest | null>(null);
  const [nominateOpen, setNominateOpen] = React.useState(false);

  const isManager = role === "manager";
  const scoped = isManager ? requests.filter((r) => r.managerCode === persona.employeeId) : requests;
  const visible = scoped.filter((r) => (status === "all" || r.status === status) && (source === "all" || r.nominatedBy === source));

  const setMany = (ids: string[], next: EnrolRequestStatus) =>
    setRequests((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, status: next, waitlistPos: next === "waitlisted" ? r.waitlistPos : null } : r)));

  const approve = (rows: EnrolRequest[]) => {
    setMany(rows.map((r) => r.id), "approved");
    mockAction(`${rows.length} enrolment${rows.length === 1 ? "" : "s"} approved`, {
      description: rows.length === 1 ? `${employeeName(rows[0].employeeCode)} — ${courseById(rows[0].courseId)?.title}. Calendar invite sent.` : "Learners and trainers have been notified.",
    });
  };

  /** FIFO: position 1 is approved, everyone behind them moves up one place. */
  const promoteNext = (sessionId: string) => {
    const queue = requests.filter((r) => r.sessionId === sessionId && r.status === "waitlisted").sort((a, b) => (a.waitlistPos ?? 0) - (b.waitlistPos ?? 0));
    const head = queue[0];
    if (!head) return;
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id === head.id) return { ...r, status: "approved", waitlistPos: null };
        if (r.sessionId === sessionId && r.status === "waitlisted" && r.waitlistPos) return { ...r, waitlistPos: r.waitlistPos - 1 };
        return r;
      }),
    );
    mockAction(`${employeeName(head.employeeCode)} promoted from the waitlist`, {
      description: `${queue.length - 1} still waiting for ${courseById(head.courseId)?.title}.`,
    });
  };

  const waitlists = React.useMemo(() => {
    const groups = new Map<string, EnrolRequest[]>();
    for (const r of scoped.filter((x) => x.status === "waitlisted" && x.sessionId)) {
      groups.set(r.sessionId!, [...(groups.get(r.sessionId!) ?? []), r]);
    }
    return [...groups.entries()].map(([sid, rows]) => ({ session: sessionById(sid)!, rows: rows.sort((a, b) => (a.waitlistPos ?? 0) - (b.waitlistPos ?? 0)) }));
  }, [scoped]);

  const columns = React.useMemo<ColumnDef<EnrolRequest, unknown>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (r) => employeeName(r.employeeCode),
        header: "Employee",
        cell: ({ row }) => <PersonCell name={employeeName(row.original.employeeCode)} code={row.original.employeeCode} subtitle={personLine(row.original.employeeCode)} />,
      },
      {
        id: "course",
        accessorFn: (r) => courseById(r.courseId)?.title ?? r.courseId,
        header: "Course / session",
        cell: ({ row }) => {
          const s = sessionById(row.original.sessionId);
          return (
            <div className="flex flex-col text-xs">
              <Link href={`/learning/courses/${row.original.courseId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                {courseById(row.original.courseId)?.title}
              </Link>
              {s && <span className="text-muted-foreground">{fmtDay(s.date)} · {s.mode}</span>}
            </div>
          );
        },
      },
      { accessorKey: "nominatedBy", header: "Nominated by", cell: ({ row }) => <MutedCell>{row.original.nominatedBy}</MutedCell> },
      { id: "manager", accessorFn: (r) => employeeName(r.managerCode), header: "Approver", cell: ({ row }) => <MutedCell>{employeeName(row.original.managerCode)}</MutedCell> },
      { accessorKey: "requestedOn", header: "Requested", cell: ({ row }) => <span className="text-xs">{fmtDate(row.original.requestedOn)}</span> },
      { accessorKey: "costInr", header: "Cost", cell: ({ row }) => <NumCell>{row.original.costInr ? inr(row.original.costInr) : "Free"}</NumCell> },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status === "waitlisted" ? "on_hold" : row.original.status}
            label={row.original.status === "waitlisted" ? `Waitlist #${row.original.waitlistPos}` : STATUS_LABEL[row.original.status]}
          />
        ),
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const r = row.original;
          const open = r.status === "pending" || r.status === "waitlisted" || r.status === "approved";
          if (!open) return null;
          return (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {r.status === "pending" && (
                <Gated menuKey="growth.enrollments" action="A">
                  <Button size="sm" variant="outline" onClick={() => approve([r])} aria-label={`Approve ${employeeName(r.employeeCode)}`}>
                    <Check /> Approve
                  </Button>
                </Gated>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={!canApprove && !canEdit}>
                  <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${employeeName(r.employeeCode)}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {r.status !== "approved" && (
                    <DropdownMenuItem destructive disabled={!canApprove} onSelect={() => setRejecting([r])}>
                      <X /> Reject…
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive disabled={!canEdit} onSelect={() => setCancelling(r)}>
                    <X /> Cancel enrolment…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- approve only closes over setters
    [canApprove, canEdit],
  );

  const pending = scoped.filter((r) => r.status === "pending");
  const candidates = isManager ? reporteesOf(persona.employeeId).map((e) => e.code) : EMPLOYEES.filter((e) => e.status !== "exited").map((e) => e.code);

  return (
    <PageBody>
      <PageHeader
        title="Enrollments"
        description={
          isManager
            ? "Training requests from your team. Approve, reject with a reason, or nominate someone for an upcoming session."
            : "Every nomination and self-enrolment across the company — manager approvals, waitlists and bulk enrolment."
        }
        actions={
          <Gated menuKey="growth.enrollments" action="C">
            <Button size="sm" onClick={() => setNominateOpen(true)}>
              <UserPlus /> Nominate
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow>
            <StatTile label="Awaiting approval" value={num(pending.length)} icon={Hourglass} tone={pending.length ? "warning" : "neutral"} onClick={() => setStatus("pending")} hint="Click to filter" />
            <StatTile label="Approved" value={num(scoped.filter((r) => r.status === "approved").length)} icon={Check} tone="good" />
            <StatTile label="On waitlists" value={num(scoped.filter((r) => r.status === "waitlisted").length)} icon={ListOrdered} onClick={() => setStatus("waitlisted")} hint="FIFO promotion" />
            <StatTile label="Committed spend" value={inr(scoped.filter((r) => r.status === "approved").reduce((a, r) => a + r.costInr, 0))} icon={ClipboardList} hint="Approved requests only" />
          </StatRow>

          <DataTable
            columns={columns}
            data={visible}
            filters={
              <>
                <FilterSelect label="Status" value={status} onValueChange={setStatus} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
                <FilterSelect label="Source" value={source} onValueChange={setSource} options={["Self", "Manager", "HR"].map((v) => ({ value: v, label: v }))} />
              </>
            }
            enableSelection
            bulkActions={(sel, clear) => {
              const actionable = sel.filter((r) => r.status === "pending" || r.status === "waitlisted");
              return (
                <>
                  <Gated menuKey="growth.enrollments" action="A">
                    <Button size="sm" disabled={!actionable.length} onClick={() => { approve(actionable); clear(); }}>
                      <Check /> Approve {actionable.length}
                    </Button>
                  </Gated>
                  <Gated menuKey="growth.enrollments" action="A">
                    <Button size="sm" variant="outline" disabled={!actionable.length} onClick={() => { setRejecting(actionable); clear(); }}>
                      <X /> Reject…
                    </Button>
                  </Gated>
                </>
              );
            }}
            getRowId={(r) => r.id}
            rowTone={(r) => (r.status === "pending" ? "warning" : undefined)}
            exportName="training-enrollments"
            emptyIcon={ClipboardList}
            emptyTitle={isManager ? "No requests from your team" : "No enrolment requests match"}
            emptyDescription="Clear the filters, or nominate someone for an upcoming session."
          />

          <Section title="Waitlists" description="First in, first out. Promoting confirms the person at the head of the queue and moves everyone else up.">
            {waitlists.length === 0 ? (
              <EmptyState icon={ListOrdered} title="Nobody is waiting" description="Every requested session still has seats." />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {waitlists.map(({ session, rows }) => (
                  <div key={session.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{courseById(session.courseId)?.title}</p>
                        <p className="tnum text-xs text-muted-foreground">{fmtDay(session.date)} · {session.attendees.length}/{session.capacity} seats</p>
                      </div>
                      <Gated menuKey="growth.enrollments" action="E">
                        <Button size="sm" variant="outline" onClick={() => promoteNext(session.id)}>Promote next</Button>
                      </Gated>
                    </div>
                    <ol className="mt-2 flex flex-col gap-1 text-xs">
                      {rows.map((r) => (
                        <li key={r.id} className="flex items-center gap-2">
                          <span className="tnum w-5 text-muted-foreground">#{r.waitlistPos}</span>
                          <span className="truncate">{employeeName(r.employeeCode)}</span>
                          <span className="ml-auto text-muted-foreground">{fmtDate(r.requestedOn)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      <DecisionDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title={`Reject ${rejecting?.length ?? 0} request${rejecting?.length === 1 ? "" : "s"}?`}
        description="The employee sees your reason and can ask again for a later session."
        confirmLabel="Reject"
        commentLabel="Reason"
        onConfirm={(reason) => {
          if (!rejecting) return;
          setMany(rejecting.map((r) => r.id), "rejected");
          mockAction(`${rejecting.length} request${rejecting.length === 1 ? "" : "s"} rejected`, { description: reason, tone: "warning" });
        }}
      />
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(v) => !v && setCancelling(null)}
        title={`Cancel ${cancelling ? employeeName(cancelling.employeeCode) : ""}'s enrolment?`}
        description="Their seat is released and offered to the first person on the waitlist. Any vendor cancellation fee is charged to the department."
        confirmLabel="Cancel enrolment"
        cancelLabel="Keep"
        destructive
        onConfirm={() => {
          if (!cancelling) return;
          setMany([cancelling.id], "cancelled");
          mockAction("Enrolment cancelled", { description: `${courseById(cancelling.courseId)?.title} — seat released.`, tone: "warning" });
        }}
      />
      <NominateDialog
        open={nominateOpen}
        onOpenChange={setNominateOpen}
        sessions={TRAINING_SESSIONS}
        candidates={candidates}
        onNominate={(v) => {
          const s = sessionById(v.sessionId)!;
          const added: EnrolRequest[] = v.employees.map((code, i) => ({
            id: `ENQ-${900 + requests.length + i}`,
            employeeCode: code,
            courseId: s.courseId,
            sessionId: s.id,
            nominatedBy: isManager ? "Manager" : "HR",
            managerCode: EMPLOYEES.find((e) => e.code === code)?.managerCode ?? persona.employeeId,
            requestedOn: "2026-09-16",
            status: isManager ? "approved" : "pending",
            waitlistPos: null,
            costInr: 0,
          }));
          setRequests((prev) => [...added, ...prev]);
          mockAction(`${added.length} nomination${added.length === 1 ? "" : "s"} sent`, {
            description: isManager ? "Pre-approved as their manager. Seats are confirmed." : "Each nominee's manager has an approval request.",
          });
        }}
      />
    </PageBody>
  );
}
