/* ==========================================================================
   Growth · corporate learning operations — course detail, training sessions
   and enrolment requests. Courses come from growth.ts (CRS-001…CRS-024).
   ========================================================================== */

import { EMPLOYEES, VIKRAM_TEAM_CODES } from "./employees";
import { COURSES, ENROLMENTS, type Course } from "./growth";
import { mulberry32, randInt } from "@/lib/utils";

/* -------------------------------------------------------- course detail */

export interface CourseModule {
  title: string;
  mins: number;
  kind: "Video" | "Reading" | "Live session" | "Exercise" | "Assessment";
}

const MODULE_SHAPES: Record<string, string[]> = {
  Leadership: ["Why this matters for your team", "The core model", "Practice with real scenarios", "Handling pushback", "Your 30-day plan"],
  Engineering: ["Mental model and vocabulary", "Hands-on lab", "Failure modes in production", "Case study from our stack", "Capstone exercise"],
  Data: ["Foundations refresher", "Working examples", "Common traps", "Applying it to our warehouse"],
  Product: ["Framing the problem", "Evidence and interviews", "Writing it down", "Review and critique"],
  Design: ["Principles", "Patterns in our design system", "Testing with real users", "Critique session"],
  Sales: ["Qualifying the deal", "Call recordings, annotated", "Role play", "Deal review"],
  Finance: ["The standard in plain English", "Worked examples", "What auditors look for", "Calendar and filings"],
  Compliance: ["What the law requires", "Scenarios", "How to report a concern"],
  Wellbeing: ["The science, briefly", "Habits that stick", "Team agreements"],
};
const KINDS: CourseModule["kind"][] = ["Video", "Reading", "Exercise", "Live session", "Video"];

export function courseModules(c: Course): CourseModule[] {
  const titles = MODULE_SHAPES[c.category] ?? MODULE_SHAPES.Leadership;
  const assess = c.category === "Compliance" || c.level !== "Foundation";
  const parts = assess ? titles.length + 1 : titles.length;
  const base = Math.floor(c.durationMins / parts);
  const mods: CourseModule[] = titles.map((t, i) => ({
    title: t,
    mins: base,
    kind: c.format === "Self-paced" && KINDS[i] === "Live session" ? "Video" : KINDS[i % KINDS.length],
  }));
  if (assess) mods.push({ title: "Final assessment (pass mark 70%)", mins: base, kind: "Assessment" });
  /* Put the rounding remainder on the first module so the total equals durationMins. */
  mods[0].mins += c.durationMins - base * parts;
  return mods;
}

export const PREREQUISITES: Record<string, string[]> = {
  "CRS-003": ["CRS-001", "CRS-002"],
  "CRS-004": ["CRS-006"],
  "CRS-008": ["CRS-005"],
  "CRS-010": ["CRS-009"],
  "CRS-014": ["CRS-012"],
  "CRS-016": ["CRS-015"],
  "CRS-018": ["CRS-017"],
};

export const CERTIFICATE_COURSES = new Set(COURSES.filter((c) => c.category === "Compliance" || c.level === "Advanced").map((c) => c.id));

export interface CourseReview {
  code: string;
  stars: number;
  text: string;
  date: string;
}

const REVIEW_LINES = [
  "Practical from the first module — I used it in a real conversation the same week.",
  "Good content, though the exercises could be shorter.",
  "The case study from our own stack made it click.",
  "Would recommend to anyone new to the team.",
  "Solid, but assumes more background than the description says.",
];

export function courseReviews(c: Course): CourseReview[] {
  const rng = mulberry32(Number(c.id.slice(4)) * 131);
  return Array.from({ length: 4 }, (_, i) => ({
    code: EMPLOYEES[randInt(rng, 20, 300)].code,
    stars: Math.max(3, Math.min(5, Math.round(c.rating + (rng() - 0.5)))),
    text: REVIEW_LINES[(i + Number(c.id.slice(4))) % REVIEW_LINES.length],
    date: `2026-0${randInt(rng, 6, 9)}-${String(randInt(rng, 1, 15)).padStart(2, "0")}`,
  }));
}

export const enrolledIn = (courseId: string) => ENROLMENTS.filter((e) => e.courseId === courseId);

/* ------------------------------------------------------ training sessions */

export interface TrainingSession {
  id: string;
  courseId: string;
  trainer: string;
  trainerCode: string | null;
  date: string;
  start: string;
  end: string;
  mode: "Virtual" | "Classroom";
  venue: string;
  capacity: number;
  /** Confirmed seats — codes of attendees. */
  attendees: string[];
  waitlist: string[];
  /** Codes marked present, for sessions on or before DEMO_TODAY. */
  present: string[];
}

