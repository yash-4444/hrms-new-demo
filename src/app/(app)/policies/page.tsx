"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BellRing, FileText, Library, Upload, Users } from "lucide-react";
import { fmtDate, fmtDateTime, num, pct } from "@/lib/format";
import { DEMO_NOW, DEMO_TODAY } from "@/mock/org";
import { MY_ACCEPTED, POLICIES, POLICY_ACCEPTANCE, type PolicyDoc } from "@/mock/engage";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, NumCell } from "@/components/data-table";
import { BarCompareChart } from "@/components/charts";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { MY_STATUS_META, PolicyReader, type MyPolicyStatus } from "@/components/engage/policy-reader";
import { PublishVersionDialog, type PublishValues } from "@/components/engage/policy-publish";

type DeptRow = (typeof POLICY_ACCEPTANCE)[number]["byDept"][number];
interface Row extends PolicyDoc {
  current: string;
  publishedOn: string;
  my: MyPolicyStatus;
}

export default function PoliciesPage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const isHr = can("engage.policies", "E");

  const [policies, setPolicies] = React.useState<PolicyDoc[]>(POLICIES);
  const [accepted, setAccepted] = React.useState<Record<string, { version: string; at: string | null }>>(() =>
    Object.fromEntries(Object.entries(MY_ACCEPTED).map(([k, v]) => [k, { version: v, at: null }])),
  );
  const [acceptance, setAcceptance] = React.useState(() => Object.fromEntries(POLICY_ACCEPTANCE.map((a) => [a.policyId, a.byDept])));
  const [readingId, setReadingId] = React.useState<string | null>(null);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [trackId, setTrackId] = React.useState(POLICY_ACCEPTANCE[0].policyId);
  const [category, setCategory] = React.useState("all");

  const statusOf = React.useCallback(
    (p: PolicyDoc): MyPolicyStatus => {
      if (!p.requiresAcceptance) return "info";
      const a = accepted[p.id];
      if (!a) return "not_accepted";
      return a.version === p.versions[0].version ? "accepted" : "reaccept";
    },
    [accepted],
  );

  const rows: Row[] = policies
    .filter((p) => category === "all" || p.category === category)
    .map((p) => ({ ...p, current: p.versions[0].version, publishedOn: p.versions[0].publishedOn, my: statusOf(p) }));
  const outstanding = policies.filter((p) => ["reaccept", "not_accepted"].includes(statusOf(p))).length;
  const reading = policies.find((p) => p.id === readingId) ?? null;

  const accept = () => {
    if (!reading) return;
    setAccepted((a) => ({ ...a, [reading.id]: { version: reading.versions[0].version, at: DEMO_NOW } }));
    mockAction(`Accepted ${reading.title} v${reading.versions[0].version}`, { description: `Timestamped ${fmtDateTime(DEMO_NOW)} and stored in your acceptance history.` });
    setReadingId(null);
  };

  const publish = (v: PublishValues) => {
    const p = policies.find((x) => x.id === v.policyId);
    if (!p) return;
    setPolicies((ps) => ps.map((x) => (x.id === v.policyId ? { ...x, versions: [{ version: v.version, publishedOn: DEMO_TODAY, changeNote: v.changeNote }, ...x.versions] } : x)));
    if (p.requiresAcceptance && acceptance[p.id])
      setAcceptance((a) => ({ ...a, [p.id]: a[p.id].map((d) => ({ ...d, accepted: 0, pending: d.headcount })) }));
    mockAction(`${p.title} v${v.version} published`, {
      description: p.requiresAcceptance ? "Every employee has been asked to read and accept the new version." : "Shared with all employees for information.",
    });
  };

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "title",
      header: "Policy",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-medium">{row.original.title}</span>
        </span>
      ),
    },
    { accessorKey: "category", header: "Category", cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge> },
    { accessorKey: "current", header: "Version", cell: ({ row }) => <span className="tnum text-xs">v{row.original.current}</span> },
    { accessorKey: "publishedOn", header: "Published", cell: ({ row }) => <span className="text-xs">{fmtDate(row.original.publishedOn)}</span> },
    { accessorKey: "my", header: "My status", cell: ({ row }) => <StatusBadge status={MY_STATUS_META[row.original.my].status} label={MY_STATUS_META[row.original.my].label} /> },
    {
      id: "__a",
      header: "",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button size="sm" variant={row.original.my === "accepted" || row.original.my === "info" ? "outline" : "default"} onClick={() => setReadingId(row.original.id)}>
            {row.original.my === "accepted" || row.original.my === "info" ? "Read" : "Read and accept"}
          </Button>
        </div>
      ),
    },
  ];

  const track = acceptance[trackId] ?? [];
  const trackTotals = track.reduce((a, d) => ({ hc: a.hc + d.headcount, ok: a.ok + d.accepted }), { hc: 0, ok: 0 });
  const deptCols: ColumnDef<DeptRow, unknown>[] = [
    { accessorKey: "department", header: "Department" },
    { accessorKey: "headcount", header: "Headcount", cell: ({ row }) => <NumCell>{num(row.original.headcount)}</NumCell> },
    { accessorKey: "accepted", header: "Accepted", cell: ({ row }) => <NumCell>{num(row.original.accepted)}</NumCell> },
    { accessorKey: "pending", header: "Pending", cell: ({ row }) => <NumCell>{num(row.original.pending)}</NumCell> },
    { id: "rate", header: "Rate", cell: ({ row }) => <NumCell>{pct((row.original.accepted / Math.max(1, row.original.headcount)) * 100, 0)}</NumCell> },
  ];

  const library = (
    <DataTable
      columns={columns}
      data={rows}
      searchKeys={["title", "category"]}
      searchPlaceholder="Search policies…"
      filters={
        <FilterSelect
          label="Category"
          value={category}
          onValueChange={setCategory}
          options={[...new Set(POLICIES.map((p) => p.category))].map((c) => ({ value: c, label: c }))}
        />
      }
      onRowClick={(r) => setReadingId(r.id)}
      getRowId={(r) => r.id}
      exportName="policy-library"
      emptyIcon={Library}
      emptyTitle="No policies in this category"
      emptyDescription="Choose another category or clear the search."
    />
  );

  return (
    <PageBody>
      <PageHeader
        title="Policy Documents"
        description="Company policies with full version history. Read to the end, then accept — every acceptance is timestamped for audit."
        actions={
          <Gated menuKey="engage.policies" action="C">
            <Button size="sm" onClick={() => setPublishOpen(true)}>
              <Upload /> Publish new version
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={3} />
          <TableSkeleton rows={5} />
        </>
      ) : (
        <>
          <StatRow cols={3}>
            <StatTile label="Policies in library" value={num(policies.length)} icon={Library} hint={`${policies.filter((p) => p.requiresAcceptance).length} require acceptance`} />
            <StatTile label="Awaiting my acceptance" value={num(outstanding)} icon={FileText} tone={outstanding ? "warning" : "good"} hint={outstanding ? "Open a policy and read to the end" : "You are up to date"} />
            <StatTile label="Latest update" value={fmtDate([...policies].sort((a, b) => b.versions[0].publishedOn.localeCompare(a.versions[0].publishedOn))[0].versions[0].publishedOn)} icon={Upload} hint="Newest published version" />
          </StatRow>

          {isHr ? (
            <Tabs defaultValue="library">
              <TabsList>
                <TabsTrigger value="library">
                  <Library /> Library
                </TabsTrigger>
                <TabsTrigger value="tracking">
                  <Users /> Acceptance tracking
                </TabsTrigger>
              </TabsList>
              <TabsContent value="library">{library}</TabsContent>
              <TabsContent value="tracking" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <FilterSelect
                    label="Policy"
                    value={trackId}
                    onValueChange={(v) => v !== "all" && setTrackId(v)}
                    allLabel="Choose"
                    width="w-[300px]"
                    options={POLICY_ACCEPTANCE.map((a) => ({ value: a.policyId, label: policies.find((p) => p.id === a.policyId)?.title ?? a.policyId }))}
                  />
                  <span className="tnum text-xs text-muted-foreground">
                    {num(trackTotals.ok)} of {num(trackTotals.hc)} accepted ({pct((trackTotals.ok / Math.max(1, trackTotals.hc)) * 100, 0)})
                  </span>
                  <Gated menuKey="engage.policies" action="E">
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto"
                      onClick={() => mockAction("Reminders sent", { description: `${num(trackTotals.hc - trackTotals.ok)} employees with pending acceptance were reminded by email and in-app.` })}
                    >
                      <BellRing /> Remind pending
                    </Button>
                  </Gated>
                </div>
                <BarCompareChart
                  title="Acceptance by department"
                  description="Current version only — a new version resets the count."
                  data={track.map((d) => ({ department: d.department, accepted: d.accepted, pending: d.pending }))}
                  xKey="department"
                  series={[
                    { key: "accepted", label: "Accepted" },
                    { key: "pending", label: "Pending" },
                  ]}
                  stacked
                />
                <DataTable columns={deptCols} data={track} getRowId={(d) => d.departmentId} exportName={`policy-acceptance-${trackId}`} emptyIcon={Users} emptyTitle="No departments" />
              </TabsContent>
            </Tabs>
          ) : (
            library
          )}
        </>
      )}

      <PolicyReader
        policy={reading}
        status={reading ? statusOf(reading) : "info"}
        acceptedAt={reading ? (accepted[reading.id]?.at ?? null) : null}
        onOpenChange={(v) => !v && setReadingId(null)}
        onAccept={accept}
      />
      <PublishVersionDialog open={publishOpen} onOpenChange={setPublishOpen} policies={policies} onPublish={publish} />
    </PageBody>
  );
}
