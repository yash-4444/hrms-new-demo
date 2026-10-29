"use client";

import { fmtDate, inr } from "@/lib/format";
import type { ExpDuplicateFlag } from "@/mock/finance-expense";
import { Badge } from "@/components/ui/primitives";
import { AiSuggestionCard } from "@/components/ai";

/* ============================================================================
   AI duplicate-receipt detection. Each card explains which signals matched;
   Accept puts the claim on hold, Edit opens the receipts to compare, Dismiss
   clears the flag for this reviewer.
   ========================================================================== */

export function DuplicatePanel({
  flags,
  canAct,
  onHold,
  onReview,
  onDismiss,
}: {
  flags: ExpDuplicateFlag[];
  canAct: boolean;
  onHold: (flag: ExpDuplicateFlag) => void;
  onReview: (flag: ExpDuplicateFlag) => void;
  onDismiss: (flag: ExpDuplicateFlag) => void;
}) {
  if (!flags.length) return null;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {flags.map((f) => (
        <AiSuggestionCard
          key={f.claimNo}
          title={`${f.claimNo}: possible duplicate of ${f.duplicateOf}`}
          confidence={f.confidence}
          acceptLabel="Hold claim"
          onAccept={canAct ? () => onHold(f) : undefined}
          onEdit={() => onReview(f)}
          onDismiss={canAct ? () => onDismiss(f) : undefined}
          body={
            <div className="flex flex-col gap-1.5">
              <p>
                The {f.category} line of {inr(f.amount, { decimals: false })} dated {fmtDate(f.date)} matches a line on{" "}
                <span className="font-medium">{f.duplicateOf}</span> dated {fmtDate(f.originalDate)}, which is already{" "}
                {f.originalStatus}. Paying both would reimburse the same bill twice.
              </p>
              <div className="flex flex-wrap gap-1">
                {f.signals.map((s) => (
                  <Badge key={s} variant="muted">
                    {s}
                  </Badge>
                ))}
              </div>
              {!canAct && (
                <p className="text-[11px] text-muted-foreground">
                  View only — holding a claim needs Finance Review edit rights.
                </p>
              )}
            </div>
          }
        />
      ))}
    </div>
  );
}
