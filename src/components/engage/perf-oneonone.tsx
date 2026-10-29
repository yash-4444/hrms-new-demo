"use client";

/* One-on-one meeting workspace: agenda, notes, action items and AI talking points. */

import * as React from "react";
import { CheckCircle2, Circle, Lock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDay } from "@/lib/format";
import { DEMO_TODAY } from "@/mock/org";
import { talkingPointsFor, type ActionItem, type OneOnOne } from "@/mock/engage";
import { mockAction } from "@/components/app-state";
import { AiSuggestionCard } from "@/components/ai";
import { Gated, Section } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Input, Textarea } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/overlays";
import { nameOf } from "./kit";

export function MeetingWorkspace({
  meeting,
  viewerCode,
  onChange,
}: {
  meeting: OneOnOne;
  viewerCode: string;
  onChange: (m: OneOnOne) => void;
}) {
  const isManager = meeting.managerCode === viewerCode;
  const other = isManager ? meeting.reporteeCode : meeting.managerCode;
  const [agendaText, setAgendaText] = React.useState("");
  const [shared, setShared] = React.useState(meeting.sharedNotes);
  const [priv, setPriv] = React.useState(meeting.privateNotes);
  const [action, setAction] = React.useState({ text: "", ownerCode: meeting.reporteeCode, dueOn: "2026-09-30" });
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const points = isManager ? talkingPointsFor(meeting.reporteeCode).filter((p) => !dismissed.includes(p.point)) : [];

  const addAgenda = (text: string, by = viewerCode) => {
    onChange({ ...meeting, agenda: [...meeting.agenda, { id: `AG-${meeting.agenda.length + 1}-${text.length}`, text, addedByCode: by, discussed: false }] });
  };
  const toggleAction = (a: ActionItem) =>
    onChange({ ...meeting, actions: meeting.actions.map((x) => (x.id === a.id ? { ...x, done: !x.done } : x)) });

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <div className="flex flex-col gap-3 xl:col-span-2">
        <Section title={`1:1 with ${nameOf(other)}`} description={`${fmtDay(meeting.date)} · ${meeting.time} · ${meeting.durationMins} min`}>
          <h3 className="mb-1.5 text-xs font-semibold">Agenda</h3>
          {meeting.agenda.length === 0 ? (
            <p className="text-xs text-muted-foreground">No agenda yet — either of you can add an item.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {meeting.agenda.map((a) => (
                <li key={a.id} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50">
                  <button
                    type="button"
                    aria-label={a.discussed ? `Mark "${a.text}" as not discussed` : `Mark "${a.text}" as discussed`}
                    aria-pressed={a.discussed}
                    className="mt-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => onChange({ ...meeting, agenda: meeting.agenda.map((x) => (x.id === a.id ? { ...x, discussed: !x.discussed } : x)) })}
                  >
                    {a.discussed ? <CheckCircle2 className="size-4 text-success-fg" /> : <Circle className="size-4" />}
                  </button>
                  <span className={cn("flex-1 text-xs", a.discussed && "text-muted-foreground line-through")}>{a.text}</span>
                  <span className="text-[11px] text-muted-foreground">{nameOf(a.addedByCode).split(" ")[0]}</span>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (agendaText.trim().length < 3) return;
              addAgenda(agendaText.trim());
              setAgendaText("");
            }}
          >
            <Input value={agendaText} onChange={(e) => setAgendaText(e.target.value)} placeholder="Add an agenda item…" aria-label="New agenda item" className="h-7 text-xs" />
            <Gated menuKey="growth.one_on_ones" action="C">
              <Button size="sm" type="submit" variant="outline" disabled={agendaText.trim().length < 3}>
                <Plus /> Add
              </Button>
            </Gated>
          </form>
        </Section>

        <Section title="Notes">
          <div className={cn("grid grid-cols-1 gap-3", isManager && "md:grid-cols-2")}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ooo-shared" className="text-xs font-medium">
                Shared notes <span className="font-normal text-muted-foreground">— both of you can see these</span>
              </label>
              <Textarea id="ooo-shared" rows={5} value={shared} onChange={(e) => setShared(e.target.value)} placeholder="What you agreed, in a sentence or two." />
            </div>
            {isManager && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ooo-private" className="flex items-center gap-1 text-xs font-medium">
                  <Lock className="size-3" aria-hidden /> Private notes <span className="font-normal text-muted-foreground">— only you</span>
                </label>
                <Textarea id="ooo-private" rows={5} value={priv} onChange={(e) => setPriv(e.target.value)} placeholder="Observations for your own follow-up." />
              </div>
            )}
          </div>
          <Gated menuKey="growth.one_on_ones" action="C">
            <Button
              size="sm"
              className="mt-2"
              disabled={shared === meeting.sharedNotes && priv === meeting.privateNotes}
              onClick={() => {
                onChange({ ...meeting, sharedNotes: shared, privateNotes: priv });
                mockAction("Notes saved", { description: isManager ? "Shared notes are visible to " + nameOf(other) + "; private notes stay with you." : "Your manager can see the shared notes." });
              }}
            >
              Save notes
            </Button>
          </Gated>
        </Section>

        <Section title="Action items" description="Owners get a reminder the day before the due date.">
          {meeting.actions.length === 0 ? (
            <EmptyState title="No action items yet" description="Capture who does what by when before you close the meeting." className="py-6" />
          ) : (
            <ul className="flex flex-col gap-1">
              {meeting.actions.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                  <button type="button" aria-pressed={a.done} aria-label={a.done ? `Reopen "${a.text}"` : `Complete "${a.text}"`} onClick={() => toggleAction(a)}>
                    {a.done ? <CheckCircle2 className="size-4 text-success-fg" /> : <Circle className="size-4 text-muted-foreground" />}
                  </button>
                  <span className={cn("flex-1 text-xs", a.done && "text-muted-foreground line-through")}>{a.text}</span>
                  <Badge variant="outline">{nameOf(a.ownerCode).split(" ")[0]}</Badge>
                  <span className={cn("tnum text-[11px]", !a.done && a.dueOn < DEMO_TODAY ? "text-destructive-fg" : "text-muted-foreground")}>{fmtDate(a.dueOn)}</span>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-2 flex flex-wrap gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (action.text.trim().length < 3) return;
              onChange({ ...meeting, actions: [...meeting.actions, { id: `AI-N${meeting.actions.length + 1}`, text: action.text.trim(), ownerCode: action.ownerCode, dueOn: action.dueOn, done: false }] });
              mockAction("Action item added", { description: `${nameOf(action.ownerCode)} · due ${fmtDate(action.dueOn)}` });
              setAction((s) => ({ ...s, text: "" }));
            }}
          >
            <Input value={action.text} onChange={(e) => setAction((s) => ({ ...s, text: e.target.value }))} placeholder="New action item…" aria-label="Action item" className="h-7 min-w-[200px] flex-1 text-xs" />
            <Select value={action.ownerCode} onValueChange={(v) => setAction((s) => ({ ...s, ownerCode: v }))}>
              <SelectTrigger size="sm" className="w-[150px]" aria-label="Owner">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[meeting.reporteeCode, meeting.managerCode].map((c) => (
                  <SelectItem key={c} value={c}>
                    {nameOf(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={action.dueOn} min={DEMO_TODAY} onChange={(e) => setAction((s) => ({ ...s, dueOn: e.target.value }))} aria-label="Due date" className="h-7 w-[140px] text-xs" />
            <Gated menuKey="growth.one_on_ones" action="C">
              <Button size="sm" type="submit" variant="outline" disabled={action.text.trim().length < 3}>
                <Plus /> Add
              </Button>
            </Gated>
          </form>
        </Section>
      </div>

      <div className="flex flex-col gap-2">
        {isManager ? (
          <>
            <p className="text-xs font-semibold">Suggested talking points</p>
            {points.length === 0 ? (
              <p className="text-xs text-muted-foreground">All suggestions handled.</p>
            ) : (
              points.map((p, i) => (
                <AiSuggestionCard
                  key={p.point}
                  title={`Talking point ${i + 1}`}
                  body={
                    <>
                      <p>{p.point}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">Signal: {p.why}</p>
                    </>
                  }
                  confidence={82 - i * 6}
                  acceptLabel="Add to agenda"
                  onAccept={() => {
                    addAgenda(p.point);
                    setDismissed((d) => [...d, p.point]);
                    mockAction("Added to the agenda", { description: `${nameOf(meeting.reporteeCode)} can see it before the meeting.` });
                  }}
                  onDismiss={() => setDismissed((d) => [...d, p.point])}
                />
              ))
            )}
            <p className="text-[11px] text-muted-foreground">Built from goal progress, feedback this cycle, and leave and attendance in the last 30 days. Never shared with the reportee.</p>
          </>
        ) : (
          <Section title="Before the meeting">
            <p className="text-xs text-muted-foreground">Add what you want to talk about to the agenda — your manager sees it as soon as you add it.</p>
          </Section>
        )}
      </div>
    </div>
  );
}
