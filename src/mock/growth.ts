import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { mulberry32, pick, randInt, round2 } from "@/lib/utils";
import { DEMO_TODAY } from "./org";
import { EMPLOYEES, VIKRAM_TEAM_CODES, employeeByCode } from "./employees";

/* ============================================================================
   GROWTH fixtures — goals, review cycles, review forms, 9-box calibration
   and learning (catalog, enrolments, compliance training).

   Everything is derived from a fixed seed and from DEMO_TODAY, never from the
   wall clock, so the server render and the client render agree byte for byte.

   Reconciliation guarantees the demo depends on:
     • every goal owner's weightage sums to exactly 100 (see GOAL_WEIGHT_CHECK)
     • a goal's progress is the mean of its key-result progress
     • a goal's status is derived from progress vs. elapsed time, never typed in
     • the 9-box target percentages sum to 100 and the cohort is exactly 45
     • the rating distribution is computed from the 9-box placement, so dragging
       a chip moves both the grid count and the histogram together
   ========================================================================== */

const TODAY = parseISO(DEMO_TODAY);
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/* ========================================================================== */
/*                                   GOALS                                    */
/* ========================================================================== */

export type GoalCategory = "Business" | "Customer" | "People" | "Craft";
export type GoalStatus = "on_track" | "at_risk" | "off_track" | "achieved";

export const GOAL_CATEGORIES: GoalCategory[] = ["Business", "Customer", "People", "Craft"];

export const GOAL_CATEGORY_BLURB: Record<GoalCategory, string> = {
  Business: "Revenue, margin and delivery commitments",
  Customer: "Retention, satisfaction and escalation load",
  People: "Hiring, growth, mentorship and retention",
  Craft: "Quality, reliability and engineering excellence",
};

export interface KeyResult {
  id: string;
  title: string;
  /** 0–100 */
  progress: number;
  dueDate: string;
}

export interface GoalCascade {
  parentGoalId: string;
  parentGoalTitle: string;
  parentOwnerCode: string;
  parentOwnerName: string;
}

export interface Goal {
  id: string;
  ownerCode: string;
  title: string;
  description: string;
  category: GoalCategory;
  /** Percentage of the owner's total goal weight. Sums to 100 per owner. */
  weightage: number;
  /** 0–100, the mean of the key-result progress. */
  progress: number;
  startDate: string;
  targetDate: string;
  status: GoalStatus;
  keyResults: KeyResult[];
  /** Which parent goal this one rolls up to — null for a standalone goal. */
  cascade: GoalCascade | null;
  lastCheckIn: string;
}

/** FY 2026-27 goal period — every goal below runs inside it. */
export const GOAL_PERIOD = { start: "2026-04-01", end: "2027-03-31", label: "FY 2026-27" };

const FY_END = GOAL_PERIOD.end;
const Q3_END = "2026-12-31";
const Q2_END = "2026-09-30";

interface GoalSeed {
  title: string;
  description: string;
  category: GoalCategory;
  weightage: number;
  targetDate: string;
  /** Parent goal id, resolved into a full cascade chip after the list is built. */
  parent: string | null;
  keyResults: [string, number][];
}

/* Company OKRs — Arjun Kapoor, Founder & CEO. Everything cascades from here. */
const SEED_0001: GoalSeed[] = [
  {
    title: "Reach ₹210 Cr ARR by 31 March 2027",
    description:
      "Grow from ₹164 Cr exiting FY25-26 on the back of enterprise expansion and the Data Platform attach rate.",
    category: "Business",
    weightage: 30,
    targetDate: FY_END,
    parent: null,
    keyResults: [
      ["Close 14 new enterprise logos above ₹80 L ACV", 43],
      ["Take Data Platform attach rate from 21% to 45%", 38],
      ["Hold new-business win rate at or above 28%", 66],
    ],
  },
  {
    title: "Lift net revenue retention from 108% to 118%",
    description:
      "Expansion inside the installed base has to carry a third of the year's growth, so churn and downgrade both have to fall.",
    category: "Customer",
    weightage: 25,
    targetDate: FY_END,
    parent: null,
    keyResults: [
      ["Cut logo churn from 9.1% to under 5%", 52],
      ["Raise seat expansion in the top 40 accounts by 25%", 47],
      ["Close every red-account recovery plan within 45 days", 61],
    ],
  },
  {
    title: "Cut regretted attrition to under 8% for the financial year",
    description:
      "Regretted attrition ran at 12.4% in FY25-26. Manager quality and internal mobility are the two levers.",
    category: "People",
    weightage: 25,
    targetDate: FY_END,
    parent: null,
    keyResults: [
      ["Take the manager-effectiveness score from 3.6 to 4.1", 44],
      ["Fill 30% of open roles internally", 35],
      ["Complete stay conversations with all 62 critical-role holders", 58],
    ],
  },
  {
    title: "Ship Stellar Data Platform GA to every enterprise tenant",
    description:
      "GA means multi-region ingestion, tenant-level isolation and a published SLA — not a feature flag on a beta list.",
    category: "Craft",
    weightage: 20,
    targetDate: Q3_END,
    parent: null,
    keyResults: [
      ["Complete multi-region ingestion with 99.95% availability", 55],
      ["Migrate all 38 beta tenants onto the GA plane", 40],
      ["Publish and hold a 4-hour P1 response SLA", 72],
    ],
  },
];

/* VP Engineering — Ramesh Subramanian. */
const SEED_0004: GoalSeed[] = [
  {
    title: "Deliver the Data Platform GA milestone with zero P1 regressions",
    description:
      "Engineering owns the GA gate: ingestion, isolation and the migration of the 38 beta tenants.",
    category: "Business",
    weightage: 30,
    targetDate: Q3_END,
    parent: "GOL-0001-4",
    keyResults: [
      ["Land tenant-level isolation in the ingestion plane", 62],
      ["Run the GA load test at 3× peak with no P1", 38],
      ["Burn the GA blocker list from 47 down to zero", 51],
    ],
  },
  {
    title: "Cut p95 checkout latency from 840 ms to under 400 ms",
    description:
      "Checkout latency is the single biggest driver of cart abandonment in the enterprise tier.",
    category: "Craft",
    weightage: 25,
    targetDate: Q3_END,
    parent: "GOL-0001-4",
    keyResults: [
      ["Remove the synchronous tax lookup from the request path", 74],
      ["Cache pricing reads with a 60-second read-through cache", 88],
      ["Hold p95 under 400 ms for four consecutive weeks", 30],
    ],
  },
  {
    title: "Reduce engineering-driven customer escalations by 40%",
    description:
      "62 of last year's 148 escalations traced back to defects shipped by engineering. That number has to halve.",
    category: "Customer",
    weightage: 20,
    targetDate: FY_END,
    parent: "GOL-0001-2",
    keyResults: [
      ["Adopt error-budget gating on all tier-1 services", 45],
      ["Close the top 25 customer-reported defects", 57],
    ],
  },
  {
    title: "Grow the internal promotion rate in Engineering to 22%",
    description:
      "Half of last year's engineering exits were people who could not see a next level. Calibration and IDPs are the fix.",
    category: "People",
    weightage: 25,
    targetDate: FY_END,
    parent: "GOL-0001-3",
    keyResults: [
      ["Publish levelling expectations for every engineering band", 80],
      ["Run calibration for all 128 engineers with a signed-off IDP", 34],
      ["Hold regretted attrition in Engineering under 7%", 48],
    ],
  },
];

/* Chief Financial Officer — Lakshmi Pillai. */
const SEED_0008: GoalSeed[] = [
  {
    title: "Bring gross margin to 74% by Q4 FY26-27",
    description: "Cloud spend and support cost per account are the two lines that move this.",
    category: "Business",
    weightage: 35,
    targetDate: FY_END,
    parent: "GOL-0001-1",
    keyResults: [
      ["Cut cloud cost per tenant by 18%", 41],
      ["Renegotiate the top 6 vendor contracts", 66],
    ],
  },
  {
    title: "Close the FY25-26 statutory audit with zero qualifications",
    description:
      "Clean opinion, no management letter points carried forward, filed before the statutory deadline.",
    category: "Craft",
    weightage: 25,
    targetDate: Q3_END,
    parent: null,
    keyResults: [
      ["Clear all 11 prior-year management letter points", 82],
      ["Complete the related-party disclosure pack", 70],
    ],
  },
  {
    title: "Cut days-sales-outstanding from 62 to 45 days",
    description: "Collections discipline on the enterprise book, plus autopay on everything under ₹10 L.",
    category: "Customer",
    weightage: 25,
    targetDate: FY_END,
    parent: "GOL-0001-1",
    keyResults: [
      ["Move 70% of SMB accounts onto autopay", 53],
      ["Close every invoice over 90 days past due", 39],
    ],
  },
  {
    title: "Build a finance bench of three promotion-ready analysts",
    description: "No single-person dependency on the close, the pay run or the statutory filings.",
    category: "People",
    weightage: 15,
    targetDate: FY_END,
    parent: "GOL-0001-3",
    keyResults: [
      ["Complete Ind AS certification for three analysts", 45],
      ["Run two closes with the bench leading", 25],
    ],
  },
];

