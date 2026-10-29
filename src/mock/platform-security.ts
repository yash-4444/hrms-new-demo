/* ============================================================================
   Security fixtures — active sessions, login history (with lockouts) and the
   quarterly access re-certification campaign.
   ========================================================================== */

import { mulberry32, pick, randInt } from "@/lib/utils";
import type { RoleId } from "@/lib/rbac";
import { EMPLOYEES } from "@/mock/employees";

const PERSONA_USERS: { code: string; name: string; role: RoleId; roleLabel: string }[] = [
  { code: "STL-0001", name: "Arjun Kapoor", role: "tenant_owner", roleLabel: "Tenant Owner" },
  { code: "STL-0009", name: "Priya Menon", role: "hr_admin", roleLabel: "HR Admin" },
  { code: "STL-0017", name: "Rahul Desai", role: "payroll_admin", roleLabel: "Payroll Admin" },
  { code: "STL-0008", name: "Lakshmi Pillai", role: "finance_controller", roleLabel: "Finance Controller" },
  { code: "STL-0010", name: "Girish Gowda", role: "it_admin", roleLabel: "IT Admin" },
  { code: "STL-0058", name: "Sana Iqbal", role: "recruiter", roleLabel: "Recruiter" },
  { code: "STL-0031", name: "Vikram Shah", role: "manager", roleLabel: "Manager" },
  { code: "STL-0005", name: "Neha Malhotra", role: "department_head", roleLabel: "Department Head" },
  { code: "STL-0305", name: "Ishita Kulkarni", role: "helpdesk_agent", roleLabel: "Helpdesk Agent" },
  { code: "STL-0296", name: "Ravi Agarwal", role: "auditor", roleLabel: "Auditor" },
  { code: "STL-0142", name: "Ananya Rao", role: "employee", roleLabel: "Employee" },
];

const DEVICES = [
  "Chrome 128 · Windows 11",
  "Edge 128 · Windows 11",
  "Safari 18 · macOS 15",
  "Chrome 128 · macOS 15",
  "HRMS app · Android 15",
  "HRMS app · iOS 18",
  "Firefox 130 · Ubuntu 24.04",
];
const PLACES: { city: string; ipPrefix: string }[] = [
  { city: "Bengaluru, IN", ipPrefix: "49.207" },
  { city: "Pune, IN", ipPrefix: "103.88" },
  { city: "Hyderabad, IN", ipPrefix: "183.82" },
  { city: "Mumbai, IN", ipPrefix: "115.96" },
  { city: "Newark NJ, US", ipPrefix: "73.194" },
];

/* --------------------------------------------------------------- sessions */

export interface ActiveSession {
  id: string;
  userCode: string;
  userName: string;
  roleLabel: string;
  device: string;
  ip: string;
  city: string;
  startedAt: string;
  lastActiveAt: string;
  mfa: boolean;
  suspicious?: string;
}

