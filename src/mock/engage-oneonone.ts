/* ==========================================================================
   Growth · one-on-ones and performance improvement plans.
   ========================================================================== */

import { VIKRAM_TEAM_CODES, employeeByCode } from "./employees";
import { RISK_BOX_CODES } from "./engage-performance";

/* --------------------------------------------------------- one-on-ones */

export interface AgendaItem {
  id: string;
  text: string;
  addedByCode: string;
  discussed: boolean;
}

export interface ActionItem {
  id: string;
  text: string;
  ownerCode: string;
  dueOn: string;
  done: boolean;
}

export type OneOnOneStatus = "scheduled" | "completed" | "cancelled";

export interface OneOnOne {
  id: string;
  managerCode: string;
  reporteeCode: string;
  date: string;
  time: string;
  durationMins: number;
  status: OneOnOneStatus;
  agenda: AgendaItem[];
  sharedNotes: string;
  /** Visible only to the author (the manager). */
  privateNotes: string;
  actions: ActionItem[];
}

const MGR = "STL-0031";

/** Upcoming slot for every reportee, plus two weeks of history for the first three. */
export const ONE_ON_ONES: OneOnOne[] = (() => {
  const out: OneOnOne[] = [];
  const slots = ["10:00", "11:00", "14:30", "15:30", "16:30"];
  VIKRAM_TEAM_CODES.forEach((code, i) => {
    const day = 17 + (i % 5);
    out.push({
      id: `OOO-${code.slice(4)}-UP`,
      managerCode: MGR,
      reporteeCode: code,
      date: `2026-09-${String(day).padStart(2, "0")}`,
      time: slots[i % slots.length],
      durationMins: 30,
      status: "scheduled",
      agenda:
        code === "STL-0142"
          ? [
              { id: "AG-1", text: "Mid-year self review — rating on Delivery", addedByCode: "STL-0142", discussed: false },
              { id: "AG-2", text: "Interest in the Payroll Core tech-lead track", addedByCode: "STL-0142", discussed: false },
              { id: "AG-3", text: "Runbook for the leave-accrual job (from 360 feedback)", addedByCode: MGR, discussed: false },
            ]
          : [{ id: `AG-${code}`, text: "Sprint 19 priorities and blockers", addedByCode: MGR, discussed: false }],
      sharedNotes: "",
      privateNotes: "",
      actions: [],
    });
  });

  const history: [string, string, string, string, ActionItem[]][] = [
    [
      "STL-0142",
      "2026-09-03",
      "Agreed Ananya leads the attendance-sync spike. She wants more design-review exposure.",
      "Strong quarter. Consider for tech-lead track at year end; estimation still the gap.",
      [
        { id: "AI-1", text: "Write the leave-accrual runbook", ownerCode: "STL-0142", dueOn: "2026-09-20", done: false },
        { id: "AI-2", text: "Add Ananya as reviewer on the holiday-calendar RFC", ownerCode: MGR, dueOn: "2026-09-10", done: true },
      ],
    ],
    [
      "STL-0142",
      "2026-08-20",
      "Discussed Sprint 17 slip. Ananya to break migration work into spikes.",
      "Raised the late-flag concern gently; she took it well.",
      [{ id: "AI-3", text: "Enrol in Distributed Systems in Practice", ownerCode: "STL-0142", dueOn: "2026-09-30", done: true }],
    ],
    [
      "STL-0147",
      "2026-09-02",
      "Reviewed rolled-over tickets. Agreed smaller slices and a Wednesday check-in.",
      "Third conversation on delivery. If no change by mid-Oct, discuss a formal plan with HR.",
      [{ id: "AI-4", text: "Split PAY-2210 into three tickets", ownerCode: "STL-0147", dueOn: "2026-09-12", done: false }],
    ],
    [
      "STL-0145",
      "2026-09-04",
      "Pranav to become code owner for payroll-core. Talked about the staff-to-principal path.",
      "Succession: ready now for EM — Payroll Core.",
      [{ id: "AI-5", text: "Update CODEOWNERS for payroll-core", ownerCode: MGR, dueOn: "2026-09-11", done: true }],
    ],
  ];
  history.forEach(([code, date, shared, priv, actions], i) =>
    out.push({
      id: `OOO-${code.slice(4)}-H${i}`,
      managerCode: MGR,
      reporteeCode: code,
      date,
      time: "11:00",
      durationMins: 30,
      status: "completed",
      agenda: [{ id: `AGH-${i}`, text: "Weekly check-in", addedByCode: MGR, discussed: true }],
      sharedNotes: shared,
      privateNotes: priv,
      actions,
    }),
  );
  return out;
})();

