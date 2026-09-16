"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";
import { Alert } from "@/components/ui/primitives";
import type { CtcComponent } from "@/mock/hiring";

/* ============================================================================
   CTC breakup preview.

   The one table in the hiring module where a wrong number is fatal: the annual
   amounts must add up to the offered CTC to the rupee. The component proves it
   rather than asserting it — the total row is computed from the rows above,
   and a mismatch renders as a loud reconciliation error instead of quietly
   rounding away.
   ========================================================================== */

const GROUP_ORDER: CtcComponent["group"][] = ["Fixed", "Retirals", "Variable"];

const GROUP_CAPTION: Record<CtcComponent["group"], string> = {
  Fixed: "Paid every month, regardless of performance",
  Retirals: "Statutory and long-term components — not part of take-home",
  Variable: "Paid against the annual performance review",
};

export function CtcBreakup({
  breakup,
  ctc,
  joiningBonus = 0,
  className,
}: {
  breakup: CtcComponent[];
  ctc: number;
  joiningBonus?: number;
  className?: string;
}) {
  const computedTotal = React.useMemo(
    () => breakup.reduce((a, c) => a + c.annual, 0),
    [breakup],
  );
  const reconciles = computedTotal === ctc;

  const groups = GROUP_ORDER.map((group) => ({
    group,
    rows: breakup.filter((c) => c.group === group),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!reconciles && (
        <Alert tone="danger" icon={TriangleAlert} title="Breakup does not reconcile">
          Components add up to {inr(computedTotal)} against an offered CTC of {inr(ctc)} — a
          difference of {inr(Math.abs(ctc - computedTotal))}. This offer cannot be released.
        </Alert>
      )}

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-xs">
          <caption className="sr-only">
            Annual cost-to-company breakup by component
          </caption>
          <thead className="bg-subtle">
            <tr className="border-b border-border">
              <th scope="col" className="px-2.5 py-1.5 text-left font-medium text-muted-foreground">
                Component
              </th>
              <th
                scope="col"
                data-numeric=""
                className="px-2.5 py-1.5 text-right font-medium text-muted-foreground"
              >
                Monthly
              </th>
              <th
                scope="col"
                data-numeric=""
                className="px-2.5 py-1.5 text-right font-medium text-muted-foreground"
              >
                Annual
              </th>
            </tr>
          </thead>

          {groups.map(({ group, rows }) => {
            const subtotal = rows.reduce((a, c) => a + c.annual, 0);
            return (
              <tbody key={group} className="border-b border-border last:border-0">
                <tr className="bg-muted/40">
                  <th
                    scope="colgroup"
                    colSpan={3}
                    className="px-2.5 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {group}
                    <span className="ml-1.5 font-normal normal-case tracking-normal opacity-80">
                      {GROUP_CAPTION[group]}
                    </span>
                  </th>
                </tr>
                {rows.map((c) => (
                  <tr key={c.label} className="border-t border-border/60">
                    <td className="px-2.5 py-1.5 align-top">
                      <span className="font-medium text-foreground">{c.label}</span>
                      {c.note && (
                        <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                          {c.note}
                        </span>
                      )}
                    </td>
                    <td className="tnum px-2.5 py-1.5 text-right align-top text-muted-foreground">
                      {inr(c.monthly, { decimals: false })}
                    </td>
                    <td className="tnum px-2.5 py-1.5 text-right align-top font-medium text-foreground">
                      {inr(c.annual, { decimals: false })}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-subtle/60">
                  <td className="px-2.5 py-1 text-right text-muted-foreground">
                    {group} subtotal
                  </td>
                  <td className="tnum px-2.5 py-1 text-right text-muted-foreground">
                    {inr(Math.round(subtotal / 12), { decimals: false })}
                  </td>
                  <td className="tnum px-2.5 py-1 text-right font-medium text-foreground">
                    {inr(subtotal, { decimals: false })}
                  </td>
                </tr>
              </tbody>
            );
          })}

          <tfoot>
            <tr className="border-t-2 border-border bg-primary-soft/40">
              <th scope="row" className="px-2.5 py-2 text-left text-sm font-semibold text-foreground">
                Annual CTC
              </th>
              <td className="tnum px-2.5 py-2 text-right text-xs text-muted-foreground">
                {inr(Math.round(computedTotal / 12), { decimals: false })} / month
              </td>
              <td
                className={cn(
                  "tnum px-2.5 py-2 text-right text-sm font-semibold",
                  reconciles ? "text-foreground" : "text-destructive-fg",
                )}
              >
                {inr(computedTotal, { decimals: false })}
              </td>
            </tr>
            {joiningBonus > 0 && (
              <tr className="border-t border-border">
                <th scope="row" className="px-2.5 py-1.5 text-left font-medium text-foreground">
                  Joining bonus
                  <span className="mt-0.5 block text-[11px] font-normal leading-tight text-muted-foreground">
                    One-time, paid with the first salary — outside CTC and recoverable if the
                    candidate leaves within 12 months
                  </span>
                </th>
                <td className="tnum px-2.5 py-1.5 text-right text-muted-foreground">—</td>
                <td className="tnum px-2.5 py-1.5 text-right font-medium text-foreground">
                  {inr(joiningBonus, { decimals: false })}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {reconciles ? (
          <>
            Components reconcile exactly to the offered CTC of{" "}
            <span className="tnum font-medium text-foreground">
              {inr(ctc, { decimals: false })}
            </span>
            . Special allowance is the balancing component — it absorbs the rounding on every
            other line. Employer PF is capped at the statutory ₹1,800 per month; gratuity is a
            provision and is payable only after five years of continuous service.
          </>
        ) : (
          <>Recompute the structure before this offer leaves the building.</>
        )}
      </p>
    </div>
  );
}