function hhmm(minutesSinceMidnight: number) {
  const h = Math.floor(minutesSinceMidnight / 60);
  const m = minutesSinceMidnight % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function buildSessions(): ActiveSession[] {
  const rng = mulberry32(4401);
  const users = [
    ...PERSONA_USERS,
    ...EMPLOYEES.filter((e) => e.status !== "exited")
      .slice(40, 64)
      .map((e) => ({ code: e.code, name: e.name, role: "employee" as RoleId, roleLabel: "Employee" })),
  ];
  const out: ActiveSession[] = [];
  users.forEach((u, i) => {
    const n = i < PERSONA_USERS.length ? randInt(rng, 1, 3) : 1;
    for (let k = 0; k < n; k++) {
      const place = u.code.startsWith("STL-03") && k === 0 ? PLACES[4] : pick(rng, PLACES.slice(0, 4));
      const start = randInt(rng, 7 * 60, 13 * 60);
      const last = Math.min(14 * 60 + 35, start + randInt(rng, 5, 360));
      out.push({
        id: `SES-${String(out.length + 1).padStart(3, "0")}`,
        userCode: u.code,
        userName: u.name,
        roleLabel: u.roleLabel,
        device: pick(rng, DEVICES),
        ip: `${place.ipPrefix}.${randInt(rng, 2, 250)}.${randInt(rng, 2, 250)}`,
        city: place.city,
        startedAt: `2026-09-16T${hhmm(start)}`,
        lastActiveAt: `2026-09-16T${hhmm(last)}`,
        mfa: i < PERSONA_USERS.length ? true : rng() > 0.25,
      });
    }
  });
  /* Two planted anomalies for the demo. */
  out.splice(3, 0, {
    id: "SES-900",
    userCode: "STL-0017",
    userName: "Rahul Desai",
    roleLabel: "Payroll Admin",
    device: "Chrome 127 · Windows 10",
    ip: "185.220.101.44",
    city: "Frankfurt, DE",
    startedAt: "2026-09-16T03:12:00",
    lastActiveAt: "2026-09-16T03:41:00",
    mfa: true,
    suspicious: "Impossible travel — Pune at 02:58, Frankfurt at 03:12. IP is a known Tor exit node.",
  });
  out.splice(9, 0, {
    id: "SES-901",
    userCode: "STL-0009",
    userName: "Priya Menon",
    roleLabel: "HR Admin",
    device: "Chrome 128 · Windows 11",
    ip: "41.203.72.19",
    city: "Lagos, NG",
    startedAt: "2026-09-16T11:04:00",
    lastActiveAt: "2026-09-16T11:06:00",
    mfa: false,
    suspicious: "New country and new device; MFA challenge was skipped by a remembered-device token.",
  });
  return out;
}

export const ACTIVE_SESSIONS: ActiveSession[] = buildSessions();

/* ---------------------------------------------------------- login history */

export type LoginFailureReason = "wrong_password" | "locked_out" | "mfa_failed" | "unknown_user" | "sso_denied";

export const LOGIN_REASON_LABEL: Record<LoginFailureReason, string> = {
  wrong_password: "Wrong password",
  locked_out: "Locked out after 5 attempts",
  mfa_failed: "MFA code rejected",
  unknown_user: "Unknown username",
  sso_denied: "SSO assertion rejected",
};

export interface LoginEvent {
  id: string;
  at: string;
  userCode: string | null;
  userName: string;
  email: string;
  result: "success" | "failure";
  reason: LoginFailureReason | null;
  method: "Password + MFA" | "Google SSO" | "Microsoft SSO" | "Password";
  ip: string;
  city: string;
  device: string;
}

function buildLogins(): LoginEvent[] {
  const rng = mulberry32(5150);
  const pool = [
    ...PERSONA_USERS.map((u) => ({ code: u.code, name: u.name })),
    ...EMPLOYEES.slice(20, 90).map((e) => ({ code: e.code, name: e.name })),
  ];
  const out: LoginEvent[] = [];
  for (let d = 0; d < 7; d++) {
    const day = 16 - d;
    const count = d === 0 ? 34 : randInt(rng, 22, 30);
    for (let k = 0; k < count; k++) {
      const u = pick(rng, pool);
      const place = pick(rng, PLACES);
      const fail = rng() < 0.12;
      const reason: LoginFailureReason | null = fail
        ? pick(rng, ["wrong_password", "wrong_password", "mfa_failed", "unknown_user", "sso_denied"] as const)
        : null;
      const minute = randInt(rng, 7 * 60, d === 0 ? 14 * 60 + 30 : 21 * 60);
      out.push({
        id: `LGN-${String(out.length + 1).padStart(4, "0")}`,
        at: `2026-09-${String(day).padStart(2, "0")}T${hhmm(minute)}`,
        userCode: reason === "unknown_user" ? null : u.code,
        userName: reason === "unknown_user" ? "—" : u.name,
        email:
          reason === "unknown_user"
            ? `${u.name.split(" ")[0].toLowerCase()}@stellartech.co`
            : `${u.name.toLowerCase().replace(/[^a-z ]/g, "").replace(" ", ".")}@stellartech.in`,
        result: fail ? "failure" : "success",
        reason,
        method: pick(rng, ["Password + MFA", "Google SSO", "Google SSO", "Microsoft SSO"] as const),
        ip: `${place.ipPrefix}.${randInt(rng, 2, 250)}.${randInt(rng, 2, 250)}`,
        city: place.city,
        device: pick(rng, DEVICES),
      });
    }
  }
  /* A brute-force burst that ends in a lockout, this morning. */
  const victim = EMPLOYEES.find((e) => e.code === "STL-0214") ?? EMPLOYEES[213];
  for (let k = 0; k < 6; k++) {
    out.push({
      id: `LGN-9${k}`,
      at: `2026-09-16T${hhmm(14 * 60 + 2 + k)}`,
      userCode: victim.code,
      userName: victim.name,
      email: victim.email,
      result: "failure",
      reason: k < 5 ? "wrong_password" : "locked_out",
      method: "Password",
      ip: "103.215.44.9",
      city: "Mumbai, IN",
      device: "Firefox 130 · Ubuntu 24.04",
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export const LOGIN_EVENTS: LoginEvent[] = buildLogins();

export interface LockedAccount {
  userCode: string;
  userName: string;
  lockedAt: string;
  attempts: number;
  unlocksAt: string;
  lastIp: string;
}

export const LOCKED_ACCOUNTS: LockedAccount[] = (() => {
  const v = EMPLOYEES.find((e) => e.code === "STL-0214") ?? EMPLOYEES[213];
  const w = EMPLOYEES.find((e) => e.code === "STL-0187") ?? EMPLOYEES[186];
  return [
    { userCode: v.code, userName: v.name, lockedAt: "2026-09-16T14:07:00", attempts: 5, unlocksAt: "2026-09-16T14:37:00", lastIp: "103.215.44.9" },
    { userCode: w.code, userName: w.name, lockedAt: "2026-09-16T14:22:00", attempts: 5, unlocksAt: "2026-09-16T14:52:00", lastIp: "49.207.18.122" },
  ];
})();

export { PERSONA_USERS };
