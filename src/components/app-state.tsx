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

/* ============================================================================
   The demo's nervous system.

   Holds the active persona, the in-memory mutation log, notification and
   approval counts, and the punch clock. Switching persona re-renders the whole
   app WITHOUT a reload — nav, dashboard and every screen's actions change.
   Nothing here persists past a refresh; that is by design.
   ========================================================================== */

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

  approvalCount: number;
  setApprovalCount: React.Dispatch<React.SetStateAction<number>>;
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
    href: "/leave/approvals",
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

const APPROVALS_BY_ROLE: Record<RoleId, number> = {
  employee: 0,
  manager: 7,
  hr_admin: 12,
  payroll_admin: 4,
  recruiter: 3,
  tenant_owner: 14,
};

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<RoleId>("hr_admin");
  const [notifications, setNotifications] = React.useState(SEED_NOTIFICATIONS);
  const [approvalCount, setApprovalCount] = React.useState(APPROVALS_BY_ROLE.hr_admin);
  const [exceptionCount, setExceptionCount] = React.useState(3);
  const [punchedIn, setPunchedIn] = React.useState(true);
  const [punchedInAt, setPunchedInAt] = React.useState<Date | null>(null);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const pathname = usePathname();

  // Punch-in time is set on the client only, so SSR and the first client render
  // agree (a Date.now() in the initial state would hydrate-mismatch).
  React.useEffect(() => {
    const t = new Date();
    t.setHours(9, 42, 0, 0);
    setPunchedInAt(t);
  }, []);

  const setRole = React.useCallback((r: RoleId) => {
    setRoleState(r);
    setApprovalCount(APPROVALS_BY_ROLE[r]);
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
      // Alt+1..6 jumps between personas mid-demo
      if (e.altKey && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        setRole(PERSONAS[Number(e.key) - 1].id);
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
      setApprovalCount,
      exceptionCount,
      setExceptionCount,
      ticketCount: 9,
      punchedIn,
      punchedInAt,
      punchIn: () => {
        setPunchedIn(true);
        setPunchedInAt(new Date());
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
    [role, setRole, notifications, approvalCount, exceptionCount, punchedIn, punchedInAt, commandOpen, sidebarCollapsed],
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
