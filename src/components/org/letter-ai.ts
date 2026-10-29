import { differenceInMonths, parseISO } from "date-fns";
import { DEMO_TODAY, branchById, deptName } from "@/mock/org";
import type { Employee } from "@/mock/employees";
import type { LetterType } from "@/mock/masters";

/* Deterministic "AI draft" paragraph tailored to the employee and letter type.
   Mock-only: shaped like a model answer, built from real record fields. */

export function aiLetterParagraph(type: LetterType, e: Employee): { text: string; sources: string[] } {
  const months = differenceInMonths(parseISO(DEMO_TODAY), parseISO(e.joiningDate));
  const tenure = months >= 12 ? `${Math.floor(months / 12)} year${months >= 24 ? "s" : ""}` : `${months} months`;
  const dept = deptName(e.departmentId);
  const city = branchById(e.branchId)?.city ?? "";
  const skills = e.skills.slice(0, 2).join(" and ") || "your craft";
  const sources = ["Employee profile", "Skills on record"];
  switch (type) {
    case "increment":
      return {
        text: `In your ${tenure} with the ${dept} team, your depth in ${skills} has made you someone colleagues rely on. This revision reflects both what you have delivered this year and the larger scope we expect you to take on next.`,
        sources: [...sources, "2025-26 review cycle"],
      };
    case "confirmation":
      return {
        text: `Your manager highlighted how quickly you became productive in ${dept} — particularly your work in ${skills}. We are glad to have you as a confirmed member of the ${city} team.`,
        sources: [...sources, "Probation review"],
      };
    case "transfer":
      return {
        text: `The move recognises the ${skills} expertise you have built over ${tenure} in ${city}. The receiving team is looking forward to having you, and your People partner will set up an introduction call in your first week.`,
        sources,
      };
    case "offer":
    case "appointment":
      return {
        text: `We were impressed by your background in ${skills} throughout the interview process, and we believe you will make an immediate difference to the ${dept} team in ${city}.`,
        sources: ["Interview scorecards", "Candidate profile"],
      };
    case "relieving":
    case "experience":
      return {
        text: `Over ${tenure} with us, ${e.firstName} contributed consistently to ${dept}, with particular strength in ${skills}, and handed over responsibilities in an orderly manner.`,
        sources: [...sources, "Exit clearance"],
      };
    case "warning":
      return {
        text: `We value your ${tenure} of contribution to ${dept} and want to support you in getting back on track. Your manager will schedule a fortnightly check-in for the next two months.`,
        sources: ["Attendance register", "Manager notes"],
      };
  }
}
