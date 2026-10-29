/* ==========================================================================
   Engagement · recognition & rewards, and the idea box.
   ========================================================================== */

import { EMPLOYEES } from "./employees";

/* --------------------------------------------------------- recognition */

export interface CompanyValue {
  id: string;
  name: string;
  blurb: string;
}

export const COMPANY_VALUES: CompanyValue[] = [
  { id: "customer", name: "Customer obsessed", blurb: "Start with the customer's payday, work backwards." },
  { id: "ownership", name: "Own it end to end", blurb: "From the ticket to the runbook to the customer note." },
  { id: "craft", name: "Raise the bar", blurb: "Leave the code, the doc or the process better than you found it." },
  { id: "together", name: "Win together", blurb: "Credit generously, help without being asked." },
  { id: "candour", name: "Candour with care", blurb: "Say the hard thing, kindly and early." },
];

export interface Kudos {
  id: string;
  fromCode: string;
  toCodes: string[];
  valueId: string;
  points: number;
  message: string;
  at: string;
  /** Awards above the threshold need HR approval before points post. */
  status: "posted" | "pending_approval" | "rejected";
  reactions: number;
}

/** Awards at or above this many points route to HR for approval. */
export const HIGH_VALUE_THRESHOLD = 500;
export const POINT_VALUE_INR = 1; // 1 point = ₹1 at redemption

export const KUDOS: Kudos[] = [
  { id: "KD-241", fromCode: "STL-0031", toCodes: ["STL-0142", "STL-0143"], valueId: "ownership", points: 200, message: "Idempotent bank-file retries shipped with zero duplicate payouts across three pay runs. That is what owning it end to end looks like.", at: "2026-09-15T11:20:00", status: "posted", reactions: 34 },
  { id: "KD-240", fromCode: "STL-0005", toCodes: [EMPLOYEES.find((e) => e.departmentId === "SAL" && e.level === 3)?.code ?? "STL-0013"], valueId: "customer", points: 750, message: "Closed the Acme Logistics expansion — 2,400 seats — while keeping implementation honest about timelines.", at: "2026-09-14T17:05:00", status: "pending_approval", reactions: 12 },
  { id: "KD-239", fromCode: "STL-0142", toCodes: ["STL-0148"], valueId: "together", points: 100, message: "Nandini picked up my on-call shift during the family emergency without a second thought.", at: "2026-09-13T09:40:00", status: "posted", reactions: 41 },
  { id: "KD-238", fromCode: "STL-0009", toCodes: ["STL-0058"], valueId: "customer", points: 300, message: "Turned the Pune walk-in drive around in a weekend — 14 offers, two angry candidates now joining.", at: "2026-09-12T15:30:00", status: "posted", reactions: 27 },
  { id: "KD-237", fromCode: "STL-0008", toCodes: ["STL-0017"], valueId: "craft", points: 1000, message: "Rahul rebuilt the PF reconciliation so the August ECR filed in one pass, two days early. Audit-ready by design.", at: "2026-09-11T12:00:00", status: "pending_approval", reactions: 19 },
  { id: "KD-236", fromCode: "STL-0145", toCodes: ["STL-0147"], valueId: "candour", points: 50, message: "Thanks for calling out the risk in the migration plan in front of everyone. We avoided a bad weekend.", at: "2026-09-10T10:15:00", status: "posted", reactions: 15 },
  { id: "KD-235", fromCode: "STL-0011", toCodes: ["STL-0006"], valueId: "together", points: 150, message: "Aditi gave design a seat at the roadmap table from day one of planning.", at: "2026-09-08T18:45:00", status: "posted", reactions: 22 },
  { id: "KD-234", fromCode: "STL-0010", toCodes: ["STL-0296"], valueId: "craft", points: 200, message: "Audit trail export now reconciles to the last row. Our ISO auditor noticed.", at: "2026-09-05T11:10:00", status: "posted", reactions: 9 },
];

export interface Reward {
  id: string;
  name: string;
  brand: string;
  points: number;
  category: "Voucher" | "Experience" | "Charity" | "Merchandise";
  stock: number | null;
}

export const REWARDS: Reward[] = [
  { id: "RW-01", name: "Amazon Pay gift card ₹500", brand: "Amazon", points: 500, category: "Voucher", stock: null },
  { id: "RW-02", name: "Swiggy voucher ₹1,000", brand: "Swiggy", points: 1000, category: "Voucher", stock: null },
  { id: "RW-03", name: "BookMyShow — 2 movie tickets", brand: "BookMyShow", points: 800, category: "Experience", stock: 40 },
  { id: "RW-04", name: "Myntra voucher ₹2,000", brand: "Myntra", points: 2000, category: "Voucher", stock: null },
  { id: "RW-05", name: "Plant 10 trees with SankalpTaru", brand: "SankalpTaru", points: 400, category: "Charity", stock: null },
  { id: "RW-06", name: "Stellar hoodie", brand: "Stellar store", points: 1200, category: "Merchandise", stock: 18 },
  { id: "RW-07", name: "Weekend stay voucher ₹5,000", brand: "Taj Experiences", points: 5000, category: "Experience", stock: 6 },
  { id: "RW-08", name: "Donate a school kit via Akshaya Patra", brand: "Akshaya Patra", points: 300, category: "Charity", stock: null },
];