/* Head of People Operations — Priya Menon (the default HR Admin persona). */
const SEED_0009: GoalSeed[] = [
  {
    title: "Cut regretted attrition in Engineering and Sales to under 8%",
    description:
      "These two functions carry 68% of regretted exits. Manager capability and compensation bands are the levers.",
    category: "People",
    weightage: 30,
    targetDate: FY_END,
    parent: "GOL-0001-3",
    keyResults: [
      ["Complete stay conversations with all 62 critical-role holders", 58],
      ["Publish refreshed compensation bands for both functions", 76],
      ["Close every exit-interview theme with a named owner", 44],
    ],
  },
  {
    title: "Bring engineering time-to-fill from 54 days to 35",
    description:
      "Every extra week a senior engineering seat stays open costs roughly ₹4.1 L in delivery slippage.",
    category: "Business",
    weightage: 25,
    targetDate: Q3_END,
    parent: "GOL-0001-1",
    keyResults: [
      ["Cut the interview loop from 6 stages to 4", 85],
      ["Hold a live pipeline of 3 candidates per open role", 49],
      ["Close the scheduling lag from 6 days to under 2", 62],
    ],
  },
  {
    title: "Take the manager-effectiveness score from 3.6 to 4.1",
    description:
      "Measured in the half-yearly engagement pulse across all 47 people managers.",
    category: "People",
    weightage: 25,
    targetDate: FY_END,
    parent: "GOL-0001-3",
    keyResults: [
      ["Put all 47 managers through the feedback-skills workshop", 51],
      ["Hit 95% completion on mid-year one-to-ones", 67],
    ],
  },
  {
    title: "Reach 100% completion on all five mandatory compliance trainings",
    description:
      "POSH, Information Security, Code of Conduct, Anti-Bribery and Data Privacy — no expired certificates at year end.",
    category: "Craft",
    weightage: 20,
    targetDate: Q3_END,
    parent: null,
    keyResults: [
      ["Clear the backlog of expired certificates", 34],
      ["Automate the 30-day expiry reminder", 90],
    ],
  },
];

/* Payroll Manager — Rahul Desai. */
const SEED_0017: GoalSeed[] = [
  {
    title: "Close every monthly pay run by the 26th with zero post-lock corrections",
    description:
      "Two of last year's twelve runs needed off-cycle corrections after lock. The target this year is none.",
    category: "Craft",
    weightage: 30,
    targetDate: FY_END,
    parent: "GOL-0008-2",
    keyResults: [
      ["Move the exception review to T-4 days", 72],
      ["Hold six consecutive runs with zero post-lock corrections", 50],
    ],
  },
  {
    title: "Cut payroll query tickets from 9.4 to 4 per 100 employees",
    description: "Most queries are payslip comprehension and reimbursement timing — both are self-serviceable.",
    category: "Customer",
    weightage: 25,
    targetDate: FY_END,
    parent: "GOL-0008-3",
    keyResults: [
      ["Ship the annotated payslip explainer", 64],
      ["Publish a reimbursement tracker in self-service", 38],
    ],
  },
  {
    title: "Automate PF, ESI and Professional Tax filings end to end",
    description: "Three statutory filings a month, currently assembled by hand from four spreadsheets.",
    category: "Business",
    weightage: 25,
    targetDate: Q3_END,
    parent: "GOL-0008-1",
    keyResults: [
      ["Generate the PF ECR file straight from the pay run", 58],
      ["Automate the ESI monthly contribution return", 41],
      ["Automate PT for Karnataka and Maharashtra", 29],
    ],
  },
  {
    title: "Cross-train two analysts to run a pay cycle unsupervised",
    description: "The pay run cannot depend on one person being reachable in the last week of the month.",
    category: "People",
    weightage: 20,
    targetDate: FY_END,
    parent: "GOL-0008-4",
    keyResults: [
      ["Document the full pay-run runbook", 78],
      ["Have each analyst shadow then lead one cycle", 30],
    ],
  },
];

/* Talent Acquisition Lead — Sana Iqbal. */
const SEED_0058: GoalSeed[] = [
  {
    title: "Close 12 open engineering requisitions within 35 days each",
    description:
      "Twelve requisitions are open against the FY26-27 plan; five of them have been open over 60 days.",
    category: "Business",
    weightage: 30,
    targetDate: Q3_END,
    parent: "GOL-0009-2",
    keyResults: [
      ["Clear the five requisitions aged over 60 days", 40],
      ["Hold a 3-candidate live pipeline per role", 55],
    ],
  },
  {
    title: "Raise the offer-acceptance rate from 71% to 85%",
    description:
      "Nine of last year's 31 declines cited compensation clarity; six cited how long the process took.",
    category: "Customer",
    weightage: 25,
    targetDate: FY_END,
    parent: "GOL-0009-2",
    keyResults: [
      ["Share the band and the full CTC break-up at offer stage", 88],
      ["Cut offer turnaround from 9 days to 3", 62],
    ],
  },
  {
    title: "Fill 40% of open roles through employee referrals",
    description: "Referral hires stay 1.8 years longer on average and cost a third as much to source.",
    category: "People",
    weightage: 25,
    targetDate: FY_END,
    parent: "GOL-0009-1",
    keyResults: [
      ["Relaunch the referral scheme with a tiered bonus", 70],
      ["Take referral share of hires from 17% to 40%", 33],
    ],
  },
  {
    title: "Ship a structured interview kit for every engineering level",
    description:
      "Scorecards, calibrated questions and a trained interviewer panel for G1 through G5.",
    category: "Craft",
    weightage: 20,
    targetDate: Q3_END,
    parent: "GOL-0009-3",
    keyResults: [
      ["Publish scorecards for all five levels", 60],
      ["Certify 20 interviewers on the new kit", 45],
    ],
  },
];

/* Engineering Manager — Vikram Shah. Ananya's goals cascade into these. */
const SEED_0031: GoalSeed[] = [
  {
    title: "Take payments service p95 from 840 ms to under 400 ms",
    description:
      "The payments team owns three of the four slow hops in checkout: pricing, tax and settlement.",
    category: "Craft",
    weightage: 30,
    targetDate: Q3_END,
    parent: "GOL-0004-2",
    keyResults: [
      ["Remove the synchronous tax lookup from the request path", 74],
      ["Move settlement webhooks onto the async queue", 42],
      ["Hold p95 under 400 ms for four consecutive weeks", 30],
    ],
  },
  {
    title: "Ship the Data Platform ingestion pipeline to GA by 15 Dec 2026",
    description: "The payments team owns the CDC connector and the replay path for the GA milestone.",
    category: "Business",
    weightage: 30,
    targetDate: "2026-12-15",
    parent: "GOL-0004-1",
    keyResults: [
      ["Land the Postgres CDC connector", 66],
      ["Ship idempotent replay with exactly-once semantics", 48],
      ["Clear the team's 14 GA blockers", 57],
    ],
  },
  {
    title: "Reduce Sev-2 escalations from the payments team by 40%",
    description: "The team carried 11 Sev-2s last quarter, seven of them from the refunds worker.",
    category: "Customer",
    weightage: 20,
    targetDate: FY_END,
    parent: "GOL-0004-3",
    keyResults: [
      ["Rewrite the refunds worker onto the durable queue", 51],
      ["Add contract tests on every gateway integration", 39],
    ],
  },
  {
    title: "Get two engineers promotion-ready by the March calibration",
    description:
      "Karthik and Shreya both have the scope; what is missing is documented evidence and cross-team visibility.",
    category: "People",
    weightage: 20,
    targetDate: FY_END,
    parent: "GOL-0004-4",
    keyResults: [
      ["Agree a written IDP with each of the two", 90],
      ["Land one cross-team project each", 44],
      ["Present evidence at the Q3 calibration", 20],
    ],
  },
];

/* Software Engineer — Ananya Rao, the individual-contributor showcase. */
const SEED_0142: GoalSeed[] = [
  {
    title: "Cut p95 checkout latency from 840 ms to under 400 ms",
    description:
      "My slice of the checkout latency goal: the pricing lookup, the tax query and the settlement webhook path.",
    category: "Craft",
    weightage: 30,
    targetDate: Q3_END,
    parent: "GOL-0031-1",
    keyResults: [
      ["Add a read-through Redis cache to the pricing lookup", 100],
      ["Replace the N+1 tax query with a single batched call", 80],
      ["Move settlement webhooks off the request path", 35],
    ],
  },
  {
    title: "Ship idempotent retries for the payments gateway to GA",
    description:
      "Duplicate charges on retry caused four of last quarter's eleven Sev-2s. Idempotency keys close that class of bug.",
    category: "Business",
    weightage: 25,
    targetDate: "2026-12-15",
    parent: "GOL-0031-2",
    keyResults: [
      ["Design and review the idempotency-key scheme", 100],
      ["Roll out behind a flag to 10% of traffic", 70],
      ["Complete the GA rollout with a 7-day soak", 25],
    ],
  },
  {
    title: "Take payments Sev-2 escalations from 11 to under 7 a quarter",
    description:
      "Owning the on-call write-ups and turning each one into either a test or a guardrail.",
    category: "Customer",
    weightage: 20,
    targetDate: FY_END,
    parent: "GOL-0031-3",
    keyResults: [
      ["Write a post-incident review for every Sev-2 within 48 h", 83],
      ["Add contract tests for the three gateway integrations", 45],
    ],
  },
  {
    title: "Raise unit-test coverage on the payments module from 54% to 80%",
    description:
      "Coverage on the settlement and refunds packages is the thinnest part of the service.",
    category: "Craft",
    weightage: 15,
    targetDate: Q2_END,
    parent: "GOL-0031-1",
    keyResults: [
      ["Bring the settlement package to 80%", 92],
      ["Bring the refunds package to 80%", 64],
    ],
  },
  {
    title: "Mentor two interns through their first production release",
    description:
      "Pairing, review and a written ramp plan so both ship to production inside their first six weeks.",
    category: "People",
    weightage: 10,
    targetDate: Q3_END,
    parent: "GOL-0031-4",
    keyResults: [
      ["Write a ramp plan for each intern", 100],
      ["Both interns ship to production", 50],
    ],
  },
];

