import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookMarked,
  Building2,
  CreditCard,
  FileClock,
  Flag,
  Gauge,
  Headset,
  Layers,
  Megaphone,
  UserCog,
  UserPlus,
} from "lucide-react";

/* ============================================================================
   Platform Console navigation — the vendor's own menu, deliberately separate
   from NAV. Console screens carry no tenant menu key: the whole /console tree
   is gated by role (isPlatformRole), not by the tenant RBAC matrix, because
   no tenant grant can ever open it.
   ========================================================================== */

export interface ConsoleNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** One line under the label in the command menu and on placeholders. */
  description: string;
}

export interface ConsoleNavGroup {
  label: string;
  items: ConsoleNavItem[];
}

export const CONSOLE_NAV: ConsoleNavGroup[] = [
  {
    label: "Tenants",
    items: [
      { label: "Overview", href: "/console", icon: Gauge, description: "Platform KPIs, growth, plan mix and tenants at risk." },
      { label: "Tenants", href: "/console/tenants", icon: Building2, description: "Every organisation on the platform — plan, status, seats and revenue." },
      { label: "Sign-up Requests", href: "/console/signups", icon: UserPlus, description: "Self-serve and sales-led sign-ups awaiting verification or provisioning." },
    ],
  },
  {
    label: "Commercial",
    items: [
      { label: "Plans & Entitlements", href: "/console/plans", icon: Layers, description: "Free, Pro and Enterprise — modules, seat pricing and rate limits." },
      { label: "Billing", href: "/console/billing", icon: CreditCard, description: "Invoices, collections, dunning and revenue across tenants." },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "System Health", href: "/console/health", icon: Activity, description: "Services, queues, error rates and incidents across the platform." },
      { label: "Reference Baselines", href: "/console/baselines", icon: BookMarked, description: "Shared holiday calendars and statutory rate tables tenants inherit." },
      { label: "Announcements", href: "/console/announcements", icon: Megaphone, description: "Maintenance windows and release notes shown to tenant admins." },
      { label: "Feature Flags", href: "/console/flags", icon: Flag, description: "Staged roll-outs by plan, region or tenant." },
    ],
  },
  {
    label: "Trust & access",
    items: [
      { label: "Support Access", href: "/console/support", icon: Headset, description: "Support sessions into tenants — requested, active and closed." },
      { label: "Operators", href: "/console/operators", icon: UserCog, description: "Vendor staff with console access, their roles and MFA status." },
      { label: "Audit Log", href: "/console/audit", icon: FileClock, description: "Every operator action on the platform, immutable." },
    ],
  },
];

export const ALL_CONSOLE_NAV_ITEMS = CONSOLE_NAV.flatMap((g) => g.items);

export const consoleNavItem = (href: string) => ALL_CONSOLE_NAV_ITEMS.find((i) => i.href === href);

/** Is this path inside the Platform Console? */
export const isConsolePath = (pathname: string) => pathname === "/console" || pathname.startsWith("/console/");

/** Breadcrumb labels for console segments; ids (TN-1001) render as-is. */
const CONSOLE_SEGMENT_LABELS: Record<string, string> = {
  console: "Platform Console",
  ...Object.fromEntries(
    ALL_CONSOLE_NAV_ITEMS.filter((i) => i.href !== "/console").map((i) => [i.href.split("/").pop()!, i.label]),
  ),
};

export function consoleSegmentLabel(segment: string) {
  return CONSOLE_SEGMENT_LABELS[segment] ?? segment.toUpperCase();
}
