"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleX, Clock, Inbox, RotateCcw, UserPlus, Zap } from "lucide-react";
import { hm, num } from "@/lib/format";
import { PLATFORM_PERSONA } from "@/lib/rbac";
import { AUTO_APPROVER, SIGNUP_REQUESTS, autoApprovable, minutesToDecide, type SignupRequest, type SignupStatus } from "@/mock/console-signups";
import { isSubdomainTaken } from "@/mock/signup-checks";
import { mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { patchSignup, resetSignups, setSignupAutoApprove, signupNowIso as nowIso, useSignupStore } from "@/components/console/signup-store";
import { useSignupColumns, type SignupAction } from "@/components/console/signups-columns";
import { ApproveSignupDialog, SignupSheet } from "@/components/console/signups-review";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { ReasonDialog } from "@/components/platform/kit";
import { Button } from "@/components/ui/button";
import { Label, Switch, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Card } from "@/components/ui/card";

type Pending = { kind: SignupAction; request: SignupRequest } | null;

/* Fixture requests live in page state; self-serve ones from /register live in
   the shared sign-up store, so a decision here reaches the applicant's
   status page — in this tab or another. */

export default function SignupsPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const { tenants, provisionSignups } = useConsole();
  const store = useSignupStore();
  const autoApprove = store.autoApprove;
  const [fixtures, setFixtures] = React.useState<SignupRequest[]>(SIGNUP_REQUESTS);
  const requests = React.useMemo(() => [...store.requests, ...fixtures], [store.requests, fixtures]);
  const [tab, setTab] = React.useState<SignupStatus>("pending");
  const [viewing, setViewing] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Pending>(null);

  /* An approved request owns its subdomain — only a different tenant makes it "taken". */
  const isTaken = React.useCallback((s: SignupRequest) => s.status === "pending" && isSubdomainTaken(s.subdomain, tenants), [tenants]);
  const viewed = requests.find((r) => r.id === viewing) ?? null;
  const byStatus = (st: SignupStatus) => requests.filter((r) => r.status === st);
  const approved = byStatus("approved");
  const manual = approved.filter((r) => r.decidedBy !== AUTO_APPROVER);
  const avgMinutes = manual.length ? manual.reduce((a, r) => a + minutesToDecide(r), 0) / manual.length : 0;
  const autoShare = approved.length ? (approved.length - manual.length) / approved.length : 0;
  const rejectedThisMonth = byStatus("rejected").filter((r) => r.decidedAt?.startsWith("2026-09")).length;
  const qualifying = requests.filter((r) => autoApprovable(r, isTaken(r)));

  const patch = (s: SignupRequest, p: Partial<SignupRequest>) =>
    s.selfServe ? patchSignup(s.id, p) : setFixtures((rs) => rs.map((r) => (r.id === s.id ? { ...r, ...p } : r)));

  /* A self-serve request can be decided in another tab while a dialog here is open. */
  const stillPending = (s: SignupRequest) => {
    const open = requests.find((r) => r.id === s.id)?.status === "pending";
    if (!open) mockAction(`${s.company} was already decided`, { description: "Another tab reviewed this request first.", tone: "info" });
    return open;
  };

  const approve = (all: SignupRequest[], by: string) => {
    const list = all.filter(stillPending);
    if (!list.length) return;
    const made = provisionSignups(list, by);
    list.forEach((s, i) => patch(s, { status: "approved", decidedAt: nowIso(), decidedBy: by, tenantId: made[i].id }));
    const first = made[0];
    toast.success(made.length === 1 ? `${first.name} provisioned as ${first.id}` : `${made.length} sign-ups provisioned`, {
      description:
        made.length === 1
          ? `${first.status === "trial" ? "Trial started" : "Live on Free"} · invitation sent to ${first.ownerEmail}.`
          : made.map((t) => t.name).join(", "),
      action: { label: "View tenant", onClick: () => router.push(`/console/tenants?status=${first.status}`) },
    });
  };

  const onAction = React.useCallback((kind: SignupAction, request: SignupRequest) => setPending({ kind, request }), []);
  const columns = useSignupColumns(tab, isTaken, onAction);

  const p = pending?.request;
  return (
    <PageBody>
      <PageHeader
        title="Sign-up requests"
        description="Self-serve registrations from /register wait here until an operator approves them. Approval provisions the tenant in its country's data region and invites the admin."
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={!store.requests.length}
            onClick={() => {
              resetSignups();
              setViewing(null);
              mockAction("Demo sign-ups cleared", { description: "Requests submitted from /register were removed; the fixture queue is unchanged.", tone: "info" });
            }}
          >
            <RotateCcw /> Reset demo sign-ups
          </Button>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} />
          <TableSkeleton />
        </>
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label="Pending" value={num(byStatus("pending").length)} icon={Inbox} tone={byStatus("pending").length ? "warning" : "neutral"} hint="Awaiting an operator" onClick={() => setTab("pending")} />
            <StatTile label="Avg time to approve" value={hm(avgMinutes)} icon={Clock} hint="Operator-reviewed requests" onClick={() => setTab("approved")} />
            <StatTile label="Auto-approved" value={`${Math.round(autoShare * 100)}%`} icon={Zap} hint={`${approved.length - manual.length} of ${approved.length} approvals`} onClick={() => setTab("approved")} />
            <StatTile label="Rejected this month" value={num(rejectedThisMonth)} icon={CircleX} hint="September 2026" onClick={() => setTab("rejected")} />
          </StatRow>

          <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Switch
              id="auto-approve"
              checked={autoApprove}
              onCheckedChange={(v) => {
                setSignupAutoApprove(v);
                mockAction(v ? "Auto-approval switched on" : "Auto-approval switched off", {
                  description: v ? "New Free sign-ups that pass every check are provisioned without review." : "Every sign-up now waits for an operator.",
                  tone: "info",
                });
              }}
            />
            <div className="min-w-0 flex-1">
              <Label htmlFor="auto-approve" className="text-sm">
                Auto-approve Free plan sign-ups that pass all checks
              </Label>
              <p className="text-xs text-muted-foreground">Paid plans and any request with a risk flag always wait for an operator.</p>
            </div>
            {autoApprove && qualifying.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => approve(qualifying, AUTO_APPROVER)}>
                <Zap /> Apply to {qualifying.length} pending now
              </Button>
            )}
          </Card>

          <Tabs value={tab} onValueChange={(v) => setTab(v as SignupStatus)}>
            <TabsList>
              <TabsTrigger value="pending">Pending ({byStatus("pending").length})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejected ({byStatus("rejected").length})</TabsTrigger>
            </TabsList>
          </Tabs>

          <DataTable
            key={tab}
            columns={columns}
            data={byStatus(tab)}
            searchKeys={["company", "subdomain", "adminName", "adminEmail", "id"]}
            searchPlaceholder="Search company, subdomain, admin…"
            onRowClick={(r) => setViewing(r.id)}
            getRowId={(r) => r.id}
            rowTone={(r) => (r.status === "pending" && (!r.checks.emailVerified || isTaken(r)) ? "danger" : undefined)}
            exportName={`signups-${tab}`}
            canExport
            emptyIcon={UserPlus}
            emptyTitle={tab === "pending" ? "Queue is clear" : `No ${tab} requests`}
            emptyDescription={tab === "pending" ? "Every sign-up has been reviewed. New ones from /register appear here." : "Clear the search to see every request."}
          />
        </>
      )}

      <SignupSheet
        request={viewed}
        subdomainTaken={viewed ? isTaken(viewed) : false}
        onOpenChange={(v) => !v && setViewing(null)}
        onApprove={() => viewed && setPending({ kind: "approve", request: viewed })}
        onReject={() => viewed && setPending({ kind: "reject", request: viewed })}
        onRequestInfo={() => viewed && setPending({ kind: "info", request: viewed })}
      />
      {pending?.kind === "approve" && p && (
        <ApproveSignupDialog
          request={p}
          onOpenChange={(v) => !v && setPending(null)}
          onConfirm={() => {
            approve([p], PLATFORM_PERSONA.name);
            setPending(null);
            setViewing(null);
          }}
        />
      )}
      <ReasonDialog
        open={pending?.kind === "reject"}
        onOpenChange={(v) => !v && setPending(null)}
        title={`Reject ${p?.company ?? ""}?`}
        description={`${p?.adminEmail ?? ""} is emailed the reason. Nothing is provisioned; they may register again.`}
        confirmLabel="Reject & notify"
        commentLabel="Reason (emailed to the applicant)"
        onConfirm={(reason) => {
          if (!p || !stillPending(p)) return;
          patch(p, { status: "rejected", decidedAt: nowIso(), decidedBy: PLATFORM_PERSONA.name, rejectReason: reason });
          setViewing(null);
          mockAction(`${p.company} rejected`, { description: `Reason emailed to ${p.adminEmail}.`, tone: "warning" });
        }}
      />
      <ReasonDialog
        open={pending?.kind === "info"}
        onOpenChange={(v) => !v && setPending(null)}
        title={`Request information from ${p?.company ?? ""}`}
        description="The request stays pending until the applicant replies; their answer lands in the support queue."
        confirmLabel="Send request"
        destructive={false}
        commentLabel="What do you need from the applicant?"
        commentPlaceholder="e.g. Your company's GSTIN or trade licence number."
        onConfirm={(message) => {
          if (!p) return;
          patch(p, { infoRequest: { at: nowIso(), message } });
          mockAction(`Information requested from ${p.adminName}`, { description: `Emailed to ${p.adminEmail}.`, tone: "info" });
        }}
      />
    </PageBody>
  );
}