/** Signals the talking-point generator reads. Hand-set so the reasoning is legible. */
export interface ReporteeSignals {
  goalsOnTrack: number;
  goalsAtRisk: number;
  feedbackThisCycle: number;
  leaveDaysLast30: number;
  lateMarksLast30: number;
  lastOneOnOne: string | null;
}

export const REPORTEE_SIGNALS: Record<string, ReporteeSignals> = {
  "STL-0142": { goalsOnTrack: 3, goalsAtRisk: 1, feedbackThisCycle: 10, leaveDaysLast30: 1, lateMarksLast30: 0, lastOneOnOne: "2026-09-03" },
  "STL-0143": { goalsOnTrack: 4, goalsAtRisk: 0, feedbackThisCycle: 4, leaveDaysLast30: 0, lateMarksLast30: 1, lastOneOnOne: "2026-09-02" },
  "STL-0144": { goalsOnTrack: 2, goalsAtRisk: 1, feedbackThisCycle: 2, leaveDaysLast30: 5, lateMarksLast30: 0, lastOneOnOne: "2026-08-27" },
  "STL-0145": { goalsOnTrack: 4, goalsAtRisk: 0, feedbackThisCycle: 6, leaveDaysLast30: 0, lateMarksLast30: 0, lastOneOnOne: "2026-09-04" },
  "STL-0146": { goalsOnTrack: 3, goalsAtRisk: 0, feedbackThisCycle: 3, leaveDaysLast30: 2, lateMarksLast30: 0, lastOneOnOne: "2026-09-01" },
  "STL-0147": { goalsOnTrack: 1, goalsAtRisk: 3, feedbackThisCycle: 1, leaveDaysLast30: 3, lateMarksLast30: 6, lastOneOnOne: "2026-09-02" },
  "STL-0148": { goalsOnTrack: 2, goalsAtRisk: 1, feedbackThisCycle: 2, leaveDaysLast30: 0, lateMarksLast30: 0, lastOneOnOne: "2026-08-25" },
  "STL-0149": { goalsOnTrack: 3, goalsAtRisk: 0, feedbackThisCycle: 1, leaveDaysLast30: 4, lateMarksLast30: 0, lastOneOnOne: "2026-08-19" },
};

/** Deterministic "AI" talking points built from the signals above. */
export function talkingPointsFor(code: string): { point: string; why: string }[] {
  const s = REPORTEE_SIGNALS[code];
  const name = employeeByCode(code)?.firstName ?? "them";
  if (!s) return [];
  const out: { point: string; why: string }[] = [];
  if (s.goalsAtRisk > 0)
    out.push({ point: `Unblock the ${s.goalsAtRisk} goal${s.goalsAtRisk > 1 ? "s" : ""} marked at risk — what would make them green by 31 Oct?`, why: `${s.goalsAtRisk} of ${s.goalsAtRisk + s.goalsOnTrack} goals at risk` });
  if (s.feedbackThisCycle >= 4)
    out.push({ point: `Recognise the peer feedback — ${name} received ${s.feedbackThisCycle} notes this cycle; ask which one landed hardest.`, why: `${s.feedbackThisCycle} feedback items since 1 Sep` });
  if (s.leaveDaysLast30 >= 4)
    out.push({ point: `Check in on wellbeing after ${s.leaveDaysLast30} days of leave — is the workload manageable on return?`, why: `${s.leaveDaysLast30} leave days in the last 30` });
  if (s.lateMarksLast30 >= 3)
    out.push({ point: `Ask, without judgement, about the ${s.lateMarksLast30} late marks — commute, shift fit or something personal?`, why: `${s.lateMarksLast30} late marks in 30 days` });
  if (s.lastOneOnOne && s.lastOneOnOne < "2026-08-28")
    out.push({ point: "It has been over three weeks since the last 1:1 — start with what has changed for them.", why: `Last 1:1 on ${s.lastOneOnOne}` });
  out.push({ point: "Career: what would they like to be doing more of in six months?", why: "Mid-year review window is open" });
  return out.slice(0, 4);
}

/* ------------------------------------------------------- improvement plans */