/* ------------------------------- generated goals for the rest of the team */

interface PoolGoal {
  title: string;
  description: string;
  category: GoalCategory;
  parent: string;
  keyResults: string[];
}

const IC_GOAL_POOL: PoolGoal[] = [
  {
    title: "Reduce the payments API error rate from 0.9% to under 0.2%",
    description: "Most of the error budget is burned by timeouts on the gateway callback path.",
    category: "Craft",
    parent: "GOL-0031-1",
    keyResults: ["Add circuit breaking on all three gateways", "Retire the legacy callback endpoint"],
  },
  {
    title: "Migrate the settlement service from Node 18 to Node 22",
    description: "Node 18 goes end of life in April 2027 and blocks the new OpenTelemetry SDK.",
    category: "Craft",
    parent: "GOL-0031-1",
    keyResults: ["Clear the 23 breaking dependency changes", "Run a week of shadow traffic on Node 22"],
  },
  {
    title: "Ship the ledger reconciliation job to GA",
    description: "Finance still reconciles settlement against the ledger in a spreadsheet every Monday.",
    category: "Business",
    parent: "GOL-0031-2",
    keyResults: ["Match 99.9% of transactions automatically", "Publish the daily break report to Finance"],
  },
  {
    title: "Deliver the Data Platform CDC connector for Postgres",
    description: "Change-data-capture from the primary Postgres cluster into the ingestion plane.",
    category: "Business",
    parent: "GOL-0031-2",
    keyResults: ["Handle schema evolution without a replay", "Sustain 40k events per second in load test"],
  },
  {
    title: "Cut the checkout bundle from 480 KB to under 260 KB",
    description: "Bundle size is the second-biggest contributor to first-paint on mid-range Android.",
    category: "Craft",
    parent: "GOL-0031-1",
    keyResults: ["Code-split the three heaviest routes", "Drop the duplicated date library"],
  },
  {
    title: "Bring the payments on-call page rate below two a week",
    description: "The rotation averaged 5.4 pages a week last quarter, most of them non-actionable.",
    category: "Customer",
    parent: "GOL-0031-3",
    keyResults: ["Retune the 19 noisiest alerts", "Auto-remediate the disk-pressure alert"],
  },
  {
    title: "Close the top 12 customer-reported payment defects",
    description: "The twelve oldest defects on the payments board, all reported by enterprise tenants.",
    category: "Customer",
    parent: "GOL-0031-3",
    keyResults: ["Close the six defects aged over 90 days", "Add a regression test for each fix"],
  },
  {
    title: "Automate the release pipeline so deploys need no manual gate",
    description: "Every payments release still needs a human to click through three approval steps.",
    category: "Craft",
    parent: "GOL-0031-1",
    keyResults: ["Gate on the canary metric instead of a person", "Cut mean deploy time from 41 to 12 minutes"],
  },
  {
    title: "Write the payments runbook and dry-run it with two engineers",
    description: "On-call handover is currently oral history. It needs to be written and rehearsed.",
    category: "People",
    parent: "GOL-0031-4",
    keyResults: ["Document all nine failure modes", "Run a game day against the staging cluster"],
  },
  {
    title: "Take API documentation coverage from 40% to 95%",
    description: "Partner integrations stall on undocumented error codes and webhook payloads.",
    category: "Craft",
    parent: "GOL-0031-1",
    keyResults: ["Publish OpenAPI specs for all 14 endpoints", "Document every error code with a worked example"],
  },
  {
    title: "Cut median pull-request review turnaround from 19 h to under 6 h",
    description: "Review latency is the largest single component of the team's cycle time.",
    category: "People",
    parent: "GOL-0031-4",
    keyResults: ["Introduce a daily review rotation", "Split the four largest long-lived branches"],
  },
  {
    title: "Move the refunds worker onto the durable queue with zero downtime",
    description: "The refunds worker is the last consumer still on the in-memory queue.",
    category: "Business",
    parent: "GOL-0031-2",
    keyResults: ["Dual-write for two weeks and compare", "Cut over with a documented rollback"],
  },
  {
    title: "Reduce Snowflake spend on the events pipeline by 30%",
    description: "The events pipeline is the largest single line in the data warehouse bill.",
    category: "Business",
    parent: "GOL-0031-2",
    keyResults: ["Cluster the three largest tables", "Move cold partitions to external storage"],
  },
  {
    title: "Onboard two new joiners to their first production commit in 14 days",
    description: "The current median for a new joiner's first production change is 31 days.",
    category: "People",
    parent: "GOL-0031-4",
    keyResults: ["Ship a one-command local environment", "Curate a starter-issue queue"],
  },
  {
    title: "Lift checkout conversion by 1.2 points through latency and retry work",
    description: "Latency and failed retries together account for most of the abandoned enterprise carts.",
    category: "Customer",
    parent: "GOL-0031-3",
    keyResults: ["Run the latency A/B on 20% of traffic", "Instrument the drop-off funnel end to end"],
  },
  {
    title: "Add contract tests to every gateway integration",
    description: "Three gateways, no contract tests — every provider change is found in production.",
    category: "Craft",
    parent: "GOL-0031-1",
    keyResults: ["Cover all three providers with Pact tests", "Wire the contract suite into CI"],
  },
];

/** Fixed weight quadruples, each summing to exactly 100. */
const WEIGHT_SETS: number[][] = [
  [30, 30, 20, 20],
  [35, 25, 25, 15],
  [40, 25, 20, 15],
  [25, 25, 25, 25],
  [30, 25, 25, 20],
];

const AUTHORED: Record<string, GoalSeed[]> = {
  "STL-0001": SEED_0001,
  "STL-0004": SEED_0004,
  "STL-0008": SEED_0008,
  "STL-0009": SEED_0009,
  "STL-0017": SEED_0017,
  "STL-0031": SEED_0031,
  "STL-0058": SEED_0058,
  "STL-0142": SEED_0142,
};

/** The other seven of Vikram's eight reportees get generated goal sets. */
const GENERATED_OWNERS = VIKRAM_TEAM_CODES.filter((c) => c !== "STL-0142");

function buildGoals(): Goal[] {
  const rng = mulberry32(90126);
  const out: Goal[] = [];
  /** goal id -> parent goal id, recorded as each goal is created. */
  const parentOf = new Map<string, string>();

  const push = (ownerCode: string, seeds: GoalSeed[]) => {
    const short = ownerCode.replace("STL-", "");
    seeds.forEach((s, i) => {
      const keyResults: KeyResult[] = s.keyResults.map(([title, progress], k) => ({
        id: `KR-${short}-${i + 1}-${k + 1}`,
        title,
        progress,
        dueDate: s.targetDate,
      }));
      const progress = Math.round(
        keyResults.reduce((a, kr) => a + kr.progress, 0) / Math.max(1, keyResults.length),
      );
      if (s.parent) parentOf.set(`GOL-${short}-${i + 1}`, s.parent);
      out.push({
        id: `GOL-${short}-${i + 1}`,
        ownerCode,
        title: s.title,
        description: s.description,
        category: s.category,
        weightage: s.weightage,
        progress,
        startDate: GOAL_PERIOD.start,
        targetDate: s.targetDate,
        status: deriveGoalStatus(progress, GOAL_PERIOD.start, s.targetDate),
        keyResults,
        cascade: null, // resolved below, once every goal id exists
        lastCheckIn: iso(addDays(TODAY, -randInt(rng, 1, 21))),
      });
    });
  };

  for (const [ownerCode, seeds] of Object.entries(AUTHORED)) push(ownerCode, seeds);

  GENERATED_OWNERS.forEach((ownerCode, idx) => {
    const weights = WEIGHT_SETS[idx % WEIGHT_SETS.length];
    const taken = new Set<number>();
    const seeds: GoalSeed[] = weights.map((weightage, i) => {
      let p = (idx * 3 + i * 5 + randInt(rng, 0, 3)) % IC_GOAL_POOL.length;
      while (taken.has(p)) p = (p + 1) % IC_GOAL_POOL.length;
      taken.add(p);
      const g = IC_GOAL_POOL[p];
      const targetDate = pick(rng, [Q3_END, FY_END, "2026-12-15"]);
      return {
        title: g.title,
        description: g.description,
        category: g.category,
        weightage,
        targetDate,
        parent: g.parent,
        keyResults: g.keyResults.map((t) => [t, randInt(rng, 10, 95)] as [string, number]),
      };
    });
    push(ownerCode, seeds);
  });

  /* Resolve the cascade chips now that every goal id exists. */
  const byId = new Map(out.map((g) => [g.id, g]));
  for (const g of out) {
    const parent = byId.get(parentOf.get(g.id) ?? "");
    if (!parent) continue;
    g.cascade = {
      parentGoalId: parent.id,
      parentGoalTitle: parent.title,
      parentOwnerCode: parent.ownerCode,
      parentOwnerName: employeeByCode(parent.ownerCode)?.name ?? parent.ownerCode,
    };
  }

  return out;
}

