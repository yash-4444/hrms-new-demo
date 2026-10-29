import { deptName } from "./org";
import { employeeByCode, employeeName } from "./employees";

/* ============================================================================
   SERVICE · HR CASES — grievance, disciplinary, investigation and POSH
   referrals. Every view of a case is written to its access log. POSH
   referrals are visible only to HR Admin (and the Internal Committee); the
   HR Ops agent sees that they exist, never what is in them.
   ========================================================================== */

export type CaseType = "Grievance" | "Disciplinary" | "Investigation" | "POSH referral";
export const CASE_TYPES: CaseType[] = ["Grievance", "Disciplinary", "Investigation", "POSH referral"];

export interface CaseEvent {
  date: string;
  actor: string;
  event: string;
}

export interface CaseNote {
  date: string;
  author: string;
  text: string;
}

export interface CaseEvidence {
  name: string;
  kind: "Document" | "Email" | "Image" | "Recording" | "Statement";
  addedBy: string;
  date: string;
  size: string;
}

export interface CaseAccess {
  at: string;
  who: string;
  action: string;
}

export interface HrCase {
  id: string;
  type: CaseType;
  title: string;
  complainant: string;
  subjectCode: string | null;
  subjectName: string;
  department: string;
  openedOn: string;
  owner: string;
  status: "open" | "in_review" | "on_hold" | "closed";
  /** true = POSH: HR Admin and the Internal Committee only. */
  restricted: boolean;
  dueOn: string;
  timeline: CaseEvent[];
  notes: CaseNote[];
  evidence: CaseEvidence[];
  outcome: string | null;
  access: CaseAccess[];
}

const subject = (code: string) => ({
  subjectCode: code,
  subjectName: employeeName(code),
  department: deptName(employeeByCode(code)!.departmentId),
});

