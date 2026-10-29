"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BellRing, Inbox, MessageSquarePlus, Send, Users } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { ACTIVE_CYCLE } from "@/mock/growth";
import { FEEDBACK, REQUESTS_360, type FeedbackItem, type Request360 } from "@/mock/engage";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState, Progress, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackAiSummary, FeedbackCard } from "@/components/engage/perf-feedback";
import { GiveFeedbackDialog, Request360Dialog } from "@/components/engage/perf-dialogs";
import { nameOf, personLine } from "@/components/engage/kit";

const RATER_STATUS: Record<string, string> = { submitted: "completed", pending: "pending", declined: "withdrawn" };

export default function FeedbackPage() {
  const loading = useFakeLoad();
  const { persona, can } = useApp();
  const me = persona.employeeId;
  const isHr = can("growth.feedback", "E");

  const [feedback, setFeedback] = React.useState<FeedbackItem[]>(FEEDBACK);
  const [requests, setRequests] = React.useState<Request360[]>(REQUESTS_360);
  const [giveOpen, setGiveOpen] = React.useState(false);
  const [reqOpen, setReqOpen] = React.useState(false);
  const [openReq, setOpenReq] = React.useState<Request360 | null>(null);

  const received = feedback.filter((f) => f.toCode === me);
  const given = feedback.filter((f) => f.fromCode === me);
  const visibleRequests = isHr ? requests : requests.filter((r) => r.subjectCode === me || r.raters.some((x) => x.code === me));
  const pendingOnMe = requests.filter((r) => r.raters.some((x) => x.code === me && x.status === "pending"));
  const allRaters = visibleRequests.flatMap((r) => r.raters);
  const completion = allRaters.length ? Math.round((allRaters.filter((r) => r.status === "submitted").length / allRaters.length) * 100) : 0;

  const nudge = (r: Request360) => {
    const pending = r.raters.filter((x) => x.status === "pending");
    mockAction(`Reminder sent to ${pending.length} rater${pending.length === 1 ? "" : "s"}`, {
      description: pending.map((x) => nameOf(x.code)).join(", ") || "Everyone has responded.",
    });
  };

  const columns = React.useMemo<ColumnDef<Request360, unknown>[]>(
    () => [
      {
        id: "subject",
        accessorFn: (r) => nameOf(r.subjectCode),
        header: "Feedback for",
        cell: ({ row }) => <PersonCell name={nameOf(row.original.subjectCode)} code={row.original.subjectCode} subtitle={personLine(row.original.subjectCode)} />,
      },
      {
        id: "progress",
        accessorFn: (r) => r.raters.filter((x) => x.status === "submitted").length / r.raters.length,
        header: "Responses",
        cell: ({ row }) => {
          const done = row.original.raters.filter((x) => x.status === "submitted").length;
          return (
            <div className="flex w-36 flex-col gap-1">
              <span className="tnum text-xs">
                {done} of {row.original.raters.length} submitted
              </span>
              <Progress value={(done / row.original.raters.length) * 100} aria-label={`${done} of ${row.original.raters.length} responses`} />
            </div>
          );
        },
      },
      {
        id: "myRole",
        accessorFn: (r) => (r.subjectCode === me ? "Subject" : r.raters.find((x) => x.code === me)?.relation ?? "—"),
        header: "My role",
        cell: ({ getValue }) => <MutedCell>{String(getValue())}</MutedCell>,
      },
      { accessorKey: "requestedOn", header: "Requested", cell: ({ row }) => <MutedCell>{fmtDate(row.original.requestedOn)}</MutedCell> },
      {
        accessorKey: "dueOn",
        header: "Due",
        cell: ({ row }) => (
          <StatusBadge status={row.original.dueOn < DEMO_TODAY ? "overdue" : "due_soon"} label={fmtDate(row.original.dueOn)} />
        ),
      },
    ],
    [me],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Feedback & 360" description="Loading feedback…" />
        <CardsSkeleton />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Feedback & 360"
        description={`Continuous feedback and 360 requests for ${ACTIVE_CYCLE.name}. Feedback is visible to the recipient straight away; anonymous items hide the sender.`}
        actions={
          <>
            <Gated menuKey="growth.feedback" action="C">
              <Button size="sm" variant="outline" onClick={() => setReqOpen(true)}>
                <Users /> Request 360
              </Button>
            </Gated>
            <Gated menuKey="growth.feedback" action="C">
              <Button size="sm" onClick={() => setGiveOpen(true)}>
                <MessageSquarePlus /> Give feedback
              </Button>
            </Gated>
          </>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Received this cycle" value={received.length} icon={Inbox} hint={`${received.filter((f) => f.kind === "praise").length} praise · ${received.filter((f) => f.kind === "constructive").length} constructive`} />
        <StatTile label="Given this cycle" value={given.length} icon={Send} hint="Counts towards the 'Win together' value" />
        <StatTile label="360 requests waiting on you" value={pendingOnMe.length} icon={BellRing} tone={pendingOnMe.length ? "warning" : "neutral"} hint="Due 26 Sep" />
        <StatTile label={isHr ? "360 completion — all" : "360 completion — yours"} value={`${completion}%`} icon={Users} hint={`${allRaters.length} rater invitations`} />
      </StatRow>

      <FeedbackAiSummary items={received} cycleName={ACTIVE_CYCLE.name} />

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Received ({received.length})</TabsTrigger>
          <TabsTrigger value="given">Given ({given.length})</TabsTrigger>
          <TabsTrigger value="360">360 requests ({visibleRequests.length})</TabsTrigger>
        </TabsList>

        {(["received", "given"] as const).map((tab) => {
          const list = tab === "received" ? received : given;
          return (
            <TabsContent key={tab} value={tab}>
              {list.length === 0 ? (
                <EmptyState
                  icon={tab === "received" ? Inbox : Send}
                  title={tab === "received" ? "No feedback received yet this cycle" : "You haven't given feedback this cycle"}
                  description={tab === "received" ? "Request a 360 to hear from your manager and peers." : "A specific note of thanks takes two minutes and is remembered for months."}
                  action={
                    <Gated menuKey="growth.feedback" action="C">
                      <Button size="sm" variant="outline" onClick={() => (tab === "received" ? setReqOpen(true) : setGiveOpen(true))}>
                        {tab === "received" ? "Request 360" : "Give feedback"}
                      </Button>
                    </Gated>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {list.map((f) => (
                    <FeedbackCard key={f.id} item={f} perspective={tab} />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}

        <TabsContent value="360">
          <Section title="360 requests" description={isHr ? "Every request in the active cycle." : "Requests about you, and requests where you are a rater."} bodyClassName="p-3">
            <DataTable
              columns={columns}
              data={visibleRequests}
              getRowId={(r) => r.id}
              onRowClick={setOpenReq}
              exportName="360-requests"
              emptyIcon={Users}
              emptyTitle="No 360 requests"
              emptyDescription="Request a 360 to collect structured feedback from your manager, peers and reportees."
            />
          </Section>
        </TabsContent>
      </Tabs>

      <Sheet open={!!openReq} onOpenChange={(v) => !v && setOpenReq(null)}>
        <SheetContent>
          {openReq && (
            <>
              <SheetHeader>
                <SheetTitle>360 for {nameOf(openReq.subjectCode)}</SheetTitle>
                <SheetDescription>
                  {ACTIVE_CYCLE.name} · due {fmtDate(openReq.dueOn)}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-2">
                {openReq.raters.map((r) => (
                  <div key={r.code} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                    <PersonCell name={nameOf(r.code)} code={r.code} subtitle={r.relation} />
                    <StatusBadge status={RATER_STATUS[r.status]} label={r.status === "submitted" ? "Submitted" : r.status === "pending" ? "Pending" : "Declined"} />
                  </div>
                ))}
                {(openReq.subjectCode === me || isHr) && (
                  <Button size="sm" variant="outline" className="mt-2 self-start" onClick={() => nudge(openReq)} disabled={!openReq.raters.some((r) => r.status === "pending")}>
                    <BellRing /> Remind pending raters
                  </Button>
                )}
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>

      <GiveFeedbackDialog
        open={giveOpen}
        onOpenChange={setGiveOpen}
        fromCode={me}
        onSubmit={(v) => {
          setFeedback((prev) => [
            { id: `FB-NEW-${prev.length + 1}`, fromCode: me, toCode: v.toCode, anonymous: v.anonymous, kind: v.kind, themes: [], text: v.text, date: DEMO_TODAY, cycleId: ACTIVE_CYCLE.id, source: "unprompted" },
            ...prev,
          ]);
          mockAction(`Feedback sent to ${nameOf(v.toCode)}`, { description: v.anonymous ? "Shared anonymously." : "They have been notified in-app." });
        }}
      />
      <Request360Dialog
        open={reqOpen}
        onOpenChange={setReqOpen}
        subjectCode={me}
        cycleName={ACTIVE_CYCLE.name}
        onSubmit={(v, relations) => {
          setRequests((prev) => [
            { id: `R360-NEW-${prev.length + 1}`, cycleId: ACTIVE_CYCLE.id, subjectCode: me, requestedOn: DEMO_TODAY, dueOn: "2026-09-30", raters: v.raters.map((c) => ({ code: c, relation: relations[c], status: "pending" as const })) },
            ...prev,
          ]);
          mockAction(`360 requested from ${v.raters.length} raters`, { description: "Due 30 Sep 2026. You'll see responses here as they arrive." });
        }}
      />
    </PageBody>
  );
}