export type MilestoneStatus = "met" | "in_progress" | "missed" | "not_started";
export type PipStatus = "active" | "extended" | "closed";
export type PipOutcome = "Successful" | "Extended" | "Role change" | "Separation";

export interface PipMilestone {
  id: string;
  title: string;
  measure: string;
  dueOn: string;
  status: MilestoneStatus;
}

export interface PipCheckIn {
  date: string;
  byCode: string;
  rating: "on_track" | "at_risk" | "off_track";
  note: string;
}

export interface Pip {
  id: string;
  employeeCode: string;
  managerCode: string;
  hrCode: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: PipStatus;
  milestones: PipMilestone[];
  checkIns: PipCheckIn[];
  outcome: PipOutcome | null;
}

const riskA = RISK_BOX_CODES[0] ?? "STL-0160";
const riskB = RISK_BOX_CODES[1] ?? "STL-0161";

export const PIPS: Pip[] = [
  {
    id: "PIP-2026-004",
    employeeCode: "STL-0147",
    managerCode: "STL-0031",
    hrCode: "STL-0009",
    startDate: "2026-09-15",
    endDate: "2026-12-14",
    reason: "Delivery: 3 of the last 4 sprint commitments rolled over; on-call acknowledgement averaged 41 min against a 15 min SLA.",
    status: "active",
    milestones: [
      { id: "M1", title: "Close sprint commitments", measure: "≥ 80% of committed points for 3 consecutive sprints", dueOn: "2026-10-27", status: "in_progress" },
      { id: "M2", title: "On-call responsiveness", measure: "Median acknowledgement under 15 min for October", dueOn: "2026-10-31", status: "not_started" },
      { id: "M3", title: "Own one production change", measure: "Design, ship and write the runbook for PAY-2210", dueOn: "2026-11-30", status: "not_started" },
    ],
    checkIns: [{ date: "2026-09-15", byCode: "STL-0031", rating: "at_risk", note: "Plan walked through with Imran and Priya. He agreed the milestones and asked for a weekly 30-min pairing slot." }],
    outcome: null,
  },
  {
    id: "PIP-2026-002",
    employeeCode: riskA,
    managerCode: employeeByCode(riskA)?.managerCode ?? "STL-0004",
    hrCode: "STL-0009",
    startDate: "2026-07-01",
    endDate: "2026-09-29",
    reason: "Quality: 9 escaped defects in Q1; two caused customer-facing payroll recalculations.",
    status: "active",
    milestones: [
      { id: "M1", title: "Test coverage on owned modules", measure: "Line coverage ≥ 80% on leave-engine", dueOn: "2026-07-31", status: "met" },
      { id: "M2", title: "Escaped defects", measure: "Zero sev-2 escapes in August", dueOn: "2026-08-31", status: "met" },
      { id: "M3", title: "Peer review quality", measure: "Two approved design reviews led", dueOn: "2026-09-25", status: "in_progress" },
    ],
    checkIns: [
      { date: "2026-07-15", byCode: "STL-0004", rating: "off_track", note: "Coverage plan agreed; first week slow." },
      { date: "2026-08-05", byCode: "STL-0004", rating: "on_track", note: "Coverage milestone met early." },
      { date: "2026-09-02", byCode: "STL-0004", rating: "on_track", note: "No escapes in August. One design review done." },
    ],
    outcome: null,
  },
  {
    id: "PIP-2026-001",
    employeeCode: riskB,
    managerCode: employeeByCode(riskB)?.managerCode ?? "STL-0004",
    hrCode: "STL-0009",
    startDate: "2026-04-15",
    endDate: "2026-07-14",
    reason: "Attendance and collaboration: repeated missed stand-ups and two unannounced absences.",
    status: "closed",
    milestones: [
      { id: "M1", title: "Stand-up attendance", measure: "≥ 95% attendance for 8 weeks", dueOn: "2026-06-10", status: "met" },
      { id: "M2", title: "Planned absences", measure: "All leave applied ≥ 2 days ahead", dueOn: "2026-07-14", status: "met" },
    ],
    checkIns: [
      { date: "2026-05-15", byCode: "STL-0004", rating: "on_track", note: "Clear improvement since the plan started." },
      { date: "2026-07-14", byCode: "STL-0009", rating: "on_track", note: "All milestones met. Plan closed as successful." },
    ],
    outcome: "Successful",
  },
];