export const HR_CASES: HrCase[] = [
  {
    id: "HRC-2026-014",
    type: "Grievance",
    title: "Shift roster published with less than 48 hours' notice, three weeks running",
    complainant: employeeName("STL-0220"),
    ...subject("STL-0007"),
    openedOn: "2026-08-26",
    owner: "Ishita Kulkarni",
    status: "in_review",
    restricted: false,
    dueOn: "2026-09-25",
    timeline: [
      { date: "2026-08-26", actor: employeeName("STL-0220"), event: "Grievance raised through the portal" },
      { date: "2026-08-27", actor: "Ishita Kulkarni", event: "Acknowledged; case owner assigned" },
      { date: "2026-09-03", actor: "Ishita Kulkarni", event: "Roster history pulled for June–August" },
      { date: "2026-09-10", actor: "Ishita Kulkarni", event: "Meeting held with the department head" },
    ],
    notes: [
      { date: "2026-09-03", author: "Ishita Kulkarni", text: "Roster audit confirms 9 of 12 rosters were published under 48 hours. Pattern started after the APAC coverage change." },
      { date: "2026-09-10", author: "Ishita Kulkarni", text: "Department head agrees to a Thursday publishing cut-off. Waiting for the written commitment before closing." },
    ],
    evidence: [
      { name: "Roster publish log Jun–Aug.xlsx", kind: "Document", addedBy: "Ishita Kulkarni", date: "2026-09-03", size: "84 KB" },
      { name: "Grievance statement.pdf", kind: "Statement", addedBy: employeeName("STL-0220"), date: "2026-08-26", size: "212 KB" },
    ],
    outcome: null,
    access: [
      { at: "2026-09-16T10:12:00", who: "Ishita Kulkarni", action: "Viewed case" },
      { at: "2026-09-10T16:40:00", who: "Ishita Kulkarni", action: "Added note" },
      { at: "2026-09-04T09:05:00", who: "Priya Menon", action: "Viewed case" },
    ],
  },
  {
    id: "HRC-2026-016",
    type: "Disciplinary",
    title: "Repeated unapproved absence — 6 days in August without leave applied",
    complainant: "Reporting manager",
    ...subject("STL-0187"),
    openedOn: "2026-09-02",
    owner: "Priya Menon",
    status: "open",
    restricted: false,
    dueOn: "2026-09-23",
    timeline: [
      { date: "2026-09-02", actor: "Priya Menon", event: "Case opened from attendance exception report" },
      { date: "2026-09-04", actor: "Priya Menon", event: "Show-cause notice issued; reply due in 7 days" },
      { date: "2026-09-11", actor: employeeName("STL-0187"), event: "Reply received citing a family medical emergency" },
    ],
    notes: [
      { date: "2026-09-12", author: "Priya Menon", text: "Reply is credible; hospital bills attached. Recommend converting 6 days to LOP-free emergency leave and a written advisory on the leave process." },
    ],
    evidence: [
      { name: "Attendance exceptions Aug.pdf", kind: "Document", addedBy: "Priya Menon", date: "2026-09-02", size: "156 KB" },
      { name: "Show-cause notice.pdf", kind: "Document", addedBy: "Priya Menon", date: "2026-09-04", size: "98 KB" },
      { name: "Employee reply and hospital bills.pdf", kind: "Statement", addedBy: employeeName("STL-0187"), date: "2026-09-11", size: "1.4 MB" },
    ],
    outcome: null,
    access: [
      { at: "2026-09-12T11:20:00", who: "Priya Menon", action: "Added note" },
      { at: "2026-09-11T18:02:00", who: "Priya Menon", action: "Viewed evidence" },
    ],
  },
  {
    id: "HRC-2026-011",
    type: "Investigation",
    title: "Possible duplicate expense receipts across two claims (flagged by AI anomaly check)",
    complainant: "Finance — anomaly detection",
    ...subject("STL-0122"),
    openedOn: "2026-08-08",
    owner: "Priya Menon",
    status: "on_hold",
    restricted: false,
    dueOn: "2026-09-30",
    timeline: [
      { date: "2026-08-08", actor: "Finance", event: "Referred from the expense anomaly queue" },
      { date: "2026-08-12", actor: "Priya Menon", event: "Investigation opened; claims frozen" },
      { date: "2026-08-20", actor: "Priya Menon", event: "Interview with employee" },
      { date: "2026-09-01", actor: "Priya Menon", event: "On hold — awaiting hotel's itemised folio" },
    ],
    notes: [
      { date: "2026-08-20", author: "Priya Menon", text: "Employee says the second claim was a split booking for a colleague. Requested the hotel folio to confirm two rooms." },
    ],
    evidence: [
      { name: "Claim EXP-2026-0412 receipt.jpg", kind: "Image", addedBy: "Finance", date: "2026-08-08", size: "640 KB" },
      { name: "Claim EXP-2026-0439 receipt.jpg", kind: "Image", addedBy: "Finance", date: "2026-08-08", size: "655 KB" },
      { name: "Interview notes.docx", kind: "Statement", addedBy: "Priya Menon", date: "2026-08-20", size: "44 KB" },
    ],
    outcome: null,
    access: [
      { at: "2026-09-01T15:30:00", who: "Priya Menon", action: "Changed status to On hold" },
      { at: "2026-08-21T10:00:00", who: "Auditor — Ravi Agarwal", action: "Viewed case (audit sample)" },
    ],
  },
  {
    id: "HRC-2026-009",
    type: "POSH referral",
    title: "Referral to the Internal Committee",
    complainant: "Withheld",
    subjectCode: null,
    subjectName: "Withheld",
    department: "Withheld",
    openedOn: "2026-07-29",
    owner: "Priya Menon",
    status: "in_review",
    restricted: true,
    dueOn: "2026-10-27",
    timeline: [
      { date: "2026-07-29", actor: "Priya Menon", event: "Complaint received; referred to the Internal Committee within 24 hours" },
      { date: "2026-08-05", actor: "Internal Committee", event: "Notice issued to the respondent" },
      { date: "2026-09-02", actor: "Internal Committee", event: "Hearings in progress" },
    ],
    notes: [
      { date: "2026-08-05", author: "Priya Menon", text: "Interim relief granted: reporting line changed for the complainant at their request. Inquiry to complete within 90 days." },
    ],
    evidence: [
      { name: "Complaint (sealed).pdf", kind: "Statement", addedBy: "Internal Committee", date: "2026-07-29", size: "Sealed" },
    ],
    outcome: null,
    access: [
      { at: "2026-09-02T17:10:00", who: "Priya Menon", action: "Viewed case" },
      { at: "2026-09-15T09:44:00", who: "Ishita Kulkarni", action: "Access denied — restricted case" },
    ],
  },
  {
    id: "HRC-2026-006",
    type: "Grievance",
    title: "Relocation allowance not paid after Pune → Bengaluru transfer",
    complainant: employeeName("STL-0251"),
    ...subject("STL-0017"),
    openedOn: "2026-06-18",
    owner: "Ishita Kulkarni",
    status: "closed",
    restricted: false,
    dueOn: "2026-07-18",
    timeline: [
      { date: "2026-06-18", actor: employeeName("STL-0251"), event: "Grievance raised" },
      { date: "2026-06-20", actor: "Ishita Kulkarni", event: "Confirmed transfer letter included relocation" },
      { date: "2026-07-01", actor: "Rahul Desai", event: "Allowance paid in the June run" },
      { date: "2026-07-03", actor: "Ishita Kulkarni", event: "Closed — employee confirmed receipt" },
    ],
    notes: [{ date: "2026-06-20", author: "Ishita Kulkarni", text: "Root cause: the transfer letter did not create a payroll input. Raised a process fix with Payroll Ops." }],
    evidence: [{ name: "Transfer letter.pdf", kind: "Document", addedBy: "Ishita Kulkarni", date: "2026-06-20", size: "120 KB" }],
    outcome: "Upheld — allowance of ₹75,000 paid in the June run; transfer letters now create a payroll input automatically.",
    access: [{ at: "2026-07-03T12:00:00", who: "Ishita Kulkarni", action: "Closed case" }],
  },
];
