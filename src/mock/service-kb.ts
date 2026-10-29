import { TICKETS } from "./workplace";

/* ============================================================================
   SERVICE · KNOWLEDGE BASE — employee-facing how-to articles. Each one is
   grounded in a policy document from the AI knowledge index (KB_DOCUMENTS in
   ai.ts), and its "deflected" count is tickets closed by Copilot or a portal
   search without reaching an agent.
   ========================================================================== */

export type KbArticleCategory = "Leave" | "Payroll" | "Tax" | "Benefits" | "IT" | "Travel";
export const KB_ARTICLE_CATEGORIES: KbArticleCategory[] = ["Leave", "Payroll", "Tax", "Benefits", "IT", "Travel"];

export interface KbVersion {
  version: string;
  date: string;
  author: string;
  note: string;
}

export interface KbArticle {
  id: string;
  title: string;
  category: KbArticleCategory;
  status: "published" | "draft";
  author: string;
  updatedOn: string;
  views: number;
  helpfulYes: number;
  helpfulNo: number;
  deflected: number;
  /** Policy document in the AI index the article is grounded in. */
  sourceDocId: string;
  summary: string;
  steps: string[];
  versions: KbVersion[];
  search: string;
}

const art = (
  id: string, title: string, category: KbArticleCategory, status: KbArticle["status"], author: string, updatedOn: string,
  views: number, yes: number, no: number, deflected: number, sourceDocId: string, summary: string, steps: string[],
  versions: KbVersion[],
): KbArticle => ({
  id, title, category, status, author, updatedOn, views, helpfulYes: yes, helpfulNo: no, deflected, sourceDocId, summary, steps, versions,
  search: `${id} ${title} ${category} ${summary}`.toLowerCase(),
});

const v = (version: string, date: string, author: string, note: string): KbVersion => ({ version, date, author, note });

