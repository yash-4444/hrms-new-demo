"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Check,
  CheckCheck,
  Megaphone,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Rows3,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtAgo, num, pct } from "@/lib/format";
import {
  ANNOUNCEMENTS,
  ANNOUNCEMENT_STATS,
  type Announcement,
  type AnnouncementCategory,
} from "@/mock/workplace";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { ViewToggle, type ListView } from "@/components/people/view-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Avatar, Badge, EmptyState, Progress, Skeleton } from "@/components/ui/primitives";
import { FilterSelect } from "@/components/ui/overlays";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  useFakeLoad,
} from "@/components/shell/page";
import { AnnounceComposeDialog, type AnnounceValues } from "@/components/ai/embed/announce-compose-dialog";

const CATEGORIES: AnnouncementCategory[] = [
  "Policy",
  "People",
  "Benefits",
  "Office",
  "Product",
  "Compliance",
];

export default function AnnouncementsPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

  const [items, setItems] = React.useState<Announcement[]>(ANNOUNCEMENTS);
  const [category, setCategory] = React.useState("all");
  const [onlyUnacked, setOnlyUnacked] = React.useState(false);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [view, setView] = React.useState<ListView>("cards");

  const visible = React.useMemo(
    () =>
      items
        .filter((a) => category === "all" || a.category === category)
        .filter((a) => !onlyUnacked || (a.requiresAck && !a.acknowledged))
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
          return b.publishedAt.localeCompare(a.publishedAt);
        }),
    [items, category, onlyUnacked],
  );

  const pendingAcks = items.filter((a) => a.requiresAck && !a.acknowledged).length;

  const acknowledge = (a: Announcement) => {
    setItems((xs) =>
      xs.map((x) =>
        x.id === a.id
          ? { ...x, acknowledged: true, acknowledgedAt: "2026-09-16T14:35:00", ackCount: x.ackCount + 1 }
          : x,
      ),
    );
    mockAction("Acknowledged", { description: a.title });
  };

  const acknowledgeMany = (rows: Announcement[]) => {
    const ids = new Set(rows.filter((a) => a.requiresAck && !a.acknowledged).map((a) => a.id));
    setItems((xs) =>
      xs.map((x) =>
        ids.has(x.id)
          ? { ...x, acknowledged: true, acknowledgedAt: "2026-09-16T14:35:00", ackCount: x.ackCount + 1 }
          : x,
      ),
    );
    mockAction(`Acknowledged ${ids.size} announcement${ids.size === 1 ? "" : "s"}`, {
      description: "Recorded against your employee record for the compliance pack.",
    });
  };

  const togglePin = (a: Announcement) => {
    setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, pinned: !x.pinned } : x)));
    mockAction(a.pinned ? "Unpinned" : "Pinned to the top", { description: a.title });
  };

  const publish = (v: AnnounceValues, audienceSize: number) => {
    const a: Announcement = {
      id: `ANN-NEW-${items.length}`,
      title: v.title.trim(),
      summary: v.summary.trim() || v.title.trim(),
      body: v.body.trim() ? v.body.trim().split(/\n{2,}/) : [v.summary.trim() || v.title.trim()],
      category: v.category,
      authorCode: persona.employeeId,
      authorName: persona.name,
      authorTitle: persona.title,
      publishedAt: "2026-09-16T14:35:00",
      pinned: v.pinned,
      audience: v.audience,
      audienceSize,
      requiresAck: v.requiresAck,
      acknowledged: true,
      acknowledgedAt: "2026-09-16T14:35:00",
      ackCount: 1,
      attachments: [],
    };
    setItems((xs) => [a, ...xs]);
    mockAction("Announcement published", {
      description: `${a.title} — sent to ${num(a.audienceSize)} employees${v.requiresAck ? ", acknowledgement requested" : ""}.`,
    });
  };

  /* Table view — the same feed, sortable, with selection and Export. */
  const columns: ColumnDef<Announcement, unknown>[] = [
    {
      id: "title",
      header: "Announcement",
      accessorKey: "title",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="min-w-[260px] max-w-[420px]">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            {row.original.pinned && <Pin className="size-3 shrink-0 text-primary" aria-label="Pinned" />}
            <span className="truncate">{row.original.title}</span>
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{row.original.summary}</p>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      accessorKey: "category",
      cell: ({ row }) => <Badge variant="muted">{row.original.category}</Badge>,
    },
    { id: "author", header: "Author", accessorKey: "authorName" },
    {
      id: "published",
      header: "Published",
      accessorKey: "publishedAt",
      cell: ({ row }) => <span className="tnum whitespace-nowrap">{fmtDate(row.original.publishedAt)}</span>,
    },
    { id: "audience", header: "Audience", accessorKey: "audience" },
    {
      id: "readRate",
      header: "Acknowledged",
      accessorFn: (a) => (a.requiresAck ? a.ackCount / Math.max(1, a.audienceSize) : -1),
      cell: ({ row }) => {
        const a = row.original;
        if (!a.requiresAck) return <span className="text-muted-foreground">Not requested</span>;
        const ackPct = (a.ackCount / Math.max(1, a.audienceSize)) * 100;
        return (
          <div className="flex min-w-[140px] items-center gap-2">
            <Progress
              value={ackPct}
              className="flex-1"
              tone={ackPct >= 80 ? "success" : ackPct >= 50 ? "warning" : "danger"}
              aria-label={`${a.title} acknowledgement progress`}
            />
            <span className="tnum w-9 text-right">{pct(ackPct, 0)}</span>
          </div>
        );
      },
    },
    {
      id: "mine",
      header: "You",
      accessorFn: (a) => (!a.requiresAck ? "—" : a.acknowledged ? "Acknowledged" : "Pending"),
      cell: ({ row }) => {
        const a = row.original;
        if (!a.requiresAck) return <span className="text-muted-foreground">—</span>;
        return a.acknowledged ? (
          <span className="flex items-center gap-1 whitespace-nowrap text-success-fg">
            <Check className="size-3" aria-hidden /> Acknowledged
          </span>
        ) : (
          <Button size="sm" onClick={() => acknowledge(a)}>
            Acknowledge
          </Button>
        );
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <Gated menuKey="workplace.announcements" action="E" hide>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={row.original.pinned ? `Unpin ${row.original.title}` : `Pin ${row.original.title}`}
            onClick={() => togglePin(row.original)}
          >
            {row.original.pinned ? <PinOff /> : <Pin />}
          </Button>
        </Gated>
      ),
    },
  ];

  const viewToggle = <ViewToggle view={view} onChange={setView} cardsLabel="Feed view" cardsIcon={Rows3} />;
  const clearFiltersButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setCategory("all");
        setOnlyUnacked(false);
      }}
    >
      Clear filters
    </Button>
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Announcements" description="Loading the feed…" />
        <Skeleton className="h-[480px]" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Announcements"
        description="Company-wide communication. Pinned items stay at the top; anything requiring acknowledgement tracks who has read it."
        actions={
          <Gated menuKey="workplace.announcements" action="C">
            <Button size="sm" onClick={() => setComposeOpen(true)}>
              <Plus /> New announcement
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Published" value={num(items.length)} icon={Megaphone} hint={`${items.filter((a) => a.pinned).length} pinned`} />
        <StatTile
          label="Awaiting your acknowledgement"
          value={num(pendingAcks)}
          icon={CheckCheck}
          tone={pendingAcks > 0 ? "warning" : "good"}
          onClick={() => setOnlyUnacked(true)}
        />
        <StatTile
          label="Average read rate"
          value={pct(ANNOUNCEMENT_STATS.avgAckRate)}
          icon={Users}
          hint="Across items requiring acknowledgement"
        />
        <StatTile label="Audience" value={num(340)} icon={Users} hint="All employees, all branches" />
      </StatRow>

      {pendingAcks > 0 && (
        <Alert
          tone="warning"
          icon={CheckCheck}
          title={`${pendingAcks} announcement${pendingAcks === 1 ? "" : "s"} still need your acknowledgement`}
        >
          Acknowledgement is recorded against your employee record and shows in the compliance pack.
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <FilterSelect
          label="Category"
          value={category}
          onValueChange={setCategory}
          allLabel="All categories"
          width="w-[175px]"
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <Button
          variant={onlyUnacked ? "default" : "outline"}
          size="sm"
          aria-pressed={onlyUnacked}
          onClick={() => setOnlyUnacked((v) => !v)}
        >
          <CheckCheck /> Needs my acknowledgement
        </Button>
        <span className="tnum ml-auto text-xs text-muted-foreground">
          {visible.length} of {items.length} announcements
        </span>
        {viewToggle}
      </div>

      {view === "table" ? (
        <DataTable<Announcement>
          columns={columns}
          data={visible}
          getRowId={(a) => a.id}
          searchKeys={["title", "summary", "authorName"]}
          searchPlaceholder="Search announcements…"
          enableSelection
          exportName="announcements"
          emptyIcon={Megaphone}
          emptyTitle="Nothing to show"
          emptyDescription="Clear the filters, or you are fully caught up."
          emptyAction={clearFiltersButton}
          bulkActions={(rows, clear) => (
            <Button
              size="sm"
              variant="outline"
              disabled={!rows.some((a) => a.requiresAck && !a.acknowledged)}
              onClick={() => {
                acknowledgeMany(rows);
                clear();
              }}
            >
              <CheckCheck /> Acknowledge
            </Button>
          )}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nothing to show"
          description="Clear the filters, or you are fully caught up."
          action={clearFiltersButton}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((a) => {
            const ackPct = (a.ackCount / Math.max(1, a.audienceSize)) * 100;
            return (
              <li key={a.id}>
                <Card className={cn("overflow-hidden", a.pinned && "border-primary/30")}>
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5">
                        {a.pinned && (
                          <Badge variant="soft">
                            <Pin className="size-3" aria-hidden /> Pinned
                          </Badge>
                        )}
                        <Badge variant="muted">{a.category}</Badge>
                        {a.requiresAck && (
                          <Badge variant="outline">Acknowledgement requested</Badge>
                        )}
                      </p>
                      <h2 className="mt-1.5 text-sm font-semibold tracking-tight">{a.title}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.summary}</p>
                    </div>
                    <Gated menuKey="workplace.announcements" action="E" hide>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={a.pinned ? `Unpin ${a.title}` : `Pin ${a.title}`}
                        onClick={() => togglePin(a)}
                      >
                        {a.pinned ? <PinOff /> : <Pin />}
                      </Button>
                    </Gated>
                  </div>

                  <div className="flex flex-col gap-2 px-4 pb-3">
                    {a.body.map((p, i) => (
                      <p key={i} className="text-xs leading-relaxed text-foreground/90">
                        {p}
                      </p>
                    ))}
                  </div>

                  {a.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                      {a.attachments.map((f) => (
                        <button
                          key={f.name}
                          type="button"
                          onClick={() =>
                            mockAction("Download started", {
                              description: `${f.name} (${f.size}) — not written to disk in the demo.`,
                            })
                          }
                          className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Paperclip className="size-3" aria-hidden />
                          {f.name}
                          <span className="tnum opacity-70">{f.size}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2.5">
                    <Avatar name={a.authorName} size={24} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium">{a.authorName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {a.authorTitle} · {fmtDate(a.publishedAt)} · {fmtAgo(a.publishedAt)}
                      </p>
                    </div>

                    {a.requiresAck && (
                      <div className="ml-auto flex min-w-[190px] flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {a.audience} · {num(a.audienceSize)}
                          </span>
                          <span className="tnum text-[10px] font-medium">
                            {num(a.ackCount)} acknowledged ({pct(ackPct, 0)})
                          </span>
                        </div>
                        <Progress
                          value={ackPct}
                          tone={ackPct >= 80 ? "success" : ackPct >= 50 ? "warning" : "danger"}
                          aria-label={`${a.title} acknowledgement progress`}
                        />
                      </div>
                    )}

                    {a.requiresAck && (
                      <Button
                        size="sm"
                        variant={a.acknowledged ? "ghost" : "default"}
                        disabled={a.acknowledged}
                        className={a.requiresAck ? "" : "ml-auto"}
                        onClick={() => acknowledge(a)}
                      >
                        {a.acknowledged ? (
                          <>
                            <Check /> Acknowledged
                          </>
                        ) : (
                          "Acknowledge"
                        )}
                      </Button>
                    )}
                  </div>

                  {a.acknowledged && a.acknowledgedAt && (
                    <p className="border-t border-border bg-success-soft/40 px-4 py-1.5 text-[10px] text-success-fg">
                      <Check className="mr-1 inline size-3" aria-hidden />
                      You acknowledged this on {fmtDate(a.acknowledgedAt)}.
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* ------------------------------------------------------- compose */}
      <AnnounceComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onPublish={publish}
        authorName={persona.name}
      />
    </PageBody>
  );
}
