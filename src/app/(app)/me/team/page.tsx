"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheck2, Inbox, LayoutGrid, MessageSquare, Rows3, UserRound, UsersRound } from "lucide-react";
import { fmtTime } from "@/lib/format";
import { deptName } from "@/mock/org";
import { reporteesOf, type Employee } from "@/mock/employees";
import { AMENDMENTS, todayFor } from "@/mock/attendance";
import { LEAVE_APPLICATIONS, balanceFor } from "@/mock/leave";
import { EXP_ALL_CLAIMS } from "@/mock/finance-expense";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, Hint, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";

interface TeamRow {
  code: string;
  name: string;
  designation: string;
  department: string;
  state: string;
  firstIn: string | null;
  elBalance: number;
  pending: number;
  emp: Employee;
}

export default function MyTeamPage() {
  const loading = useFakeLoad();
  const { persona, can, why } = useApp();
  const [view, setView] = React.useState<"cards" | "table">("cards");
  const canOpen = can("people.profile");

  const rows = React.useMemo<TeamRow[]>(
    () =>
      reporteesOf(persona.employeeId)
        .filter((e) => e.status !== "exited")
        .map((e) => {
          const today = todayFor(e.code);
          const pending =
            LEAVE_APPLICATIONS.filter((a) => a.employeeCode === e.code && a.status === "pending").length +
            AMENDMENTS.filter((a) => a.code === e.code && a.status === "pending").length +
            EXP_ALL_CLAIMS.filter((c) => c.employeeCode === e.code && c.status === "submitted").length;
          return {
            code: e.code,
            name: e.name,
            designation: e.designation,
            department: deptName(e.departmentId),
            state: today ? (today.inProgress ? "present" : today.state) : "not_marked",
            firstIn: today?.firstIn ?? null,
            elBalance: balanceFor(e.code, "EL")?.available ?? 0,
            pending,
            emp: e,
          };
        }),
    [persona.employeeId],
  );

  const openProfile = (r: TeamRow, size: "sm" | "icon-sm" = "sm") =>
    canOpen ? (
      <Button size={size} variant="outline" asChild>
        <Link href={`/employees/${r.code}`} aria-label={`Open ${r.name}'s profile`}>
          <UserRound /> {size === "sm" && "Profile"}
        </Link>
      </Button>
    ) : (
      <Hint text={why("people.profile")}>
        <span className="inline-flex cursor-not-allowed">
          <Button size={size} variant="outline" disabled aria-label={`Open ${r.name}'s profile`}>
            <UserRound /> {size === "sm" && "Profile"}
          </Button>
        </span>
      </Hint>
    );

  const columns: ColumnDef<TeamRow, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <Avatar name={row.original.name} size={24} />
          <span className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-[10px] text-muted-foreground">{row.original.designation}</span>
          </span>
        </span>
      ),
    },
    { accessorKey: "state", header: "Today", cell: ({ row }) => <StatusBadge status={row.original.state} /> },
    { accessorKey: "firstIn", header: "In at", cell: ({ row }) => <span className="tnum">{row.original.firstIn ? fmtTime(row.original.firstIn) : "—"}</span> },
    { accessorKey: "elBalance", header: "EL balance", cell: ({ row }) => <NumCell>{row.original.elBalance}</NumCell> },
    { accessorKey: "pending", header: "Pending", cell: ({ row }) => <NumCell>{row.original.pending}</NumCell> },
    { id: "actions", header: "", enableSorting: false, cell: ({ row }) => <span className="flex justify-end">{openProfile(row.original)}</span> },
  ];

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="My team" description="Loading your reportees…" />
        <CardsSkeleton count={8} height={150} />
      </PageBody>
    );
  }

  const present = rows.filter((r) => r.state === "present" || r.state === "overtime" || r.state === "half_day").length;
  const onLeave = rows.filter((r) => r.state === "leave").length;
  const pendingTotal = rows.reduce((a, r) => a + r.pending, 0);

  return (
    <PageBody>
      <PageHeader
        title="My team"
        description={`${persona.name}'s direct reportees — who is in today, leave balances, and anything waiting on you.`}
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as "cards" | "table")}>
            <TabsList>
              <TabsTrigger value="cards" aria-label="Card view">
                <LayoutGrid className="size-3.5" aria-hidden /> Cards
              </TabsTrigger>
              <TabsTrigger value="table" aria-label="Table view">
                <Rows3 className="size-3.5" aria-hidden /> Table
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No direct reportees"
          description={`${persona.name} has nobody reporting to them in the org structure. Reportees appear here as soon as HR assigns them.`}
        />
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label="Team size" value={rows.length} icon={UsersRound} />
            <StatTile label="In today" value={`${present} / ${rows.length}`} icon={CalendarCheck2} tone="good" />
            <StatTile label="On leave today" value={onLeave} icon={CalendarCheck2} tone={onLeave ? "warning" : "neutral"} />
            <StatTile label="Pending requests" value={pendingTotal} icon={Inbox} tone={pendingTotal ? "warning" : "good"} href={can("team.approvals") ? "/approvals" : undefined} />
          </StatRow>

          {view === "cards" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {rows.map((r) => (
                <Card key={r.code} className="flex flex-col gap-3 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <Avatar name={r.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{r.designation}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{r.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={r.state} />
                    <span className="tnum text-[11px] text-muted-foreground">{r.firstIn ? `In ${fmtTime(r.firstIn)}` : "No punch yet"}</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 rounded-md bg-subtle p-2">
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">EL balance</dt>
                      <dd className="tnum text-sm font-semibold">{r.elBalance}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending</dt>
                      <dd className="tnum text-sm font-semibold">{r.pending}</dd>
                    </div>
                  </dl>
                  <div className="mt-auto flex gap-1.5">
                    {openProfile(r)}
                    {r.pending > 0 && can("team.approvals") && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/approvals">
                          <Inbox /> Review
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="ml-auto"
                      aria-label={`Message ${r.name}`}
                      onClick={() => mockAction(`Message sent to ${r.emp.firstName}`, { description: "Delivered in Teams and in-app." })}
                    >
                      <MessageSquare />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Section bodyClassName="p-4">
              <DataTable
                columns={columns}
                data={rows}
                searchKeys={["name", "code", "designation"]}
                searchPlaceholder="Search team…"
                exportName="my-team"
                getRowId={(r) => r.code}
                emptyIcon={UsersRound}
                emptyTitle="No one matches"
              />
            </Section>
          )}
        </>
      )}
    </PageBody>
  );
}
