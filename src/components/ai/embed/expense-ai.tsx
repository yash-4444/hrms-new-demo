"use client";

import * as React from "react";
import { format, parseISO, subDays } from "date-fns";
import { Copy, Loader2, ScanLine, Sparkles, Undo2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { EXP_ALL_CLAIMS } from "@/mock/finance-expense";
import { policyFor, type ExpenseCategory } from "@/mock/workplace";
import { Button } from "@/components/ui/button";
import { AI_TONE, AiBadge, AiConfidence, AiExplainButton } from "@/components/ai";

/* ============================================================================
   Expense claim AI — receipt OCR (simulated), duplicate-receipt warning and a
   plain-words policy check. Deterministic: the same file name and employee
   always read the same receipt. Nothing is submitted by the AI — it only
   fills fields the claimant can see, edit and undo.
   ========================================================================== */

export type AiLineField = "category" | "date" | "description" | "amount";

export interface ReceiptRead {
  merchant: string;
  category: ExpenseCategory;
  date: string;
  description: string;
  amount: number;
  confidence: number;
  receipt: string;
}

interface SampleReceipt {
  merchant: string;
  category: ExpenseCategory;
  daysAgo: number;
  what: string;
  amount: number;
}

const SAMPLES: SampleReceipt[] = [
  { merchant: "Uber India", category: "Travel – Cab", daysAgo: 2, what: "Office to client site, Whitefield", amount: 642 },
  { merchant: "Truffles, Koramangala", category: "Meals", daysAgo: 3, what: "Team lunch after the sprint demo", amount: 1080 },
  { merchant: "Airtel Xstream Fiber", category: "Internet & Telecom", daysAgo: 6, what: "Home broadband — August bill", amount: 1179 },
  { merchant: "Ginger Hotel, Pune", category: "Accommodation", daysAgo: 9, what: "1 night — Hinjewadi vendor visit", amount: 4720 },
  { merchant: "Staples, MG Road", category: "Office Supplies", daysAgo: 4, what: "Whiteboard markers and notebooks", amount: 865 },
  { merchant: "Rapido Bike Taxi", category: "Travel – Cab", daysAgo: 1, what: "Metro station to office", amount: 118 },
];

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** An earlier claimed line of this employee — what a re-scanned receipt looks like. */
function earlierLine(employeeCode: string) {
  const claims = EXP_ALL_CLAIMS.filter((c) => c.employeeCode === employeeCode && c.status !== "draft");
  return claims.flatMap((c) => c.lines)[0] ?? null;
}

/**
 * "Reads" a receipt. Every third read for an employee with claim history is a
 * receipt they have already claimed, so the duplicate warning can be seen.
 */
export function readReceipt(employeeCode: string, fileName: string, attempt: number): ReceiptRead {
  const h = hash(`${employeeCode}|${fileName}|${attempt}`);
  const prior = earlierLine(employeeCode);
  if (prior && attempt % 3 === 2) {
    const merchant = prior.description.split(/[—,]/)[0].trim();
    return {
      merchant,
      category: prior.category,
      date: prior.date,
      description: prior.description,
      amount: prior.amount,
      confidence: 91,
      receipt: fileName,
    };
  }
  const s = SAMPLES[h % SAMPLES.length];
  return {
    merchant: s.merchant,
    category: s.category,
    date: format(subDays(parseISO(DEMO_TODAY), s.daysAgo), "yyyy-MM-dd"),
    description: `${s.merchant} — ${s.what}`,
    amount: s.amount,
    confidence: 86 + (h % 12),
    receipt: fileName,
  };
}

/** An existing claim line by the same employee with the same category and amount. */
export function findDuplicate(
  employeeCode: string,
  line: { category: string; amount: string | number; date: string },
  excludeClaimNo?: string,
) {
  const amount = Number(line.amount);
  if (!line.category || !(amount > 0)) return null;
  for (const c of EXP_ALL_CLAIMS) {
    if (c.employeeCode !== employeeCode || c.claimNo === excludeClaimNo || c.status === "draft") continue;
    const hit = c.lines.find((l) => l.category === line.category && l.amount === amount);
    if (hit) return { claimNo: c.claimNo, status: c.status, date: hit.date, description: hit.description, sameDate: hit.date === line.date };
  }
  return null;
}

/* --------------------------------------------------------------- UI bits */

/** Violet ring for a field the AI filled; cleared once the person edits it. */
export const aiFieldClass = (on: boolean) =>
  on ? "border-violet-400 ring-2 ring-violet-300/60 dark:border-violet-400/60 dark:ring-violet-500/30" : undefined;

export function AiFilledTag({ show, label = "AI-filled" }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <span className={cn("inline-flex w-fit items-center gap-0.5 text-[10px] font-medium", AI_TONE.text)}>
      <Sparkles className="size-2.5" aria-hidden />
      {label}
    </span>
  );
}

