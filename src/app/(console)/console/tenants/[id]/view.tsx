"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Ban,
  BarChart3,
  Building2,
  CreditCard,
  Headset,
  Hourglass,
  Layers,
  LayoutGrid,
  MoreHorizontal,
  Play,
  ShieldAlert,
} from "lucide-react";
import { fmtDate, inr } from "@/lib/format";
import { COUNTRY_META } from "@/mock/console-tenants";
import { useConsole } from "@/components/console/console-state";
import { PlanBadge, TenantStatusBadge } from "@/components/console/kit";
import { useTenantActions } from "@/components/console/tenant-actions";
import { TenantOverviewTab, TenantUsageTab } from "@/components/console/tenant-overview-usage";
import { TenantModulesTab } from "@/components/console/tenant-modules";
import { TenantActivityTab, TenantBillingTab } from "@/components/console/tenant-billing-activity";
import { TenantDangerZoneTab } from "@/components/console/tenant-danger-zone";
import { CardsSkeleton, PageBody, PageHeader, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";

export default function TenantDetailView() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";
  const loading = useFakeLoad();
  const { tenantById } = useConsole();
  const { open, can, dialogs } = useTenantActions();
  const tenant = tenantById(id);

  if (loading) {
    return (
      <PageBody>
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-8 w-[480px] max-w-full" />
        <CardsSkeleton count={3} />
        <Skeleton className="h-[360px]" />
      </PageBody>
    );
  }

  if (!tenant) {
    return (
      <PageBody>
        <PageHeader title="Tenant not found" description={`No tenant on the platform has the id ${id || "—"}.`} />
        <EmptyState
          icon={Building2}
          title="This tenant id is unknown"
          description="It may have been purged after its retention window, or the link was mistyped."
          action={
            <Button size="sm" asChild>
              <Link href="/console/tenants">
                <ArrowLeft /> Back to tenants
              </Link>
            </Button>
          }
        />
      </PageBody>
    );
  }

  const t = tenant;
  return (
    <PageBody>
      <PageHeader
        title={t.name}
        description={
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <TenantStatusBadge status={t.status} />
            <PlanBadge plan={t.plan} />
            <span className="font-mono">{t.subdomain}.hrms-new.app</span>
            <span aria-hidden>·</span>
            <span>{COUNTRY_META[t.country].label}</span>
            <span aria-hidden>·</span>
            <span className="tnum">{t.mrr ? `${inr(t.mrr, { decimals: false })} / month` : "No recurring revenue"}</span>
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="outline" disabled={!can("impersonate", t)} onClick={() => open("impersonate", t)}>
              <Headset /> Impersonate for support
            </Button>
            <Button size="sm" variant="outline" disabled={!can("plan", t)} onClick={() => open("plan", t)}>
              <Layers /> Change plan
            </Button>
            {t.status === "trial" && (
              <Button size="sm" variant="outline" onClick={() => open("trial", t)}>
                <Hourglass /> Extend trial
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="outline" aria-label="More tenant actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {t.status === "suspended" ? (
                  <DropdownMenuItem onSelect={() => open("reactivate", t)}>
                    <Play /> Reactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem destructive disabled={!can("suspend", t)} onSelect={() => open("suspend", t)}>
                    <Ban /> Suspend
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/console/tenants">
                    <ArrowLeft /> All tenants
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {t.status === "suspended" && (
        <Alert tone="danger" icon={Ban} title="Suspended — users cannot sign in" action={<Button size="sm" variant="outline" onClick={() => open("reactivate", t)}>Reactivate</Button>}>
          {t.statusNote ?? "Suspended by the platform."}
        </Alert>
      )}
      {t.status === "pending" && (
        <Alert tone="warning" icon={Hourglass} title="Provisioning pending">
          {t.statusNote ?? "Waiting for the owner to finish setting up."} Created {fmtDate(t.createdAt)}.
        </Alert>
      )}
      {t.status === "churned" && (
        <Alert tone="neutral" title="Churned">
          {t.statusNote ?? "The tenant has left the platform."}
        </Alert>
      )}

      <Tabs defaultValue="overview" className="min-w-0">
        <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-0.5">
          <TabsList>
            <TabsTrigger value="overview"><Building2 /> Overview</TabsTrigger>
            <TabsTrigger value="usage"><BarChart3 /> Usage</TabsTrigger>
            <TabsTrigger value="modules"><LayoutGrid /> Modules ({t.modules.length})</TabsTrigger>
            <TabsTrigger value="billing"><CreditCard /> Billing</TabsTrigger>
            <TabsTrigger value="activity"><Activity /> Activity</TabsTrigger>
            <TabsTrigger value="danger"><ShieldAlert /> Danger zone</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          <TenantOverviewTab tenant={t} />
        </TabsContent>
        <TabsContent value="usage">
          <TenantUsageTab tenant={t} />
        </TabsContent>
        <TabsContent value="modules">
          <TenantModulesTab tenant={t} onChangePlan={() => open("plan", t)} />
        </TabsContent>
        <TabsContent value="billing">
          <TenantBillingTab tenant={t} onChangePlan={() => open("plan", t)} />
        </TabsContent>
        <TabsContent value="activity">
          <TenantActivityTab tenant={t} />
        </TabsContent>
        <TabsContent value="danger">
          <TenantDangerZoneTab tenant={t} onAction={(kind) => open(kind, t)} />
        </TabsContent>
      </Tabs>

      {dialogs}
    </PageBody>
  );
}
