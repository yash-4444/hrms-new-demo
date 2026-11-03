import { CONSOLE_TENANTS, PLAN_META, daysFromToday, type TenantCountry } from "@/mock/console-tenants";
import { GROWTH_TREND, MRR_SCALE } from "@/mock/console-overview";
import { tenantInvoices, type InvoiceStatus } from "@/mock/console-tenant-detail";

/* ============================================================================
   Platform Console — billing across every tenant: the invoice register, the
   MRR movement behind the overview's MRR line, and the dunning queue.

   Invoices come from the same generator as each tenant's own Billing tab
   (tenantInvoices), run over the FIXTURE tenants — an invoice is a stamped
   record, so a plan change made this session must not rewrite history.
   Mid-cycle seat top-ups are the only extra rows. GST is 18% for Indian
   tenants; exports of service to US / UAE / Singapore are zero-rated.
   ========================================================================== */

export type BillingStatus = "paid" | "due" | "overdue" | "failed" | "refunded";

export interface PlatformInvoice {
  id: string;
  tenantId: string;
  tenantName: string;
  country: TenantCountry;
  period: string;
  issuedOn: string;
  dueOn: string;
  /** INR before tax. */
  amount: number;
  tax: number;
  status: BillingStatus;
  method: "Card" | "NEFT / RTGS" | "Wire transfer";
  note?: string;
}

const STATUS_MAP: Record<InvoiceStatus, BillingStatus> = { paid: "paid", failed: "failed", overdue: "overdue", open: "due", void: "refunded" };

/* Seats added mid-September, prorated for the 21 days left in the month. */
const TOP_UPS: [tenantId: string, seats: number][] = [
  ["TN-1003", 200],
  ["TN-1021", 100],
  ["TN-1036", 150],
  ["TN-1024", 50],
  ["TN-1030", 25],
];

export const PLATFORM_INVOICES: PlatformInvoice[] = (() => {
  const out: PlatformInvoice[] = [];
  for (const t of CONSOLE_TENANTS) {
    /* Enterprise pays by bank transfer — unless it is paying by card, which is what failed. */
    const method = t.plan === "enterprise" && t.payment !== "failed" ? (t.country === "IN" ? "NEFT / RTGS" : "Wire transfer") : "Card";
    for (const i of tenantInvoices(t)) {
      const status = STATUS_MAP[i.status];
      out.push({
        id: i.id,
        tenantId: t.id,
        tenantName: t.name,
        country: t.country,
        period: i.period,
        issuedOn: i.issuedOn,
        dueOn: i.dueOn,
        amount: i.amount,
        tax: i.tax,
        status,
        method,
        note: status === "refunded" ? "Pro-rata refund on closure — credit note issued." : undefined,
      });
    }
  }
  for (const [id, seats] of TOP_UPS) {
    const t = CONSOLE_TENANTS.find((x) => x.id === id);
    if (!t) continue;
    const amount = Math.round((seats * PLAN_META[t.plan].seatPrice * 21) / 30);
    out.push({
      id: `INV-2609-${id.slice(3)}-A`,
      tenantId: t.id,
      tenantName: t.name,
      country: t.country,
      period: "Sep 2026 (top-up)",
      issuedOn: "2026-09-10",
      dueOn: "2026-09-25",
      amount,
      tax: t.country === "IN" ? Math.round(amount * 0.18) : 0,
      status: "due",
      method: t.plan === "enterprise" ? (t.country === "IN" ? "NEFT / RTGS" : "Wire transfer") : "Card",
      note: `${seats} seats added on 10 Sep, prorated for 21 days.`,
    });
  }
  return out.sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || a.tenantName.localeCompare(b.tenantName));
})();

export const invoiceTotal = (i: Pick<PlatformInvoice, "amount" | "tax">) => i.amount + i.tax;

/* ---------------------------------------------------------- MRR movement */

export interface MrrMovement {
  month: string;
  new: number;
  expansion: number;
  /** Negative. */
  contraction: number;
  /** Negative. */
  churn: number;
  net: number;
  mrr: number;
}

/* Month-end MRR before the trend starts (Sep 2025). */
const OPENING_MRR = Math.round(1652000 * MRR_SCALE);

/* New, contraction and churn per month (INR); expansion is whatever closes
   the gap to the overview's month-end MRR, so the two charts always agree. */
const MOVES: [newMrr: number, contraction: number, churn: number][] = [
  [22350, -2980, 0],
  [59600, -4470, -14900],
  [14900, -2980, -3725],
  [178500, -1490, 0],
  [26820, -2980, -22350],
  [0, -1490, 0],
  [14900, -2980, 0],
  [37250, -1490, 0],
  [22350, -4470, 0],
  [37250, -2980, -14900],
  [22350, -1490, 0],
  [0, -5960, -59600],
];

export const MRR_MOVEMENT: MrrMovement[] = GROWTH_TREND.map((g, i) => {
  const prev = i === 0 ? OPENING_MRR : GROWTH_TREND[i - 1].mrr;
  const [n, contraction, churn] = MOVES[i];
  const net = g.mrr - prev;
  return { month: g.month, new: n, expansion: net - n - contraction - churn, contraction, churn, net, mrr: g.mrr };
});

/** Trailing-12-month net revenue retention, as a percentage. */
export const NET_REVENUE_RETENTION =
  ((OPENING_MRR + MRR_MOVEMENT.reduce((a, m) => a + m.expansion + m.contraction + m.churn, 0)) / OPENING_MRR) * 100;

/* ---------------------------------------------------------------- dunning */

/** Retry (card) or reminder (bank transfer) days; suspension follows on day 14. */
export const DUNNING_STEPS = [1, 3, 7] as const;
export const DUNNING_SUSPEND_DAY = 14;

export interface DunningCase {
  tenantId: string;
  invoiceId: string;
  kind: "card" | "invoice";
  /** Day 0 — the failed charge or the missed due date. */
  startedOn: string;
  reason: string;
}

export const DUNNING_CASES: DunningCase[] = [
  { tenantId: "TN-1005", invoiceId: "INV-2609-1005", kind: "card", startedOn: "2026-09-05", reason: "Card declined — issuer reports insufficient funds." },
  { tenantId: "TN-1028", invoiceId: "INV-2609-1028", kind: "invoice", startedOn: "2026-09-07", reason: "Invoice unpaid past its due date — the card on file expired in August." },
  { tenantId: "TN-1026", invoiceId: "INV-2609-1026", kind: "card", startedOn: "2026-08-12", reason: "Chargeback raised on the July invoice; card since blocked." },
  { tenantId: "TN-1009", invoiceId: "INV-2609-1009", kind: "invoice", startedOn: "2026-07-16", reason: "Two invoices unpaid; no response to reminders." },
];

/** Days since dunning started, by the console's clock. */
export const dunningDay = (c: DunningCase) => -daysFromToday(c.startedOn);