/** "✨ Read receipt" strip: attach a file, or try the sample receipt. */
export function ReceiptReader({
  employeeCode,
  onRead,
  onUndo,
  canUndo,
}: {
  employeeCode: string;
  onRead: (r: ReceiptRead) => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [last, setLast] = React.useState<ReceiptRead | null>(null);
  const attempt = React.useRef(0);

  const run = (fileName: string) => {
    setBusy(true);
    const n = attempt.current++;
    window.setTimeout(() => {
      const r = readReceipt(employeeCode, fileName, n);
      setBusy(false);
      setLast(r);
      onRead(r);
    }, 900);
  };

  return (
    <div className={cn("flex flex-col gap-2 rounded-md border px-3 py-2.5", AI_TONE.soft)}>
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge label="Receipt OCR" />
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Attach a receipt and AI reads the merchant, date, amount and category into a new line. Check every highlighted field.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) run(f.name);
            e.target.value = "";
          }}
        />
        <Button type="button" size="sm" className={AI_TONE.solid} disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          ✨ Read receipt
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run(`IMG_${String(2400 + attempt.current * 37).slice(0, 4)}.jpg`)}
        >
          <ScanLine aria-hidden /> Try a sample receipt
        </Button>
      </div>
      <div aria-live="polite" className="text-[11px]">
        {busy ? (
          <span className="text-muted-foreground">Reading receipt — extracting merchant, date and total…</span>
        ) : last ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <span>
              Read <span className="font-medium text-foreground">{last.receipt}</span>: {last.merchant} ·{" "}
              {fmtDate(last.date)} · <span className="tnum">{inr(last.amount)}</span>
            </span>
            <AiConfidence value={last.confidence} />
            {canUndo && (
              <button type="button" onClick={onUndo} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Undo2 className="size-3" aria-hidden /> Undo fill
              </button>
            )}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Non-blocking warning when a line repeats a receipt that is already claimed. */
export function DuplicateReceiptWarning({ dup }: { dup: NonNullable<ReturnType<typeof findDuplicate>> }) {
  return (
    <p role="status" className="mt-2 flex items-start gap-1.5 border-t border-warning/30 pt-2 text-[11px] text-warning-fg">
      <Copy className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span>
        <AiBadge label="Possible duplicate" className="mr-1 align-middle" />
        Same category and amount as a line in <strong>{dup.claimNo}</strong> ({dup.status}) dated {fmtDate(dup.date)}
        {dup.sameDate ? ", same date" : ""}: “{dup.description}”. You can still submit — finance verifies duplicates before payout.
      </span>
    </p>
  );
}

/** "Policy check" popover explaining the cap that applies and how the line compares. */
export function ExpensePolicyCheck({ category, amount }: { category: string; amount: number }) {
  const p = policyFor(category);
  if (!p || !(amount > 0)) return null;
  const excess = Math.max(0, amount - p.limit);
  const used = Math.round((amount / p.limit) * 100);
  return (
    <AiExplainButton
      label={excess > 0 ? "Policy: over cap" : "Policy: within cap"}
      title={`Policy check — ${category}`}
      summary={
        excess > 0
          ? `${inr(amount, { decimals: false })} is ${inr(excess, { decimals: false })} over the ${inr(p.limit, { decimals: false })} cap. It can still be submitted with a written exception; your approver decides.`
          : `${inr(amount, { decimals: false })} uses ${used}% of the ${inr(p.limit, { decimals: false })} cap — no exception needed.`
      }
      drivers={[
        { label: `Cap ${inr(p.limit, { decimals: false })} ${p.basis}`, detail: "Expense policy · reimbursement limits by category", weight: p.limit },
        { label: `This line ${inr(amount, { decimals: false })}`, detail: `${used}% of the cap`, weight: amount },
        ...(excess > 0
          ? [{ label: `Excess ${inr(excess, { decimals: false })}`, detail: "Routed with an exception note; not auto-rejected", weight: excess }]
          : []),
      ]}
      footnote="AI explanation of the written policy — the approver makes the decision."
    />
  );
}
