"use client";

import * as React from "react";
import {
  Check,
  CheckCheck,
  Megaphone,
  Paperclip,
  Pin,
  PinOff,
  Plus,
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Alert,
  Avatar,
  Badge,
  EmptyState,
  Field,
  Input,
  Progress,
  Skeleton,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/overlays";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  useFakeLoad,
} from "@/components/shell/page";

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

  /* compose form */
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [body, setBody] = React.useState("");
  const [newCategory, setNewCategory] = React.useState<AnnouncementCategory>("Office");
  const [pinned, setPinned] = React.useState(false);
  const [requiresAck, setRequiresAck] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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

  const togglePin = (a: Announcement) => {
    setItems((xs) => xs.map((x) => (x.id === a.id ? { ...x, pinned: !x.pinned } : x)));
    mockAction(a.pinned ? "Unpinned" : "Pinned to the top", { description: a.title });
  };

  const publish = () => {
    if (title.trim().length < 8) {
      setError("Give the announcement a title of at least 8 characters.");
      return;
    }
    const a: Announcement = {
      id: `ANN-NEW-${items.length}`,
      title: title.trim(),
      summary: summary.trim() || title.trim(),
      body: body.trim() ? body.trim().split(/\n{2,}/) : [summary.trim() || title.trim()],
      category: newCategory,
      authorCode: persona.employeeId,
      authorName: persona.name,
      authorTitle: persona.title,
      publishedAt: "2026-09-16T14:35:00",
      pinned,
      audience: "All employees",
      audienceSize: 340,
      requiresAck,
      acknowledged: true,
      acknowledgedAt: "2026-09-16T14:35:00",
      ackCount: 1,
      attachments: [],
    };
    setItems((xs) => [a, ...xs]);
    setComposeOpen(false);
    setTitle("");
    setSummary("");
    setBody("");
    setError(null);
    mockAction("Announcement published", {
      description: `${a.title} — sent to ${num(a.audienceSize)} employees${requiresAck ? ", acknowledgement requested" : ""}.`,
    });
  };

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
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nothing to show"
          description="Clear the filters, or you are fully caught up."
          action={
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
          }
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
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>New announcement</DialogTitle>
            <DialogDescription>
              Published immediately to the selected audience. Separate paragraphs with a blank line.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <Field label="Title" htmlFor="ann-title" required error={error ?? undefined}>
              <Input
                id="ann-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={!!error}
                placeholder="Deepavali holiday calendar published"
              />
            </Field>

            <Field label="Summary" htmlFor="ann-summary" hint="One line shown in the feed and in the notification.">
              <Input
                id="ann-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="08 and 09 November are company holidays across both Indian branches."
              />
            </Field>

            <Field label="Body" htmlFor="ann-body">
              <Textarea
                id="ann-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[140px]"
                placeholder={"First paragraph.\n\nSecond paragraph."}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" htmlFor="ann-cat" required>
                <Select value={newCategory} onValueChange={(v) => setNewCategory(v as AnnouncementCategory)}>
                  <SelectTrigger id="ann-cat">
                    <span className="text-xs">{newCategory}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                  <span className="text-xs">Pin to the top</span>
                  <Switch checked={pinned} onCheckedChange={setPinned} aria-label="Pin to the top" />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                  <span className="text-xs">Require acknowledgement</span>
                  <Switch
                    checked={requiresAck}
                    onCheckedChange={setRequiresAck}
                    aria-label="Require acknowledgement"
                  />
                </label>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={publish}>
              <Megaphone /> Publish to 340 employees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}