/** Points balances — earned from posted kudos plus a seeded opening balance. */
export const OPENING_POINTS: Record<string, number> = {
  "STL-0142": 1240,
  "STL-0143": 980,
  "STL-0031": 1650,
  "STL-0009": 2100,
  "STL-0058": 1430,
  "STL-0017": 760,
  "STL-0001": 3000,
  "STL-0005": 1890,
};

/** Monthly peer-to-peer allowance each employee can GIVE. */
export const MONTHLY_GIVE_ALLOWANCE = 500;

export const RECOGNITION_BUDGET = { fy: "FY 2026-27", allocated: 1200000, redeemed: 418600, pendingApproval: 1750 };

/* ------------------------------------------------------------- idea box */

export type IdeaStatus = "new" | "under_review" | "accepted" | "implemented" | "declined";
export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  new: "New",
  under_review: "Under review",
  accepted: "Accepted",
  implemented: "Implemented",
  declined: "Declined",
};

export interface Idea {
  id: string;
  authorCode: string;
  title: string;
  body: string;
  category: "Workplace" | "Product" | "Process" | "Wellbeing" | "Cost saving";
  status: IdeaStatus;
  votes: number;
  comments: { authorCode: string; text: string; at: string }[];
  submittedOn: string;
  /** HR's note when the status changed. */
  decisionNote: string | null;
}

export const IDEAS: Idea[] = [
  { id: "IDEA-087", authorCode: "STL-0144", title: "Shuttle from Whitefield metro on release weeks", body: "Release weeks run late. A 9 pm shuttle to Whitefield metro would cut the cab spend and keep people safe.", category: "Wellbeing", status: "under_review", votes: 142, submittedOn: "2026-09-04", decisionNote: null,
    comments: [{ authorCode: "STL-0010", text: "Facilities is pricing two vendors.", at: "2026-09-09T10:00:00" }] },
  { id: "IDEA-086", authorCode: "STL-0142", title: "Payslip explainer in plain language", body: "A one-paragraph 'why did my net pay change' note on every payslip would cut payroll tickets in half after each increment.", category: "Product", status: "accepted", votes: 118, submittedOn: "2026-08-28", decisionNote: "Accepted into the Q4 roadmap — Payroll Core will build it with the AI team.",
    comments: [{ authorCode: "STL-0017", text: "Yes please. August had 212 'why is my pay different' tickets.", at: "2026-08-29T09:30:00" }] },
  { id: "IDEA-085", authorCode: "STL-0058", title: "Interview-free Fridays", body: "Block Friday afternoons from interview scheduling so panellists get uninterrupted focus time.", category: "Process", status: "implemented", votes: 96, submittedOn: "2026-07-15", decisionNote: "Live since 1 Sep — the scheduler now skips Friday after 2 pm.", comments: [] },
  { id: "IDEA-084", authorCode: "STL-0149", title: "Annual hardware refresh lottery", body: "Instead of a fixed 4-year cycle, let people opt in to a lottery for new laptops when stock is available.", category: "Workplace", status: "declined", votes: 31, submittedOn: "2026-07-02", decisionNote: "Declined — asset depreciation and warranty terms make a fixed cycle cheaper. Battery replacements are now on request.", comments: [] },
  { id: "IDEA-083", authorCode: "STL-0146", title: "Switch idle staging clusters off at night", body: "Staging runs 24×7. Scaling to zero from 10 pm to 7 am saves an estimated ₹3.1 L a month.", category: "Cost saving", status: "under_review", votes: 88, submittedOn: "2026-08-19", decisionNote: null, comments: [] },
  { id: "IDEA-082", authorCode: "STL-0007", title: "Customer shadow day for every new joiner", body: "Every joiner spends one day in their first month on customer calls with Customer Success.", category: "Process", status: "new", votes: 54, submittedOn: "2026-09-12", decisionNote: null, comments: [] },
  { id: "IDEA-081", authorCode: "STL-0148", title: "Quiet room on floor 3", body: "Convert the small meeting room next to the pantry into a no-calls quiet room.", category: "Workplace", status: "new", votes: 23, submittedOn: "2026-09-14", decisionNote: null, comments: [] },
];
