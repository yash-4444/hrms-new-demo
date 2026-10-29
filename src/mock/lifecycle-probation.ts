import { addMonths, differenceInDays, format, parseISO } from "date-fns";
import { EMPLOYEES, type Employee } from "./employees";
import { DEMO_TODAY } from "./org";

/* ============================================================================
   Probation & confirmation. Policy: 6 months for G1–G3, 3 months for G4 and
   above. The end date is computed from the joining date plus any extension —
   it is never stored, so an extension moves it everywhere at once.
   ========================================================================== */

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export type Recommendation = "Confirm" | "Extend" | "Terminate";

export interface ProbationReview {
  rating: number;
  recommendation: Recommendation;
  extendMonths?: number;
  comment: string;
  submittedOn: string;
}

export interface ProbationRecord {
  code: string;
  employee: Employee;
  policyMonths: number;
  extendedMonths: number;
  extensionNote: string | null;
  endDate: string;
  daysToEnd: number;
  review: ProbationReview | null;
}

export const policyMonthsFor = (gradeId: string) => (["G4", "G5", "G6", "G7"].includes(gradeId) ? 3 : 6);

const EXTENSIONS: Record<string, { months: number; note: string }> = {
  "STL-0055": { months: 3, note: "Extended 14 Jul 2026 by 3 months — on-call ownership not yet demonstrated." },
};

const REVIEWS: Record<string, ProbationReview> = {
  "STL-0020": { rating: 4, recommendation: "Confirm", comment: "Stabilised the Pune payroll squad and closed two quarters of carry-over debt. Ready.", submittedOn: "2026-08-20" },
  "STL-0067": { rating: 4, recommendation: "Confirm", comment: "Ramped fast on the leave engine; reviews are careful and well reasoned.", submittedOn: "2026-09-11" },
  "STL-0075": { rating: 2, recommendation: "Extend", extendMonths: 2, comment: "Code-review turnaround has been inconsistent. Agreed a two-month plan with clear weekly goals.", submittedOn: "2026-09-12" },
  "STL-0156": { rating: 5, recommendation: "Confirm", comment: "Owned the statutory compliance roadmap end to end. Exceptional first six months.", submittedOn: "2026-09-14" },
  "STL-0055": { rating: 3, recommendation: "Confirm", comment: "On-call ownership now consistent through the extension. Recommend confirmation.", submittedOn: "2026-09-10" },
  "STL-0314": { rating: 3, recommendation: "Confirm", comment: "Reliable on the service desk; asset audits completed on time.", submittedOn: "2026-09-15" },
};

export const PROBATION: ProbationRecord[] = EMPLOYEES.filter((e) => e.status === "probation")
  .map((e) => {
    const policyMonths = policyMonthsFor(e.gradeId);
    const ext = EXTENSIONS[e.code];
    const end = addMonths(parseISO(e.joiningDate), policyMonths + (ext?.months ?? 0));
    return {
      code: e.code,
      employee: e,
      policyMonths,
      extendedMonths: ext?.months ?? 0,
      extensionNote: ext?.note ?? null,
      endDate: iso(end),
      daysToEnd: differenceInDays(end, parseISO(DEMO_TODAY)),
      review: REVIEWS[e.code] ?? null,
    };
  })
  .sort((a, b) => a.endDate.localeCompare(b.endDate));

export type ProbationState = "overdue" | "due_soon" | "upcoming";

export const probationState = (r: Pick<ProbationRecord, "daysToEnd">): ProbationState =>
  r.daysToEnd < 0 ? "overdue" : r.daysToEnd <= 30 ? "due_soon" : "upcoming";

export const extendEnd = (endDate: string, months: number) => iso(addMonths(parseISO(endDate), months));
