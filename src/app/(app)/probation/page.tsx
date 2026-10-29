"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, CalendarPlus, CheckCircle2, ClipboardEdit, FileText, Hourglass, MoreHorizontal, Star } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, FilterSelect } from "@/components/ui/overlays";
import { PersonCell } from "@/components/people/person-cell";
import { LcBadge, ReasonDialog } from "@/components/lifecycle/kit";
import { ConfirmationLetter, ExtendDialog, ReviewDialog } from "@/components/lifecycle/probation-dialogs";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { employeeName } from "@/mock/employees";
import { PROBATION, extendEnd, probationState, type ProbationRecord } from "@/mock/lifecycle";
import { differenceInCalendarDays, parseISO } from "date-fns";

/* ============================================================================
   /probation — who is due for confirmation, the manager's review, and HR's
   decision. Extending moves the end date; confirming issues a letter.
   ========================================================================== */

type Decision = { kind: "confirmed"; letterNo: string } | { kind: "terminated"; reason: string };
type Row = ProbationRecord & { decision: Decision | null };

const STATE_LABEL = { overdue: "Overdue", due_soon: "Due in 30 days", upcoming: "Upcoming" } as const;

export default function ProbationPage() {
  const loading = useFakeLoad();
  const { role, persona } = useApp();
  const [rows, setRows] = React.useState<Row[]>(() => PROBATION.map((p) => ({ ...p, decision: null })));
  const [scope, setScope] = React.useState(role === "manager" ? "mine" : "all");
  const [state, setState] = React.useState("all");
  const [reviewing, setReviewing] = React.useState<Row | null>(null);
  const [extending, setExtending] = React.useState<Row | null>(null);
  const [confirming, setConfirming] = React.useState<Row | null>(null);
  const [terminating, setTerminating] = React.useState<Row | null>(null);
  const [letter, setLetter] = React.useState<Row | null>(null);

  const patch = (code: string, fn: (r: Row) => Row) => setRows((xs) => xs.map((x) => (x.code === code ? fn(x) : x)));
  const open = rows.filter((r) => !r.decision);

  const data = rows.filter(
    (r) =>
      (scope === "all" || r.employee.managerCode === persona.employeeId) &&
      (state === "all" || (state === "decided" ? !!r.decision : !r.decision && probationState(r) === state)),
  );

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        id: "employee",
        header: "Employee",
        accessorFn: (r) => r.employee.name,
        enableHiding: false,
        cell: ({ row }) => <PersonCell name={row.original.employee.name} subtitle={`${row.original.code} · ${row.original.employee.designation}`} href={`/employees/${row.original.code}`} />,
      },
      { id: "dept", header: "Department", accessorFn: (r) => deptName(r.employee.departmentId) },
      { id: "manager", header: "Manager", accessorFn: (r) => employeeName(r.employee.managerCode) },
      { id: "joined", header: "Joined", accessorFn: (r) => r.employee.joiningDate, cell: ({ row }) => <span className="tnum">{fmtDate(row.original.employee.joiningDate)}</span> },
      {
        id: "policy",
        header: "Period",
        accessorKey: "policyMonths",
        cell: ({ row }) => (
          <span className="tnum whitespace-nowrap">
            {row.original.policyMonths} mo{row.original.extendedMonths ? <span className="text-warning-fg"> + {row.original.extendedMonths} ext.</span> : null}
          </span>
        ),
      },
      {
        id: "end",
        header: "Probation ends",
        accessorKey: "endDate",
        cell: ({ row }) => {
          const d = row.original.daysToEnd;
          return (
            <span className="tnum whitespace-nowrap">
              {fmtDate(row.original.endDate)}
              <span className={`block text-[11px] ${d < 0 ? "font-medium text-destructive-fg" : "text-muted-foreground"}`}>{d < 0 ? `${-d} days overdue` : `in ${d} days`}</span>
            </span>
          );
        },
      },
      {
        id: "review",
        header: "Manager review",
        accessorFn: (r) => r.review?.recommendation ?? "",
        cell: ({ row }) => {
          const r = row.original.review;
          if (!r) return <span className="text-muted-foreground">Not submitted</span>;
          return (
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <Star className="size-3.5 fill-warning text-warning" aria-hidden />
              <span className="tnum">{r.rating}/5</span>
              <span className="text-muted-foreground">· {r.recommendation}{r.extendMonths ? ` ${r.extendMonths} mo` : ""}</span>
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessorFn: (r) => (r.decision ? r.decision.kind : probationState(r)),
        cell: ({ row }) => {
          const d = row.original.decision;
          if (d?.kind === "confirmed")
            return (
              <button type="button" className="flex flex-col items-start gap-0.5 text-left" onClick={(e) => { e.stopPropagation(); setLetter(row.original); }}>
                <StatusBadge status="approved" label="Confirmed" />
                <span className="flex items-center gap-1 text-[11px] text-primary underline-offset-2 hover:underline">
                  <FileText className="size-3" aria-hidden /> {d.letterNo}
                </span>
              </button>
            );
          if (d?.kind === "terminated") return <StatusBadge status="rejected" label="Terminated" />;
          const s = probationState(row.original);
          return <LcBadge status={s === "overdue" ? "overdue" : s} label={STATE_LABEL[s]} />;
        },
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.decision ? null : (
            <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Gated menuKey="lifecycle.probation" action="E">
                <Button size="sm" variant="outline" onClick={() => setReviewing(row.original)}>
                  <ClipboardEdit aria-hidden /> {row.original.review ? "Edit review" : "Review"}
                </Button>
              </Gated>
              <Gated menuKey="lifecycle.probation" action="A">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label={`Decide probation for ${row.original.employee.name}`}>
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setConfirming(row.original)}>
                      <CheckCircle2 aria-hidden /> Confirm employment
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setExtending(row.original)}>
                      <CalendarPlus aria-hidden /> Extend probation
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTerminating(row.original)} className="text-destructive-fg">
                      <Ban aria-hidden /> Terminate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Gated>
            </span>
          ),
      },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Probation & Confirmation"
        description="Probation is 6 months for G1–G3 and 3 months for G4 and above. Managers review in the last 30 days; HR confirms, extends or ends the employment, and the confirmation letter is generated on approval."
      />
      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow>
          <StatTile label="On probation" value={open.length} icon={Hourglass} />
          <StatTile label="Overdue for a decision" value={open.filter((r) => probationState(r) === "overdue").length} tone="critical" hint="Probation end date has passed" onClick={() => setState("overdue")} />
          <StatTile label="Due in 30 days" value={open.filter((r) => probationState(r) === "due_soon").length} tone="warning" onClick={() => setState("due_soon")} />
          <StatTile label="Reviews awaiting HR" value={open.filter((r) => r.review).length} hint="Manager review submitted, decision pending" icon={ClipboardEdit} />
        </StatRow>
      )}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchKeys={["code"]}
          searchPlaceholder="Search by employee code…"
          getRowId={(r) => r.code}
          rowTone={(r) => (!r.decision && probationState(r) === "overdue" ? "danger" : undefined)}
          exportName="probation"
          emptyIcon={Hourglass}
          emptyTitle={scope === "mine" ? "None of your reportees are on probation" : "No probation records match"}
          emptyDescription={scope === "mine" ? "Switch the scope to All employees to see the whole company." : "Clear the status filter to see everyone on probation."}
          filters={
            <>
              <FilterSelect label="Scope" value={scope} onValueChange={setScope} allLabel="All employees" options={[{ value: "mine", label: "My reportees" }]} />
              <FilterSelect label="Status" value={state} onValueChange={setState} options={[{ value: "overdue", label: "Overdue" }, { value: "due_soon", label: "Due in 30 days" }, { value: "upcoming", label: "Upcoming" }, { value: "decided", label: "Decided" }]} />
            </>
          }
        />
      )}

      {reviewing && (
        <ReviewDialog
          record={reviewing}
          onClose={() => setReviewing(null)}
          onSubmit={(review) => {
            patch(reviewing.code, (r) => ({ ...r, review }));
            mockAction("Probation review submitted", { description: `${reviewing.employee.name}: ${review.rating}/5 · recommends ${review.recommendation}. HR has been notified.` });
          }}
        />
      )}
      {extending && (
        <ExtendDialog
          record={extending}
          onClose={() => setExtending(null)}
          onExtend={(months) => {
            const endDate = extendEnd(extending.endDate, months);
            patch(extending.code, (r) => ({ ...r, extendedMonths: r.extendedMonths + months, endDate, daysToEnd: differenceInCalendarDays(parseISO(endDate), parseISO(DEMO_TODAY)), review: null }));
            mockAction("Probation extended", { description: `${extending.employee.name} — new end date ${fmtDate(endDate)}. Extension letter sent.` });
          }}
        />
      )}
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(v) => !v && setConfirming(null)}
        title={`Confirm ${confirming?.employee.name}?`}
        description={confirming?.review ? `Manager recommends ${confirming.review.recommendation} (${confirming.review.rating}/5). A confirmation letter is generated and the employee status changes to Active.` : "No manager review has been submitted. You can still confirm on HR's authority."}
        confirmLabel="Confirm employment"
        onConfirm={() => {
          if (!confirming) return;
          const letterNo = `CL-2026-${String(rows.filter((r) => r.decision?.kind === "confirmed").length + 41).padStart(3, "0")}`;
          patch(confirming.code, (r) => ({ ...r, decision: { kind: "confirmed", letterNo } }));
          mockAction("Employment confirmed", { description: `${confirming.employee.name} — letter ${letterNo} generated and shared.` });
        }}
      />
      <ReasonDialog
        open={!!terminating}
        onOpenChange={(v) => !v && setTerminating(null)}
        title={`End employment of ${terminating?.employee.name}?`}
        description="This starts an involuntary separation during probation (notice per the appointment letter). Legal and the manager are notified."
        confirmLabel="Terminate"
        onConfirm={(reason) => {
          if (!terminating) return;
          patch(terminating.code, (r) => ({ ...r, decision: { kind: "terminated", reason } }));
          mockAction("Separation initiated", { description: `${terminating.employee.name} — involuntary, during probation. Reason recorded.`, tone: "warning" });
        }}
      />
      {letter?.decision?.kind === "confirmed" && <ConfirmationLetter record={letter} letterNo={letter.decision.letterNo} onClose={() => setLetter(null)} />}
    </PageBody>
  );
}
