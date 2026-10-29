"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  BadgeCheck,
  Cpu,
  FlaskConical,
  Gauge,
  Globe2,
  IndianRupee,
  Lock,
  MessageSquare,
  Play,
  Save,
  ScrollText,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime, inr, num, pct } from "@/lib/format";
import {
  AI_AUDIT_LOG,
  AI_EVAL,
  AI_FEATURES,
  AI_GUARDRAILS,
  AI_PROVIDER,
  AI_QUOTA,
  AI_ROLE_COLUMNS,
  AI_USAGE_BY_FEATURE,
  AI_USAGE_BY_MONTH,
  type AiAuditEntry,
  type AiFeature,
  type AiGuardrail,
} from "@/mock/ai";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell, NumCell } from "@/components/data-table";
import { PersonCell } from "@/components/people/person-cell";
import { BarCompareChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert, Hint, Progress, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { FilterSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { AI_TONE, AiBadge } from "@/components/ai/ai-ui";

const OUTCOME: Record<AiAuditEntry["outcome"], { status: string; label: string }> = {
  answered: { status: "completed", label: "Answered" },
  refused: { status: "rejected", label: "Refused — out of scope" },
  action_confirmed: { status: "approved", label: "Action confirmed" },
  action_declined: { status: "cancelled", label: "Action declined" },
  fallback: { status: "on_hold", label: "No answer (fallback)" },
};

const PROVIDERS = [
  { value: "azure", label: "Azure OpenAI — Central India" },
  { value: "bedrock", label: "AWS Bedrock — Mumbai (ap-south-1)" },
  { value: "selfhost", label: "Self-hosted — tenant VPC" },
];

const thisMonth = AI_USAGE_BY_MONTH[AI_USAGE_BY_MONTH.length - 1];

export default function AiSettingsPage() {
  const loading = useFakeLoad();
  const { can, why } = useApp();
  const canEdit = can("admin.ai", "E");
  const [features, setFeatures] = React.useState<AiFeature[]>(AI_FEATURES);
  const [guards, setGuards] = React.useState<AiGuardrail[]>(AI_GUARDRAILS);
  const [provider, setProvider] = React.useState("azure");
  const [dirty, setDirty] = React.useState(false);
  const [outcome, setOutcome] = React.useState("all");
  const [feature, setFeature] = React.useState("all");

  const toggleFeature = (id: string) => {
    setFeatures((fs) => fs.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
    setDirty(true);
  };
  const toggleRole = (id: string, role: string) => {
    setFeatures((fs) => fs.map((f) => (f.id === id ? { ...f, roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role] } : f)));
    setDirty(true);
  };
  const toggleGuard = (id: string) => {
    setGuards((gs) => gs.map((g) => (g.id === id && !g.locked ? { ...g, enabled: !g.enabled } : g)));
    setDirty(true);
  };

  const audit = AI_AUDIT_LOG.filter((a) => (outcome === "all" || a.outcome === outcome) && (feature === "all" || a.feature === feature));
  const auditColumns = React.useMemo<ColumnDef<AiAuditEntry, unknown>[]>(
    () => [
      { accessorKey: "at", header: "When", cell: ({ row }) => <MutedCell>{fmtDateTime(row.original.at)}</MutedCell> },
      { accessorKey: "actorName", header: "Who", cell: ({ row }) => <PersonCell name={row.original.actorName} subtitle={row.original.role} size={22} /> },
      { accessorKey: "feature", header: "Feature", cell: ({ row }) => <span className="text-xs">{row.original.feature}</span> },
      { accessorKey: "prompt", header: "Asked", cell: ({ row }) => <span className="block max-w-[280px] truncate text-xs" title={row.original.prompt}>{row.original.prompt}</span> },
      { accessorKey: "tools", header: "Tools used", cell: ({ row }) => <span className="block max-w-[240px] truncate text-[11px] text-muted-foreground" title={row.original.tools}>{row.original.tools}</span> },
      { accessorKey: "outcome", header: "Outcome", cell: ({ row }) => <StatusBadge status={OUTCOME[row.original.outcome].status} label={OUTCOME[row.original.outcome].label} /> },
      { accessorKey: "redactions", header: "PII redacted", cell: ({ row }) => <NumCell>{row.original.redactions || "—"}</NumCell> },
    ],
    [],
  );

  const quotaPct = (thisMonth.requests / AI_QUOTA.monthlyRequests) * 100;
  const tokenPct = (thisMonth.tokens / AI_QUOTA.monthlyTokens) * 100;

  return (
    <PageBody>
      <PageHeader
        title="AI Settings & Usage"
        description="Choose the model provider, decide which roles get which AI capabilities, set guardrails, and audit every AI interaction."
        actions={
          <>
            <span className="inline-flex items-center gap-1 rounded-md border border-success/25 bg-success-soft px-1.5 py-0.5 text-[11px] font-medium text-success-fg">
              <ShieldCheck className="size-3" aria-hidden />
              No training on your data
            </span>
            <Gated menuKey="admin.ai" action="E">
              <Button
                size="sm"
                disabled={!dirty}
                onClick={() => {
                  setDirty(false);
                  mockAction("AI settings saved", { description: "Changes apply to new conversations immediately and are written to the audit log." });
                }}
              >
                <Save aria-hidden />
                Save changes
              </Button>
            </Gated>
          </>
        }
      />

      {!canEdit && (
        <Alert tone="neutral" icon={Lock}>
          Read-only. {why("admin.ai", "E")}
        </Alert>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Provider & guardrails</TabsTrigger>
          <TabsTrigger value="capabilities">Capabilities by role</TabsTrigger>
          <TabsTrigger value="usage">Usage & quota</TabsTrigger>
          <TabsTrigger value="audit">AI audit log</TabsTrigger>
          <TabsTrigger value="eval">Evaluation</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------- overview */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
            <Section title="Model provider" description="Swappable — the product is not tied to one vendor" actions={<AiBadge />} bodyClassName="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Active provider</p>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    setProvider(v);
                    setDirty(true);
                  }}
                  disabled={!canEdit}
                >
                  <SelectTrigger aria-label="Active provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-xs">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Cpu className="size-3.5" aria-hidden />
                  Model tier
                </dt>
                <dd className="font-medium">{AI_PROVIDER.modelTier}</dd>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Globe2 className="size-3.5" aria-hidden />
                  Data region
                </dt>
                <dd className="font-medium">{AI_PROVIDER.region}</dd>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  Contract
                </dt>
                <dd>{AI_PROVIDER.contract}</dd>
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="size-3.5" aria-hidden />
                  Supported
                </dt>
                <dd className="text-muted-foreground">{AI_PROVIDER.provider}</dd>
              </dl>
              <div className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-xs", AI_TONE.soft)}>
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-fg" aria-hidden />
                <p>
                  <span className="font-semibold">No training on your data.</span> Prompts and answers stay in India, are never used to train models, and are deleted by the provider after the response (zero data retention).
                </p>
              </div>
            </Section>

            <Section title="Guardrails" description="Enforced before any text reaches the model and before any action is written">
              <ul className="flex flex-col divide-y divide-border">
                {guards.map((g) => (
                  <li key={g.id} className="flex items-start gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-xs font-medium">
                        {g.label}
                        {g.locked && (
                          <span className="inline-flex items-center gap-0.5 rounded border border-border px-1 text-[10px] text-muted-foreground">
                            <Lock className="size-2.5" aria-hidden />
                            Always on
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{g.description}</p>
                    </div>
                    <Hint text={g.locked ? "Required by policy — cannot be switched off" : !canEdit ? why("admin.ai", "E") : undefined}>
                      <span className="inline-flex">
                        <Switch checked={g.enabled} disabled={g.locked || !canEdit} onCheckedChange={() => toggleGuard(g.id)} aria-label={g.label} />
                      </span>
                    </Hint>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- capabilities */}
        <TabsContent value="capabilities" className="mt-4">
          <Section title="Capabilities by role" description="Switch a capability off for everyone, or choose which roles get it. Roles still need the underlying module grant." bodyClassName="p-0">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-subtle text-left">
                    <th scope="col" className="px-3 py-2 font-medium text-muted-foreground">
                      Capability
                    </th>
                    <th scope="col" className="px-2 py-2 font-medium text-muted-foreground">
                      On
                    </th>
                    {AI_ROLE_COLUMNS.map((r) => (
                      <th key={r.id} scope="col" className="px-1 py-2 text-center font-medium text-muted-foreground">
                        <Hint text={r.label}>
                          <span>{r.short}</span>
                        </Hint>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {features.map((f) => (
                    <tr key={f.id} className={cn("border-b border-border last:border-0", !f.enabled && "opacity-60")}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-foreground">
                          {f.label}
                          {f.writes && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">· can propose writes</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{f.description}</p>
                      </td>
                      <td className="px-2 py-2">
                        <Switch checked={f.enabled} disabled={!canEdit} onCheckedChange={() => toggleFeature(f.id)} aria-label={`${f.label} enabled`} />
                      </td>
                      {AI_ROLE_COLUMNS.map((r) => {
                        const on = f.roles.includes(r.id);
                        return (
                          <td key={r.id} className="px-1 py-2 text-center">
                            <button
                              type="button"
                              aria-pressed={on}
                              aria-label={`${f.label} for ${r.label}`}
                              disabled={!canEdit || !f.enabled}
                              onClick={() => toggleRole(f.id, r.id)}
                              className={cn(
                                "inline-flex size-6 items-center justify-center rounded-md border text-[10px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                                on ? AI_TONE.chip : "border-dashed border-border text-muted-foreground/60",
                              )}
                            >
                              {on ? r.short : "·"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              E Employee · M Manager · H HR Admin · P Payroll Admin · R Recruiter · F Finance Controller · D Department Head · K HR Ops Agent · I IT & Asset Admin · A Auditor. Tenant Owner always has every capability.
            </p>
          </Section>
        </TabsContent>

        {/* ---------------------------------------------------- usage */}
        <TabsContent value="usage" className="mt-4">
          <div className="flex flex-col gap-4">
            {loading ? (
              <CardsSkeleton />
            ) : (
              <StatRow>
                <StatTile label="Requests · Sep (to date)" value={num(thisMonth.requests)} icon={MessageSquare} hint={`of ${num(AI_QUOTA.monthlyRequests)} ${AI_QUOTA.tier} quota`} />
                <StatTile label="Tokens · Sep (to date)" value={`${(thisMonth.tokens / 1_000_000).toFixed(1)} M`} icon={Gauge} hint={`of ${num(AI_QUOTA.monthlyTokens / 1_000_000)} M`} />
                <StatTile label="Estimated cost · Sep" value={inr(thisMonth.cost)} icon={IndianRupee} hint="₹0.62 per 1,000 tokens, blended" />
                <StatTile label="Cost per employee · Sep" value={inr(Math.round(thisMonth.cost / 340))} icon={IndianRupee} hint="340 employees" />
              </StatRow>
            )}
            <Section title={`Quota — ${AI_QUOTA.tier} plan`} description="Resets on the 1st. At 90% admins are notified; at 100% non-essential features pause, Policy Q&A keeps running.">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>Requests</span>
                    <span className="tnum text-muted-foreground">
                      {num(thisMonth.requests)} / {num(AI_QUOTA.monthlyRequests)} · {pct(quotaPct)}
                    </span>
                  </div>
                  <Progress value={quotaPct} tone={quotaPct > 90 ? "danger" : quotaPct > 75 ? "warning" : "accent"} aria-label="Request quota used" />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>Tokens</span>
                    <span className="tnum text-muted-foreground">
                      {(thisMonth.tokens / 1_000_000).toFixed(1)} M / {num(AI_QUOTA.monthlyTokens / 1_000_000)} M · {pct(tokenPct)}
                    </span>
                  </div>
                  <Progress value={tokenPct} tone={tokenPct > 90 ? "danger" : tokenPct > 75 ? "warning" : "accent"} aria-label="Token quota used" />
                </div>
              </div>
            </Section>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <BarCompareChart title="Requests by month" description="FY 2026-27, all features" data={AI_USAGE_BY_MONTH} xKey="month" series={[{ key: "requests", label: "Requests" }]} height={230} />
              <BarCompareChart
                title="Cost by feature · Sep"
                description="Estimated, in INR"
                data={AI_USAGE_BY_FEATURE}
                xKey="feature"
                series={[{ key: "cost", label: "Cost" }]}
                valueFormat={(v) => inr(v)}
                horizontal
                height={260}
              />
            </div>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- audit */}
        <TabsContent value="audit" className="mt-4">
          <Section title="AI audit log" description="Every question, the tools used and whether a proposed action was confirmed. Kept for 7 years; prompts are stored with PII already redacted." bodyClassName="p-3">
            {loading ? (
              <TableSkeleton />
            ) : (
              <DataTable
                columns={auditColumns}
                data={audit}
                searchKeys={["actorName", "prompt", "tools", "feature"]}
                searchPlaceholder="Search the audit log…"
                getRowId={(a) => a.id}
                exportName="ai-audit-log"
                dense
                rowTone={(a) => (a.outcome === "refused" ? "warning" : undefined)}
                filters={
                  <>
                    <FilterSelect label="Outcome" value={outcome} onValueChange={setOutcome} options={Object.entries(OUTCOME).map(([k, v]) => ({ value: k, label: v.label }))} width="w-[170px]" />
                    <FilterSelect label="Feature" value={feature} onValueChange={setFeature} options={[...new Set(AI_AUDIT_LOG.map((a) => a.feature))].map((f) => ({ value: f, label: f }))} />
                  </>
                }
                emptyTitle="No AI activity matches"
                emptyDescription="Clear the filters to see every interaction."
                emptyIcon={ScrollText}
              />
            )}
          </Section>
        </TabsContent>

        {/* ---------------------------------------------------- eval */}
        <TabsContent value="eval" className="mt-4">
          <div className="flex flex-col gap-4">
            <StatRow cols={5}>
              <StatTile label="Answer accuracy" value={pct(AI_EVAL.accuracy)} icon={FlaskConical} deltaValue={AI_EVAL.accuracy - AI_EVAL.accuracyPrev} deltaSuffix=" pts" deltaLabel="vs last run" goodDirection="up" tone="good" />
              <StatTile label="Citation precision" value={pct(AI_EVAL.citationPrecision)} icon={BadgeCheck} />
              <StatTile label="Thumbs-up rate" value={pct(AI_EVAL.thumbsUpRate)} icon={ThumbsUp} />
              <StatTile label="Ticket deflection" value={pct(AI_EVAL.deflectionRate)} icon={MessageSquare} />
              <StatTile label="Correct refusals" value={pct(AI_EVAL.refusalCorrectness)} icon={ShieldCheck} hint="Out-of-scope asks refused" />
            </StatRow>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <BarCompareChart
                title="Accuracy by category"
                description={`Golden test set of ${AI_EVAL.testSetSize} questions · last run ${AI_EVAL.lastRun}`}
                data={AI_EVAL.byCategory}
                xKey="category"
                series={[{ key: "accuracy", label: "Accuracy %" }]}
                valueFormat={(v) => pct(v)}
                height={240}
              />
              <Section title="How we evaluate" actions={<AiBadge />}>
                <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs text-foreground/90">
                  <li>{AI_EVAL.testSetSize} real HR questions with expected answers, reviewed by HR and Payroll.</li>
                  <li>Every policy answer must cite the right passage — uncited answers count as wrong.</li>
                  <li>Questions outside the asker&apos;s scope must be refused; a leak fails the run.</li>
                  <li>Runs nightly and on every model or prompt change; a drop over 2 points blocks the release.</li>
                </ul>
                <Gated menuKey="admin.ai" action="X">
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => mockAction("Evaluation started", { description: `${AI_EVAL.testSetSize} questions · results in about 6 minutes`, tone: "info" })}
                  >
                    <Play aria-hidden />
                    Run evaluation now
                  </Button>
                </Gated>
              </Section>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}
