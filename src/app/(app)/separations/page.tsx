"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Check,
  ClipboardCheck,
  Scissors,
  TrendingDown,
  UserMinus,
  UserX,
} from "lucide-react";
import { fmtDate } from "@/lib/format";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  CardsSkeleton,
  Gated,
  PageBody,
  PageHeader,
  TableSkeleton,
  useFakeLoad,
} from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, Hint } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterSelect } from "@/components/ui/overlays";
import { PersonCell } from "@/components/people/person-cell";
import { LcBadge, ReasonDialog } from "@/components/lifecycle/kit";
import { InitiateSeparationDialog } from "@/components/lifecycle/initiate-separation-dialog";
import { NoticeDialog } from "@/components/lifecycle/notice-dialog";
import { DEMO_TODAY, deptName } from "@/mock/org";
import {
  SEPARATIONS,
  SEPARATION_STATUS_LABEL,
  daysToLwd,
  reasonLabel,
  type Separation,
} from "@/mock/lifecycle";

/* ============================================================================
   /separations — resignations, terminations and retirements, with the LWD
   computed from notice, waiver and buyout. Fixture rows open the clearance
   matrix; rows created in this session live only in memory.
   ========================================================================== */

const FIXTURE_IDS = new Set(SEPARATIONS.map((s) => s.id));
const TYPE_LABEL = {
  voluntary: "Voluntary",
  involuntary: "Involuntary",
  retirement: "Retirement",
} as const;

