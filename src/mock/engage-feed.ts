/* ==========================================================================
   Engagement · company feed and policy documents.
   ========================================================================== */

import { DEPARTMENTS } from "./org";
import { mulberry32 } from "@/lib/utils";

/* ------------------------------------------------------------- feed */

export type ReactionKey = "like" | "celebrate" | "insightful" | "support";
export const REACTIONS: { key: ReactionKey; label: string; emoji: string }[] = [
  { key: "like", label: "Like", emoji: "👍" },
  { key: "celebrate", label: "Celebrate", emoji: "🎉" },
  { key: "insightful", label: "Insightful", emoji: "💡" },
  { key: "support", label: "Support", emoji: "🤝" },
];

export interface FeedComment {
  id: string;
  authorCode: string;
  text: string;
  at: string;
}

export interface FeedPoll {
  question: string;
  options: { id: string; label: string; votes: number }[];
  closesOn: string;
}

export interface FeedPost {
  id: string;
  authorCode: string;
  at: string;
  text: string;
  /** Gradient key for a CSS image placeholder; null when the post has no image. */
  image: { tone: "violet" | "teal" | "amber" | "rose"; caption: string } | null;
  poll: FeedPoll | null;
  pinned: boolean;
  reactions: Record<ReactionKey, number>;
  comments: FeedComment[];
  /** Moderation state — HR can hide a post pending review. */
  flagged: boolean;
  hidden: boolean;
  audience: string;
}

export const FEED_POSTS: FeedPost[] = [
  {
    id: "POST-118", authorCode: "STL-0001", at: "2026-09-15T09:05:00", pinned: true, audience: "Everyone",
    text: "We crossed 340 people this week. Thank you for building Stellar with us. Town hall on Friday 26 Sep at 4 pm — bring your hardest questions; the Q&A board is open now.",
    image: { tone: "violet", caption: "Town hall · Bengaluru HQ auditorium" }, poll: null,
    reactions: { like: 186, celebrate: 94, insightful: 6, support: 22 }, flagged: false, hidden: false,
    comments: [
      { id: "C1", authorCode: "STL-0009", text: "Livestream link goes out Thursday for Pune and Newark.", at: "2026-09-15T09:40:00" },
      { id: "C2", authorCode: "STL-0145", text: "Will the roadmap section cover the US payroll launch?", at: "2026-09-15T10:12:00" },
    ],
  },
  {
    id: "POST-117", authorCode: "STL-0009", at: "2026-09-14T16:20:00", pinned: true, audience: "Everyone",
    text: "Mid-year reviews are open until 9 Oct. Self reviews first — managers can't start until you submit. Need help? The People Ops desk is on the 3rd floor every afternoon this week.",
    image: null,
    poll: { question: "When do you prefer review reminders?", closesOn: "2026-09-20", options: [
      { id: "a", label: "Monday morning", votes: 84 }, { id: "b", label: "Wednesday afternoon", votes: 41 }, { id: "c", label: "Only on the deadline week", votes: 57 } ] },
    reactions: { like: 72, celebrate: 4, insightful: 18, support: 9 }, flagged: false, hidden: false, comments: [],
  },
  {
    id: "POST-116", authorCode: "STL-0145", at: "2026-09-13T11:45:00", pinned: false, audience: "Engineering",
    text: "Payroll Core shipped idempotent bank-file retries. Zero duplicate payouts across 3 pay runs since. Huge thanks to Ananya and Karthik for the late nights.",
    image: { tone: "teal", caption: "Retry dashboard — 0 duplicates" }, poll: null,
    reactions: { like: 64, celebrate: 51, insightful: 23, support: 3 }, flagged: false, hidden: false,
    comments: [{ id: "C3", authorCode: "STL-0031", text: "Proud of this team. Writing it up for the engineering blog.", at: "2026-09-13T12:10:00" }],
  },
  {
    id: "POST-115", authorCode: "STL-0013", at: "2026-09-12T15:00:00", pinned: false, audience: "Everyone",
    text: "Our customer story with Acme Logistics is live — 2,400 employees moved to Stellar payroll in six weeks. Share it on LinkedIn if you're proud of it.",
    image: { tone: "amber", caption: "Acme Logistics customer story" }, poll: null,
    reactions: { like: 93, celebrate: 38, insightful: 11, support: 4 }, flagged: false, hidden: false, comments: [],
  },
  {
    id: "POST-114", authorCode: "STL-0058", at: "2026-09-11T10:30:00", pinned: false, audience: "Everyone",
    text: "Referral bonus for Senior Backend Engineers is now ₹75,000 till 31 Oct. Know someone great? Refer them from Careers → Refer.",
    image: null, poll: null,
    reactions: { like: 48, celebrate: 6, insightful: 2, support: 12 }, flagged: false, hidden: false, comments: [],
  },
  {
    id: "POST-113", authorCode: "STL-0010", at: "2026-09-10T18:05:00", pinned: false, audience: "Everyone",
    text: "Reminder: the Wi-Fi on floor 4 is being replaced Saturday. Use floor 2 or WFH if you're planning to come in.",
    image: null, poll: null,
    reactions: { like: 21, celebrate: 0, insightful: 3, support: 1 }, flagged: true, hidden: false,
    comments: [{ id: "C4", authorCode: "STL-0147", text: "Again? This is the third weekend this month.", at: "2026-09-10T19:00:00" }],
  },
  {
    id: "POST-112", authorCode: "STL-0011", at: "2026-09-09T12:00:00", pinned: false, audience: "Everyone",
    text: "Design crit is open to everyone this Thursday — we're reviewing the new employee self-service app. Bring opinions.",
    image: { tone: "rose", caption: "Self-service app — first look" }, poll: null,
    reactions: { like: 37, celebrate: 9, insightful: 14, support: 2 }, flagged: false, hidden: false, comments: [],
  },
];