/**
 * Progress vs. elapsed time. A goal that is 20% done with 80% of the window
 * gone is off track, and the screen says so without anyone typing a status.
 */
export function deriveGoalStatus(progress: number, startDate: string, targetDate: string): GoalStatus {
  if (progress >= 100) return "achieved";
  const span = Math.max(1, differenceInCalendarDays(parseISO(targetDate), parseISO(startDate)));
  const gone = clamp(differenceInCalendarDays(TODAY, parseISO(startDate)) / span, 0, 1);
  const gap = progress - gone * 100;
  if (gap >= -8) return "on_track";
  if (gap >= -22) return "at_risk";
  return "off_track";
}

export const GOALS: Goal[] = buildGoals();

export const goalsFor = (ownerCode: string) => GOALS.filter((g) => g.ownerCode === ownerCode);
export const goalById = (id: string) => GOALS.find((g) => g.id === id) ?? null;

/** Goals that roll up INTO a given goal — the other half of the cascade. */
export const childGoalsOf = (goalId: string) =>
  GOALS.filter((g) => g.cascade?.parentGoalId === goalId);

/** Owners with an authored or generated goal set — used by the owner picker. */
export const GOAL_OWNERS: string[] = [...new Set(GOALS.map((g) => g.ownerCode))];

/**
 * Weightage integrity. Every owner's goals must total exactly 100% — this is
 * the check the /goals screen surfaces, so a broken fixture is visible rather
 * than silently wrong.
 */
export const GOAL_WEIGHT_CHECK = (() => {
  const totals = new Map<string, number>();
  for (const g of GOALS) totals.set(g.ownerCode, (totals.get(g.ownerCode) ?? 0) + g.weightage);
  const rows = [...totals.entries()]
    .map(([ownerCode, total]) => ({ ownerCode, total, ok: total === 100 }))
    .sort((a, b) => a.ownerCode.localeCompare(b.ownerCode));
  return { rows, offenders: rows.filter((r) => !r.ok), allOk: rows.every((r) => r.ok) };
})();

export function weightageFor(ownerCode: string) {
  return goalsFor(ownerCode).reduce((a, g) => a + g.weightage, 0);
}

/** Weighted completion for one owner — the number the KPI row leads with. */
export function weightedProgressFor(ownerCode: string) {
  const list = goalsFor(ownerCode);
  const w = list.reduce((a, g) => a + g.weightage, 0) || 1;
  return round2(list.reduce((a, g) => a + g.progress * g.weightage, 0) / w);
}

/** Weighted completion across an arbitrary set of goals (live local state). */
export function weightedProgress(list: Goal[]) {
  const w = list.reduce((a, g) => a + g.weightage, 0) || 1;
  return round2(list.reduce((a, g) => a + g.progress * g.weightage, 0) / w);
}

/**
 * Achieved vs. expected-by-now, per category. Takes the goal list rather than
 * an owner code so the chart tracks live edits on the screen.
 */
export function categoryProgress(list: Goal[]) {
  return GOAL_CATEGORIES.filter((c) => list.some((g) => g.category === c)).map((category) => {
    const rows = list.filter((g) => g.category === category);
    const w = rows.reduce((a, g) => a + g.weightage, 0) || 1;
    const achieved = rows.reduce((a, g) => a + g.progress * g.weightage, 0) / w;
    const expected =
      rows.reduce((a, g) => {
        const span = Math.max(1, differenceInCalendarDays(parseISO(g.targetDate), parseISO(g.startDate)));
        const gone = clamp(differenceInCalendarDays(TODAY, parseISO(g.startDate)) / span, 0, 1);
        return a + gone * 100 * g.weightage;
      }, 0) / w;
    return {
      category,
      achieved: Math.round(achieved),
      expected: Math.round(expected),
      weightage: rows.reduce((a, g) => a + g.weightage, 0),
    };
  });
}

/** Convenience wrapper for the stored fixtures. */
export const goalProgressByCategory = (ownerCode: string) => categoryProgress(goalsFor(ownerCode));

/** Expected completion for one goal, given how much of its window has gone. */
export function expectedProgress(goal: Goal) {
  const span = Math.max(1, differenceInCalendarDays(parseISO(goal.targetDate), parseISO(goal.startDate)));
  const gone = clamp(differenceInCalendarDays(TODAY, parseISO(goal.startDate)) / span, 0, 1);
  return Math.round(gone * 100);
}

/* ========================================================================== */
/*                              REVIEW CYCLES                                 */
/* ========================================================================== */

export type ReviewStageId = "self" | "manager" | "peer" | "calibration" | "release";

export const REVIEW_STAGES: { id: ReviewStageId; label: string; blurb: string }[] = [
  { id: "self", label: "Self review", blurb: "Employee rates themselves against each competency" },
  { id: "manager", label: "Manager review", blurb: "Reporting manager rates and writes the summary" },
  { id: "peer", label: "Peer feedback", blurb: "Three nominated peers submit written feedback" },
  { id: "calibration", label: "Calibration", blurb: "Ratings normalised across the department cohort" },
  { id: "release", label: "Release", blurb: "Final rating shared with the employee" },
];

export interface StageProgress {
  stage: ReviewStageId;
  label: string;
  completed: number;
  total: number;
  pct: number;
}

export type ReviewCycleStatus = "in_review" | "completed" | "scheduled";

export interface ReviewCycle {
  id: string;
  name: string;
  kind: "Annual" | "Mid-year" | "Check-in";
  windowStart: string;
  windowEnd: string;
  participants: number;
  completionPct: number;
  status: ReviewCycleStatus;
  stages: StageProgress[];
  ownerCode: string;
  /** Departments in scope — every cycle here is company-wide. */
  scope: string;
}

function stages(participants: number, done: number[]): StageProgress[] {
  return REVIEW_STAGES.map((s, i) => ({
    stage: s.id,
    label: s.label,
    completed: done[i],
    total: participants,
    pct: Math.round((done[i] / participants) * 100),
  }));
}

export const REVIEW_CYCLES: ReviewCycle[] = (() => {
  const mid = { participants: 312, done: [271, 186, 224, 0, 0] };
  const annual = { participants: 328, done: [328, 328, 328, 328, 328] };
  const h1Last = { participants: 296, done: [296, 296, 296, 296, 296] };
  const q3 = { participants: 318, done: [0, 0, 0, 0, 0] };

  const cycles: ReviewCycle[] = [
    {
      id: "RC-2026-MID",
      name: "H1 FY26-27 Mid-Year Review",
      kind: "Mid-year",
      windowStart: "2026-09-01",
      windowEnd: "2026-10-09",
      participants: mid.participants,
      completionPct: 0,
      status: "in_review",
      stages: stages(mid.participants, mid.done),
      ownerCode: "STL-0009",
      scope: "All departments · confirmed employees",
    },
    {
      id: "RC-2026-ANN",
      name: "FY25-26 Annual Review",
      kind: "Annual",
      windowStart: "2026-04-06",
      windowEnd: "2026-05-22",
      participants: annual.participants,
      completionPct: 100,
      status: "completed",
      stages: stages(annual.participants, annual.done),
      ownerCode: "STL-0009",
      scope: "All departments · confirmed employees",
    },
    {
      id: "RC-2025-MID",
      name: "H1 FY25-26 Mid-Year Review",
      kind: "Mid-year",
      windowStart: "2025-09-08",
      windowEnd: "2025-10-17",
      participants: h1Last.participants,
      completionPct: 100,
      status: "completed",
      stages: stages(h1Last.participants, h1Last.done),
      ownerCode: "STL-0009",
      scope: "All departments · confirmed employees",
    },
    {
      id: "RC-2027-Q3",
      name: "Q3 FY26-27 Check-in",
      kind: "Check-in",
      windowStart: "2027-01-04",
      windowEnd: "2027-01-22",
      participants: q3.participants,
      completionPct: 0,
      status: "scheduled",
      stages: stages(q3.participants, q3.done),
      ownerCode: "STL-0009",
      scope: "All departments · confirmed employees",
    },
  ];

  /* Completion is the mean stage completion — it reconciles with the stage bars. */
  for (const c of cycles) {
    c.completionPct = Math.round(c.stages.reduce((a, s) => a + s.pct, 0) / c.stages.length);
  }
  return cycles;
})();

export const ACTIVE_CYCLE = REVIEW_CYCLES[0];
export const cycleById = (id: string) => REVIEW_CYCLES.find((c) => c.id === id) ?? null;

/* ------------------------------------------------------------ rating scale */

export interface RatingAnchor {
  value: number;
  label: string;
  short: string;
  description: string;
}

