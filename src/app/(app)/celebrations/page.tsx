"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { Cake, PartyPopper, Settings2, Sparkles, UserPlus } from "lucide-react";
import { fmtDate, fmtDay, fmtIso, num } from "@/lib/format";
import { EMPLOYEES, type Employee } from "@/mock/employees";
import { DEMO_TODAY, deptName } from "@/mock/org";
import { mockAction } from "@/components/app-state";
import { DataTable } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { PersonCell } from "@/components/people/person-cell";
import { CardsSkeleton, Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, Badge, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { WishesDialog, type Occasion, type WishTarget } from "@/components/engage/wishes-dialog";

interface Row {
  code: string;
  name: string;
  department: string;
  date: string;
  inDays: number;
  years: number;
  occasion: Occasion;
}

const TODAY = parseISO(DEMO_TODAY);
const ACTIVE = EMPLOYEES.filter((e) => e.status !== "exited");

/** Next occurrence (this year or next) of a month-day, relative to DEMO_TODAY. */
function nextOccurrence(iso: string) {
  const md = iso.slice(5);
  let d = parseISO(`2026-${md === "02-29" ? "02-28" : md}`);
  if (differenceInCalendarDays(d, TODAY) < 0) d = parseISO(`2027-${md === "02-29" ? "02-28" : md}`);
  return d;
}

const row = (e: Employee, d: Date, occasion: Occasion, years: number): Row => ({
  code: e.code,
  name: e.name,
  department: deptName(e.departmentId),
  date: fmtIso(d),
  inDays: differenceInCalendarDays(d, TODAY),
  years,
  occasion,
});

const BIRTHDAYS = ACTIVE.map((e) => row(e, nextOccurrence(e.dob), "birthday", 0)).filter((r) => r.inDays <= 30).sort((a, b) => a.inDays - b.inDays);
const ANNIVERSARIES = ACTIVE.map((e) => {
  const d = nextOccurrence(e.joiningDate);
  return row(e, d, "anniversary", d.getFullYear() - Number(e.joiningDate.slice(0, 4)));
})
  .filter((r) => r.inDays <= 30 && r.years >= 1)
  .sort((a, b) => a.inDays - b.inDays);
const JOINERS = ACTIVE.filter((e) => {
  const d = differenceInCalendarDays(TODAY, parseISO(e.joiningDate));
  return d >= 0 && d <= 45;
})
  .map((e) => ({ ...row(e, parseISO(e.joiningDate), "joiner", 0), inDays: -differenceInCalendarDays(TODAY, parseISO(e.joiningDate)) }))
  .sort((a, b) => b.date.localeCompare(a.date));

const whenLabel = (r: Row) =>
  r.occasion === "joiner" ? (r.inDays === 0 ? "Joined today" : `Joined ${-r.inDays} days ago`) : r.inDays === 0 ? "Today" : r.inDays === 1 ? "Tomorrow" : `In ${r.inDays} days`;

const AUTO_DEFAULTS = { birthdayFeed: true, birthdayEmail: true, anniversaryFeed: true, milestoneOnly: false, welcomePost: true, notifyManager: true };
type AutoKey = keyof typeof AUTO_DEFAULTS;
const AUTO_LABELS: Record<AutoKey, [string, string]> = {
  birthdayFeed: ["Birthday post on the feed", "Posted at 9:00 am local time — only for people who opted in to share their birthday."],
  birthdayEmail: ["Birthday e-card by email", "Signed by the CEO and the person's manager."],
  anniversaryFeed: ["Work anniversary post", "Mentions years of service and the team."],
  milestoneOnly: ["Only milestone anniversaries", "Limit anniversary posts to 1, 3, 5, 10 and 15 years."],
  welcomePost: ["Welcome post for new joiners", "Published on day 3, once the joiner has a profile photo."],
  notifyManager: ["Remind managers the day before", "In-app reminder to wish their reportee personally."],
};

export default function CelebrationsPage() {
  const loading = useFakeLoad();
  const [target, setTarget] = React.useState<WishTarget | null>(null);
  const [sent, setSent] = React.useState<string[]>([]);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [auto, setAuto] = React.useState(AUTO_DEFAULTS);
  const [draftAuto, setDraftAuto] = React.useState(AUTO_DEFAULTS);

  const today = [...BIRTHDAYS, ...ANNIVERSARIES].filter((r) => r.inDays === 0);
  const key = (r: Row) => `${r.occasion}-${r.code}`;

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "name", header: "Person", cell: ({ row: r }) => <PersonCell name={r.original.name} code={r.original.code} subtitle={r.original.department} /> },
    { accessorKey: "date", header: "Date", cell: ({ row: r }) => <span className="text-xs">{fmtDay(r.original.date)}</span> },
    { accessorKey: "inDays", header: "When", cell: ({ row: r }) => <span className="text-xs">{whenLabel(r.original)}</span> },
    {
      accessorKey: "years",
      header: "Milestone",
      cell: ({ row: r }) =>
        r.original.occasion === "anniversary" ? (
          <Badge variant={[1, 3, 5, 10, 15].includes(r.original.years) ? "soft" : "outline"}>
            {r.original.years} year{r.original.years === 1 ? "" : "s"}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: "__a",
      header: "",
      enableHiding: false,
      cell: ({ row: r }) => (
        <div className="flex justify-end">
          <Button size="sm" variant={sent.includes(key(r.original)) ? "outline" : "default"} disabled={sent.includes(key(r.original))} onClick={() => setTarget({ code: r.original.code, occasion: r.original.occasion, years: r.original.years })}>
            {sent.includes(key(r.original)) ? "Wished" : "Send wishes"}
          </Button>
        </div>
      ),
    },
  ];

  const table = (data: Row[], name: string, empty: string) => (
    <DataTable columns={columns} data={data} searchKeys={["name", "department"]} searchPlaceholder="Search people…" getRowId={key} exportName={name} emptyIcon={PartyPopper} emptyTitle={empty} emptyDescription="Check back tomorrow." />
  );

  return (
    <PageBody>
      <PageHeader
        title="Celebrations"
        description={`Birthdays, work anniversaries and new joiners around ${fmtDate(DEMO_TODAY)}. Birthdays show day and month only — never the year.`}
        actions={
          <Gated menuKey="engage.celebrations" action="E">
            <Button size="sm" variant="outline" onClick={() => { setDraftAuto(auto); setConfigOpen(true); }}>
              <Settings2 /> Configure auto-wishes
            </Button>
          </Gated>
        }
      />

      {loading ? (
        <>
          <CardsSkeleton count={3} />
          <TableSkeleton rows={6} />
        </>
      ) : (
        <>
          <StatRow cols={3}>
            <StatTile label="Birthdays (next 30 days)" value={num(BIRTHDAYS.length)} icon={Cake} hint={`${BIRTHDAYS.filter((r) => r.inDays === 0).length} today`} />
            <StatTile label="Work anniversaries (next 30 days)" value={num(ANNIVERSARIES.length)} icon={PartyPopper} hint={`${ANNIVERSARIES.filter((r) => [5, 10, 15].includes(r.years)).length} milestone (5/10/15 yrs)`} />
            <StatTile label="New joiners (last 45 days)" value={num(JOINERS.length)} icon={UserPlus} hint="Say hello on the feed" />
          </StatRow>

          {today.length > 0 && (
            <Section title="Today" description={fmtDay(DEMO_TODAY)}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {today.map((r) => (
                  <Card key={key(r)} className="flex items-center gap-2.5 p-3">
                    <Avatar name={r.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.name}</p>
                      <p className="text-[11px] text-muted-foreground">{r.occasion === "birthday" ? "🎂 Birthday" : `🎉 ${r.years} year${r.years === 1 ? "" : "s"} at Stellar`}</p>
                    </div>
                    <Button size="sm" disabled={sent.includes(key(r))} onClick={() => setTarget({ code: r.code, occasion: r.occasion, years: r.years })}>
                      <Sparkles /> {sent.includes(key(r)) ? "Wished" : "Wish"}
                    </Button>
                  </Card>
                ))}
              </div>
            </Section>
          )}

          <Tabs defaultValue="birthdays">
            <TabsList>
              <TabsTrigger value="birthdays"><Cake /> Birthdays</TabsTrigger>
              <TabsTrigger value="anniversaries"><PartyPopper /> Anniversaries</TabsTrigger>
              <TabsTrigger value="joiners"><UserPlus /> New joiners</TabsTrigger>
            </TabsList>
            <TabsContent value="birthdays">{table(BIRTHDAYS, "birthdays", "No birthdays in the next 30 days")}</TabsContent>
            <TabsContent value="anniversaries">{table(ANNIVERSARIES, "work-anniversaries", "No anniversaries in the next 30 days")}</TabsContent>
            <TabsContent value="joiners">{table(JOINERS, "new-joiners", "No one joined in the last 45 days")}</TabsContent>
          </Tabs>
        </>
      )}

      <WishesDialog
        target={target}
        onOpenChange={(v) => !v && setTarget(null)}
        onSend={(t, v) => {
          const r = [...BIRTHDAYS, ...ANNIVERSARIES, ...JOINERS].find((x) => x.code === t.code && x.occasion === t.occasion);
          if (r) setSent((s) => [...s, key(r)]);
          mockAction("Wishes sent", { description: v.onFeed ? "Delivered in-app and posted on the company feed." : "Delivered privately in-app." });
        }}
      />

      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Auto-wishes</SheetTitle>
            <SheetDescription>What the platform sends on its own. Next run: {fmtDate(addDays(TODAY, 1))}, 9:00 am.</SheetDescription>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-3">
            {(Object.keys(AUTO_LABELS) as AutoKey[]).map((k) => (
              <label key={k} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <span>
                  <span className="block text-sm font-medium">{AUTO_LABELS[k][0]}</span>
                  <span className="block text-xs text-muted-foreground">{AUTO_LABELS[k][1]}</span>
                </span>
                <Switch checked={draftAuto[k]} onCheckedChange={(v) => setDraftAuto((a) => ({ ...a, [k]: v }))} aria-label={AUTO_LABELS[k][0]} />
              </label>
            ))}
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setAuto(draftAuto);
                setConfigOpen(false);
                mockAction("Auto-wishes updated", { description: `${Object.values(draftAuto).filter(Boolean).length} of ${Object.keys(draftAuto).length} automations on.` });
              }}
            >
              Save settings
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </PageBody>
  );
}
