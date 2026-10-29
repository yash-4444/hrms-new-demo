"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Database, Megaphone, RotateCcw, Sparkles, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { deptLabel, requisitionByCode } from "@/mock/hiring";
import { TALENT_POOL, daysSince, type PoolCandidate, type PoolMatch } from "@/mock/lifecycle";
import { mockAction, useApp } from "@/components/app-state";
import { AI_TONE } from "@/components/ai";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { CardsSkeleton, Gated, PageBody, PageHeader, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { PersonCell } from "@/components/people/person-cell";
import { Button } from "@/components/ui/button";
import { Badge, Hint } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { ProfileSheet, agoLabel, matchKey } from "./profile-sheet";
import { CampaignDialog, type CampaignValues } from "./campaign-dialog";

/* ============================================================================
   /hiring/talent-pool — silver medallists, declined offers and past finalists,
   kept warm and re-matched against today's open requisitions by AI.
   ========================================================================== */

const STALE_DAYS = 90;

const DEPT_OPTIONS = Array.from(new Set(TALENT_POOL.map((p) => p.departmentId))).map((id) => ({ value: id, label: deptLabel(id) }));
const TAG_OPTIONS = Array.from(new Set(TALENT_POOL.flatMap((p) => p.tags)))
  .sort()
  .map((t) => ({ value: t, label: t }));

export default function TalentPoolPage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const canAdd = can("hiring.talent_pool", "E");
  const linkPipeline = can("hiring.candidates", "V");

  const [pool, setPool] = React.useState<PoolCandidate[]>(() => TALENT_POOL.map((p) => ({ ...p })));
  const [dismissed, setDismissed] = React.useState<Set<string>>(() => new Set());
  const [added, setAdded] = React.useState<Set<string>>(() => new Set());
  const [dept, setDept] = React.useState("all");
  const [tag, setTag] = React.useState("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [campaign, setCampaign] = React.useState<{ recipients: PoolCandidate[]; reqCode?: string; clear?: () => void } | null>(null);

  const topMatch = React.useCallback(
    (p: PoolCandidate) => p.matches.find((m) => !dismissed.has(matchKey(p.id, m.reqCode))),
    [dismissed],
  );

  const rows = React.useMemo(
    () => pool.filter((p) => (dept === "all" || p.departmentId === dept) && (tag === "all" || p.tags.includes(tag))),
    [pool, dept, tag],
  );
  const filtersActive = dept !== "all" || tag !== "all";
  const resetFilters = () => {
    setDept("all");
    setTag("all");
  };

  const kpis = React.useMemo(
    () => ({
      silver: pool.filter((p) => p.tags.includes("Silver medallist")).length,
      strong: pool.filter((p) => (topMatch(p)?.score ?? 0) >= 80).length,
      stale: pool.filter((p) => daysSince(p.lastContacted) > STALE_DAYS).length,
    }),
    [pool, topMatch],
  );

  /* -------------------------------------------------------------- mutators */

  const accept = (p: PoolCandidate, m: PoolMatch) => {
    setAdded((s) => new Set(s).add(matchKey(p.id, m.reqCode)));
    mockAction(`${p.name} added to ${m.reqCode}`, {
      description: `Created as Applied for ${m.role}, with the AI match notes attached for the recruiter.`,
    });
  };

  const dismiss = (p: PoolCandidate, m: PoolMatch) => {
    const key = matchKey(p.id, m.reqCode);
    setDismissed((s) => new Set(s).add(key));
    mockAction("Match dismissed", {
      description: `${p.name} won't be suggested for ${m.role} again. Your feedback tunes future matches.`,
      tone: "info",
      undo: () =>
        setDismissed((s) => {
          const n = new Set(s);
          n.delete(key);
          return n;
        }),
    });
  };

  const sent = (ids: string[], v: CampaignValues) => {
    const set = new Set(ids);
    setPool((prev) => prev.map((p) => (set.has(p.id) ? { ...p, lastContacted: DEMO_TODAY } : p)));
    campaign?.clear?.();
    const role = requisitionByCode(v.reqCode)?.role ?? v.reqCode;
    mockAction(v.sendOn === DEMO_TODAY ? `“${v.name}” sent` : `“${v.name}” scheduled`, {
      description: `${ids.length} ${v.channel === "Email" ? "emails" : "InMails"} for ${role}${
        v.sendOn === DEMO_TODAY ? " are going out now" : ` go out on ${fmtDate(v.sendOn)}`
      }. Replies route to the recruiter and open in the pipeline.`,
    });
  };

  const openProfile = (p: PoolCandidate) => {
    setOpenId(p.id);
    setSheetOpen(true);
  };
  const active = openId ? (pool.find((p) => p.id === openId) ?? null) : null;

  /* ---------------------------------------------------------------- columns */

  const columns = React.useMemo<ColumnDef<PoolCandidate, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Person",
        accessorKey: "name",
        enableHiding: false,
        cell: ({ row }) => <PersonCell name={row.original.name} subtitle={`${row.original.currentTitle} · ${row.original.currentCompany}`} />,
      },
      {
        id: "aiMatch",
        header: "Top AI match",
        accessorFn: (p) => topMatch(p)?.score ?? 0,
        cell: ({ row }) => {
          const m = topMatch(row.original);
          if (!m) return <span className="text-xs text-muted-foreground">No open match</span>;
          return (
            <span className={cn("inline-flex max-w-[240px] items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", AI_TONE.chip)}>
              <Sparkles className="size-3 shrink-0" aria-hidden />
              <span className="tnum">{m.score}%</span>
              <span className="truncate">· {m.role}</span>
            </span>
          );
        },
      },
      {
        id: "tags",
        header: "Tags",
        accessorFn: (p) => p.tags.join(", "),
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            {row.original.tags.map((t) => (
              <Badge key={t} variant="soft" className="whitespace-nowrap">
                {t}
              </Badge>
            ))}
          </span>
        ),
      },
      {
        id: "skills",
        header: "Skills",
        accessorFn: (p) => p.skills.join(", "),
        cell: ({ row }) => {
          const s = row.original.skills;
          return (
            <span className="flex flex-wrap gap-1">
              {s.slice(0, 3).map((k) => (
                <Badge key={k} variant="outline" className="whitespace-nowrap">
                  {k}
                </Badge>
              ))}
              {s.length > 3 && (
                <Hint text={s.slice(3).join(", ")}>
                  <Badge variant="muted">+{s.length - 3}</Badge>
                </Hint>
              )}
            </span>
          );
        },
      },
      {
        id: "experience",
        header: () => <span className="block text-right">Exp.</span>,
        accessorKey: "experienceYears",
        cell: ({ row }) => <span className="tnum block text-right">{row.original.experienceYears} yrs</span>,
      },
      { id: "dept", header: "Department", accessorFn: (p) => deptLabel(p.departmentId) },
      { id: "stage", header: "Last stage reached", accessorKey: "lastStageReached" },
      {
        id: "lastContacted",
        header: "Last contacted",
        accessorKey: "lastContacted",
        cell: ({ row }) => {
          const d = row.original.lastContacted;
          const stale = daysSince(d) > STALE_DAYS;
          return (
            <Hint text={`${fmtDate(d)}${stale ? " — over 90 days, worth a nudge" : ""}`}>
              <span className={cn("tnum whitespace-nowrap", stale ? "font-medium text-warning-fg" : "text-muted-foreground")}>
                {agoLabel(d)}
              </span>
            </Hint>
          );
        },
      },
      {
        id: "rating",
        header: () => <span className="block text-right">Rating</span>,
        accessorKey: "rating",
        cell: ({ row }) => (
          <span className="tnum flex items-center justify-end gap-1">
            <Star className="size-3 fill-warning text-warning" aria-hidden />
            {row.original.rating.toFixed(1)}
          </span>
        ),
      },
    ],
    [topMatch],
  );

  return (
    <PageBody>
      <PageHeader
        title="Talent Pool"
        description="Finalists and declined offers from past cycles, re-matched by AI against every open requisition. Hire faster from people who already cleared your bar."
        actions={
          <>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw /> Clear filters
              </Button>
            )}
            <Gated menuKey="hiring.talent_pool" action="C">
              <Button size="sm" onClick={() => setCampaign({ recipients: rows })} disabled={rows.length === 0}>
                <Megaphone /> Re-engage campaign
              </Button>
            </Gated>
          </>
        }
      />

      {loading ? (
        <CardsSkeleton count={4} />
      ) : (
        <StatRow cols={4}>
          <StatTile label="People in pool" value={pool.length} icon={Database} tone="accent" hint={`${DEPT_OPTIONS.length} departments`} />
          <StatTile
            label="Silver medallists"
            value={kpis.silver}
            icon={Star}
            hint="Reached the final loop, not selected"
            onClick={() => setTag(tag === "Silver medallist" ? "all" : "Silver medallist")}
            footer={tag === "Silver medallist" ? "Filtering the table — click again to clear" : undefined}
          />
          <StatTile label="Strong AI matches" value={kpis.strong} icon={Sparkles} tone="good" hint="80%+ fit to an open requisition" />
          <StatTile
            label="Not contacted in 90 days"
            value={kpis.stale}
            icon={Megaphone}
            tone={kpis.stale > 0 ? "warning" : "neutral"}
            hint="Candidates for the next campaign"
          />
        </StatRow>
      )}

      {loading ? (
        <TableSkeleton rows={10} />
      ) : (
        <DataTable<PoolCandidate>
          columns={columns}
          data={rows}
          getRowId={(p) => p.id}
          searchKeys={["name", "currentTitle", "currentCompany"]}
          searchPlaceholder="Search name, title or company…"
          exportName="talent-pool"
          enableSelection
          onRowClick={openProfile}
          rowTone={(p) => (daysSince(p.lastContacted) > STALE_DAYS ? "warning" : undefined)}
          bulkActions={(selected, clear) => (
            <Gated menuKey="hiring.talent_pool" action="C">
              <Button size="sm" onClick={() => setCampaign({ recipients: selected, clear })}>
                <Megaphone /> Re-engage {selected.length}
              </Button>
            </Gated>
          )}
          emptyIcon={Database}
          emptyTitle="No one in the pool matches these filters"
          emptyDescription="Finalists are added automatically when a requisition closes without selecting them."
          emptyAction={
            <Button variant="outline" size="sm" onClick={resetFilters}>
              <RotateCcw /> Clear filters
            </Button>
          }
          filters={
            <>
              <FilterSelect label="Department" value={dept} onValueChange={setDept} options={DEPT_OPTIONS} allLabel="All departments" width="w-[190px]" />
              <FilterSelect label="Tag" value={tag} onValueChange={setTag} options={TAG_OPTIONS} allLabel="All tags" width="w-[200px]" />
            </>
          }
          toolbar={
            <Badge variant="muted" className="tnum">
              {rows.length} of {pool.length}
            </Badge>
          }
        />
      )}

      <ProfileSheet
        person={active}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        dismissed={dismissed}
        added={added}
        canAdd={canAdd}
        linkPipeline={linkPipeline}
        onAccept={accept}
        onDismiss={dismiss}
        onReengage={(p) => setCampaign({ recipients: [p], reqCode: topMatch(p)?.reqCode })}
      />

      {campaign && (
        <CampaignDialog
          open
          onOpenChange={(v) => !v && setCampaign(null)}
          recipients={campaign.recipients}
          defaultReq={campaign.reqCode}
          onSent={sent}
        />
      )}
    </PageBody>
  );
}
