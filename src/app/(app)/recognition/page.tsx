"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Award, Gift, HandHeart, Trophy, Wallet } from "lucide-react";
import { inr, num } from "@/lib/format";
import { DEMO_NOW } from "@/mock/org";
import {
  COMPANY_VALUES,
  HIGH_VALUE_THRESHOLD,
  KUDOS,
  MONTHLY_GIVE_ALLOWANCE,
  OPENING_POINTS,
  RECOGNITION_BUDGET,
  REWARDS,
  type Kudos,
  type Reward,
} from "@/mock/engage";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { GiveKudosDialog, type KudosValues } from "@/components/engage/kudos-dialog";
import { KudosCard, RewardsGrid } from "@/components/engage/recognition-parts";
import { DecisionDialog, nameOf, personLine } from "@/components/engage/kit";

interface LeaderRow {
  code: string;
  points: number;
  kudos: number;
}

export default function RecognitionPage() {
  const loading = useFakeLoad();
  const { persona, can } = useApp();
  const me = persona.employeeId;
  const isHr = can("engage.recognition", "A");

  const [kudos, setKudos] = React.useState<Kudos[]>(KUDOS);
  const [rewards, setRewards] = React.useState<Reward[]>(REWARDS);
  const [cheers, setCheers] = React.useState<string[]>([]);
  const [redeemed, setRedeemed] = React.useState(0);
  const [giveOpen, setGiveOpen] = React.useState(false);
  const [redeeming, setRedeeming] = React.useState<Reward | null>(null);
  const [rejecting, setRejecting] = React.useState<Kudos | null>(null);
  const [budget, setBudget] = React.useState(RECOGNITION_BUDGET);

  /* Managers give from a spot-award budget four times the peer allowance. */
  const allowance = persona.reportees > 0 ? MONTHLY_GIVE_ALLOWANCE * 4 : MONTHLY_GIVE_ALLOWANCE;
  const givenThisMonth = kudos
    .filter((k) => k.fromCode === me && k.at.startsWith("2026-09") && k.status !== "rejected")
    .reduce((a, k) => a + k.points * k.toCodes.length, 0);
  const remaining = Math.max(0, allowance - givenThisMonth);
  const received = kudos.filter((k) => k.status === "posted" && k.toCodes.includes(me)).reduce((a, k) => a + k.points, 0);
  const balance = (OPENING_POINTS[me] ?? 0) + received - redeemed;

  const leaders: LeaderRow[] = React.useMemo(() => {
    const m = new Map<string, LeaderRow>();
    for (const k of kudos.filter((x) => x.status === "posted"))
      for (const c of k.toCodes) {
        const r = m.get(c) ?? { code: c, points: 0, kudos: 0 };
        r.points += k.points;
        r.kudos += 1;
        m.set(c, r);
      }
    return [...m.values()].sort((a, b) => b.points - a.points);
  }, [kudos]);
  const pending = kudos.filter((k) => k.status === "pending_approval");

  const give = (v: KudosValues) => {
    const high = v.points >= HIGH_VALUE_THRESHOLD;
    const k: Kudos = {
      id: `KD-${242 + kudos.length - KUDOS.length}`,
      fromCode: me,
      toCodes: v.recipients,
      valueId: v.valueId,
      points: v.points,
      message: v.message,
      at: DEMO_NOW,
      status: high ? "pending_approval" : "posted",
      reactions: 0,
    };
    setKudos((ks) => [k, ...ks]);
    if (high) setBudget((b) => ({ ...b, pendingApproval: b.pendingApproval + v.points * v.recipients.length }));
    mockAction(`Kudos sent to ${v.recipients.map(nameOf).join(", ")}`, {
      description: high ? "On the wall now. Points post once HR approves the award." : `${v.points * v.recipients.length} points posted.`,
    });
  };

  const decide = (k: Kudos, approve: boolean, note?: string) => {
    setKudos((ks) => ks.map((x) => (x.id === k.id ? { ...x, status: approve ? "posted" : "rejected" } : x)));
    const total = k.points * k.toCodes.length;
    setBudget((b) => ({ ...b, pendingApproval: Math.max(0, b.pendingApproval - total) }));
    mockAction(approve ? "Award approved" : "Award points declined", {
      description: approve ? `${num(total)} points posted to ${k.toCodes.map(nameOf).join(", ")}.` : `Reason recorded: ${note}`,
      tone: approve ? "success" : "warning",
    });
  };

  const leaderCols: ColumnDef<LeaderRow, unknown>[] = [
    { id: "rank", header: "#", cell: ({ row }) => <span className="tnum text-xs text-muted-foreground">{row.index + 1}</span> },
    { accessorKey: "code", header: "Person", cell: ({ row }) => <PersonCell name={nameOf(row.original.code)} code={row.original.code} subtitle={personLine(row.original.code)} /> },
    { accessorKey: "kudos", header: "Kudos", cell: ({ row }) => <NumCell>{num(row.original.kudos)}</NumCell> },
    { accessorKey: "points", header: "Points (Sep)", cell: ({ row }) => <NumCell>{num(row.original.points)}</NumCell> },
  ];

  const pendingCols: ColumnDef<Kudos, unknown>[] = [
    { accessorKey: "fromCode", header: "From", cell: ({ row }) => <PersonCell name={nameOf(row.original.fromCode)} code={row.original.fromCode} /> },
    { id: "to", header: "To", cell: ({ row }) => <span className="text-xs">{row.original.toCodes.map(nameOf).join(", ")}</span> },
    { accessorKey: "message", header: "Reason", cell: ({ row }) => <span className="line-clamp-2 max-w-sm text-xs">{row.original.message}</span> },
    { accessorKey: "points", header: "Points", cell: ({ row }) => <NumCell>{num(row.original.points * row.original.toCodes.length)}</NumCell> },
    {
      id: "__a",
      header: "",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1.5">
          <Gated menuKey="engage.recognition" action="A">
            <Button size="sm" variant="outline" onClick={() => setRejecting(row.original)}>
              Decline
            </Button>
          </Gated>
          <Gated menuKey="engage.recognition" action="A">
            <Button size="sm" onClick={() => decide(row.original, true)}>
              Approve
            </Button>
          </Gated>
        </div>
      ),
    },
  ];

  return (
    <PageBody>
      <PageHeader
        title="Recognition & Rewards"
        description={`Thank people publicly for living our values. Points convert to rewards at ₹1 each; awards of ${HIGH_VALUE_THRESHOLD}+ points are approved by HR.`}
        actions={
          <Gated menuKey="engage.recognition" action="C">
            <Button size="sm" onClick={() => setGiveOpen(true)}>
              <HandHeart /> Give kudos
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <CardsSkeleton />
      ) : (
        <>
          <StatRow cols={4}>
            <StatTile label="My points balance" value={num(balance)} icon={Wallet} hint={`Worth ${inr(balance)} in rewards`} />
            <StatTile label="Left to give (Sep)" value={num(remaining)} icon={HandHeart} hint={`of ${num(allowance)} ${persona.reportees > 0 ? "spot-award budget" : "monthly allowance"}`} />
            <StatTile label="Kudos this month" value={num(kudos.filter((k) => k.at.startsWith("2026-09")).length)} icon={Award} hint={`${COMPANY_VALUES.length} company values`} />
            {isHr ? (
              <StatTile
                label="Rewards budget used"
                value={`${Math.round((budget.redeemed / budget.allocated) * 100)}%`}
                icon={Gift}
                hint={`${inr(budget.redeemed)} of ${inr(budget.allocated)} · ${inr(budget.pendingApproval)} pending`}
              />
            ) : (
              <StatTile label="Top recognised" value={leaders[0] ? nameOf(leaders[0].code) : "—"} icon={Trophy} hint={leaders[0] ? `${num(leaders[0].points)} points this month` : undefined} />
            )}
          </StatRow>

          <Tabs defaultValue="wall">
            <TabsList>
              <TabsTrigger value="wall">
                <Award /> Recognition wall
              </TabsTrigger>
              <TabsTrigger value="leaderboard">
                <Trophy /> Leaderboard
              </TabsTrigger>
              <TabsTrigger value="rewards">
                <Gift /> Rewards
              </TabsTrigger>
              {isHr && <TabsTrigger value="approvals">Approvals ({pending.length})</TabsTrigger>}
            </TabsList>

            <TabsContent value="wall">
              {kudos.length === 0 ? (
                <EmptyState icon={Award} title="No kudos yet" description="Be the first to recognise a colleague." />
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {kudos.map((k) => (
                    <KudosCard
                      key={k.id}
                      kudos={k}
                      cheered={cheers.includes(k.id)}
                      onCheer={() => setCheers((c) => (c.includes(k.id) ? c.filter((x) => x !== k.id) : [...c, k.id]))}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="leaderboard">
              <DataTable columns={leaderCols} data={leaders} getRowId={(r) => r.code} exportName="recognition-leaderboard" emptyIcon={Trophy} emptyTitle="No points posted this month" />
            </TabsContent>

            <TabsContent value="rewards">
              <RewardsGrid rewards={rewards} balance={balance} onRedeem={setRedeeming} />
            </TabsContent>

            {isHr && (
              <TabsContent value="approvals">
                <DataTable
                  columns={pendingCols}
                  data={pending}
                  getRowId={(k) => k.id}
                  exportName="recognition-approvals"
                  emptyIcon={Award}
                  emptyTitle="No awards waiting"
                  emptyDescription={`Awards of ${HIGH_VALUE_THRESHOLD}+ points land here for approval.`}
                />
              </TabsContent>
            )}
          </Tabs>
        </>
      )}

      <GiveKudosDialog open={giveOpen} onOpenChange={setGiveOpen} remaining={remaining} meCode={me} onGive={give} />

      <ConfirmDialog
        open={!!redeeming}
        onOpenChange={(v) => !v && setRedeeming(null)}
        title={`Redeem ${redeeming?.name ?? ""}?`}
        description={redeeming ? `${num(redeeming.points)} points will be deducted, leaving ${num(balance - redeeming.points)}. Vouchers are emailed within 24 hours and cannot be reversed.` : undefined}
        confirmLabel="Redeem"
        onConfirm={() => {
          if (!redeeming) return;
          setRedeemed((r) => r + redeeming.points);
          setRewards((rs) => rs.map((r) => (r.id === redeeming.id && r.stock !== null ? { ...r, stock: r.stock - 1 } : r)));
          setBudget((b) => ({ ...b, redeemed: b.redeemed + redeeming.points }));
          mockAction(`${redeeming.name} redeemed`, { description: `Sent to ${persona.email}.` });
        }}
      />

      <DecisionDialog
        open={!!rejecting}
        onOpenChange={(v) => !v && setRejecting(null)}
        title="Decline the points for this award?"
        description="The kudos stays on the wall; only the points are declined. The giver sees your reason."
        confirmLabel="Decline points"
        commentLabel="Reason"
        onConfirm={(note) => rejecting && decide(rejecting, false, note)}
      />
    </PageBody>
  );
}
