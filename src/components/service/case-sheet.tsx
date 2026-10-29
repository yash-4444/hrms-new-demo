"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Gavel, Lock, NotebookPen, Paperclip, ScrollText } from "lucide-react";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { CaseAccess, CaseEvidence, HrCase } from "@/mock/service";
import { DataTable, MutedCell } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { StatusBadge } from "@/components/ui/status-badge";
import { Gated } from "@/components/shell/page";
import { FactGrid, ReasonDialog, Timeline } from "./kit";

const evidenceCols: ColumnDef<CaseEvidence, unknown>[] = [
  { accessorKey: "name", header: "File", cell: ({ row }) => <span className="flex items-center gap-1.5"><Paperclip className="size-3.5 text-muted-foreground" aria-hidden /><span className="font-medium">{row.original.name}</span></span> },
  { accessorKey: "kind", header: "Type", cell: ({ row }) => <Badge variant="muted">{row.original.kind}</Badge> },
  { accessorKey: "addedBy", header: "Added by" },
  { accessorKey: "date", header: "Date", cell: ({ row }) => <span className="tnum">{fmtDate(row.original.date)}</span> },
  { accessorKey: "size", header: "Size", cell: ({ row }) => <MutedCell>{row.original.size}</MutedCell> },
];

const accessCols: ColumnDef<CaseAccess, unknown>[] = [
  { accessorKey: "at", header: "When", cell: ({ row }) => <span className="tnum">{fmtDateTime(row.original.at)}</span> },
  { accessorKey: "who", header: "Who" },
  { accessorKey: "action", header: "Action", cell: ({ row }) => <span className={row.original.action.startsWith("Access denied") ? "font-medium text-destructive-fg" : ""}>{row.original.action}</span> },
];

/** Case file: timeline, investigation notes, evidence, outcome and the access log. */
export function CaseSheet({
  hrCase,
  canSeeRestricted,
  onOpenChange,
  onAddNote,
  onClose,
}: {
  hrCase: HrCase | null;
  canSeeRestricted: boolean;
  onOpenChange: (v: boolean) => void;
  onAddNote: (c: HrCase, text: string) => void;
  onClose: (c: HrCase, outcome: string) => void;
}) {
  const [note, setNote] = React.useState("");
  const [closing, setClosing] = React.useState(false);
  const locked = !!hrCase?.restricted && !canSeeRestricted;

  return (
    <>
      <Sheet open={!!hrCase} onOpenChange={onOpenChange}>
        <SheetContent width="sm:max-w-3xl">
          {hrCase && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-6"><span className="font-mono text-xs text-muted-foreground">{hrCase.id}</span> {locked ? "Restricted case" : hrCase.title}</SheetTitle>
                <SheetDescription asChild>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="muted">{hrCase.type}</Badge>
                    <StatusBadge status={hrCase.status} />
                    {hrCase.restricted && <Badge variant="outline"><Lock className="size-3" aria-hidden /> IC only</Badge>}
                    <span className="text-xs text-muted-foreground">Owner {hrCase.owner} · opened {fmtDate(hrCase.openedOn)} · due {fmtDate(hrCase.dueOn)}</span>
                  </div>
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-3 overflow-y-auto">
                {locked ? (
                  <Alert tone="warning" icon={Lock} title="You do not have access to this case">
                    POSH referrals are handled by the Internal Committee and the Head of People Operations. Your attempt to open it has been
                    written to the case access log.
                  </Alert>
                ) : (
                  <>
                    <FactGrid
                      items={[
                        ["Raised by", hrCase.complainant],
                        ["Concerning", hrCase.subjectCode ? `${hrCase.subjectName} · ${hrCase.department}` : hrCase.subjectName],
                        ["Outcome", hrCase.outcome ?? "Pending"],
                      ]}
                    />
                    <Tabs defaultValue="timeline">
                      <TabsList>
                        <TabsTrigger value="timeline"><ScrollText /> Timeline</TabsTrigger>
                        <TabsTrigger value="notes"><NotebookPen /> Investigation notes ({hrCase.notes.length})</TabsTrigger>
                        <TabsTrigger value="evidence"><FileText /> Evidence ({hrCase.evidence.length})</TabsTrigger>
                        <TabsTrigger value="access"><Lock /> Access log</TabsTrigger>
                      </TabsList>
                      <TabsContent value="timeline" className="pt-2">
                        <Timeline items={hrCase.timeline.map((e, i) => ({ key: `${e.date}-${i}`, date: fmtDate(e.date), title: e.event, note: e.actor }))} />
                      </TabsContent>
                      <TabsContent value="notes" className="flex flex-col gap-2">
                        {hrCase.notes.map((n, i) => (
                          <div key={`${n.date}-${i}`} className="rounded-md border border-dashed border-warning/50 bg-warning-soft/50 p-2.5 text-xs">
                            <p className="mb-0.5 flex items-center gap-1.5 font-medium"><Lock className="size-3" aria-hidden /> {n.author} <span className="tnum font-normal text-muted-foreground">· {fmtDate(n.date)}</span></p>
                            <p>{n.text}</p>
                          </div>
                        ))}
                        {hrCase.status !== "closed" && (
                          <div className="flex flex-col gap-1.5">
                            <Textarea aria-label="New investigation note" placeholder="Notes are visible to case handlers only." value={note} onChange={(e) => setNote(e.target.value)} />
                            <Gated menuKey="helpdesk.cases" action="E">
                              <Button size="sm" className="self-end" disabled={note.trim().length < 5} onClick={() => { onAddNote(hrCase, note.trim()); setNote(""); }}>
                                <NotebookPen /> Add note
                              </Button>
                            </Gated>
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="evidence">
                        <DataTable columns={evidenceCols} data={hrCase.evidence} getRowId={(e) => e.name} exportName={`${hrCase.id}-evidence`} dense
                          emptyIcon={Paperclip} emptyTitle="No evidence attached" emptyDescription="Statements, emails and documents added to the case appear here." />
                      </TabsContent>
                      <TabsContent value="access">
                        <DataTable columns={accessCols} data={hrCase.access} getRowId={(a) => `${a.at}-${a.who}`} exportName={`${hrCase.id}-access-log`} dense
                          emptyIcon={Lock} emptyTitle="No access recorded" emptyDescription="Every view and change is logged here." />
                      </TabsContent>
                    </Tabs>
                    {hrCase.status !== "closed" && (
                      <div className="flex justify-end">
                        <Gated menuKey="helpdesk.cases" action="A">
                          <Button size="sm" onClick={() => setClosing(true)}><Gavel /> Record outcome and close</Button>
                        </Gated>
                      </div>
                    )}
                  </>
                )}
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ReasonDialog
        open={closing}
        onOpenChange={setClosing}
        title={`Close ${hrCase?.id ?? ""}?`}
        description="The outcome is shared with the parties in writing and the case file is locked."
        confirmLabel="Close case"
        destructive={false}
        commentLabel="Outcome"
        placeholder="Upheld / not upheld, and the action taken."
        onConfirm={(outcome) => hrCase && onClose(hrCase, outcome)}
      />
    </>
  );
}
