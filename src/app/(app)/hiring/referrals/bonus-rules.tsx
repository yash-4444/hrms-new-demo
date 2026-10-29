"use client";

import { BadgeIndianRupee, CalendarClock, ShieldCheck, Wallet } from "lucide-react";

import { inr } from "@/lib/format";
import { REFERRAL_RULES, REFERRAL_TENURE_DAYS } from "@/mock/lifecycle";
import { Section } from "@/components/shell/page";
import { Badge } from "@/components/ui/primitives";
import { Timeline } from "@/components/lifecycle/kit";

/* ============================================================================
   Bonus rules — what a referral pays, when it becomes payable and how it
   reaches the referrer. The amounts here are the same table bonusFor() reads.
   ========================================================================== */

export function BonusRules() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {REFERRAL_RULES.map((r) => (
          <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{r.band}</p>
              <BadgeIndianRupee className="size-4 text-primary" aria-hidden />
            </div>
            <p className="tnum text-2xl font-semibold tracking-tight text-foreground">{inr(r.amount, { decimals: false })}</p>
            <div className="flex flex-wrap gap-1">
              {r.grades.map((g) => (
                <Badge key={g} variant="muted" className="tnum">
                  {g === "Critical" ? "Critical priority" : `Grade ${g}`}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{r.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="How a bonus becomes payable" description="Every referral walks the same path. Nothing is paid on a promise.">
          <Timeline
            items={[
              { at: "Day 0", title: "Referral submitted", detail: "Candidate consents and lands in the requisition's pipeline, tagged with your name.", tone: "done" },
              { at: "Joining day", title: "Hired and joined", detail: "The bonus amount is locked at the rule in force on the offer date.", tone: "done" },
              {
                at: `Day ${REFERRAL_TENURE_DAYS}`,
                title: `${REFERRAL_TENURE_DAYS} days of service completed`,
                detail: "Status moves from Awaiting 90 days to Awaiting HR approval automatically — no one has to remember.",
                tone: "current",
              },
              { at: "HR approval", title: "HR approves the reward", detail: "Approval assigns the next open payroll period.", tone: "upcoming" },
              { at: "Payroll", title: "Paid with salary", detail: "Shows on the payslip as Referral bonus, taxed as salary.", tone: "upcoming" },
            ]}
          />
        </Section>

        <Section title="Policy terms" description="Referral Policy v3, effective 1 April 2026.">
          <ul className="flex flex-col gap-3 text-xs">
            {[
              {
                icon: CalendarClock,
                title: `${REFERRAL_TENURE_DAYS}-day tenure`,
                body: "The hire must complete 90 calendar days of service. If they leave earlier the referral closes as Not eligible.",
              },
              {
                icon: Wallet,
                title: "Paid through payroll",
                body: "Approved bonuses are added to the next payroll run as an earning, with TDS at the referrer's slab. No separate claim is needed.",
              },
              {
                icon: ShieldCheck,
                title: "Who is not eligible",
                body: "The hiring manager for the role, recruiters, and anyone in the interview panel. Re-hires of former employees within 12 months also don't qualify.",
              },
              {
                icon: BadgeIndianRupee,
                title: "First referral wins",
                body: "If two people refer the same candidate, the earlier submission keeps the bonus. Duplicates are flagged on submit.",
              },
            ].map((t) => (
              <li key={t.title} className="flex gap-2.5">
                <t.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>
                  <span className="block font-medium text-foreground">{t.title}</span>
                  <span className="text-muted-foreground">{t.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