export const KB_ARTICLES: KbArticle[] = [
  art("KB-1001", "How earned leave accrues and carries forward", "Leave", "published", "Ishita Kulkarni", "2026-08-12", 2184, 412, 21, 96, "kb-leave",
    "Earned Leave accrues at 1.75 days per completed month, up to 21 days a year; unused days carry forward to a cap of 45.",
    ["Open Leave › My balance to see the accrual ledger.", "Accrual posts on the 1st of each month for the month just completed.", "At 31 March, balance above 45 days lapses; you are notified 30 days before."],
    [v("v3", "2026-08-12", "Ishita Kulkarni", "Added the lapse notification"), v("v2", "2026-04-01", "Priya Menon", "Aligned to Leave Policy v4.2"), v("v1", "2025-06-10", "Priya Menon", "First published")]),
  art("KB-1002", "Applying for leave on behalf of a sick team member", "Leave", "published", "Priya Menon", "2026-07-02", 642, 118, 9, 31, "kb-leave",
    "Managers can raise Sick Leave for a reportee who cannot log in; a medical certificate is needed beyond 2 days.",
    ["Go to Leave › Team and choose the reportee.", "Pick Sick Leave and the dates; attach the certificate if over 2 days.", "The reportee is notified and can withdraw within 7 days."],
    [v("v2", "2026-07-02", "Priya Menon", "Clarified certificate rule"), v("v1", "2025-11-18", "Priya Menon", "First published")]),
  art("KB-1003", "Reading your payslip line by line", "Payroll", "published", "Rahul Desai", "2026-06-28", 3105, 590, 44, 142, "kb-gratuity",
    "What each earning, deduction and employer contribution on the payslip means, including PF at 12% of basic.",
    ["Open My Payslips and pick a month.", "Earnings: basic, HRA, special allowance, reimbursements.", "Deductions: employee PF, professional tax, TDS.", "Employer PF is shown for information — it is part of CTC, not take-home."],
    [v("v4", "2026-06-28", "Rahul Desai", "New layout for FY27 payslip"), v("v3", "2026-04-02", "Rahul Desai", "PF wage ceiling note")]),
  art("KB-1004", "When will my reimbursement be paid?", "Payroll", "published", "Rahul Desai", "2026-09-02", 1422, 260, 31, 88, "kb-travel",
    "Approved claims are paid with the next payroll run; claims must be filed within 30 days of the expense.",
    ["Check the claim is Approved under Expenses.", "Claims approved by the 22nd are paid the same month.", "Later approvals roll into the next month's run."],
    [v("v2", "2026-09-02", "Rahul Desai", "Cut-off moved to the 22nd"), v("v1", "2026-02-14", "Rahul Desai", "First published")]),
  art("KB-1005", "Choosing between the old and new tax regime", "Tax", "published", "Rahul Desai", "2026-04-08", 2760, 480, 62, 121, "kb-handbook",
    "How to compare regimes in the HRMS calculator before declaring, and when you can switch.",
    ["Open My Tax › Regime comparison.", "Enter planned 80C, 80D and HRA figures.", "Declare by 30 April; you can switch once at the time of filing your return."],
    [v("v3", "2026-04-08", "Rahul Desai", "FY27 slabs"), v("v2", "2025-04-04", "Rahul Desai", "FY26 slabs")]),
  art("KB-1006", "Submitting investment proofs", "Tax", "draft", "Ishita Kulkarni", "2026-09-14", 0, 0, 0, 0, "kb-handbook",
    "Proof submission window, accepted documents and what happens to unverified declarations.",
    ["Proof window opens 5 January and closes 31 January.", "Upload one PDF per investment; rent receipts need the landlord PAN above ₹1 lakh a year.", "Unverified amounts are reversed in the February run."],
    [v("v1", "2026-09-14", "Ishita Kulkarni", "Draft for review")]),
  art("KB-1007", "Adding parents to group health insurance", "Benefits", "published", "Ishita Kulkarni", "2026-05-20", 1288, 233, 18, 64, "kb-handbook",
    "Parents can be added during enrolment or within 30 days of a life event; the premium is shared.",
    ["Open My Benefits › Insurance.", "Add dependants with date of birth.", "The parental top-up premium is deducted monthly from salary."],
    [v("v2", "2026-05-20", "Ishita Kulkarni", "FY27 premium table"), v("v1", "2025-05-12", "Priya Menon", "First published")]),
  art("KB-1008", "Gratuity eligibility explained", "Benefits", "published", "Priya Menon", "2026-03-11", 846, 151, 12, 37, "kb-gratuity",
    "Gratuity is payable after 5 years of continuous service at 15 days' last drawn basic per year.",
    ["Your years of service are shown on My Profile.", "The estimate in My Benefits is indicative; the final figure is calculated at exit."],
    [v("v1", "2026-03-11", "Priya Menon", "First published")]),
  art("KB-1009", "Fixing VPN drops on office Wi-Fi", "IT", "published", "Girish Gowda", "2026-09-10", 1934, 344, 40, 117, "kb-it",
    "Reinstall the VPN profile from Company Portal; if drops continue on the corporate SSID, raise a Network ticket.",
    ["Open Company Portal and remove the Stellar VPN profile.", "Restart and reinstall the profile.", "If drops recur every ~20 minutes, raise a ticket under Network & VPN."],
    [v("v2", "2026-09-10", "Girish Gowda", "Added the 20-minute IKE symptom"), v("v1", "2026-02-02", "Girish Gowda", "First published")]),
  art("KB-1010", "Requesting software that is not in the catalogue", "IT", "published", "Girish Gowda", "2026-07-21", 708, 131, 15, 42, "kb-it",
    "Only catalogue software can be installed; anything else needs a request with business justification.",
    ["Search the Software Catalogue in Company Portal first.", "If missing, raise Asset Requests › Software with justification.", "Security reviews within 3 working days."],
    [v("v1", "2026-07-21", "Girish Gowda", "First published")]),
  art("KB-1011", "Returning your laptop on your last day", "IT", "published", "Girish Gowda", "2026-06-05", 512, 96, 4, 23, "kb-it",
    "Company devices are returned on the last working day; the clearance task closes automatically on scan.",
    ["Back up personal files — the device is wiped.", "Hand it to the IT store; the asset tag is scanned.", "Your exit clearance updates within the hour."],
    [v("v1", "2026-06-05", "Girish Gowda", "First published")]),
  art("KB-1012", "Hotel limits by city", "Travel", "published", "Ishita Kulkarni", "2026-08-01", 1650, 298, 26, 79, "kb-travel",
    "Hotel stays are reimbursed up to ₹6,500 a night in metros and ₹4,500 elsewhere.",
    ["Book through the travel desk where possible.", "Excess over the limit is flagged to your approver.", "Attach the itemised invoice, not a card slip."],
    [v("v2", "2026-08-01", "Ishita Kulkarni", "Limits updated"), v("v1", "2025-08-20", "Priya Menon", "First published")]),
  art("KB-1013", "Per diem and meal claims on travel", "Travel", "published", "Ishita Kulkarni", "2026-08-01", 984, 170, 22, 45, "kb-travel",
    "Meals are reimbursed at actuals up to ₹1,200 per day per person while travelling.",
    ["Claim meals as one line per day.", "Alcohol is never reimbursable.", "Team meals need the attendee list."],
    [v("v1", "2026-08-01", "Ishita Kulkarni", "First published")]),
];

export const KB_ARTICLE_TOTALS = {
  published: KB_ARTICLES.filter((a) => a.status === "published").length,
  drafts: KB_ARTICLES.filter((a) => a.status === "draft").length,
  views: KB_ARTICLES.reduce((s, a) => s + a.views, 0),
  deflected: KB_ARTICLES.reduce((s, a) => s + a.deflected, 0),
  helpfulPct:
    (KB_ARTICLES.reduce((s, a) => s + a.helpfulYes, 0) /
      Math.max(1, KB_ARTICLES.reduce((s, a) => s + a.helpfulYes + a.helpfulNo, 0))) *
    100,
};

/** The resolved IT tickets the AI clusters into a new article draft. */
export const KB_DRAFT_SOURCE_TICKETS = TICKETS.filter((t) => t.category === "IT" && t.status === "resolved").map((t) => t.id);

export const KB_AI_DRAFT = {
  title: "Laptop and network issues the service desk resolves most often",
  category: "IT" as KbArticleCategory,
  summary: `Drafted from ${KB_DRAFT_SOURCE_TICKETS.length} resolved IT tickets with the same fix pattern. Covers self-service steps that closed those tickets without an engineer visit.`,
  steps: [
    "Restart and check for pending updates in Company Portal before raising a ticket.",
    "For VPN drops, remove and reinstall the Stellar VPN profile.",
    "For a slow laptop, run Company Portal › Device health; it clears the cache and checks the disk.",
    "If the issue persists, raise a ticket — include the asset tag printed under the laptop.",
  ],
};
