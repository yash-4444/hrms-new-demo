"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardCheck, ShieldX, UserX } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { ACCESS_CAMPAIGN, REVIEW_ITEMS, type ReviewDecision, type ReviewItem } from "@/mock/platform";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { BarCompareChart, DonutChart } from "@/components/charts";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { Facts, ReasonDialog, TonePill } from "@/components/platform/kit";

const DECISION_PILL: Record<ReviewDecision, React.ReactNode> = {
  pending: <TonePill tone="warning">Pending</TonePill>,
  certified: <TonePill tone="success" icon={CheckCircle2}>Certified</TonePill>,
  revoked: <TonePill tone="danger" icon={ShieldX}>Revoked</TonePill>,
};

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export default function AccessReviewPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();
  const [items, setItems] = React.useState<ReviewItem[]>(REVIEW_ITEMS);
  const [decision, setDecision] = React.useState("pending");
  const [reviewer, setReviewer] = React.useState("all");
  const [riskOnly, setRiskOnly] = React.useState("all");
  const [acting, setActing] = React.useState<{ kind: "certified" | "revoked"; rows: ReviewItem[]; clear?: () => void } | null>(null);

  const data = React.useMemo(
    () =>
      items.filter((i) => {
        if (decision !== "all" && i.decision !== decision) return false;
        if (reviewer !== "all" && i.reviewer !== reviewer) return false;
        if (riskOnly === "risky" && i.risky.length === 0) return false;
        return true;
      }),
    [items, decision, reviewer, riskOnly],
  );

  const done = items.filter((i) => i.decision !== "pending").length;
  const progress = Math.round((done / items.length) * 100);
  const daysLeft = daysBetween(DEMO_TODAY, ACCESS_CAMPAIGN.dueAt);

  const byReviewer = ACCESS_CAMPAIGN.reviewers.map((r) => {
    const mine = items.filter((i) => i.reviewer === r);
    return {
      reviewer: r.split(" ")[0],
      certified: mine.filter((i) => i.decision === "certified").length,
      revoked: mine.filter((i) => i.decision === "revoked").length,
      pending: mine.filter((i) => i.decision === "pending").length,
    };
  });

  const apply = (kind: "certified" | "revoked", rows: ReviewItem[], comment: string) => {
    const ids = rows.map((r) => r.id);
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, decision: kind, comment } : i)));
    mockAction(`${rows.length} ${kind === "certified" ? "certified" : "revoked"}`, {
      description:
        kind === "revoked"
          ? "Role assignments are removed and sessions revoked. A ticket was raised for IT to clean up downstream systems."
          : `Signed off by ${persona.name}. The evidence pack updates automatically.`,
      tone: kind === "revoked" ? "warning" : "success",
    });
  };

  const columns = React.useMemo<ColumnDef<ReviewItem, unknown>[]>(
    () => [
      { accessorKey: "userName", header: "User", cell: ({ row }) => <PersonCell name={row.original.userName} code={row.original.userCode} subtitle={deptName(row.original.department)} /> },
      { accessorKey: "role", header: "Role", cell: ({ row }) => <span className="text-xs font-medium">{row.original.role}</span> },
      {
        id: "grants",
        header: "Grants under review",
        cell: ({ row }) => (
          <div className="flex max-w-[340px] flex-col gap-1">
            <p className="text-xs text-muted-foreground">{row.original.grants.join(" · ")}</p>
            {row.original.risky.map((r) => (
              <TonePill key={r} tone="danger" icon={AlertTriangle} className="whitespace-normal">
                {r}
              </TonePill>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "lastLoginAt",
        header: "Last login",
        cell: ({ row }) => (row.original.lastLoginAt ? <span className="tnum text-xs">{fmtDate(row.original.lastLoginAt)}</span> : <MutedCell>Never</MutedCell>),
      },
      { accessorKey: "reviewer", header: "Reviewer", cell: ({ row }) => <span className="text-xs">{row.original.reviewer}</span> },
      {
        accessorKey: "decision",
        header: "Decision",
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            {DECISION_PILL[row.original.decision]}
            {row.original.comment && <span className="max-w-[200px] text-[11px] text-muted-foreground">{row.original.comment}</span>}
          </div>
        ),
      },
      {
        id: "__a",
        header: "",
        enableHiding: false,
        cell: ({ row }) =>
          row.original.decision === "pending" ? (
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Gated menuKey="admin.access_review" action="A">
                <Button size="sm" variant="outline" onClick={() => setActing({ kind: "certified", rows: [row.original] })}>
                  Certify
                </Button>
              </Gated>
              <Gated menuKey="admin.access_review" action="A">
                <Button size="sm" variant="ghost" className="text-destructive-fg" onClick={() => setActing({ kind: "revoked", rows: [row.original] })}>
                  Revoke
                </Button>
              </Gated>
            </div>
          ) : null,
      },
    ],
    [],
  );

  return (
    <PageBody>
      <PageHeader
        title="Access Review"
        description="Quarterly re-certification of privileged access. Each reviewer confirms every account still needs its role — or revokes it. The signed campaign is your ISO 27001 / SOC 2 evidence."
        actions={
          <Gated menuKey="admin.access_review" action="X" hide>
            <Button size="sm" variant="outline" onClick={() => mockAction("Evidence pack exported", { description: "PDF with every decision, reviewer, timestamp and comment.", tone: "info" })}>
              <ClipboardCheck /> Export evidence
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={2} height={140} />
          <TableSkeleton />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Section title={ACCESS_CAMPAIGN.name} description={ACCESS_CAMPAIGN.policy} className="lg:col-span-2">
              <div className="flex flex-col gap-4">
                <div>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">{done} of {items.length} decisions made</span>
                    <span className="tnum font-semibold">{progress}%</span>
                  </div>
                  <Progress value={progress} aria-label="Campaign progress" tone={progress === 100 ? "success" : "accent"} />
                </div>
                <Facts
                  cols={3}
                  items={[
                    { label: "Scope", value: ACCESS_CAMPAIGN.scope },
                    { label: "Reviewers", value: ACCESS_CAMPAIGN.reviewers.join(", ") },
                    {
                      label: "Due",
                      value: (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="size-3.5" aria-hidden /> {fmtDate(ACCESS_CAMPAIGN.dueAt)} · {daysLeft} days left
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            </Section>
            <DonutChart
              title="Campaign summary"
              data={[
                { name: "Certified", value: items.filter((i) => i.decision === "certified").length },
                { name: "Revoked", value: items.filter((i) => i.decision === "revoked").length },
                { name: "Pending", value: items.filter((i) => i.decision === "pending").length },
              ]}
              height={150}
              centreLabel="decided"
              centreValue={`${progress}%`}
            />
          </div>

          <BarCompareChart
            title="Progress by reviewer"
            data={byReviewer}
            xKey="reviewer"
            series={[
              { key: "certified", label: "Certified" },
              { key: "revoked", label: "Revoked" },
              { key: "pending", label: "Pending" },
            ]}
            stacked
            horizontal
            height={150}
          />

          <DataTable
            columns={columns}
            data={data}
            searchKeys={["userName", "userCode", "role"]}
            searchPlaceholder="Search people or roles…"
            filters={
              <>
                <FilterSelect label="Decision" value={decision} onValueChange={setDecision} options={[{ value: "pending", label: "Pending" }, { value: "certified", label: "Certified" }, { value: "revoked", label: "Revoked" }]} />
                <FilterSelect label="Reviewer" value={reviewer} onValueChange={setReviewer} width="w-[180px]" options={ACCESS_CAMPAIGN.reviewers.map((r) => ({ value: r, label: r }))} />
                <FilterSelect label="Risk" value={riskOnly} onValueChange={setRiskOnly} options={[{ value: "risky", label: "Risky grants only" }]} />
              </>
            }
            rowTone={(i) => (i.decision === "pending" && i.risky.length ? "warning" : undefined)}
            enableSelection
            getRowId={(i) => i.id}
            bulkActions={(sel, clear) => {
              const open = sel.filter((s) => s.decision === "pending");
              return (
                <Gated menuKey="admin.access_review" action="A">
                  <Button size="sm" disabled={!open.length} onClick={() => setActing({ kind: "certified", rows: open, clear })}>
                    Certify {open.length}
                  </Button>
                </Gated>
              );
            }}
            exportName="access-review"
            emptyIcon={UserX}
            emptyTitle={decision === "pending" ? "Your worklist is clear" : "Nothing matches"}
            emptyDescription={decision === "pending" ? "Every account in scope has a decision. Export the evidence pack to close the campaign." : "Change the filters to see more accounts."}
          />
        </>
      )}

      <ReasonDialog
        open={!!acting}
        onOpenChange={(v) => !v && setActing(null)}
        title={acting?.kind === "revoked" ? `Revoke access for ${acting.rows[0]?.userName}?` : `Certify ${acting?.rows.length ?? 0} account${acting?.rows.length === 1 ? "" : "s"}?`}
        description={
          acting?.kind === "revoked"
            ? `Removes the ${acting.rows[0]?.role} role immediately and signs the user out.`
            : "You confirm each account still needs exactly the access listed."
        }
        confirmLabel={acting?.kind === "revoked" ? "Revoke access" : "Certify"}
        destructive={acting?.kind === "revoked"}
        commentLabel="Reviewer comment"
        onConfirm={(c) => {
          if (!acting) return;
          apply(acting.kind, acting.rows, c);
          acting.clear?.();
        }}
      />
    </PageBody>
  );
}
