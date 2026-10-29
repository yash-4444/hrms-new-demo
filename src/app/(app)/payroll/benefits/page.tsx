"use client";

import * as React from "react";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarClock, ClipboardCheck, FileCheck2, Gift, TriangleAlert } from "lucide-react";
import { fmtDate, fmtIso, inr, inrCompact, num } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import {
  FBP_COMPONENTS,
  FBP_DECLARATIONS,
  FBP_PROOFS,
  FBP_WINDOW,
  type FbpDeclaration,
  type FbpProof,
} from "@/mock/finance-loans";
import { mockAction } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge, Progress, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { DeclarationsTab } from "./declarations";
import { payableOf, ProofsTab } from "./proofs";

/* ============================================================================
   /payroll/benefits — flexible benefit plan: window, components, declarations
   against limits, and the proof verification queue.
   ========================================================================== */

export default function BenefitsPage() {
  const loading = useFakeLoad();
  const [declarations, setDeclarations] = React.useState<FbpDeclaration[]>(FBP_DECLARATIONS);
  const [proofs, setProofs] = React.useState<FbpProof[]>(FBP_PROOFS);
  const [closesOn, setClosesOn] = React.useState(FBP_WINDOW.closesOn);
  const [extendOpen, setExtendOpen] = React.useState(false);
  const [tab, setTab] = React.useState("proofs");

  const daysLeft = differenceInCalendarDays(parseISO(closesOn), parseISO(DEMO_TODAY));
  const extendedTo = fmtIso(addDays(parseISO(closesOn), 7));
  const done = declarations.filter((d) => d.status === "submitted" || d.status === "approved").length;
  const flagged = declarations.filter((d) => d.overLimit.length || d.overBasket).length;
  const pending = proofs.filter((p) => p.status === "pending");
  const verifiedPayable = proofs.filter((p) => p.status === "verified").reduce((s, p) => s + payableOf(p), 0);

  const verify = (ids: string[]) => {
    const set = new Set(ids);
    setProofs((ps) =>
      ps.map((p) => (set.has(p.id) ? { ...p, status: "verified", note: "Bill matches the declared component and limit." } : p)),
    );
    const amount = proofs.filter((p) => set.has(p.id)).reduce((s, p) => s + payableOf(p), 0);
    mockAction(`Verified ${ids.length} proof${ids.length === 1 ? "" : "s"}`, {
      description: `${inr(amount, { decimals: false })} released tax-free in the October 2026 run.`,
    });
  };

  const reject = (id: string, reason: string) => {
    setProofs((ps) => ps.map((p) => (p.id === id ? { ...p, status: "rejected", note: reason } : p)));
    mockAction(`${id} rejected`, { description: reason, tone: "warning" });
  };

  const approveDeclarations = (codes: string[]) => {
    const set = new Set(codes);
    setDeclarations((ds) => ds.map((d) => (set.has(d.employeeCode) ? { ...d, status: "approved" } : d)));
    mockAction(`Approved ${codes.length} declaration${codes.length === 1 ? "" : "s"}`, {
      description: "The declared split replaces Special Allowance from the October 2026 run.",
    });
  };

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Flexible benefits" description="Loading the FBP plan…" />
        <TableSkeleton />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Flexible benefits"
        description={`${FBP_WINDOW.fy} FBP. Employees restructure part of Special Allowance into tax-free components, then claim them against bills. Whatever is not declared, or not proven, stays taxable.`}
        actions={
          <Gated menuKey="payroll.benefits" action="E">
            <Button variant="outline" size="sm" onClick={() => setExtendOpen(true)}>
              <CalendarClock /> Extend window
            </Button>
          </Gated>
        }
      />

      <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Declaration window</p>
          <p className="mt-0.5 text-sm font-semibold">
            {fmtDate(FBP_WINDOW.opensOn)} – {fmtDate(closesOn)}{" "}
            <Badge variant={daysLeft >= 0 ? "soft" : "muted"} className="ml-1 align-middle">
              {daysLeft >= 0 ? `Open · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "Closed"}
            </Badge>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Bills for the year must be uploaded by {fmtDate(FBP_WINDOW.proofsDueOn)}; unproven amounts are taxed in the
            February and March runs.
          </p>
        </div>
        <div className="ml-auto w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">Declarations submitted</span>
            <span className="tnum font-medium">
              {num(done)} / {num(declarations.length)}
            </span>
          </div>
          <Progress value={(done / Math.max(1, declarations.length)) * 100} aria-label="Declarations submitted" />
        </div>
      </Card>

      <StatRow cols={4}>
        <StatTile label="Eligible employees" value={num(declarations.length)} icon={Gift} hint="G2 and above on the India payroll" />
        <StatTile
          label="Over a limit"
          value={num(flagged)}
          icon={TriangleAlert}
          tone={flagged ? "warning" : "neutral"}
          hint="Declared above a component limit or the basket"
          onClick={() => setTab("declarations")}
        />
        <StatTile label="Proofs to verify" value={num(pending.length)} icon={FileCheck2} tone="accent" onClick={() => setTab("proofs")} />
        <StatTile label="Verified, payable" value={inrCompact(verifiedPayable)} icon={ClipboardCheck} hint="Tax-free in the next run" />
      </StatRow>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="proofs">Proof verification ({num(pending.length)})</TabsTrigger>
          <TabsTrigger value="declarations">Declarations</TabsTrigger>
          <TabsTrigger value="plan">Plan components</TabsTrigger>
        </TabsList>
        <TabsContent value="proofs" className="mt-3">
          <ProofsTab rows={proofs} onVerify={verify} onReject={reject} />
        </TabsContent>
        <TabsContent value="declarations" className="mt-3">
          <DeclarationsTab rows={declarations} onApprove={approveDeclarations} />
        </TabsContent>
        <TabsContent value="plan" className="mt-3">
          <Section
            title="Plan components"
            description={`Annual limits for ${FBP_WINDOW.fy}. The basket is half of annual Special Allowance, capped at the sum of these limits.`}
            bodyClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {FBP_COMPONENTS.map((c) => {
              const declared = declarations.reduce((s, d) => s + d.lines[c.id], 0);
              const takers = declarations.filter((d) => d.lines[c.id] > 0).length;
              return (
                <div key={c.id} className="flex flex-col gap-1.5 rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{c.name}</h3>
                    <span className="tnum text-sm font-semibold">{inr(c.annualLimit, { decimals: false })}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {c.monthlyLimit ? `${inr(c.monthlyLimit, { decimals: false })} a month · ` : "Per journey · "}
                    {num(takers)} declared · {inrCompact(declared)} total
                  </p>
                  <p className="text-xs">{c.rule}</p>
                  <p className="text-[11px] text-muted-foreground">Proof: {c.proof}</p>
                </div>
              );
            })}
          </Section>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={extendOpen}
        onOpenChange={setExtendOpen}
        title="Extend the declaration window by 7 days?"
        description={`The window will close on ${fmtDate(extendedTo)} instead of ${fmtDate(closesOn)}. Employees who have not declared get a reminder.`}
        confirmLabel="Extend window"
        onConfirm={() => {
          setClosesOn(extendedTo);
          mockAction("Declaration window extended", { description: `Now closes on ${fmtDate(extendedTo)}. Reminders queued.` });
        }}
      />
    </PageBody>
  );
}
