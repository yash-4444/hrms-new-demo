/* ==========================================================================
   Growth · review cycle administration — phase timeline, eligibility and
   participation per department. Counts reconcile with growth.ts REVIEW_CYCLES.
   ========================================================================== */

import { DEPARTMENTS } from "./org";
import { REVIEW_CYCLES, type ReviewStageId } from "./growth";

export type PhaseId = "goals" | ReviewStageId;
export type PhaseState = "done" | "open" | "upcoming";

export interface CyclePhase {
  id: PhaseId;
  label: string;
  start: string;
  end: string;
  state: PhaseState;
}

const PHASE_LABEL: Record<PhaseId, string> = {
  goals: "Goal setting",
  self: "Self review",
  manager: "Manager review",
  peer: "Peer feedback (360)",
  calibration: "Calibration",
  release: "Release",
};

type Plan = [PhaseId, string, string, PhaseState][];

const PLANS: Record<string, Plan> = {
  "RC-2026-MID": [
    ["goals", "2026-04-01", "2026-04-30", "done"],
    ["self", "2026-09-01", "2026-09-19", "open"],
    ["peer", "2026-09-01", "2026-09-26", "open"],
    ["manager", "2026-09-08", "2026-09-30", "open"],
    ["calibration", "2026-09-22", "2026-10-03", "upcoming"],
    ["release", "2026-10-06", "2026-10-09", "upcoming"],
  ],
  "RC-2026-ANN": [
    ["goals", "2025-04-01", "2025-04-30", "done"],
    ["self", "2026-04-06", "2026-04-17", "done"],
    ["peer", "2026-04-06", "2026-04-24", "done"],
    ["manager", "2026-04-13", "2026-05-01", "done"],
    ["calibration", "2026-05-04", "2026-05-15", "done"],
    ["release", "2026-05-18", "2026-05-22", "done"],
  ],
  "RC-2025-MID": [
    ["goals", "2025-04-01", "2025-04-30", "done"],
    ["self", "2025-09-08", "2025-09-19", "done"],
    ["peer", "2025-09-08", "2025-09-26", "done"],
    ["manager", "2025-09-15", "2025-10-03", "done"],
    ["calibration", "2025-10-06", "2025-10-14", "done"],
    ["release", "2025-10-15", "2025-10-17", "done"],
  ],
  "RC-2027-Q3": [
    ["goals", "2026-12-15", "2027-01-02", "upcoming"],
    ["self", "2027-01-04", "2027-01-11", "upcoming"],
    ["peer", "2027-01-04", "2027-01-15", "upcoming"],
    ["manager", "2027-01-11", "2027-01-18", "upcoming"],
    ["calibration", "2027-01-18", "2027-01-20", "upcoming"],
    ["release", "2027-01-21", "2027-01-22", "upcoming"],
  ],
};

export const phasesFor = (cycleId: string): CyclePhase[] =>
  (PLANS[cycleId] ?? []).map(([id, start, end, state]) => ({ id, label: PHASE_LABEL[id], start, end, state }));

export interface EligibilityRule {
  id: string;
  label: string;
  detail: string;
  enabled: boolean;
}

export const ELIGIBILITY_RULES: EligibilityRule[] = [
  { id: "confirmed", label: "Confirmed employees only", detail: "Employees on probation are reviewed through the probation workflow instead.", enabled: true },
  { id: "tenure", label: "Joined on or before the cut-off", detail: "Joined on or before 30 Jun 2026 — at least 60 days in role before the window opens.", enabled: true },
  { id: "notice", label: "Exclude employees serving notice", detail: "Their manager records an exit summary instead.", enabled: true },
  { id: "interns", label: "Include interns", detail: "Interns get a lightweight two-question review.", enabled: false },
  { id: "long_leave", label: "Exclude long leave (> 90 days in period)", detail: "Maternity and sabbatical leave do not lower anyone's rating.", enabled: true },
];

/**
 * Per-department completion for the cycle's self / manager / peer stages.
 * Department totals sum to the cycle's participants and completions.
 */
export function participationFor(cycleId: string) {
  const cycle = REVIEW_CYCLES.find((c) => c.id === cycleId);
  if (!cycle) return [];
  const total = DEPARTMENTS.reduce((a, d) => a + d.headcount, 0);
  const tilt = [0.04, -0.02, 0.06, -0.11, 0.01, -0.07, 0.03, 0.09, -0.03];
  const stage = (id: ReviewStageId) => cycle.stages.find((s) => s.stage === id)!;
  const left = { participants: cycle.participants, self: stage("self").completed, manager: stage("manager").completed, peer: stage("peer").completed };
  return DEPARTMENTS.map((d, i) => {
    const last = i === DEPARTMENTS.length - 1;
    const participants = last ? left.participants : Math.round((d.headcount / total) * cycle.participants);
    const share = (id: "self" | "manager" | "peer") => {
      if (last) return Math.max(0, Math.min(participants, left[id]));
      const rate = Math.max(0, Math.min(1, stage(id).completed / cycle.participants + (stage(id).completed && stage(id).completed < cycle.participants ? tilt[i] : 0)));
      return Math.round(participants * rate);
    };
    const row = { departmentId: d.id, department: d.name, participants, self: share("self"), manager: share("manager"), peer: share("peer") };
    left.participants -= row.participants;
    left.self -= row.self;
    left.manager -= row.manager;
    left.peer -= row.peer;
    return row;
  });
}

export interface ReminderLog {
  id: string;
  cycleId: string;
  sentOn: string;
  audience: string;
  recipients: number;
  channel: "Email + in-app" | "In-app" | "Email";
}

export const REMINDERS: ReminderLog[] = [
  { id: "RM-14", cycleId: "RC-2026-MID", sentOn: "2026-09-15T09:00:00", audience: "Self review not started", recipients: 41, channel: "Email + in-app" },
  { id: "RM-13", cycleId: "RC-2026-MID", sentOn: "2026-09-10T09:00:00", audience: "Managers with pending reviews", recipients: 37, channel: "Email" },
  { id: "RM-12", cycleId: "RC-2026-MID", sentOn: "2026-09-08T09:00:00", audience: "360 raters with pending requests", recipients: 64, channel: "In-app" },
  { id: "RM-11", cycleId: "RC-2026-MID", sentOn: "2026-09-01T08:30:00", audience: "All participants — cycle opened", recipients: 312, channel: "Email + in-app" },
];
