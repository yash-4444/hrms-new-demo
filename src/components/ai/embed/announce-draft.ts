import { TENANT } from "@/mock/org";
import type { AnnouncementCategory } from "@/mock/workplace";

/* ============================================================================
   Local announcement drafter — deterministic templates keyed on the topic's
   wording, the chosen audience and tone. Stands in for the model call; the
   output is always presented as an AI draft for a person to edit.
   ========================================================================== */

export type AnnounceTone = "Friendly" | "Formal" | "Urgent";

const CATEGORY_RULES: [RegExp, AnnouncementCategory][] = [
  [/posh|audit|statutory|compliance|pf|esi|tds|labour|labor|filing/i, "Compliance"],
  [/policy|rule|guideline|handbook|code of conduct|wfh|work from home|leave/i, "Policy"],
  [/insurance|benefit|wellness|medical|nps|esop|gratuity|health/i, "Benefits"],
  [/launch|release|product|feature|customer|roadmap/i, "Product"],
  [/welcome|joiner|promotion|award|celebrat|farewell|town ?hall|people/i, "People"],
  [/office|campus|move|moving|holiday|parking|canteen|wifi|wi-fi|maintenance|power|floor/i, "Office"],
];

const OPENERS: Record<AnnounceTone, string> = {
  Friendly: "Hi everyone,",
  Formal: "Dear colleagues,",
  Urgent: "Action required:",
};

const CLOSERS: Record<AnnounceTone, string> = {
  Friendly: "Thanks for being part of it — reach out on the helpdesk if anything is unclear.",
  Formal: "Please direct any questions to People Operations through the helpdesk.",
  Urgent: "Please read and acknowledge today. Raise a helpdesk ticket if this affects your work.",
};

const NEXT_STEPS: Record<AnnouncementCategory, string> = {
  Policy: "The updated document is in the Policies library. Managers, please walk your teams through what changes for them in this week's 1:1s.",
  People: "Join us in making this a great moment for the team — details and timings will be on the calendar invite.",
  Benefits: "You can review your enrolment under My Benefits. Changes made by the end of the month apply from the next payroll run.",
  Office: "Facilities will share floor plans and access details by email. Your badge and parking access carry over automatically.",
  Product: "A short demo is on the town-hall agenda; release notes are linked from the product wiki.",
  Compliance: "Completion is tracked for the compliance pack. Overdue items are escalated to your reporting manager after 7 days.",
};

const sentence = (s: string) => {
  const t = s.trim().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const titleCase = (s: string) =>
  sentence(s)
    .split(" ")
    .map((w, i) => (i > 0 && /^(a|an|the|on|in|to|for|of|and|at|by)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");

export function draftAnnouncement({
  topic,
  tone,
  audience,
  category,
  author,
}: {
  topic: string;
  tone: AnnounceTone;
  audience: string;
  category: AnnouncementCategory;
  author: string;
}): { title: string; summary: string; body: string; category: AnnouncementCategory } {
  const cat = CATEGORY_RULES.find(([re]) => re.test(topic))?.[1] ?? category;
  const core = sentence(topic);
  const scope = audience === "All employees" ? `everyone at ${TENANT.shortName}` : `colleagues in our ${audience.replace(/ office$/, "")} office`;
  const prefix = tone === "Urgent" ? "Action required: " : "";
  const title = `${prefix}${titleCase(core)}`.slice(0, 110);
  const summary = `${core} — what it means for ${scope} and what to do next.`.slice(0, 190);
  const body = [
    `${OPENERS[tone]} ${core}. This applies to ${scope}.`,
    NEXT_STEPS[cat],
    `${CLOSERS[tone]}\n\n— ${author}`,
  ].join("\n\n");
  return { title, summary, body, category: cat };
}