/* --------------------------------------------------------- policy library */

export interface PolicyVersion {
  version: string;
  publishedOn: string;
  changeNote: string;
}

export interface PolicyDoc {
  id: string;
  title: string;
  category: "Conduct" | "Leave & time" | "Security" | "Benefits" | "Travel";
  ownerCode: string;
  versions: PolicyVersion[];
  /** Must every employee acknowledge it? */
  requiresAcceptance: boolean;
  sections: { heading: string; body: string }[];
}

export const POLICIES: PolicyDoc[] = [
  {
    id: "POL-COC", title: "Code of Conduct", category: "Conduct", ownerCode: "STL-0009", requiresAcceptance: true,
    versions: [
      { version: "4.1", publishedOn: "2026-09-01", changeNote: "Added the generative-AI usage clause (§6) and updated the gifts threshold to ₹5,000." },
      { version: "4.0", publishedOn: "2025-10-01", changeNote: "Annual review; conflict-of-interest declaration moved online." },
    ],
    sections: [
      { heading: "1. Purpose", body: "This code sets out how we treat each other, our customers and the data they trust us with. It applies to every employee, contractor and intern, in every location." },
      { heading: "2. Respect at work", body: "We do not tolerate harassment, discrimination or bullying. Concerns can be raised with your manager, People Ops, or anonymously through the ethics line." },
      { heading: "3. Conflicts of interest", body: "Declare any outside employment, board seat or financial interest in a customer or vendor within 30 days. Declarations are reviewed by People Ops and Legal." },
      { heading: "4. Gifts and hospitality", body: "You may accept gifts up to ₹5,000 in value. Anything above must be declared and is usually returned or donated." },
      { heading: "5. Customer data", body: "Customer payroll and personal data is accessed only for a ticketed purpose. Every access is logged and reviewed quarterly." },
      { heading: "6. Generative AI", body: "Use only approved AI tools. Never paste customer data, salaries or personal identifiers into a tool that is not on the approved list. AI output is reviewed by a human before it reaches a customer or an employee record." },
      { heading: "7. Speaking up", body: "Retaliation against anyone who raises a concern in good faith is itself a breach of this code." },
    ],
  },
  {
    id: "POL-POSH", title: "Prevention of Sexual Harassment Policy", category: "Conduct", ownerCode: "STL-0009", requiresAcceptance: true,
    versions: [{ version: "3.0", publishedOn: "2026-01-15", changeNote: "Internal Committee reconstituted; external member updated." }],
    sections: [
      { heading: "1. Scope", body: "Applies to all workplaces, including client sites, offsites and virtual meetings." },
      { heading: "2. Internal Committee", body: "Presided by a senior woman employee, with an external member from an NGO. Complaints are acknowledged within 2 working days." },
      { heading: "3. Process", body: "Inquiry concludes within 90 days. Interim relief such as a transfer or leave can be granted on request." },
    ],
  },
  {
    id: "POL-INFOSEC", title: "Acceptable Use & Information Security", category: "Security", ownerCode: "STL-0010", requiresAcceptance: true,
    versions: [
      { version: "2.3", publishedOn: "2026-07-01", changeNote: "Mandatory hardware keys for admin consoles." },
      { version: "2.2", publishedOn: "2025-11-12", changeNote: "BYOD rules tightened." },
    ],
    sections: [
      { heading: "1. Devices", body: "Company laptops are encrypted and managed. Personal devices may access email only through the managed app." },
      { heading: "2. Credentials", body: "Never share passwords. Admin consoles require a hardware security key from 1 July 2026." },
      { heading: "3. Incidents", body: "Report a suspected phishing email or lost device to #security within one hour." },
    ],
  },
  {
    id: "POL-LEAVE", title: "Leave & Holiday Policy", category: "Leave & time", ownerCode: "STL-0009", requiresAcceptance: false,
    versions: [{ version: "5.2", publishedOn: "2026-04-01", changeNote: "Earned leave carry-forward cap raised to 45 days." }],
    sections: [
      { heading: "1. Entitlement", body: "18 earned leave, 8 casual leave and 8 sick leave per financial year, accrued monthly." },
      { heading: "2. Carry forward", body: "Up to 45 days of earned leave carry forward; the rest is encashed at basic pay." },
    ],
  },
  {
    id: "POL-TRAVEL", title: "Travel & Expense Policy", category: "Travel", ownerCode: "STL-0008", requiresAcceptance: false,
    versions: [{ version: "3.4", publishedOn: "2026-06-15", changeNote: "Per-diem revised for metro cities." }],
    sections: [
      { heading: "1. Air travel", body: "Economy class, capped at ₹18,000 per sector, booked at least 7 days ahead through the travel desk." },
      { heading: "2. Per diem", body: "₹3,500 per day in metro cities, ₹2,500 elsewhere, covering meals and local conveyance." },
    ],
  },
];

/** Acceptance of the CURRENT version, by department (HR tracking view). */
export const POLICY_ACCEPTANCE = (() => {
  const rng = mulberry32(4242);
  return POLICIES.filter((p) => p.requiresAcceptance).map((p) => ({
    policyId: p.id,
    byDept: DEPARTMENTS.map((d) => {
      const fresh = p.versions[0].publishedOn >= "2026-09-01";
      const rate = fresh ? 0.25 + rng() * 0.45 : 0.82 + rng() * 0.17;
      const accepted = Math.min(d.headcount, Math.round(d.headcount * rate));
      return { departmentId: d.id, department: d.name, headcount: d.headcount, accepted, pending: d.headcount - accepted };
    }),
  }));
})();

/** Which versions the signed-in persona has already accepted (seeded). */
export const MY_ACCEPTED: Record<string, string> = {
  "POL-COC": "4.0",
  "POL-POSH": "3.0",
  "POL-INFOSEC": "2.3",
};

