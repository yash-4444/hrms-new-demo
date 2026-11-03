"use client";

import * as React from "react";
import { format } from "date-fns";
import { Activity, AlertTriangle, Megaphone, Octagon } from "lucide-react";
import { PLATFORM_PERSONA } from "@/lib/rbac";
import { INCIDENTS, QUEUES, SERVICES, overallStatus, tenantLoad, type Incident } from "@/mock/console-health";
import { demoNowMs, mockAction } from "@/components/app-state";
import { useConsole } from "@/components/console/console-state";
import { HEALTH_STYLE, QueueDepths, ServiceCards } from "@/components/console/health-services";
import { JobsSection, NoisyNeighbours } from "@/components/console/health-jobs";
import { INCIDENT_STYLE, IncidentsSection, PostUpdateDialog } from "@/components/console/health-incidents";
import { CardsSkeleton, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";

export default function HealthPage() {
  const loading = useFakeLoad();
  const { tenants } = useConsole();
  const [incidents, setIncidents] = React.useState<Incident[]>(INCIDENTS);
  const [posting, setPosting] = React.useState<string | null>(null);

  const status = overallStatus(SERVICES);
  const openIncidents = incidents.filter((i) => i.status !== "resolved");
  const sorted = [...openIncidents, ...incidents.filter((i) => i.status === "resolved")];
  const degraded = SERVICES.filter((s) => s.status !== "healthy").map((s) => s.name);

  return (
    <PageBody>
      <PageHeader
        title="System health"
        description="Dependencies, background jobs, queues and per-tenant load across the platform. Only SQL Server can mark the platform Unhealthy; every other dependency degrades it at worst."
        actions={
          <Button size="sm" disabled={!openIncidents.length} onClick={() => setPosting(openIncidents[0]?.id ?? null)}>
            <Megaphone /> Post status update
          </Button>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={4} height={150} />
          <TableSkeleton rows={6} />
        </>
      ) : (
        <>
          <Alert
            tone={status === "healthy" ? "success" : status === "degraded" ? "warning" : "danger"}
            icon={status === "healthy" ? Activity : status === "degraded" ? AlertTriangle : Octagon}
            title={`Platform ${HEALTH_STYLE[status].label.toLowerCase()}`}
          >
            {status === "healthy"
              ? "Every dependency is passing its health check."
              : `${degraded.join(" and ")} ${degraded.length === 1 ? "is" : "are"} degraded — tenants can work, some features are slower. ${openIncidents.length} open incident${openIncidents.length === 1 ? "" : "s"}.`}
          </Alert>

          <ServiceCards services={SERVICES} />

          <JobsSection />

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <NoisyNeighbours rows={tenantLoad(tenants)} />
            <QueueDepths queues={QUEUES} />
          </div>

          <IncidentsSection incidents={sorted} onPost={setPosting} />
        </>
      )}

      {posting && (
        <PostUpdateDialog
          incidents={incidents}
          initialId={posting}
          onOpenChange={(v) => !v && setPosting(null)}
          onPost={(id, next, message, notify) => {
            const at = format(new Date(demoNowMs()), "yyyy-MM-dd'T'HH:mm:ss");
            setIncidents((list) =>
              list.map((i) =>
                i.id === id
                  ? { ...i, status: next, resolvedAt: next === "resolved" ? at : undefined, updates: [{ at, status: next, message, author: PLATFORM_PERSONA.name }, ...i.updates] }
                  : i,
              ),
            );
            setPosting(null);
            mockAction(`${id}: ${INCIDENT_STYLE[next].label}`, {
              description: `Published to the status page${notify ? " and emailed to tenant admins" : ""}.`,
            });
          }}
        />
      )}
    </PageBody>
  );
}
