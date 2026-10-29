"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeIndianRupee, Check, GitBranch, Share2, UserCheck, UserPlus, Users } from "lucide-react";

import { fmtMonth, inr } from "@/lib/format";
import { BONUS_STATUS_LABEL, REFERRALS, type BonusStatus, type Referral } from "@/mock/lifecycle";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { ReasonDialog } from "@/components/lifecycle/kit";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { ReferDialog } from "./refer-dialog";
import { referralColumns } from "./referral-columns";
import { BonusRules } from "./bonus-rules";

/* ============================================================================
   /hiring/referrals — employees refer, recruiters track, HR approves rewards.
   Referral state is cloned locally so a submission, an approval or a
   rejection moves the table, the KPI row and the tabs together.
   ========================================================================== */

const FY_START = "2026-04-01";
const NEXT_PAYOUT = "2026-10";

const BONUS_OPTIONS = (Object.keys(BONUS_STATUS_LABEL) as BonusStatus[]).map((s) => ({ value: s, label: BONUS_STATUS_LABEL[s] }));

export default function ReferralsPage() {
  const loading = useFakeLoad();
  const { persona, can, role } = useApp();
  const canReview = can("hiring.referrals", "A");
  const linkCandidates = can("hiring.candidates", "V");
  const linkEmployees = can("people.directory", "V");

  const [referrals, setReferrals] = React.useState<Referral[]>(() => REFERRALS.map((r) => ({ ...r })));
  const [referOpen, setReferOpen] = React.useState(false);
  const [rejecting, setRejecting] = React.useState<Referral | null>(null);
  const [bonusStatus, setBonusStatus] = React.useState("all");

  const mine = React.useMemo(() => referrals.filter((r) => r.referrerCode === persona.employeeId), [referrals, persona.employeeId]);
  const scoped = canReview ? referrals : mine;

  const kpis = React.useMemo(() => {
    const sum = (xs: Referral[]) => xs.reduce((a, r) => a + r.bonus, 0);
    return {
      fy: scoped.filter((r) => r.submittedOn >= FY_START).length,
      submitted: scoped.filter((r) => r.stage === "submitted").length,
      pipeline: scoped.filter((r) => r.bonusStatus === "in_pipeline").length,
      hired: scoped.filter((r) => r.stage === "hired").length,
      tenure: scoped.filter((r) => r.bonusStatus === "pending_tenure").length,
      awaiting: scoped.filter((r) => r.bonusStatus === "pending_approval").length,
      paid: sum(scoped.filter((r) => r.bonusStatus === "paid")),
      pending: sum(scoped.filter((r) => ["pending_tenure", "pending_approval", "approved"].includes(r.bonusStatus))),
    };
  }, [scoped]);

  const nextId = React.useMemo(() => {
    const max = Math.max(...referrals.map((r) => Number(r.id.slice(-3))));
    return `REF-2026-${String(max + 1).padStart(3, "0")}`;
  }, [referrals]);

  /* -------------------------------------------------------------- mutators */

  const approve = React.useCallback((targets: Referral[]) => {
    const ids = new Set(targets.map((t) => t.id));
    const mark = (status: BonusStatus, period: string | null) =>
      setReferrals((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, bonusStatus: status, payoutPeriod: period } : r)));
    mark("approved", NEXT_PAYOUT);
    const total = targets.reduce((a, r) => a + r.bonus, 0);
    mockAction(targets.length === 1 ? `Bonus approved for ${targets[0].referrerName}` : `${targets.length} referral bonuses approved`, {
      description: `${inr(total, { decimals: false })} added to the ${fmtMonth(`${NEXT_PAYOUT}-01`)} payroll run as a Referral bonus earning.`,
      undo: () => mark("pending_approval", null),
    });
  }, []);

  const reject = (r: Referral, comment: string) => {
    setReferrals((prev) => prev.map((x) => (x.id === r.id ? { ...x, bonusStatus: "not_eligible" as const, payoutPeriod: null } : x)));
    mockAction(`Bonus rejected for ${r.referrerName}`, {
      description: `Referral of ${r.candidateName} closed as Not eligible. Reason: ${comment}`,
      tone: "warning",
    });
  };

  const submitted = (r: Referral) => {
    setReferrals((prev) => [r, ...prev]);
    mockAction("Referral submitted", {
      description: `${r.candidateName} for ${r.role} (${r.reqCode}). They will get a consent email; the recruiter is notified.`,
    });
  };

  /* ---------------------------------------------------------------- columns */

  const mineColumns = React.useMemo(
    () => referralColumns({ mode: "mine", linkCandidates, linkEmployees }),
    [linkCandidates, linkEmployees],
  );
  const allColumns = React.useMemo(
    () => referralColumns({ mode: "all", linkCandidates, linkEmployees, onApprove: (r) => approve([r]), onReject: setRejecting }),
    [linkCandidates, linkEmployees, approve],
  );

  const allRows = React.useMemo(
    () => referrals.filter((r) => bonusStatus === "all" || r.bonusStatus === bonusStatus),
    [referrals, bonusStatus],
  );

  const referButton = (
    <Gated menuKey="hiring.referrals" action="C">
      <Button size="sm" onClick={() => setReferOpen(true)}>
        <UserPlus /> Refer a friend
      </Button>
    </Gated>
  );

  return (
    <PageBody>
      <PageHeader
        title="Referrals"
        description="Refer people you have worked with. Bonuses unlock after 90 days of service and are paid through payroll — tracked here end to end."
        actions={referButton}
      />

      {loading ? (
        <CardsSkeleton count={4} />
      ) : (
        <StatRow cols={4}>
          <StatTile
            label={canReview ? "Referrals this FY" : "Your referrals this FY"}
            value={kpis.fy}
            icon={Share2}
            tone="accent"
            hint={`${kpis.submitted} new, awaiting a recruiter screen`}
          />
          <StatTile label="In pipeline" value={kpis.pipeline} icon={GitBranch} hint="Screening, interviewing or at offer" />
          <StatTile label="Hired" value={kpis.hired} icon={UserCheck} tone="good" hint={`${kpis.tenure} still serving the 90 days`} />
          <StatTile
            label="Bonus paid"
            value={inr(kpis.paid, { decimals: false })}
            icon={BadgeIndianRupee}
            tone={kpis.awaiting > 0 && canReview ? "warning" : "neutral"}
            hint={`${inr(kpis.pending, { decimals: false })} pending${canReview && kpis.awaiting ? ` · ${kpis.awaiting} awaiting your approval` : ""}`}
            onClick={canReview ? () => setBonusStatus(bonusStatus === "pending_approval" ? "all" : "pending_approval") : undefined}
            footer={canReview && bonusStatus === "pending_approval" ? "Filtering All referrals — click again to clear" : undefined}
          />
        </StatRow>
      )}

      <Tabs key={role} defaultValue={canReview ? "all" : "mine"}>
        <TabsList>
          <TabsTrigger value="mine">
            My referrals <Badge variant="muted" className="tnum">{mine.length}</Badge>
          </TabsTrigger>
          {canReview && (
            <TabsTrigger value="all">
              All referrals <Badge variant="muted" className="tnum">{referrals.length}</Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="rules">Bonus rules</TabsTrigger>
        </TabsList>

        <TabsContent value="mine">
          {loading ? (
            <TableSkeleton rows={6} />
          ) : mine.length === 0 ? (
            <EmptyState
              icon={Users}
              title="You haven't referred anyone yet"
              description="Know someone who would be great here? Refer them for an open role and earn up to ₹1,00,000 once they complete 90 days."
              action={referButton}
            />
          ) : (
            <DataTable<Referral>
              columns={mineColumns}
              data={mine}
              getRowId={(r) => r.id}
              searchKeys={["candidateName", "role"]}
              searchPlaceholder="Search your referrals…"
              exportName="my-referrals"
              emptyIcon={Users}
              emptyTitle="No referrals match"
              emptyDescription="Try a different name or role."
            />
          )}
        </TabsContent>

        {canReview && (
          <TabsContent value="all">
            {loading ? (
              <TableSkeleton rows={10} />
            ) : (
              <DataTable<Referral>
                columns={allColumns}
                data={allRows}
                getRowId={(r) => r.id}
                searchKeys={["candidateName", "role", "referrerName"]}
                searchPlaceholder="Search candidate, role or referrer…"
                exportName="referrals"
                enableSelection
                rowTone={(r) => (r.bonusStatus === "pending_approval" ? "warning" : undefined)}
                bulkActions={(selected, clear) => (
                  <Gated menuKey="hiring.referrals" action="A">
                    <Button
                      size="sm"
                      onClick={() => {
                        const targets = selected.filter((r) => r.bonusStatus === "pending_approval");
                        if (!targets.length) {
                          mockAction("Nothing to approve", {
                            description: "None of the selected referrals are awaiting HR approval.",
                            tone: "info",
                          });
                          return;
                        }
                        approve(targets);
                        clear();
                      }}
                    >
                      <Check /> Approve bonuses
                    </Button>
                  </Gated>
                )}
                emptyIcon={Share2}
                emptyTitle="No referrals in this status"
                emptyDescription="Clear the filter to see every referral this cycle."
                emptyAction={
                  <Button variant="outline" size="sm" onClick={() => setBonusStatus("all")}>
                    Clear filter
                  </Button>
                }
                filters={
                  <FilterSelect
                    label="Bonus status"
                    value={bonusStatus}
                    onValueChange={setBonusStatus}
                    options={BONUS_OPTIONS}
                    allLabel="All statuses"
                    width="w-[230px]"
                  />
                }
                toolbar={
                  linkCandidates ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/candidates">Candidate pipeline</Link>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </TabsContent>
        )}

        <TabsContent value="rules">
          <BonusRules />
        </TabsContent>
      </Tabs>

      <ReferDialog
        open={referOpen}
        onOpenChange={setReferOpen}
        referrer={{ code: persona.employeeId, name: persona.name }}
        existing={referrals.map((r) => r.candidateEmail.toLowerCase())}
        nextId={nextId}
        onSubmitted={submitted}
      />

      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title={rejecting ? `Reject bonus for ${rejecting.referrerName}?` : "Reject bonus"}
        description={
          rejecting
            ? `${inr(rejecting.bonus, { decimals: false })} for referring ${rejecting.candidateName}. The referrer is notified with your reason.`
            : undefined
        }
        confirmLabel="Reject bonus"
        onConfirm={(c) => rejecting && reject(rejecting, c)}
      />
    </PageBody>
  );
}
