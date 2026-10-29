"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlarmClock,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCheck,
  Flame,
  Inbox,
  MoreHorizontal,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime, inr, num } from "@/lib/format";
import { menuKeyForPath } from "@/lib/nav";
import { PERSONAS } from "@/lib/rbac";
import { EMPLOYEES, employeeByCode } from "@/mock/employees";
import {
  APPROVAL_TYPE_META,
  approvalsFor,
  type ApprovalItem,
  type ApprovalType,
} from "@/mock/self-service";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Alert, Avatar, Badge, EmptyState, Hint, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FilterSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { AiBadge, ApprovalChainTimeline, SlaChip, ageLabel } from "@/components/self-service/bits";
import { DecisionDialog, DelegateDialog, type DecisionKind, type DelegateValues } from "@/components/self-service/dialogs";

type Outcome = "approved" | "rejected" | "sent_back" | "delegated";
interface Row extends ApprovalItem {
  outcome: Outcome | null;
  decidedNote: string | null;
  /** Flat text for the table's free-text search. */
  search: string;
}

const OUTCOME_LABEL: Record<Outcome, string> = {
  approved: "Approved",
  rejected: "Rejected",
  sent_back: "Sent back",
  delegated: "Delegated",
};

export default function ApprovalsInboxPage() {
  const { role } = useApp();
  /* Re-seed the queue whenever the persona changes. */
  return <ApprovalsInbox key={role} />;
}