const LIVE = COURSES.filter((c) => c.format !== "Self-paced");
const SESSION_PLAN: [string, string, string, TrainingSession["mode"], string, number, string | null, string][] = [
  ["2026-09-03", "10:00", "13:00", "Classroom", "Bengaluru HQ · Training Room 2", 20, "STL-0009", "Priya Menon"],
  ["2026-09-08", "15:00", "17:00", "Virtual", "Teams · link sent on enrolment", 40, null, "Meera Raghavan (Stellar Academy)"],
  ["2026-09-11", "10:00", "16:00", "Classroom", "Pune · Board Room", 16, null, "Harvard ManageMentor faculty"],
  ["2026-09-15", "14:00", "17:00", "Virtual", "Teams · link sent on enrolment", 30, "STL-0031", "Vikram Shah"],
  ["2026-09-16", "11:00", "13:00", "Classroom", "Bengaluru HQ · Training Room 1", 18, "STL-0011", "Tanvi Deshpande"],
  ["2026-09-18", "10:00", "12:00", "Virtual", "Zoom · link sent on enrolment", 50, null, "Rohan Bhatia (LinkedIn Learning)"],
  ["2026-09-22", "09:30", "17:30", "Classroom", "Bengaluru HQ · Auditorium", 24, null, "Harvard ManageMentor faculty"],
  ["2026-09-24", "15:00", "18:00", "Virtual", "Teams · link sent on enrolment", 25, "STL-0004", "Ramesh Subramanian"],
  ["2026-09-29", "10:00", "13:00", "Classroom", "Pune · Training Room", 15, null, "NIIT trainer — Suresh Kamat"],
  ["2026-10-01", "14:00", "16:00", "Virtual", "Teams · link sent on enrolment", 60, "STL-0010", "Girish Gowda"],
  ["2026-10-06", "10:00", "16:00", "Classroom", "Bengaluru HQ · Training Room 2", 20, "STL-0005", "Neha Malhotra"],
  ["2026-10-08", "11:00", "13:00", "Virtual", "Zoom · link sent on enrolment", 35, null, "Meera Raghavan (Stellar Academy)"],
  ["2026-10-13", "10:00", "13:00", "Classroom", "Newark · Conference Room A", 12, null, "Coursera live instructor"],
  ["2026-10-20", "15:00", "17:00", "Virtual", "Teams · link sent on enrolment", 40, "STL-0006", "Aditi Krishnan"],
];

export const TRAINING_SESSIONS: TrainingSession[] = (() => {
  const rng = mulberry32(90210);
  const pool = EMPLOYEES.filter((e) => e.status !== "exited").map((e) => e.code);
  return SESSION_PLAN.map(([date, start, end, mode, venue, capacity, trainerCode, trainer], i) => {
    const course = LIVE[i % LIVE.length];
    const full = i % 4 === 1;
    const n = full ? capacity : Math.max(4, capacity - randInt(rng, 2, Math.max(3, Math.floor(capacity / 2))));
    const offset = randInt(rng, 0, pool.length - n - 10);
    const attendees = pool.slice(offset, offset + n);
    const waitlist = full ? pool.slice(offset + n, offset + n + randInt(rng, 2, 5)) : [];
    const past = date <= "2026-09-15";
    const present = past ? attendees.filter(() => rng() > 0.12) : [];
    return { id: `TS-${String(i + 101)}`, courseId: course.id, trainer, trainerCode, date, start, end, mode, venue, capacity, attendees, waitlist, present };
  });
})();

/* ---------------------------------------------------- enrolment requests */

export type EnrolRequestStatus = "pending" | "approved" | "waitlisted" | "rejected" | "cancelled";

export interface EnrolRequest {
  id: string;
  employeeCode: string;
  courseId: string;
  sessionId: string | null;
  nominatedBy: "Self" | "Manager" | "HR";
  managerCode: string;
  requestedOn: string;
  status: EnrolRequestStatus;
  /** FIFO position when waitlisted. */
  waitlistPos: number | null;
  costInr: number;
}

export const ENROL_REQUESTS: EnrolRequest[] = (() => {
  const rng = mulberry32(5150);
  const people = [...VIKRAM_TEAM_CODES, ...EMPLOYEES.filter((e) => e.departmentId === "SAL" && e.level === 3).slice(0, 8).map((e) => e.code)];
  const statuses: EnrolRequestStatus[] = ["pending", "pending", "approved", "waitlisted", "pending", "approved", "rejected", "waitlisted"];
  const waitPos: Record<string, number> = {};
  return people.map((code, i) => {
    const session = TRAINING_SESSIONS[(i * 3) % TRAINING_SESSIONS.length];
    const status = statuses[i % statuses.length];
    const emp = EMPLOYEES.find((e) => e.code === code);
    const pos = status === "waitlisted" ? (waitPos[session.id] = (waitPos[session.id] ?? 0) + 1) : null;
    return {
      id: `ENQ-${String(i + 401)}`,
      employeeCode: code,
      courseId: session.courseId,
      sessionId: session.id,
      nominatedBy: i % 3 === 0 ? "Manager" : i % 5 === 0 ? "HR" : "Self",
      managerCode: emp?.managerCode ?? "STL-0031",
      requestedOn: `2026-09-${String(randInt(rng, 1, 15)).padStart(2, "0")}`,
      status,
      waitlistPos: pos,
      costInr: [0, 4500, 12000, 18500, 24000][randInt(rng, 0, 4)],
    };
  });
})();
