"use client";

import * as React from "react";
import { format } from "date-fns";
import { PLATFORM_PERSONA } from "@/lib/rbac";
import { CONSOLE_TENANTS, type ConsoleTenant } from "@/mock/console-tenants";
import type { TenantActivity } from "@/mock/console-tenant-detail";
import { tenantFromSignup, type SignupRequest } from "@/mock/console-signups";
import { demoNowMs } from "@/components/app-state";
import { useSignupStore } from "@/components/console/signup-store";

/* ============================================================================
   Platform Console state — the tenant list every console screen reads and
   writes, so a plan change on /console/tenants is still there on the tenant's
   detail page and on the overview. In-memory only, like every demo mutation.

   Operator actions are also appended to the tenant's activity trail
   (`logActivity`), which the detail page merges over the fixture history.

   The one exception to "in-memory only": a self-serve sign-up approved in
   another tab, or before a reload, is rebuilt from the persisted sign-up
   store (signup-store.ts) so the tenant it became still lists.
   ========================================================================== */

interface ConsoleState {
  tenants: ConsoleTenant[];
  tenantById: (id: string) => ConsoleTenant | undefined;
  updateTenant: (id: string, patch: Partial<ConsoleTenant>) => void;
  addTenant: (t: ConsoleTenant) => void;
  /** Provisions one tenant per approved sign-up (via addTenant), logs it, and returns them in order. */
  provisionSignups: (list: SignupRequest[], by: string) => ConsoleTenant[];
  /** Operator actions recorded this session, per tenant, newest first. */
  activityFor: (id: string) => TenantActivity[];
  logActivity: (tenantId: string, e: Omit<TenantActivity, "id" | "at" | "actor" | "actorKind">) => void;
}

const Ctx = React.createContext<ConsoleState | null>(null);

export function ConsoleStateProvider({ children }: { children: React.ReactNode }) {
  const [own, setTenants] = React.useState<ConsoleTenant[]>(CONSOLE_TENANTS);
  const [activity, setActivity] = React.useState<Record<string, TenantActivity[]>>({});
  const { requests: selfServe } = useSignupStore();

  /* Approved self-serve sign-ups this tab has not provisioned itself. */
  const restored = React.useMemo(
    () =>
      selfServe
        .filter((r) => r.status === "approved" && r.tenantId && !own.some((t) => t.id === r.tenantId))
        .map((r) => tenantFromSignup(r, r.tenantId!)),
    [selfServe, own],
  );
  const tenants = React.useMemo(() => (restored.length ? [...restored, ...own] : own), [restored, own]);

  const value = React.useMemo<ConsoleState>(() => {
    const addTenant = (t: ConsoleTenant) => setTenants((ts) => [t, ...ts]);
    const logActivity: ConsoleState["logActivity"] = (tenantId, e) => {
      const at = format(new Date(demoNowMs()), "yyyy-MM-dd'T'HH:mm:ss");
      setActivity((a) => {
        const prior = a[tenantId] ?? [];
        const entry: TenantActivity = { ...e, id: `${tenantId}-op-${prior.length + 1}`, at, actor: PLATFORM_PERSONA.name, actorKind: "operator" };
        return { ...a, [tenantId]: [entry, ...prior] };
      });
    };
    return {
      tenants,
      tenantById: (id) => tenants.find((t) => t.id === id),
      /* A restored tenant is not in local state yet — editing it adopts it. */
      updateTenant: (id, patch) =>
        setTenants((ts) =>
          ts.some((t) => t.id === id)
            ? ts.map((t) => (t.id === id ? { ...t, ...patch } : t))
            : [...restored.filter((t) => t.id === id).map((t) => ({ ...t, ...patch })), ...ts],
        ),
      addTenant,
      provisionSignups: (list, by) => {
        let next = Math.max(...tenants.map((t) => Number(t.id.replace(/\D/g, "")) || 0));
        return list.map((s) => {
          next += 1;
          const tenant = tenantFromSignup(s, `TN-${next}`);
          addTenant(tenant);
          logActivity(tenant.id, { category: "lifecycle", action: "Tenant provisioned from sign-up", detail: `${s.id} approved by ${by} · ${tenant.subdomain}.hrms-new.app` });
          return tenant;
        });
      },
      activityFor: (id) => activity[id] ?? [],
      logActivity,
    };
  }, [tenants, restored, activity]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useConsole() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useConsole must be used inside <ConsoleStateProvider>");
  return ctx;
}
