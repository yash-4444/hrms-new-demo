import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeIndianRupee,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Contact,
  FileSpreadsheet,
  FileText,
  Gauge,
  GitFork,
  GraduationCap,
  Grid3x3,
  History,
  LayoutGrid,
  LifeBuoy,
  Laptop,
  Megaphone,
  Plane,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Upload,
  UserRoundCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { MenuKey } from "./rbac";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  menuKey: MenuKey;
  /** shown as a count chip in the sidebar */
  badge?: "approvals" | "exceptions" | "tickets";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Home",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Gauge, menuKey: "dashboard" },
    ],
  },
  {
    label: "My Space",
    items: [
      { label: "Attendance", href: "/attendance", icon: Clock, menuKey: "my.attendance" },
      { label: "Leave", href: "/leave", icon: CalendarDays, menuKey: "my.leave" },
      { label: "Regularisation", href: "/attendance/amendments", icon: ClipboardCheck, menuKey: "time.amendments" },
      { label: "Payslips", href: "/payslips", icon: Wallet, menuKey: "my.payslips" },
      { label: "Goals", href: "/goals", icon: Target, menuKey: "my.goals" },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Team Attendance", href: "/attendance/team", icon: Users, menuKey: "team.attendance" },
      { label: "Leave Approvals", href: "/leave/approvals", icon: UserRoundCheck, menuKey: "team.leave_approvals", badge: "approvals" },
      { label: "Leave Calendar", href: "/leave/calendar", icon: CalendarRange, menuKey: "leave.calendar" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Directory", href: "/employees", icon: Contact, menuKey: "people.directory" },
      { label: "Org Chart", href: "/org-chart", icon: GitFork, menuKey: "people.org_chart" },
      { label: "Bulk Import", href: "/employees/import", icon: Upload, menuKey: "people.import" },
    ],
  },
  {
    label: "Time",
    items: [
      { label: "Leave Administration", href: "/leave/admin", icon: SlidersHorizontal, menuKey: "leave.admin" },
      { label: "Attendance Settings", href: "/admin/attendance-settings", icon: Settings, menuKey: "time.settings" },
      { label: "Work Calendars", href: "/admin/work-calendars", icon: CalendarClock, menuKey: "time.calendars" },
    ],
  },
  {
    label: "Payroll",
    items: [
      { label: "Pay Runs", href: "/payroll/runs", icon: BadgeIndianRupee, menuKey: "payroll.runs", badge: "exceptions" },
      { label: "Salary Structures", href: "/payroll/structures", icon: FileSpreadsheet, menuKey: "payroll.structures" },
    ],
  },
  {
    label: "Hiring",
    items: [
      { label: "Requisitions", href: "/requisitions", icon: ClipboardList, menuKey: "hiring.requisitions" },
      { label: "Job Postings", href: "/jobs", icon: Briefcase, menuKey: "hiring.jobs" },
      { label: "Candidates", href: "/candidates", icon: LayoutGrid, menuKey: "hiring.candidates" },
      { label: "Interviews", href: "/interviews", icon: CalendarDays, menuKey: "hiring.interviews" },
      { label: "Offers", href: "/offers", icon: FileText, menuKey: "hiring.offers" },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Reviews", href: "/reviews", icon: Award, menuKey: "growth.reviews" },
      { label: "Calibration", href: "/reviews/calibration", icon: Grid3x3, menuKey: "growth.calibration" },
      { label: "Learning", href: "/learning", icon: GraduationCap, menuKey: "growth.learning" },
    ],
  },
  {
    label: "Workplace",
    items: [
      { label: "Assets", href: "/assets", icon: Laptop, menuKey: "workplace.assets" },
      { label: "Expenses", href: "/expenses", icon: Receipt, menuKey: "workplace.expenses" },
      { label: "Travel", href: "/travel", icon: Plane, menuKey: "workplace.travel" },
      { label: "Helpdesk", href: "/helpdesk", icon: LifeBuoy, menuKey: "workplace.helpdesk", badge: "tickets" },
      { label: "Announcements", href: "/announcements", icon: Megaphone, menuKey: "workplace.announcements" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3, menuKey: "analytics" },
      { label: "Reports", href: "/reports", icon: ScrollText, menuKey: "reports" },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Users", href: "/admin/users", icon: Users, menuKey: "admin.users" },
      { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck, menuKey: "admin.roles" },
      { label: "Tenant Settings", href: "/admin/settings", icon: Building2, menuKey: "admin.settings" },
      { label: "Audit Log", href: "/admin/audit", icon: History, menuKey: "admin.audit" },
      { label: "Compliance", href: "/admin/compliance", icon: Sparkles, menuKey: "admin.compliance" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV.flatMap((g) => g.items);

/** Route -> menu key, longest-prefix wins. Used by the route guard. */
const ROUTE_KEYS: [string, MenuKey][] = [
  ["/dashboard", "dashboard"],
  ["/attendance/team", "team.attendance"],
  ["/attendance/amendments", "time.amendments"],
  ["/attendance", "my.attendance"],
  ["/leave/approvals", "team.leave_approvals"],
  ["/leave/calendar", "leave.calendar"],
  ["/leave/admin", "leave.admin"],
  ["/leave", "my.leave"],
  ["/employees/import", "people.import"],
  ["/employees", "people.directory"],
  ["/org-chart", "people.org_chart"],
  ["/payroll/runs", "payroll.runs"],
  ["/payroll/structures", "payroll.structures"],
  ["/payslips", "my.payslips"],
  ["/requisitions", "hiring.requisitions"],
  ["/jobs", "hiring.jobs"],
  ["/candidates", "hiring.candidates"],
  ["/interviews", "hiring.interviews"],
  ["/offers", "hiring.offers"],
  ["/goals", "my.goals"],
  ["/reviews/calibration", "growth.calibration"],
  ["/reviews", "growth.reviews"],
  ["/learning", "growth.learning"],
  ["/assets", "workplace.assets"],
  ["/expenses", "workplace.expenses"],
  ["/travel", "workplace.travel"],
  ["/helpdesk", "workplace.helpdesk"],
  ["/announcements", "workplace.announcements"],
  ["/admin/users", "admin.users"],
  ["/admin/roles", "admin.roles"],
  ["/admin/settings", "admin.settings"],
  ["/admin/audit", "admin.audit"],
  ["/admin/compliance", "admin.compliance"],
  ["/admin/attendance-settings", "time.settings"],
  ["/admin/work-calendars", "time.calendars"],
  ["/analytics", "analytics"],
  ["/reports", "reports"],
];

export function menuKeyForPath(pathname: string): MenuKey | null {
  const hits = ROUTE_KEYS.filter(
    ([p]) => pathname === p || pathname.startsWith(p + "/"),
  ).sort((a, b) => b[0].length - a[0].length);
  return hits[0]?.[1] ?? null;
}

/** Human breadcrumb segments for a path. */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  attendance: "Attendance",
  team: "Team",
  amendments: "Regularisation",
  leave: "Leave",
  approvals: "Approvals",
  calendar: "Calendar",
  admin: "Admin",
  employees: "Employees",
  import: "Bulk Import",
  "org-chart": "Org Chart",
  payroll: "Payroll",
  runs: "Pay Runs",
  structures: "Salary Structures",
  payslips: "Payslips",
  requisitions: "Requisitions",
  jobs: "Job Postings",
  candidates: "Candidates",
  interviews: "Interviews",
  offers: "Offers",
  goals: "Goals",
  reviews: "Reviews",
  calibration: "Calibration",
  learning: "Learning",
  assets: "Assets",
  expenses: "Expenses",
  travel: "Travel",
  helpdesk: "Helpdesk",
  announcements: "Announcements",
  users: "Users",
  roles: "Roles & Permissions",
  settings: "Settings",
  audit: "Audit Log",
  compliance: "Compliance",
  "attendance-settings": "Attendance Settings",
  "work-calendars": "Work Calendars",
  analytics: "Analytics",
  reports: "Reports",
  employee: "Employee",
  careers: "Careers",
};

export function segmentLabel(segment: string) {
  return (
    SEGMENT_LABELS[segment] ??
    segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
