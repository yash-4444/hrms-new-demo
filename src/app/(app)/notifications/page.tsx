"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, Bell, BellOff, CheckCheck, CircleCheck, Info, Settings2, TriangleAlert, OctagonAlert, Lock } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { fmtDate, fmtTime } from "@/lib/format";
import { menuKeyForPath } from "@/lib/nav";
import { DEMO_TODAY } from "@/mock/org";
import { EXTRA_NOTIFICATIONS, SEED_CATEGORY, type FeedNotification, type NotificationCategory } from "@/mock/self-service";
import { mockAction, useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Hint, Tabs, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { CardsSkeleton, PageBody, PageHeader, Section, useFakeLoad } from "@/components/shell/page";

type Filter = "all" | "unread" | NotificationCategory;

const TONE: Record<NonNullable<FeedNotification["tone"]>, { icon: React.ElementType; className: string }> = {
  info: { icon: Info, className: "bg-info-soft text-info-fg" },
  warning: { icon: TriangleAlert, className: "bg-warning-soft text-warning-fg" },
  success: { icon: CircleCheck, className: "bg-success-soft text-success-fg" },
  danger: { icon: OctagonAlert, className: "bg-destructive-soft text-destructive-fg" },
};

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  approvals: "Approvals",
  mentions: "Mentions",
  system: "System",
};

function dayBucket(at: string) {
  const d = differenceInCalendarDays(parseISO(DEMO_TODAY), parseISO(at));
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : "Earlier";
}

export default function NotificationsPage() {
  const loading = useFakeLoad();
  const router = useRouter();
  const { notifications, markRead, markAllRead, can } = useApp();
  const [extraRead, setExtraRead] = React.useState<Set<string>>(
    () => new Set(EXTRA_NOTIFICATIONS.filter((n) => n.read).map((n) => n.id)),
  );
  const [filter, setFilter] = React.useState<Filter>("all");

  /* App-state seeds (shared with the top-bar bell) + the richer feed. */
  const feed = React.useMemo<FeedNotification[]>(() => {
    const seeds: FeedNotification[] = notifications.map((n) => ({
      ...n,
      category: SEED_CATEGORY[n.id] ?? (/approv|awaiting/i.test(n.title) ? "approvals" : "system"),
    }));
    const extras = EXTRA_NOTIFICATIONS.map((n) => ({ ...n, read: extraRead.has(n.id) }));
    return [...seeds, ...extras].sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [notifications, extraRead]);

  const reachable = (n: FeedNotification) => {
    if (!n.href) return false;
    const key = menuKeyForPath(n.href);
    return !key || can(key);
  };

  const visible = feed.filter((n) =>
    filter === "all" ? true : filter === "unread" ? !n.read : n.category === filter,
  );
  const unread = feed.filter((n) => !n.read).length;
  const counts: Record<Filter, number> = {
    all: feed.length,
    unread,
    approvals: feed.filter((n) => n.category === "approvals").length,
    mentions: feed.filter((n) => n.category === "mentions").length,
    system: feed.filter((n) => n.category === "system").length,
  };

  const markOne = (n: FeedNotification) => {
    if (n.id in SEED_CATEGORY || notifications.some((s) => s.id === n.id)) markRead(n.id);
    else setExtraRead((s) => new Set(s).add(n.id));
  };

  const groups = (["Today", "Yesterday", "Earlier"] as const)
    .map((label) => ({ label, items: visible.filter((n) => dayBucket(n.at) === label) }))
    .filter((g) => g.items.length > 0);

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Notifications" description="Loading…" />
        <CardsSkeleton count={4} height={64} />
      </PageBody>
    );
  }

  return (
    <PageBody className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Notifications"
        description="Everything the system told you, grouped by day. Open one to jump straight to the record — it is marked read as you go."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/me/preferences">
                <Settings2 /> Preferences
              </Link>
            </Button>
            <Button
              size="sm"
              disabled={unread === 0}
              onClick={() => {
                markAllRead();
                setExtraRead(new Set(EXTRA_NOTIFICATIONS.map((n) => n.id)));
                mockAction(`Marked ${unread} notification${unread === 1 ? "" : "s"} as read`);
              }}
            >
              <CheckCheck /> Mark all read
            </Button>
          </>
        }
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="flex-wrap">
          {(["all", "unread", "approvals", "mentions", "system"] as Filter[]).map((f) => (
            <TabsTrigger key={f} value={f}>
              {f === "all" ? "All" : f === "unread" ? "Unread" : CATEGORY_LABEL[f as NotificationCategory]}
              <span className="tnum ml-1 text-muted-foreground">{counts[f]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {groups.length === 0 ? (
        <EmptyState
          icon={filter === "unread" ? CheckCheck : BellOff}
          title={filter === "unread" ? "You're all caught up" : "Nothing here"}
          description={
            filter === "unread"
              ? "Every notification has been read. New ones arrive in real time on the channels you chose."
              : "No notifications in this category yet."
          }
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/me/preferences">Choose what you get notified about</Link>
            </Button>
          }
        />
      ) : (
        groups.map((g) => (
          <Section key={g.label} title={g.label} description={g.label === "Earlier" ? `Before ${fmtDate("2026-09-15")}` : undefined} bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {g.items.map((n) => {
                const tone = TONE[n.tone ?? "info"];
                const Icon = n.category === "mentions" ? AtSign : tone.icon;
                const ok = reachable(n);
                return (
                  <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.read && "bg-primary-soft/30")}>
                    <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full", tone.className)}>
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <button
                      type="button"
                      disabled={!ok}
                      onClick={() => {
                        markOne(n);
                        if (n.href) router.push(n.href);
                      }}
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        {!n.read && <span className="size-1.5 rounded-full bg-primary" aria-label="Unread" />}
                        <span className={cn("text-sm", !n.read ? "font-semibold" : "font-medium")}>{n.title}</span>
                        <Badge variant="muted" className="text-[10px]">
                          {CATEGORY_LABEL[n.category]}
                        </Badge>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>
                      <span className="tnum mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {g.label === "Earlier" ? fmtDate(n.at) : fmtTime(n.at)}
                        {!ok && n.href && (
                          <Hint text="Your current role cannot open the linked screen.">
                            <span className="inline-flex items-center gap-0.5">
                              <Lock className="size-3" aria-hidden /> No access to the linked screen
                            </span>
                          </Hint>
                        )}
                      </span>
                    </button>
                    {!n.read && (
                      <Button size="icon-sm" variant="ghost" aria-label={`Mark "${n.title}" as read`} onClick={() => markOne(n)}>
                        <CheckCheck />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        ))
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Bell className="size-3" aria-hidden /> Delivered in-app, and on email, WhatsApp or Teams where you opted in.
        <Link href="/me/preferences" className="text-primary hover:underline">
          Change channels
        </Link>
      </p>
    </PageBody>
  );
}