export const RATING_SCALE: RatingAnchor[] = [
  {
    value: 1,
    short: "Below expectations",
    label: "1 — Below expectations",
    description: "Falls short of the bar for the level on most of the period's work.",
  },
  {
    value: 2,
    short: "Partially meets",
    label: "2 — Partially meets expectations",
    description: "Delivers some of what the level asks for, with gaps that need a plan.",
  },
  {
    value: 3,
    short: "Consistently meets",
    label: "3 — Consistently meets expectations",
    description: "Reliably delivers the bar for the level. This is a good rating, not a warning.",
  },
  {
    value: 4,
    short: "Exceeds",
    label: "4 — Exceeds expectations",
    description: "Regularly delivers beyond the level, and raises the bar for people around them.",
  },
  {
    value: 5,
    short: "Role model",
    label: "5 — Role model for the level",
    description: "Sets the standard others are calibrated against. Rare by construction.",
  },
];

export const ratingAnchor = (v: number) => RATING_SCALE.find((r) => r.value === Math.round(v)) ?? RATING_SCALE[2];

/* ------------------------------------------------------------ review forms */

export interface Competency {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export const COMPETENCIES: Competency[] = [
  { id: "delivery", name: "Delivery & execution", description: "Ships committed work at the expected quality and pace.", weight: 20 },
  { id: "craft", name: "Technical craft", description: "Depth of engineering judgement, design and code quality.", weight: 20 },
  { id: "ownership", name: "Ownership & accountability", description: "Takes problems end to end, including the unglamorous parts.", weight: 15 },
  { id: "collaboration", name: "Collaboration", description: "Works across teams without needing a manager in the room.", weight: 10 },
  { id: "communication", name: "Communication", description: "Written and verbal clarity with technical and non-technical audiences.", weight: 10 },
  { id: "customer", name: "Customer focus", description: "Understands who the work is for and what it costs them when it breaks.", weight: 10 },
  { id: "mentorship", name: "Mentorship & growth", description: "Grows others and actively closes their own gaps.", weight: 10 },
  { id: "adaptability", name: "Adaptability", description: "Holds up when priorities, scope or constraints move.", weight: 5 },
];

export interface CompetencyReview {
  competencyId: string;
  self: number;
  manager: number;
  peer: number;
  selfComment: string;
  managerComment: string;
  peerComment: string;
}

export type ReviewFormStatus = "draft" | "self_pending" | "manager_pending" | "in_review" | "completed" | "approved";

export interface ReviewForm {
  id: string;
  cycleId: string;
  employeeCode: string;
  managerCode: string;
  peerCodes: string[];
  status: ReviewFormStatus;
  submittedSelfOn: string | null;
  submittedManagerOn: string | null;
  competencies: CompetencyReview[];
  selfSummary: string;
  managerSummary: string;
  /** Rating the manager is proposing into calibration. */
  proposedRating: number;
}

/** Ananya Rao's mid-year form, written out in full — the showcase record. */
const ANANYA_REVIEW: CompetencyReview[] = [
  {
    competencyId: "delivery",
    self: 4,
    manager: 4,
    peer: 4,
    selfComment:
      "Shipped the pricing cache and the batched tax query inside the quarter; p95 is down from 840 ms to 512 ms with the settlement work still to land.",
    managerComment:
      "Delivered every committed item on the latency goal and picked up the idempotency work when Karthik moved to the CDC connector. Consistently ahead of the plan.",
    peerComment:
      "Ananya's changes land in small, reviewable pieces — I have never had to ask her to split a branch.",
  },
  {
    competencyId: "craft",
    self: 5,
    manager: 4,
    peer: 4,
    selfComment:
      "The idempotency-key design went through two review rounds and came out simpler than either draft; I think that is the strongest design work I have done here.",
    managerComment:
      "Genuinely strong design instincts — the idempotency scheme is now the pattern the other two services are copying. Holding at 4 because the settlement refactor still has a rollback path we have not exercised.",
    peerComment:
      "She caught the double-charge race in my refunds PR that three of us had read past.",
  },
  {
    competencyId: "ownership",
    self: 5,
    manager: 3,
    peer: 4,
    selfComment:
      "I own the payments on-call write-ups and I have closed every one within 48 hours this half.",
    managerComment:
      "The write-ups are excellent. Where ownership tails off is after the write-up — four of the follow-up actions from June are still open and I have had to chase them. That is the gap between a 3 and a 5 here.",
    peerComment:
      "Very responsive during incidents; follow-through on the resulting tickets is patchier.",
  },
  {
    competencyId: "collaboration",
    self: 4,
    manager: 4,
    peer: 5,
    selfComment:
      "Worked directly with the Data Platform team on the CDC contract rather than going through managers.",
    managerComment:
      "Works across team lines by default. The joint session she ran with Data Platform saved us a fortnight of contract churn.",
    peerComment:
      "Easiest person on the payments team to pull into a cross-team problem.",
  },
  {
    competencyId: "communication",
    self: 3,
    manager: 4,
    peer: 4,
    selfComment:
      "Writing is fine; I am less confident presenting to a room that is not engineers.",
    managerComment:
      "She is underrating herself. The latency review she presented to the CS leadership was clear, honest about what was not fixed, and landed well.",
    peerComment: "Design docs are short and legible, which is rarer than it should be.",
  },
  {
    competencyId: "customer",
    self: 4,
    manager: 4,
    peer: 3,
    selfComment:
      "Read every one of the twelve enterprise defect reports before prioritising the retry work.",
    managerComment:
      "Prioritises by customer impact rather than by what is interesting. The retry work came directly out of reading escalation transcripts.",
    peerComment: "Good instincts, though mostly filtered through the escalation queue rather than direct contact.",
  },
  {
    competencyId: "mentorship",
    self: 3,
    manager: 4,
    peer: 4,
    selfComment:
      "Both interns shipped a ramp plan; only one has made it to production so far, so I would call this partly done.",
    managerComment:
      "Ramp plans were the best written on the team and Nandini's first production change went out in week five. The outcome is better than Ananya is scoring it.",
    peerComment: "Patient in review; explains the why, not just the fix.",
  },
  {
    competencyId: "adaptability",
    self: 4,
    manager: 4,
    peer: 4,
    selfComment:
      "Absorbed the GA date moving forward by three weeks without dropping the coverage goal.",
    managerComment: "Took the GA date change calmly and re-planned the same afternoon.",
    peerComment: "Unflappable when the plan moves.",
  },
];

const SELF_COMMENT_POOL = [
  "Delivered against the plan for the half, with the settlement work carrying into next quarter.",
  "This is the area I have put the most deliberate effort into since the last review.",
  "I met the bar here but I would not claim more than that — the evidence is steady rather than standout.",
  "Stronger than last half, mostly because the runbook work forced me to learn the whole path.",
  "Honest gap. I have a plan for it in my IDP and I would like coaching on it.",
];

const MANAGER_COMMENT_POOL = [
  "Consistent, dependable work at the level. No concerns and no drama.",
  "Above the bar for the level this half — the cross-team work in particular stood out.",
  "Meets the bar, and the next step up is about scope rather than quality.",
  "A real step forward since the annual review. Keep the evidence coming for calibration.",
  "This is the one area I would like to see deliberate work on before the March calibration.",
];

const PEER_COMMENT_POOL = [
  "Easy to work with, and the code review feedback is specific rather than stylistic.",
  "Reliable partner on shared work; tells you early when something is going to slip.",
  "Would happily be on-call alongside them.",
  "Clear writer — the design doc was the reason the review was short.",
  "Generous with time when someone else is blocked.",
];

function buildReviewForms(): ReviewForm[] {
  const rng = mulberry32(260916);
  const forms: ReviewForm[] = [];

  const peersFor = (code: string) =>
    VIKRAM_TEAM_CODES.filter((c) => c !== code).slice(0, 3);

  for (const code of VIKRAM_TEAM_CODES) {
    const isAnanya = code === "STL-0142";
    const competencies: CompetencyReview[] = isAnanya
      ? ANANYA_REVIEW
      : COMPETENCIES.map((c) => {
          const base = randInt(rng, 2, 4);
          const self = clamp(base + (rng() > 0.72 ? 1 : 0), 1, 5);
          const manager = clamp(base + (rng() > 0.82 ? 1 : rng() > 0.74 ? -1 : 0), 1, 5);
          const peer = clamp(base + (rng() > 0.66 ? 1 : 0), 1, 5);
          return {
            competencyId: c.id,
            self,
            manager,
            peer,
            selfComment: pick(rng, SELF_COMMENT_POOL),
            managerComment: pick(rng, MANAGER_COMMENT_POOL),
            peerComment: pick(rng, PEER_COMMENT_POOL),
          };
        });

    /* One reportee is deliberately left with the manager review outstanding,
       and one has not submitted a self review — the queue has to look real. */
    const idx = VIKRAM_TEAM_CODES.indexOf(code);
    const status: ReviewFormStatus =
      idx === 5 ? "self_pending" : idx === 6 ? "manager_pending" : isAnanya ? "in_review" : "in_review";

    const emp = employeeByCode(code);
    const first = emp?.firstName ?? "They";

    forms.push({
      id: `RF-${ACTIVE_CYCLE.id}-${code.replace("STL-", "")}`,
      cycleId: ACTIVE_CYCLE.id,
      employeeCode: code,
      managerCode: "STL-0031",
      peerCodes: peersFor(code),
      status,
      submittedSelfOn: status === "self_pending" ? null : iso(addDays(TODAY, -randInt(rng, 3, 14))),
      submittedManagerOn:
        status === "self_pending" || status === "manager_pending"
          ? null
          : iso(addDays(TODAY, -randInt(rng, 1, 6))),
      competencies,
      selfSummary: isAnanya
        ? "The half was defined by the latency goal. Two of the three hops are done and p95 is at 512 ms; the settlement webhook move is the remaining piece and it is the riskiest. Outside that, the idempotency design is the work I am proudest of. My weakest area is closing out incident follow-ups — I write them well and then let them age."
        : `${first} delivered against the committed goals for the half, with the cross-team work landing better than planned and one carry-over item into Q3.`,
      managerSummary: isAnanya
        ? "A strong half from Ananya. She took the hardest slice of the latency goal and has p95 down 39% with the riskiest change still ahead of her. The idempotency-key design has become the reference pattern for the other two services. The one thing standing between this and a clear 'exceeds' overall is follow-through on incident actions — the write-ups are excellent, the resulting tickets age. We have agreed a weekly sweep. Proposed rating: 4."
        : `Solid half. ${first} is at the bar for the level with visible growth in ownership. Proposed rating reflects steady delivery rather than exceptional scope.`,
      proposedRating: isAnanya ? 4 : clamp(Math.round(randInt(rng, 25, 42) / 10), 1, 5),
    });
  }

  return forms;
}

export const REVIEW_FORMS: ReviewForm[] = buildReviewForms();

export const reviewFormFor = (employeeCode: string, cycleId = ACTIVE_CYCLE.id) =>
  REVIEW_FORMS.find((f) => f.employeeCode === employeeCode && f.cycleId === cycleId) ?? null;

export const reviewFormsForManager = (managerCode: string, cycleId = ACTIVE_CYCLE.id) =>
  REVIEW_FORMS.filter((f) => f.managerCode === managerCode && f.cycleId === cycleId);

/** Weighted overall for one column of a review form. */
export function overallRating(form: ReviewForm, column: "self" | "manager" | "peer") {
  const w = COMPETENCIES.reduce((a, c) => a + c.weight, 0);
  const total = form.competencies.reduce((a, cr) => {
    const c = COMPETENCIES.find((x) => x.id === cr.competencyId)!;
    return a + cr[column] * c.weight;
  }, 0);
  return round2(total / w);
}

/** Competencies where self and manager are two or more points apart. */
export function divergentCompetencies(form: ReviewForm) {
  return form.competencies.filter((c) => Math.abs(c.self - c.manager) >= 2);
}

/* ========================================================================== */
/*                            9-BOX CALIBRATION                               */
/* ========================================================================== */

export type BoxLevel = "low" | "medium" | "high";

export interface NineBox {
  id: string;
  performance: BoxLevel;
  potential: BoxLevel;
  /** Short name the grid shows in bold. */
  name: string;
  /** Full label, e.g. "High performance / High potential — Star". */
  label: string;
  guidance: string;
  /** Healthy distribution target, in per cent. The nine sum to 100. */
  targetPct: number;
  /** Rating this box converts to when the cycle is released. */
  rating: number;
  /** Index into the chart layer's sequential ramp. */
  seqIndex: number;
}

const LEVEL_LABEL: Record<BoxLevel, string> = { low: "Low", medium: "Medium", high: "High" };
const LEVEL_ORDER: BoxLevel[] = ["low", "medium", "high"];

export const NINE_BOXES: NineBox[] = [
  {
    id: "risk",
    performance: "low",
    potential: "low",
    name: "Risk",
    label: "Low performance / Low potential — Risk",
    guidance: "Needs a documented performance plan with a decision point inside 90 days.",
    targetPct: 3,
    rating: 1,
    seqIndex: 0,
  },
  {
    id: "solid",
    performance: "medium",
    potential: "low",
    name: "Solid Performer",
    label: "Medium performance / Low potential — Solid Performer",
    guidance: "Delivers the role well. Invest in depth, not in a next level.",
    targetPct: 18,
    rating: 3,
    seqIndex: 1,
  },
  {
    id: "specialist",
    performance: "high",
    potential: "low",
    name: "Trusted Professional",
    label: "High performance / Low potential — Trusted Professional",
    guidance: "Deep expert at this level. Retain with scope and recognition, not promotion.",
    targetPct: 9,
    rating: 4,
    seqIndex: 3,
  },
  {
    id: "inconsistent",
    performance: "low",
    potential: "medium",
    name: "Inconsistent Player",
    label: "Low performance / Medium potential — Inconsistent Player",
    guidance: "Capability is there and the output is not. Diagnose the blocker before the plan.",
    targetPct: 6,
    rating: 2,
    seqIndex: 1,
  },
  {
    id: "core",
    performance: "medium",
    potential: "medium",
    name: "Core Player",
    label: "Medium performance / Medium potential — Core Player",
    guidance: "The engine of the team. Keep them engaged and paid at band.",
    targetPct: 32,
    rating: 3,
    seqIndex: 3,
  },
  {
    id: "high_performer",
    performance: "high",
    potential: "medium",
    name: "High Performer",
    label: "High performance / Medium potential — High Performer",
    guidance: "Consistently above the bar. Stretch scope inside the current level.",
    targetPct: 13,
    rating: 4,
    seqIndex: 4,
  },
  {
    id: "enigma",
    performance: "low",
    potential: "high",
    name: "Enigma",
    label: "Low performance / High potential — Enigma",
    guidance: "High ceiling, low output. Usually a role-fit or manager-fit problem.",
    targetPct: 3,
    rating: 3,
    seqIndex: 3,
  },
  {
    id: "growth",
    performance: "medium",
    potential: "high",
    name: "High Potential",
    label: "Medium performance / High potential — High Potential",
    guidance: "Next level is visible. Give them the stretch project before someone else does.",
    targetPct: 9,
    rating: 4,
    seqIndex: 4,
  },
  {
    id: "star",
    performance: "high",
    potential: "high",
    name: "Star",
    label: "High performance / High potential — Star",
    guidance: "Promote, pay ahead of band, and name a successor for their current role.",
    targetPct: 7,
    rating: 5,
    seqIndex: 6,
  },
];

export const boxById = (id: string) => NINE_BOXES.find((b) => b.id === id)!;
export const boxAt = (performance: BoxLevel, potential: BoxLevel) =>
  NINE_BOXES.find((b) => b.performance === performance && b.potential === potential)!;

export const NINE_BOX_TARGET_TOTAL = NINE_BOXES.reduce((a, b) => a + b.targetPct, 0);

export const boxAxisLabel = (level: BoxLevel) => LEVEL_LABEL[level];
export const BOX_LEVELS = LEVEL_ORDER;

export interface CalibrationChip {
  employeeCode: string;
  name: string;
  designation: string;
  gradeId: string;
  branchId: string;
  boxId: string;
  /** Weighted manager rating carried in from the review form. */
  managerRating: number;
  tenureYears: number;
  /** Flagged when the manager's proposal and the box disagree. */
  flagged: boolean;
}

export const CALIBRATION_COHORT = {
  id: "CAL-2026-ENG",
  cycleId: ACTIVE_CYCLE.id,
  departmentId: "ENG",
  departmentName: "Engineering",
  facilitatorCode: "STL-0009",
  sponsorCode: "STL-0004",
  session: "2026-09-23",
  note: "Session 2 of 3 — Engineering G1 to G4. Sales and Customer Success calibrate on 25 Sep.",
};

/** Hand-set counts: they sum to exactly 45 and deliberately miss the target. */
const BOX_COUNTS: Record<string, number> = {
  risk: 2,
  solid: 7,
  specialist: 4,
  inconsistent: 3,
  core: 17,
  high_performer: 6,
  enigma: 1,
  growth: 3,
  star: 2,
};

export const CALIBRATION_CHIPS: CalibrationChip[] = (() => {
  const rng = mulberry32(45990);
  const cohort = EMPLOYEES.filter(
    (e) => e.departmentId === "ENG" && e.status !== "exited" && e.level >= 2,
  ).slice(0, 45);

  const slots: string[] = [];
  for (const [boxId, n] of Object.entries(BOX_COUNTS)) for (let i = 0; i < n; i++) slots.push(boxId);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  return cohort.map((e, i) => {
    const boxId = slots[i] ?? "core";
    const box = boxById(boxId);
    const form = reviewFormFor(e.code);
    const managerRating = form ? overallRating(form, "manager") : round2(box.rating + (rng() - 0.5) * 0.6);
    return {
      employeeCode: e.code,
      name: e.name,
      designation: e.designation,
      gradeId: e.gradeId,
      branchId: e.branchId,
      boxId,
      managerRating,
      tenureYears: round2(differenceInCalendarDays(TODAY, parseISO(e.joiningDate)) / 365),
      flagged: Math.abs(managerRating - box.rating) >= 1.2,
    };
  });
})();

/** Count per box for a given placement map — recomputed live as chips move. */
export function boxDistribution(placement: Record<string, string>) {
  const total = Object.keys(placement).length || 1;
  return NINE_BOXES.map((b) => {
    const count = Object.values(placement).filter((id) => id === b.id).length;
    return {
      boxId: b.id,
      name: b.name,
      label: b.label,
      count,
      actualPct: round2((count / total) * 100),
      targetPct: b.targetPct,
      targetCount: Math.round((b.targetPct / 100) * total),
      deltaPct: round2((count / total) * 100 - b.targetPct),
    };
  });
}

/** Rating histogram derived from the same placement — the two always agree. */
export function ratingDistribution(placement: Record<string, string>) {
  const counts = new Map<number, number>(RATING_SCALE.map((r) => [r.value, 0]));
  for (const boxId of Object.values(placement)) {
    const r = boxById(boxId).rating;
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const total = Object.keys(placement).length || 1;
  return RATING_SCALE.map((r) => ({
    rating: r.value,
    label: r.short,
    count: counts.get(r.value) ?? 0,
    pct: round2(((counts.get(r.value) ?? 0) / total) * 100),
  }));
}

/** The starting placement the calibration screen loads with. */
export const INITIAL_PLACEMENT: Record<string, string> = Object.fromEntries(
  CALIBRATION_CHIPS.map((c) => [c.employeeCode, c.boxId]),
);

/* ========================================================================== */
/*                                 LEARNING                                   */
/* ========================================================================== */

export type CourseFormat = "Self-paced" | "Instructor-led" | "Cohort" | "Workshop" | "Blended";

export interface Course {
  id: string;
  title: string;
  provider: string;
  category: string;
  /** Total learning time in minutes. */
  durationMins: number;
  format: CourseFormat;
  /** 1–5, one decimal. */
  rating: number;
  ratingCount: number;
  enrolments: number;
  level: "Foundation" | "Intermediate" | "Advanced";
  summary: string;
}

export const COURSE_CATEGORIES = [
  "Leadership",
  "Engineering",
  "Data",
  "Product",
  "Design",
  "Sales",
  "Finance",
  "Compliance",
  "Wellbeing",
];

export const COURSE_FORMATS: CourseFormat[] = [
  "Self-paced",
  "Instructor-led",
  "Cohort",
  "Workshop",
  "Blended",
];

const COURSE_SEEDS: Omit<Course, "id" | "rating" | "ratingCount" | "enrolments">[] = [
  { title: "Giving Feedback That Actually Lands", provider: "Stellar Academy", category: "Leadership", durationMins: 240, format: "Workshop", level: "Foundation", summary: "The SBI model, practised live on real situations from your own team." },
  { title: "First-Time Manager Foundations", provider: "Harvard ManageMentor", category: "Leadership", durationMins: 720, format: "Cohort", level: "Foundation", summary: "Six weeks on delegation, one-to-ones, performance conversations and hiring." },
  { title: "Running Calibration Without Losing the Room", provider: "Stellar Academy", category: "Leadership", durationMins: 180, format: "Workshop", level: "Advanced", summary: "How to facilitate a 9-box session where the ratings survive contact with evidence." },
  { title: "Distributed Systems in Practice", provider: "Pluralsight", category: "Engineering", durationMins: 960, format: "Self-paced", level: "Advanced", summary: "Consensus, partitioning and failure modes, with a build-it-yourself Raft exercise." },
  { title: "Designing Idempotent APIs", provider: "Internal Guild", category: "Engineering", durationMins: 150, format: "Self-paced", level: "Intermediate", summary: "Retry semantics, idempotency keys and exactly-once illusions, using our own payments service." },
  { title: "Production Kubernetes for Application Engineers", provider: "Udemy Business", category: "Engineering", durationMins: 840, format: "Self-paced", level: "Intermediate", summary: "Everything an app engineer needs to debug a pod at 2 a.m. without paging platform." },
  { title: "Performance Profiling for Web Applications", provider: "Pluralsight", category: "Engineering", durationMins: 420, format: "Self-paced", level: "Intermediate", summary: "Flame graphs, long tasks and the p95 that actually matters to a customer." },
  { title: "Secure Coding for Payment Systems", provider: "Stellar Academy", category: "Engineering", durationMins: 300, format: "Blended", level: "Advanced", summary: "PCI-adjacent threat modelling, tokenisation and the mistakes that reach production." },
  { title: "SQL for People Who Already Know SQL", provider: "Coursera", category: "Data", durationMins: 480, format: "Self-paced", level: "Advanced", summary: "Window functions, query plans and why your CTE is scanning the whole table." },
  { title: "Analytics Engineering with dbt", provider: "Coursera", category: "Data", durationMins: 600, format: "Cohort", level: "Intermediate", summary: "Modelling, testing and documenting a warehouse other people can trust." },
  { title: "Telling the Truth with Charts", provider: "Internal Guild", category: "Data", durationMins: 120, format: "Workshop", level: "Foundation", summary: "Chart choice, colour and the small lies that creep into a dashboard." },
  { title: "Product Discovery in Enterprise Software", provider: "Coursera", category: "Product", durationMins: 540, format: "Cohort", level: "Intermediate", summary: "Opportunity solution trees and customer interviews when your user is not the buyer." },
  { title: "Writing Specs Engineers Want to Read", provider: "Stellar Academy", category: "Product", durationMins: 180, format: "Workshop", level: "Foundation", summary: "Problem framing, non-goals and the one-page spec format we use here." },
  { title: "Pricing and Packaging for B2B SaaS", provider: "LinkedIn Learning", category: "Product", durationMins: 300, format: "Self-paced", level: "Advanced", summary: "Value metrics, tiering and the migration plan nobody budgets for." },
  { title: "Accessible Interfaces from the Start", provider: "Internal Guild", category: "Design", durationMins: 270, format: "Blended", level: "Intermediate", summary: "WCAG 2.2 in practice — focus order, contrast, and testing with a screen reader." },
  { title: "Design Systems at Scale", provider: "LinkedIn Learning", category: "Design", durationMins: 390, format: "Self-paced", level: "Advanced", summary: "Tokens, governance and how a system stops being a component library." },
  { title: "Enterprise Discovery Calls That Convert", provider: "LinkedIn Learning", category: "Sales", durationMins: 210, format: "Instructor-led", level: "Intermediate", summary: "MEDDIC applied to a two-quarter enterprise cycle, with call recordings." },
  { title: "Negotiating Multi-Year Contracts", provider: "Harvard ManageMentor", category: "Sales", durationMins: 360, format: "Cohort", level: "Advanced", summary: "Concession planning, ramp deals and the clauses Finance will refuse." },
  { title: "Ind AS for Non-Finance Managers", provider: "NIIT", category: "Finance", durationMins: 480, format: "Self-paced", level: "Foundation", summary: "Revenue recognition, leases and why your budget and the P&L disagree." },
  { title: "Payroll Compliance in India", provider: "NIIT", category: "Finance", durationMins: 420, format: "Instructor-led", level: "Intermediate", summary: "PF, ESI, Professional Tax and gratuity, with the filing calendar that goes with them." },
  { title: "Prevention of Sexual Harassment at Work", provider: "Stellar Academy", category: "Compliance", durationMins: 90, format: "Self-paced", level: "Foundation", summary: "The POSH Act, the internal committee, and what to do in the first hour." },
  { title: "Information Security Essentials", provider: "Stellar Academy", category: "Compliance", durationMins: 75, format: "Self-paced", level: "Foundation", summary: "Phishing, device hygiene, secrets handling and incident reporting." },
  { title: "Managing Energy, Not Just Time", provider: "LinkedIn Learning", category: "Wellbeing", durationMins: 150, format: "Self-paced", level: "Foundation", summary: "Recovery, attention and how on-call rotations quietly wreck sleep." },
  { title: "Psychological Safety for Teams", provider: "Harvard ManageMentor", category: "Wellbeing", durationMins: 240, format: "Workshop", level: "Intermediate", summary: "Making it safe to say 'I broke production' before the customer says it for you." },
];

export const COURSES: Course[] = (() => {
  const rng = mulberry32(24071);
  return COURSE_SEEDS.map((c, i) => {
    const ratingCount = randInt(rng, 14, 220);
    return {
      ...c,
      id: `CRS-${String(i + 1).padStart(3, "0")}`,
      rating: round2(3.4 + rng() * 1.5),
      ratingCount,
      enrolments: randInt(rng, 18, 268),
    };
  });
})();

export const courseById = (id: string) => COURSES.find((c) => c.id === id) ?? null;

export type EnrolmentStatus = "completed" | "on_track" | "at_risk" | "scheduled";

export interface Enrolment {
  id: string;
  employeeCode: string;
  courseId: string;
  status: EnrolmentStatus;
  /** 0–100 */
  progress: number;
  enrolledOn: string;
  dueOn: string;
  lastActivityOn: string | null;
  completedOn: string | null;
  /** Minutes of the course already watched / attended. */
  minutesDone: number;
}

const ENROLMENT_OWNERS = [
  "STL-0001",
  "STL-0009",
  "STL-0017",
  "STL-0031",
  "STL-0058",
  ...VIKRAM_TEAM_CODES,
];

export const ENROLMENTS: Enrolment[] = (() => {
  const rng = mulberry32(70113);
  const out: Enrolment[] = [];
  ENROLMENT_OWNERS.forEach((employeeCode, oi) => {
    const n = randInt(rng, 4, 7);
    const taken = new Set<number>();
    for (let i = 0; i < n; i++) {
      let ci = (oi * 5 + i * 7 + randInt(rng, 0, 4)) % COURSES.length;
      while (taken.has(ci)) ci = (ci + 1) % COURSES.length;
      taken.add(ci);
      const course = COURSES[ci];
      const enrolledOn = addDays(TODAY, -randInt(rng, 8, 150));
      const dueOn = addDays(enrolledOn, randInt(rng, 45, 120));
      const r = rng();
      const progress = r > 0.62 ? 100 : r > 0.12 ? randInt(rng, 10, 92) : 0;
      const overdue = differenceInCalendarDays(dueOn, TODAY) < 14;
      const status: EnrolmentStatus =
        progress === 100 ? "completed" : progress === 0 ? "scheduled" : overdue ? "at_risk" : "on_track";
      out.push({
        id: `ENR-${employeeCode.replace("STL-", "")}-${course.id}`,
        employeeCode,
        courseId: course.id,
        status,
        progress,
        enrolledOn: iso(enrolledOn),
        dueOn: iso(dueOn),
        lastActivityOn: progress === 0 ? null : iso(addDays(TODAY, -randInt(rng, 0, 20))),
        completedOn: progress === 100 ? iso(addDays(TODAY, -randInt(rng, 1, 60))) : null,
        minutesDone: Math.round((progress / 100) * course.durationMins),
      });
    }
  });
  return out;
})();

export const enrolmentsFor = (employeeCode: string) =>
  ENROLMENTS.filter((e) => e.employeeCode === employeeCode);

/* ------------------------------------------------------ compliance training */

export interface ComplianceTraining {
  id: string;
  name: string;
  shortName: string;
  mandate: string;
  /** Certificate validity in months. */
  validityMonths: number;
  durationMins: number;
  ownerCode: string;
  courseId: string | null;
}

export const COMPLIANCE_TRAININGS: ComplianceTraining[] = [
  {
    id: "CT-POSH",
    name: "Prevention of Sexual Harassment (POSH)",
    shortName: "POSH",
    mandate: "Sexual Harassment of Women at Workplace Act, 2013 — annual for every employee",
    validityMonths: 12,
    durationMins: 90,
    ownerCode: "STL-0009",
    courseId: "CRS-021",
  },
  {
    id: "CT-INFOSEC",
    name: "Information Security Awareness",
    shortName: "Information Security",
    mandate: "ISO 27001 Annex A.6.3 — annual, evidenced at audit",
    validityMonths: 12,
    durationMins: 75,
    ownerCode: "STL-0010",
    courseId: "CRS-022",
  },
  {
    id: "CT-COC",
    name: "Code of Conduct & Ethics",
    shortName: "Code of Conduct",
    mandate: "Board policy — attested every two years",
    validityMonths: 24,
    durationMins: 45,
    ownerCode: "STL-0009",
    courseId: null,
  },
  {
    id: "CT-ABAC",
    name: "Anti-Bribery & Anti-Corruption",
    shortName: "Anti-Bribery",
    mandate: "Prevention of Corruption Act & UK Bribery Act — annual for all customer-facing staff",
    validityMonths: 12,
    durationMins: 60,
    ownerCode: "STL-0008",
    courseId: null,
  },
  {
    id: "CT-DPDP",
    name: "Data Privacy & DPDP Act",
    shortName: "Data Privacy",
    mandate: "Digital Personal Data Protection Act, 2023 — annual for anyone handling personal data",
    validityMonths: 12,
    durationMins: 60,
    ownerCode: "STL-0010",
    courseId: null,
  },
];

export const trainingById = (id: string) => COMPLIANCE_TRAININGS.find((t) => t.id === id)!;

export type ComplianceStatus = "completed" | "pending" | "expired";

export interface ComplianceRecord {
  trainingId: string;
  employeeCode: string;
  status: ComplianceStatus;
  completedOn: string | null;
  expiresOn: string | null;
  /** Negative when already expired. */
  daysToExpiry: number | null;
}

/** Hand-set outcomes for the six demo personas, so every tone is on screen. */
const PERSONA_COMPLIANCE: Record<string, Record<string, number | null>> = {
  /* value = days from DEMO_TODAY until expiry; null = never completed */
  "STL-0142": { "CT-POSH": 18, "CT-INFOSEC": -23, "CT-COC": 412, "CT-ABAC": 96, "CT-DPDP": null },
  "STL-0031": { "CT-POSH": 7, "CT-INFOSEC": 141, "CT-COC": 268, "CT-ABAC": -61, "CT-DPDP": 203 },
  "STL-0009": { "CT-POSH": 291, "CT-INFOSEC": 26, "CT-COC": 520, "CT-ABAC": 174, "CT-DPDP": 88 },
  "STL-0017": { "CT-POSH": 134, "CT-INFOSEC": -9, "CT-COC": 63, "CT-ABAC": 21, "CT-DPDP": 245 },
  "STL-0058": { "CT-POSH": 59, "CT-INFOSEC": 11, "CT-COC": 344, "CT-ABAC": null, "CT-DPDP": 167 },
  "STL-0001": { "CT-POSH": 228, "CT-INFOSEC": 82, "CT-COC": 611, "CT-ABAC": 29, "CT-DPDP": -4 },
};

export const COMPLIANCE_RECORDS: ComplianceRecord[] = (() => {
  const rng = mulberry32(551302);
  const out: ComplianceRecord[] = [];

  for (const emp of EMPLOYEES) {
    for (const t of COMPLIANCE_TRAININGS) {
      const forced = PERSONA_COMPLIANCE[emp.code]?.[t.id];
      let daysToExpiry: number | null;

      if (forced !== undefined) {
        daysToExpiry = forced;
      } else {
        const r = rng();
        /* ~7% never took it, the rest are spread across the validity window
           with a deliberate tail that has already lapsed. */
        daysToExpiry = r < 0.07 ? null : randInt(rng, -80, t.validityMonths * 30);
      }

      if (daysToExpiry === null) {
        out.push({
          trainingId: t.id,
          employeeCode: emp.code,
          status: "pending",
          completedOn: null,
          expiresOn: null,
          daysToExpiry: null,
        });
        continue;
      }

      const expires = addDays(TODAY, daysToExpiry);
      const completed = addDays(expires, -t.validityMonths * 30);
      out.push({
        trainingId: t.id,
        employeeCode: emp.code,
        status: daysToExpiry < 0 ? "expired" : "completed",
        completedOn: iso(completed),
        expiresOn: iso(expires),
        daysToExpiry,
      });
    }
  }
  return out;
})();

export const complianceFor = (employeeCode: string) =>
  COMPLIANCE_TRAININGS.map(
    (t) => COMPLIANCE_RECORDS.find((r) => r.employeeCode === employeeCode && r.trainingId === t.id)!,
  );

/** Expiry banding — the panel colours and, more importantly, labels by this. */
export type ExpiryBand = "expired" | "expiring" | "pending" | "valid";

export function expiryBand(record: ComplianceRecord): ExpiryBand {
  if (record.status === "pending") return "pending";
  if (record.daysToExpiry === null) return "pending";
  if (record.daysToExpiry < 0) return "expired";
  if (record.daysToExpiry <= 30) return "expiring";
  return "valid";
}

export interface ComplianceSummaryRow {
  trainingId: string;
  name: string;
  shortName: string;
  total: number;
  completed: number;
  expiring: number;
  expired: number;
  pending: number;
  completionRate: number;
}

export const COMPLIANCE_SUMMARY: ComplianceSummaryRow[] = COMPLIANCE_TRAININGS.map((t) => {
  const rows = COMPLIANCE_RECORDS.filter((r) => r.trainingId === t.id);
  const bands = rows.map(expiryBand);
  const expired = bands.filter((b) => b === "expired").length;
  const expiring = bands.filter((b) => b === "expiring").length;
  const pending = bands.filter((b) => b === "pending").length;
  const valid = bands.filter((b) => b === "valid").length;
  const completed = valid + expiring;
  return {
    trainingId: t.id,
    name: t.name,
    shortName: t.shortName,
    total: rows.length,
    completed,
    expiring,
    expired,
    pending,
    completionRate: round2((completed / Math.max(1, rows.length)) * 100),
  };
});

export const COMPLIANCE_TOTALS = {
  records: COMPLIANCE_RECORDS.length,
  expired: COMPLIANCE_RECORDS.filter((r) => expiryBand(r) === "expired").length,
  expiring: COMPLIANCE_RECORDS.filter((r) => expiryBand(r) === "expiring").length,
  pending: COMPLIANCE_RECORDS.filter((r) => expiryBand(r) === "pending").length,
  completionRate: round2(
    (COMPLIANCE_RECORDS.filter((r) => ["valid", "expiring"].includes(expiryBand(r))).length /
      Math.max(1, COMPLIANCE_RECORDS.length)) *
      100,
  ),
};

/* ---------------------------------------------------------- learning stats */

export function learningStatsFor(employeeCode: string) {
  const mine = enrolmentsFor(employeeCode);
  const done = mine.filter((e) => e.status === "completed");
  const minutes = mine.reduce((a, e) => a + e.minutesDone, 0);
  const mandatory = complianceFor(employeeCode);
  const bands = mandatory.map(expiryBand);
  return {
    enrolled: mine.length,
    completed: done.length,
    inProgress: mine.filter((e) => e.status === "on_track" || e.status === "at_risk").length,
    hours: round2(minutes / 60),
    mandatoryDue: bands.filter((b) => b === "expired" || b === "expiring" || b === "pending").length,
    mandatoryExpired: bands.filter((b) => b === "expired").length,
    mandatoryExpiring: bands.filter((b) => b === "expiring").length,
  };
}