export default function SeparationsPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const { role, persona } = useApp();
  const [rows, setRows] = React.useState<Separation[]>(SEPARATIONS);
  const [status, setStatus] = React.useState("all");
  const [type, setType] = React.useState("all");
  const [initiating, setInitiating] = React.useState(false);
  const [notice, setNotice] = React.useState<Separation | null>(null);
  const [rejecting, setRejecting] = React.useState<Separation | null>(null);

  const patch = (id: string, p: Partial<Separation>) =>
    setRows((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  /* Manager approves the first step for their own reportees; HR approves the second. */
  const canApprove = (s: Separation) =>
    (s.status === "pending_manager" &&
      (role === "hr_admin" ||
        role === "tenant_owner" ||
        (role === "manager" && s.managerCode === persona.employeeId))) ||
    (s.status === "pending_hr" &&
      (role === "hr_admin" || role === "tenant_owner"));

  const approve = (s: Separation) => {
    if (s.status === "pending_manager") {
      patch(s.id, { status: "pending_hr", managerApprovedOn: DEMO_TODAY });
      mockAction("Resignation accepted by manager", {
        description: `${s.name} — now with HR for approval. LWD ${fmtDate(s.lwd)}.`,
      });
    } else {
      patch(s.id, { status: "serving_notice", hrApprovedOn: DEMO_TODAY });
      mockAction("Separation approved", {
        description: `${s.name} — serving notice until ${fmtDate(s.lwd)}. Clearance opens 15 days before LWD.`,
      });
    }
  };

  const data = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (type === "all" || r.type === type),
  );
  const live = rows.filter((r) => r.status !== "completed");
  const voluntary = rows.filter((r) => r.type === "voluntary");

  const columns: ColumnDef<Separation, unknown>[] = [
    {
      id: "employee",
      header: "Employee",
      accessorKey: "name",
      enableHiding: false,
      cell: ({ row }) => (
        <PersonCell
          name={row.original.name}
          subtitle={`${row.original.former ? "Former · " : ""}${row.original.designation}`}
          href={
            row.original.former ? undefined : `/employees/${row.original.code}`
          }
        />
      ),
    },
    {
      id: "dept",
      header: "Department",
      accessorFn: (s) => deptName(s.departmentId),
    },
    {
      id: "type",
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => TYPE_LABEL[row.original.type],
    },
    {
      id: "reason",
      header: "Reason",
      accessorFn: (s) => reasonLabel(s),
      cell: ({ row }) => (
        <span className="flex flex-wrap items-center gap-1">
          <Hint text={row.original.reasonDetail}>
            <span className="underline decoration-dotted underline-offset-2">
              {reasonLabel(row.original)}
            </span>
          </Hint>
          {row.original.regretted && <Badge variant="soft">Regretted</Badge>}
        </span>
      ),
    },
    {
      id: "initiated",
      header: "Initiated",
      accessorKey: "initiatedOn",
      cell: ({ row }) => (
        <span className="tnum">{fmtDate(row.original.initiatedOn)}</span>
      ),
    },
    {
      id: "notice",
      header: "Notice",
      accessorKey: "noticeDays",
      cell: ({ row }) => {
        const s = row.original;
        return (
          <span className="tnum whitespace-nowrap">
            {s.noticeDays} d
            {s.waivedDays ? (
              <span className="block text-[11px] text-muted-foreground">
                {s.waivedDays} d waived
              </span>
            ) : null}
            {s.buyoutDays ? (
              <span className="block text-[11px] text-warning-fg">
                {s.buyoutDays} d buyout
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "lwd",
      header: "Last working day",
      accessorKey: "lwd",
      cell: ({ row }) => {
        const d = daysToLwd(row.original);
        return (
          <Hint
            text={`${fmtDate(row.original.initiatedOn)} + ${row.original.noticeDays} days − ${row.original.waivedDays} waived − ${row.original.buyoutDays} buyout`}
          >
            <span className="tnum whitespace-nowrap">
              {fmtDate(row.original.lwd)}
              <span className="block text-[11px] text-muted-foreground">
                {d > 0 ? `in ${d} days` : d === 0 ? "today" : "exited"}
              </span>
            </span>
          </Hint>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) =>
        row.original.status === "completed" ? (
          <StatusBadge status="exited" />
        ) : (
          <LcBadge
            status={row.original.status}
            label={SEPARATION_STATUS_LABEL[row.original.status]}
          />
        ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <span
            className="flex justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {(s.status === "pending_manager" || s.status === "pending_hr") && (
              <Gated menuKey="lifecycle.separations" action="A">
                <Button
                  size="sm"
                  disabled={!canApprove(s)}
                  title={
                    canApprove(s)
                      ? undefined
                      : s.status === "pending_hr"
                        ? "Waiting for HR approval"
                        : "Only the reporting manager or HR can accept"
                  }
                  onClick={() => approve(s)}
                >
                  <Check aria-hidden />{" "}
                  {s.status === "pending_manager" ? "Accept" : "Approve"}
                </Button>
              </Gated>
            )}
            {(s.status === "pending_manager" || s.status === "pending_hr") && (
              <Gated menuKey="lifecycle.separations" action="A">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!canApprove(s)}
                  onClick={() => setRejecting(s)}
                >
                  Reject
                </Button>
              </Gated>
            )}
            {(s.status === "serving_notice" || s.status === "clearance") && (
              <Gated menuKey="lifecycle.separations" action="A">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNotice(s)}
                >
                  <Scissors aria-hidden /> Waive / buyout
                </Button>
              </Gated>
            )}
            {FIXTURE_IDS.has(s.id) && (
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/separations/${s.id}`}>
                  <ClipboardCheck aria-hidden /> Clearance
                </Link>
              </Button>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Separations"
        description="Resignations, terminations and retirements. Reasons come from the separation-reason lookup, which also decides whether an exit counts as regretted attrition."
        actions={
          <Gated menuKey="lifecycle.separations" action="C">
            <Button size="sm" onClick={() => setInitiating(true)}>
              <UserMinus aria-hidden /> Initiate separation
            </Button>
          </Gated>
        }
      />
      {loading ? (
        <CardsSkeleton />
      ) : (
        <StatRow>
          <StatTile
            label="Active separations"
            value={live.length}
            icon={UserMinus}
            hint="Pending approval, serving notice or in clearance"
          />
          <StatTile
            label="Awaiting approval"
            value={live.filter((r) => r.status.startsWith("pending")).length}
            tone="warning"
            onClick={() => setStatus("pending_manager")}
          />
          <StatTile
            label="In clearance"
            value={live.filter((r) => r.status === "clearance").length}
            icon={ClipboardCheck}
            onClick={() => setStatus("clearance")}
          />
          <StatTile
            label="Regretted share of voluntary exits"
            value={`${Math.round((voluntary.filter((r) => r.regretted).length / Math.max(1, voluntary.length)) * 100)}%`}
            icon={TrendingDown}
            tone="serious"
          />
        </StatRow>
      )}
      {loading ? (
        <TableSkeleton />
      ) : (
        <DataTable
          columns={columns}
          data={data}
          searchKeys={["name", "code"]}
          searchPlaceholder="Search by name or code…"
          getRowId={(r) => r.id}
          onRowClick={(r) =>
            FIXTURE_IDS.has(r.id) && router.push(`/separations/${r.id}`)
          }
          rowTone={(r) =>
            r.status.startsWith("pending") ? "warning" : undefined
          }
          exportName="separations"
          emptyIcon={UserX}
          emptyTitle="No separations match"
          emptyDescription="Clear the filters to see every separation this year."
          filters={
            <>
              <FilterSelect
                label="Status"
                value={status}
                onValueChange={setStatus}
                options={Object.entries(SEPARATION_STATUS_LABEL).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
              <FilterSelect
                label="Type"
                value={type}
                onValueChange={setType}
                options={Object.entries(TYPE_LABEL).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </>
          }
        />
      )}

      <InitiateSeparationDialog
        open={initiating}
        onOpenChange={setInitiating}
        existingCodes={new Set(rows.map((r) => r.code))}
        onCreate={(s) => {
          setRows((xs) => [s, ...xs]);
          mockAction("Separation initiated", {
            description: `${s.name} — LWD ${fmtDate(s.lwd)}. ${s.status === "pending_manager" ? "Sent to the reporting manager to accept." : "Notice served; IT, Finance and Payroll notified."}`,
          });
        }}
      />
      {notice && (
        <NoticeDialog
          separation={notice}
          onClose={() => setNotice(null)}
          onSave={(p) => {
            patch(notice.id, {
              waivedDays: p.waivedDays,
              buyoutDays: p.buyoutDays,
              lwd: p.lwd,
            });
            mockAction(
              p.buyoutDays ? "Notice buyout recorded" : "Notice waived",
              {
                description: `${notice.name} — last working day now ${fmtDate(p.lwd)}.`,
              },
            );
          }}
        />
      )}
      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title={`Reject ${rejecting?.name}'s resignation?`}
        description="Use this when the employee has agreed to withdraw — the record is kept, and the employee is notified."
        confirmLabel="Reject resignation"
        onConfirm={() => {
          if (!rejecting) return;
          setRows((xs) => xs.filter((x) => x.id !== rejecting.id));
          mockAction("Resignation withdrawn", {
            description: `${rejecting.name} stays. Reason recorded in the audit trail.`,
            tone: "warning",
          });
        }}
      />
    </PageBody>
  );
}