function ApprovalsInbox() {
  const loading = useFakeLoad();
  const { role, persona, can, decidedApprovals, markDecided } = useApp();
  const canDecide = can("team.approvals", "A");

  const seed = React.useMemo<Row[]>(
    () =>
      approvalsFor(role, persona.employeeId, persona.name).map((i) => ({
        ...i,
        outcome: null,
        decidedNote: null,
        search: `${i.ref} ${i.title} ${i.requesterName} ${i.department} ${i.summary}`,
      })),
    [role, persona.employeeId, persona.name],
  );
  /* Items already decided on the dashboard this session stay decided here. */
  const [rows, setRows] = React.useState<Row[]>(() => seed.filter((r) => !decidedApprovals.has(r.id)));

  const [tab, setTab] = React.useState<string>("all");
  const [age, setAge] = React.useState("all");
  const [sla, setSla] = React.useState("all");
  const [risk, setRisk] = React.useState("all");
  const [dept, setDept] = React.useState("all");
  const [active, setActive] = React.useState<Row | null>(null);
  const [decision, setDecision] = React.useState<{ kind: DecisionKind; ids: string[]; clear?: () => void } | null>(null);
  const [delegate, setDelegate] = React.useState<{ mode: "ooo" | "reassign"; ids: string[]; clear?: () => void } | null>(null);
  const [triageOpen, setTriageOpen] = React.useState(false);
  const [triageDismissed, setTriageDismissed] = React.useState(false);
  const [away, setAway] = React.useState<{ name: string; from: string; to: string } | null>(null);
  const [stopAway, setStopAway] = React.useState(false);

  const pending = rows.filter((r) => !r.outcome);
  const decided = rows.filter((r) => r.outcome);
  const lowRisk = pending.filter((r) => r.lowRisk);

  const typeCounts = React.useMemo(() => {
    const m = new Map<ApprovalType, number>();
    pending.forEach((r) => m.set(r.type, (m.get(r.type) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pending]);

  const departments = React.useMemo(
    () => Array.from(new Set(rows.map((r) => r.department))).sort().map((d) => ({ value: d, label: d })),
    [rows],
  );

  const filtered = React.useMemo(() => {
    const base = tab === "decided" ? decided : pending;
    return base.filter((r) => {
      if (tab !== "all" && tab !== "decided" && r.type !== tab) return false;
      if (sla !== "all" && r.slaState !== sla) return false;
      if (risk === "low" && !r.lowRisk) return false;
      if (risk === "review" && r.lowRisk) return false;
      if (risk === "escalated" && !r.escalated) return false;
      if (dept !== "all" && r.department !== dept) return false;
      if (age === "lt1" && r.ageHours >= 24) return false;
      if (age === "1to3" && (r.ageHours < 24 || r.ageHours > 72)) return false;
      if (age === "gt3" && r.ageHours <= 72) return false;
      return true;
    });
  }, [tab, pending, decided, sla, risk, dept, age]);

  /* --------------------------------------------------------- mutations */

  const apply = React.useCallback((ids: string[], outcome: Outcome, note: string | null) => {
    const set = new Set(ids);
    const before = rows;
    setRows((rs) => rs.map((r) => (set.has(r.id) ? { ...r, outcome, decidedNote: note } : r)));
    markDecided(ids);
    setActive(null);
    const affected = before.filter((r) => set.has(r.id));
    const money = affected.reduce((a, r) => a + (r.amount ?? 0), 0);
    mockAction(
      ids.length === 1 ? `${OUTCOME_LABEL[outcome]} — ${affected[0]?.title}` : `${OUTCOME_LABEL[outcome]} ${ids.length} requests`,
      {
        description:
          outcome === "approved"
            ? `Moved to the next step${money ? ` · ${inr(money)} in value` : ""}. Requesters were notified.`
            : outcome === "delegated"
              ? note ?? "Reassigned."
              : "The requester sees your comment.",
        tone: outcome === "approved" ? "success" : outcome === "rejected" ? "warning" : "info",
        undo: () => {
          setRows(before);
          markDecided(ids, false);
        },
      },
    );
  }, [rows, markDecided]);

  const candidates = React.useMemo(() => {
    const me = employeeByCode(persona.employeeId);
    const peers = EMPLOYEES.filter(
      (e) => e.code !== persona.employeeId && e.status !== "exited" && e.level <= 2 && e.departmentId === me?.departmentId,
    )
      .slice(0, 5)
      .map((e) => ({ code: e.code, name: e.name, role: e.designation }));
    const others = PERSONAS.filter((p) => p.id !== role && p.id !== "employee" && p.id !== "auditor")
      .slice(0, 5)
      .map((p) => ({ code: p.employeeId, name: p.name, role: p.role }));
    const seen = new Set<string>();
    return [...peers, ...others].filter((c) => (seen.has(c.code) ? false : (seen.add(c.code), true)));
  }, [persona.employeeId, role]);

  /* Every type this persona can receive — not just what is pending right now. */
  const delegateTypes = React.useMemo(
    () => Array.from(new Set(seed.map((r) => r.type))).map((t) => ({ value: t, label: APPROVAL_TYPE_META[t].plural })),
    [seed],
  );

  const submitDelegate = (v: DelegateValues) => {
    const who = candidates.find((c) => c.code === v.delegateTo)?.name ?? v.delegateTo;
    if (delegate?.mode === "ooo") {
      setAway({ name: who, from: v.from, to: v.to });
      mockAction(`Delegation on — ${who}`, {
        description: `${fmtDate(v.from)} to ${fmtDate(v.to)} · ${v.scope.length} request type(s)${v.autoReply ? " · auto-reply on" : ""}.`,
      });
    } else if (delegate) {
      apply(delegate.ids, "delegated", `Now with ${who}${v.note ? ` — “${v.note}”` : ""}`);
      delegate.clear?.();
    }
    setDelegate(null);
  };

  /* ----------------------------------------------------------- columns */

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Request",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <span className="flex min-w-0 max-w-[300px] flex-col">
              <span className="flex items-center gap-1.5">
                <Badge variant="muted">{APPROVAL_TYPE_META[r.type].label}</Badge>
                {r.lowRisk && !r.outcome && (
                  <Hint text="AI triage: low risk — matches policy">
                    <Sparkles className="size-3 text-violet-600 dark:text-violet-300" aria-label="Low risk" />
                  </Hint>
                )}
              </span>
              <span className="mt-0.5 truncate font-medium">{r.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{r.ref}</span>
            </span>
          );
        },
      },
      {
        accessorKey: "requesterName",
        header: "Requester",
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <Avatar name={row.original.requesterName} size={24} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.requesterName}</span>
              <span className="truncate text-[10px] text-muted-foreground">{row.original.department}</span>
            </span>
          </span>
        ),
      },
      {
        accessorKey: "amount",
        header: "Value",
        cell: ({ row }) => <NumCell>{row.original.amount ? inr(row.original.amount) : <span className="text-muted-foreground">—</span>}</NumCell>,
      },
      {
        accessorKey: "ageHours",
        header: "Waiting",
        cell: ({ row }) => (
          <span className="tnum flex flex-col">
            <span>{ageLabel(row.original.ageHours)}</span>
            <span className="text-[10px] text-muted-foreground">{fmtDate(row.original.submittedAt)}</span>
          </span>
        ),
      },
      {
        accessorKey: "slaState",
        header: "SLA",
        cell: ({ row }) =>
          row.original.outcome ? (
            <Badge variant="outline">{OUTCOME_LABEL[row.original.outcome]}</Badge>
          ) : (
            <span className="flex items-center gap-1">
              <SlaChip state={row.original.slaState} ageHours={row.original.ageHours} slaHours={row.original.slaHours} />
              {row.original.escalated && (
                <Hint text={row.original.escalationNote ?? "Escalated"}>
                  <Flame className="size-3.5 text-destructive-fg" aria-label="Escalated" />
                </Hint>
              )}
            </span>
          ),
      },
      {
        id: "step",
        header: "Your step",
        enableSorting: false,
        cell: ({ row }) => {
          const chain = row.original.chain;
          const idx = chain.findIndex((c) => c.status === "pending");
          return (
            <span className="text-xs text-muted-foreground">
              {idx >= 0 ? `${idx} of ${chain.length - 1} · ${chain[idx].step}` : "—"}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const r = row.original;
          if (r.outcome) return <span className="text-[11px] text-muted-foreground">{r.decidedNote ?? "—"}</span>;
          return (
            <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Gated menuKey="team.approvals" action="A">
                <Button size="sm" onClick={() => apply([r.id], "approved", null)}>
                  Approve
                </Button>
              </Gated>
              <Gated menuKey="team.approvals" action="A">
                <Button size="sm" variant="outline" onClick={() => setDecision({ kind: "reject", ids: [r.id] })}>
                  Reject
                </Button>
              </Gated>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${r.ref}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setActive(r)}>Open details</DropdownMenuItem>
                  <DropdownMenuItem disabled={!canDecide} onSelect={() => setDecision({ kind: "send_back", ids: [r.id] })}>
                    <RotateCcw /> Send back
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canDecide} onSelect={() => setDelegate({ mode: "reassign", ids: [r.id] })}>
                    <UserRoundPlus /> Delegate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          );
        },
      },
    ],
    [canDecide, apply],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Approvals inbox" description="Gathering requests from every module…" />
        <StatRow cols={4}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[88px] animate-pulse rounded-md bg-muted" />
          ))}
        </StatRow>
        <TableSkeleton />
      </PageBody>
    );
  }

  const breached = pending.filter((r) => r.slaState === "breached").length;
  const atRisk = pending.filter((r) => r.slaState === "at_risk").length;
  const escalated = pending.filter((r) => r.escalated).length;
  const showTriage = canDecide && lowRisk.length > 0 && !triageDismissed;
  const commonReasons = Array.from(
    new Set(lowRisk.flatMap((r) => r.riskReasons.slice(0, 2).map((x) => x.split(" — ")[0]))),
  ).slice(0, 4);

  return (
    <PageBody>
      <PageHeader
        title="Approvals inbox"
        description={
          canDecide
            ? "One queue for every request routed to you — leave, attendance, money, hiring, assets and profile data. Decide here; the module record updates."
            : `${persona.role} has read-only access to the inbox. Decisions are disabled and every view is audited.`
        }
        actions={
          <>
            {away ? (
              <Button size="sm" variant="outline" onClick={() => setStopAway(true)}>
                <CalendarClock /> Delegating to {away.name.split(" ")[0]}
              </Button>
            ) : (
              <Gated menuKey="team.approvals" action="A">
                <Button size="sm" variant="outline" onClick={() => setDelegate({ mode: "ooo", ids: [] })}>
                  <CalendarClock /> Delegate while I&apos;m away
                </Button>
              </Gated>
            )}
          </>
        }
      />

      {away && (
        <Alert
          tone="info"
          icon={CalendarClock}
          title={`Out-of-office delegation is on — ${away.name}`}
          action={
            <Button size="sm" variant="outline" onClick={() => setStopAway(true)}>
              Turn off
            </Button>
          }
        >
          From {fmtDate(away.from)} to {fmtDate(away.to)}, new requests route to {away.name}. You can still decide anything
          here; their decisions show as &ldquo;on behalf of {persona.name}&rdquo;.
        </Alert>
      )}

      {rows.length === 0 ? (
        <Section>
          <EmptyState
            icon={ShieldCheck}
            title="Nothing is waiting on you"
            description={`${persona.name} has no requests in an approval chain right now. When a request reaches your step it appears here with its SLA clock, and you will get a notification on the channels you chose.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href="/me/preferences">Notification preferences</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </div>
            }
          />
        </Section>
      ) : (
        <>
          {showTriage && (
            <div className="flex flex-col gap-3 rounded-md border border-violet-500/30 bg-violet-500/[0.06] p-3.5 sm:flex-row sm:items-center">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300">
                <Sparkles className="size-4.5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <AiBadge label="AI triage" />
                  <p className="text-sm font-semibold">
                    {lowRisk.length} low-risk request{lowRisk.length === 1 ? "" : "s"} match policy — approve all?
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Why: {commonReasons.join(" · ")}. Nothing here changes payroll, headcount or a sensitive field. AI
                  suggestion — review before use.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setTriageDismissed(true)}>
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTab("all");
                    setRisk("low");
                  }}
                >
                  Review them
                </Button>
                <Button size="sm" className="bg-violet-600 text-white hover:bg-violet-600/90" onClick={() => setTriageOpen(true)}>
                  <CheckCheck /> Approve {lowRisk.length}
                </Button>
              </div>
            </div>
          )}

          <StatRow cols={4}>
            <StatTile label="Awaiting you" value={num(pending.length)} icon={Inbox} tone={pending.length ? "warning" : "good"} onClick={() => { setTab("all"); setSla("all"); setRisk("all"); }} />
            <StatTile label="SLA breached" value={num(breached)} icon={AlarmClock} tone={breached ? "critical" : "good"} hint={`${atRisk} more at risk`} onClick={() => setSla("breached")} />
            <StatTile label="Escalated to you" value={num(escalated)} icon={Flame} tone={escalated ? "serious" : "neutral"} hint="Auto-escalated after SLA + 24h" onClick={() => setRisk("escalated")} />
            <StatTile label="Decided this session" value={num(decided.length)} icon={Check} tone="good" onClick={() => setTab("decided")} />
          </StatRow>

          <Section bodyClassName="p-4 flex flex-col gap-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex-wrap">
                <TabsTrigger value="all">
                  All <span className="tnum ml-1 text-muted-foreground">{pending.length}</span>
                </TabsTrigger>
                {typeCounts.map(([t, n]) => (
                  <TabsTrigger key={t} value={t}>
                    {APPROVAL_TYPE_META[t].plural} <span className="tnum ml-1 text-muted-foreground">{n}</span>
                  </TabsTrigger>
                ))}
                <TabsTrigger value="decided">
                  Decided <span className="tnum ml-1 text-muted-foreground">{decided.length}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <DataTable
              columns={columns}
              data={filtered}
              searchKeys={["search"]}
              searchPlaceholder="Search by ref, requester, title…"
              exportName="approvals-inbox"
              getRowId={(r) => r.id}
              enableSelection={tab !== "decided"}
              onRowClick={(r) => setActive(r)}
              rowTone={(r) => (!r.outcome && r.escalated ? "danger" : undefined)}
              pageSize={12}
              emptyIcon={CheckCheck}
              emptyTitle={tab === "decided" ? "No decisions yet this session" : "Inbox zero for this view"}
              emptyDescription={
                tab === "decided"
                  ? "Approve, reject or send back a request and it lands here, with an Undo in the toast."
                  : "Nothing matches these filters. Clear them to see the full queue."
              }
              bulkActions={(selected, clear) => (
                <>
                  <Gated menuKey="team.approvals" action="A">
                    <Button size="sm" onClick={() => { apply(selected.map((s) => s.id), "approved", null); clear(); }}>
                      <Check /> Approve {selected.length}
                    </Button>
                  </Gated>
                  <Gated menuKey="team.approvals" action="A">
                    <Button size="sm" variant="outline" onClick={() => setDecision({ kind: "reject", ids: selected.map((s) => s.id), clear })}>
                      <X /> Reject
                    </Button>
                  </Gated>
                  <Gated menuKey="team.approvals" action="A">
                    <Button size="sm" variant="outline" onClick={() => setDecision({ kind: "send_back", ids: selected.map((s) => s.id), clear })}>
                      <RotateCcw /> Send back
                    </Button>
                  </Gated>
                  <Gated menuKey="team.approvals" action="A">
                    <Button size="sm" variant="outline" onClick={() => setDelegate({ mode: "reassign", ids: selected.map((s) => s.id), clear })}>
                      <UserRoundPlus /> Delegate
                    </Button>
                  </Gated>
                </>
              )}
              filters={
                <>
                  <FilterSelect label="Dept" value={dept} onValueChange={setDept} allLabel="All" width="w-[170px]" options={departments} />
                  <FilterSelect
                    label="Age"
                    value={age}
                    onValueChange={setAge}
                    allLabel="Any"
                    width="w-[130px]"
                    options={[
                      { value: "lt1", label: "Under 1 day" },
                      { value: "1to3", label: "1–3 days" },
                      { value: "gt3", label: "Over 3 days" },
                    ]}
                  />
                  <FilterSelect
                    label="SLA"
                    value={sla}
                    onValueChange={setSla}
                    allLabel="Any"
                    width="w-[140px]"
                    options={[
                      { value: "ok", label: "On track" },
                      { value: "at_risk", label: "At risk" },
                      { value: "breached", label: "Breached" },
                    ]}
                  />
                  <FilterSelect
                    label="Risk"
                    value={risk}
                    onValueChange={setRisk}
                    allLabel="Any"
                    width="w-[150px]"
                    options={[
                      { value: "low", label: "AI: low risk" },
                      { value: "review", label: "Needs review" },
                      { value: "escalated", label: "Escalated" },
                    ]}
                  />
                </>
              }
            />
          </Section>
        </>
      )}

      {/* ------------------------------------------------ detail sheet */}
      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent width="sm:max-w-lg">
          {active && (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="muted">{APPROVAL_TYPE_META[active.type].label}</Badge>
                  <span className="font-mono text-[10px] text-muted-foreground">{active.ref}</span>
                  {!active.outcome && <SlaChip state={active.slaState} ageHours={active.ageHours} slaHours={active.slaHours} />}
                </div>
                <SheetTitle>{active.title}</SheetTitle>
                <SheetDescription>
                  {active.requesterName} · {active.department} · submitted {fmtDateTime(active.submittedAt)}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-4">
                {active.escalated && (
                  <Alert tone="danger" icon={Flame} title="Escalated">
                    {active.escalationNote}
                  </Alert>
                )}
                <p className="rounded-md border border-border bg-subtle p-3 text-xs leading-relaxed">{active.summary}</p>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                  {active.amount !== null && (
                    <div>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Value</dt>
                      <dd className="tnum mt-0.5 text-xs font-medium">{inr(active.amount)}</dd>
                    </div>
                  )}
                  {active.details.map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                      <dd className="mt-0.5 break-words text-xs font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div
                  className={cn(
                    "rounded-md border p-3",
                    active.lowRisk ? "border-violet-500/30 bg-violet-500/[0.06]" : "border-border",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AiBadge />
                    <p className="text-xs font-semibold">{active.lowRisk ? "Low risk — matches policy" : "Needs a human review"}</p>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1">
                    {active.riskReasons.map((r) => (
                      <li key={r} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                        {r}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-muted-foreground">AI suggestion — review before use.</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold">Approval chain</p>
                  <ApprovalChainTimeline chain={active.chain} ageHours={active.ageHours} />
                </div>

                {can(menuKeyForPath(active.href) ?? "dashboard") && (
                  <Link href={active.href} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Open the full record <ArrowUpRight className="size-3" aria-hidden />
                  </Link>
                )}
              </SheetBody>
              {!active.outcome && (
                <SheetFooter>
                  <Gated menuKey="team.approvals" action="A">
                    <Button variant="ghost" onClick={() => setDelegate({ mode: "reassign", ids: [active.id] })}>
                      <UserRoundPlus /> Delegate
                    </Button>
                  </Gated>
                  <Gated menuKey="team.approvals" action="A">
                    <Button variant="outline" onClick={() => setDecision({ kind: "send_back", ids: [active.id] })}>
                      <RotateCcw /> Send back
                    </Button>
                  </Gated>
                  <Gated menuKey="team.approvals" action="A">
                    <Button variant="outline" onClick={() => setDecision({ kind: "reject", ids: [active.id] })}>
                      <X /> Reject
                    </Button>
                  </Gated>
                  <Gated menuKey="team.approvals" action="A">
                    <Button onClick={() => apply([active.id], "approved", null)}>
                      <Check /> Approve
                    </Button>
                  </Gated>
                </SheetFooter>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <DecisionDialog
        open={!!decision}
        kind={decision?.kind ?? "reject"}
        count={decision?.ids.length ?? 0}
        subject={rows.find((r) => r.id === decision?.ids[0])?.ref ?? ""}
        onClose={() => setDecision(null)}
        onSubmit={(comment) => {
          if (!decision) return;
          apply(decision.ids, decision.kind === "reject" ? "rejected" : decision.kind === "send_back" ? "sent_back" : "approved", comment || null);
          decision.clear?.();
          setDecision(null);
        }}
      />

      <DelegateDialog
        open={!!delegate}
        mode={delegate?.mode ?? "ooo"}
        count={delegate?.ids.length}
        candidates={candidates}
        types={delegateTypes}
        onClose={() => setDelegate(null)}
        onSubmit={submitDelegate}
      />

      <ConfirmDialog
        open={triageOpen}
        onOpenChange={setTriageOpen}
        title={`Approve ${lowRisk.length} low-risk request${lowRisk.length === 1 ? "" : "s"}?`}
        description={
          <span className="flex flex-col gap-2">
            <span>
              Each one passed every policy check below. They move to their next step and the requesters are notified. You can
              undo from the toast.
            </span>
            <span className="flex flex-col gap-1 rounded-md border border-border bg-subtle p-2">
              {lowRisk.slice(0, 8).map((r) => (
                <span key={r.id} className="flex justify-between gap-2 text-[11px]">
                  <span className="truncate">
                    {APPROVAL_TYPE_META[r.type].label} · {r.requesterName}
                  </span>
                  <span className="shrink-0 text-muted-foreground">{r.riskReasons[0].split(" — ")[0]}</span>
                </span>
              ))}
              {lowRisk.length > 8 && <span className="text-[11px] text-muted-foreground">+ {lowRisk.length - 8} more</span>}
            </span>
          </span>
        }
        confirmLabel={`Approve ${lowRisk.length}`}
        onConfirm={() => apply(lowRisk.map((r) => r.id), "approved", "AI triage — approved in bulk")}
      />

      <ConfirmDialog
        open={stopAway}
        onOpenChange={setStopAway}
        title="Turn off delegation?"
        description={`New requests will route back to you immediately. Anything ${away?.name ?? "your delegate"} already decided stays decided.`}
        confirmLabel="Turn off"
        onConfirm={() => {
          setAway(null);
          mockAction("Delegation turned off", { description: "Requests now route to you." });
        }}
      />
    </PageBody>
  );
}
