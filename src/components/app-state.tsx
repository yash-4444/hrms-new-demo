"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  PERSONAS,
  can,
  denyReason,
  grantsFor,
  personaById,
  type Action,
  type MenuKey,
  type Persona,
  type RoleId,
} from "@/lib/rbac";
import { DEMO_NOW, DEMO_TODAY } from "@/mock/org";
import { approvalsFor } from "@/mock/self-service";

/* ============================================================================
   The demo's nervous system.

   Holds the active persona, the in-memory mutation log, notification and
   approval counts, and the punch clock. Switching persona re-renders the whole
   app WITHOUT a reload — nav, dashboard and every screen's actions change.
   Only the chosen persona survives a refresh (sessionStorage), so a deep link
   reloaded mid-demo keeps its viewer; every mutation is in-memory by design.
   ========================================================================== */

/* ------------------------------------------------------------- demo clock */

/** The demo's "now" in epoch ms — DEMO_NOW, never the wall clock. */
const DEMO_NOW_MS = new Date(DEMO_NOW).getTime();

/** Today's general shift: 09:30–18:30 with a 1 h break = 8 h of work. */
export const SHIFT_TARGET_MINUTES = 480;

/** Today's punch-in on the demo date — the one anchor every punch timer uses. */
export const DEMO_PUNCH_IN = new Date(`${DEMO_TODAY}T09:36:00`);

let clockBoot: number | null = null;

/** Demo "now" that advances in real time from DEMO_NOW once the page is open. */
export function demoNowMs() {
  if (typeof window === "undefined") return DEMO_NOW_MS;
  clockBoot ??= Date.now();
  return DEMO_NOW_MS + (Date.now() - clockBoot);
}

/**
 * Ticking demo clock for live timers. The first render returns DEMO_NOW
 * exactly, so the server HTML and the hydrating client agree.
 */
export function useDemoNow(tickMs = 1000) {
  const [now, setNow] = React.useState(DEMO_NOW_MS);
  React.useEffect(() => {
    const tick = () => setNow(demoNowMs());
    tick();
    const t = setInterval(tick, tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href?: string;
  tone?: "info" | "warning" | "success" | "danger";
}

interface AppState {
  role: RoleId;
  persona: Persona;
  setRole: (r: RoleId) => void;

  can: (key: MenuKey, action?: Action) => boolean;
  grants: (key: MenuKey) => Action[];
  why: (key: MenuKey, action?: Action) => string;

  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;

  /** Open items in the persona's inbox — derived from `approvalsFor` minus
      `decidedApprovals`, so the sidebar badge, the dashboard and /approvals
      can never disagree. */
  approvalCount: number;
  /** Inbox item ids decided anywhere this session (dashboard or /approvals),
      so a decision on one screen does not reappear on the other. */
  decidedApprovals: ReadonlySet<string>;
  /** Mark inbox items decided (or undecided, for Undo). */
  markDecided: (ids: string[], decided?: boolean) => void;
  exceptionCount: number;
  setExceptionCount: React.Dispatch<React.SetStateAction<number>>;
  ticketCount: number;

  /** punch clock */
  punchedIn: boolean;
  punchedInAt: Date | null;
  punchIn: () => void;
  punchOut: () => void;

  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const Ctx = React.createContext<AppState | null>(null);

const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    title: "Leave request awaiting your decision",
    body: "Kavya Iyer applied for 3 days of Earned Leave (12–14 Oct).",
    at: "2026-09-16T09:12:00",
    read: false,
    href: "/approvals",
    tone: "warning",
  },
  {
    id: "n2",
    title: "September pay run is calculated",
    body: "3 exceptions must be cleared before the run can be locked.",
    at: "2026-09-16T08:40:00",
    read: false,
    href: "/payroll/runs",
    tone: "danger",
  },
  {
    id: "n3",
    title: "PF ECR filing due in 4 days",
    body: "Due 20 Sep 2026 · Owner: Rahul Desai",
    at: "2026-09-16T07:05:00",
    read: false,
    href: "/admin/compliance",
    tone: "warning",
  },
  {
    id: "n4",
    title: "Offer accepted — Nikhil Bansal",
    body: "Senior Backend Engineer, Bengaluru. Joining 06 Oct 2026.",
    at: "2026-09-15T17:22:00",
    read: true,
    href: "/offers",
    tone: "success",
  },
  {
    id: "n5",
    title: "Regularisation approved",
    body: "Your missed punch-out for 11 Sep 2026 was approved by Vikram Shah.",
    at: "2026-09-15T11:03:00",
    read: true,
    href: "/attendance/amendments",
    tone: "success",
  },
  {
    id: "n6",
    title: "New announcement: Diwali holiday calendar",
    body: "Acknowledgement requested from all employees by 25 Sep.",
    at: "2026-09-14T10:00:00",
    read: true,
    href: "/announcements",
    tone: "info",
  },
];

/** Badge count = items in the persona's unified inbox (the /approvals page),
    exactly what its "Awaiting you" tile counts — read-only personas included. */
function inboxCount(r: RoleId, decided: ReadonlySet<string>) {
  const p = personaById(r);
  return approvalsFor(r, p.employeeId, p.name).filter((i) => !decided.has(i.id)).length;
}

const PERSONA_KEY = "hrms.persona";

function readStoredRole(): RoleId | null {
  try {
    const v = window.sessionStorage.getItem(PERSONA_KEY);
    return v && PERSONAS.some((p) => p.id === v) ? (v as RoleId) : null;
  } catch {
    return null;
  }
}

function storeRole(r: RoleId) {
  try {
    window.sessionStorage.setItem(PERSONA_KEY, r);
  } catch {
    /* storage blocked — the persona simply resets on reload */
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<RoleId>("hr_admin");
  const [notifications, setNotifications] = React.useState(SEED_NOTIFICATIONS);
  const [decidedApprovals, setDecidedApprovals] = React.useState<ReadonlySet<string>>(() => new Set());
  const approvalCount = React.useMemo(() => inboxCount(role, decidedApprovals), [role, decidedApprovals]);
  const markDecided = React.useCallback((ids: string[], decided = true) => {
    setDecidedApprovals((s) => {
      const next = new Set(s);
      ids.forEach((id) => (decided ? next.add(id) : next.delete(id)));
      return next;
    });
  }, []);
  const [exceptionCount, setExceptionCount] = React.useState(3);
  const [punchedIn, setPunchedIn] = React.useState(true);
  const [punchedInAt, setPunchedInAt] = React.useState<Date | null>(DEMO_PUNCH_IN);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const pathname = usePathname();

  /* Restore the persona of this tab before the first paint. The server HTML is
     always HR Admin; a layout effect swaps it in before the browser paints, so
     a reloaded deep link never flashes the wrong persona or "Access denied". */
  React.useLayoutEffect(() => {
    const stored = readStoredRole();
    if (stored && stored !== "hr_admin") {
      setRoleState(stored);
    }
    document.documentElement.removeAttribute("data-persona-restoring");
  }, []);

  const setRole = React.useCallback((r: RoleId) => {
    setRoleState(r);
    storeRole(r);
    const p = personaById(r);
    toast.success(`Now viewing as ${p.name}`, {
      description: `${p.role} · ${p.branch}. Navigation and available actions have changed.`,
    });
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      // Alt+1..9, Alt+0 jumps between the first ten personas mid-demo.
      // e.code, not e.key: on macOS Option+digit types a symbol.
      const digit = /^Digit(\d)$/.exec(e.code)?.[1];
      if (e.altKey && !e.metaKey && !e.ctrlKey && digit) {
        const persona = PERSONAS[digit === "0" ? 9 : Number(digit) - 1];
        if (persona) {
          e.preventDefault();
          setRole(persona.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setRole]);

  React.useEffect(() => {
    setCommandOpen(false);
  }, [pathname]);

  const value = React.useMemo<AppState>(
    () => ({
      role,
      persona: personaById(role),
      setRole,
      can: (key, action = "V") => can(role, key, action),
      grants: (key) => grantsFor(role, key),
      why: (key, action = "V") => denyReason(role, key, action),
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markAllRead: () => setNotifications((ns) => ns.map((n) => ({ ...n, read: true }))),
      markRead: (id) => setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n))),
      approvalCount,
      decidedApprovals,
      markDecided,
      exceptionCount,
      setExceptionCount,
      ticketCount: 9,
      punchedIn,
      punchedInAt,
      punchIn: () => {
        setPunchedIn(true);
        setPunchedInAt(new Date(demoNowMs()));
        toast.success("Punched in", { description: "Your shift timer has started." });
      },
      punchOut: () => {
        setPunchedIn(false);
        toast.success("Punched out", { description: "Today's hours have been recorded." });
      },
      commandOpen,
      setCommandOpen,
      sidebarCollapsed,
      toggleSidebar: () => setSidebarCollapsed((v) => !v),
    }),
    [role, setRole, notifications, approvalCount, decidedApprovals, markDecided, exceptionCount, punchedIn, punchedInAt, commandOpen, sidebarCollapsed],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside <AppStateProvider>");
  return ctx;
}

/* -------------------------------------------------- optimistic mock action */

/**
 * Every mutation in the demo goes through here: it feels instant, shows a
 * toast, and changes only in-memory state. Nothing is persisted — by design.
 */
export function mockAction(
  message: string,
  opts?: { description?: string; tone?: "success" | "info" | "warning" | "error"; undo?: () => void },
) {
  const fn =
    opts?.tone === "error"
      ? toast.error
      : opts?.tone === "warning"
        ? toast.warning
        : opts?.tone === "info"
          ? toast.info
          : toast.success;
  fn(message, {
    description: opts?.description,
    action: opts?.undo ? { label: "Undo", onClick: opts.undo } : undefined,
  });
}
