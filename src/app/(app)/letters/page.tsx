"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Eye, FilePenLine, FileSignature, LayoutTemplate, MailCheck, MoreHorizontal, Plus, RefreshCw, Send } from "lucide-react";
import { fmtDate, num } from "@/lib/format";
import { employeeByCode, employeeName } from "@/mock/employees";
import { LETTERS, LETTER_LABEL, LETTER_TEMPLATES, renderLetter, type GeneratedLetter, type LetterStatus, type LetterType } from "@/mock/masters";
import { EmployeeLink } from "@/components/org/bits";
import { GenerateLetterDialog } from "@/components/org/generate-letter-dialog";
import { LetterPreview } from "@/components/org/letter-preview";
import { mockAction, useApp } from "@/components/app-state";
import { DataTable, MutedCell } from "@/components/data-table";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import { Gated, PageBody, PageHeader, Section, TableSkeleton, useFakeLoad } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FilterSelect,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/overlays";

const LETTER_STATUS: Record<LetterStatus, { status: string; label: string }> = {
  draft: { status: "draft", label: "Draft" },
  issued: { status: "submitted", label: "Issued" },
  acknowledged: { status: "completed", label: "Acknowledged" },
};

type Row = GeneratedLetter & { employeeName: string; typeLabel: string };

export default function LettersPage() {
  const loading = useFakeLoad();
  const { can } = useApp();
  const canCreate = can("people.letters", "C");
  const [letters, setLetters] = React.useState<GeneratedLetter[]>(LETTERS);
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [genOpen, setGenOpen] = React.useState(false);
  const [viewId, setViewId] = React.useState<string | null>(null);
  const [reissue, setReissue] = React.useState<GeneratedLetter | null>(null);

  const nextRef = `LTR-26-${String(letters.length + 1).padStart(4, "0")}`;
  const viewing = letters.find((l) => l.id === viewId) ?? null;
  const rows: Row[] = letters
    .filter((l) => (type === "all" || l.type === type) && (status === "all" || l.status === status))
    .map((l) => ({ ...l, employeeName: employeeName(l.employeeCode), typeLabel: LETTER_LABEL[l.type] }));

  const download = (l: GeneratedLetter) =>
    mockAction(`${l.id}.pdf downloaded`, { description: `${LETTER_LABEL[l.type]} for ${employeeName(l.employeeCode)} · digitally signed PDF, 2 pages.`, tone: "info" });

  const issue = (l: GeneratedLetter) => {
    setLetters((ls) => ls.map((x) => (x.id === l.id ? { ...x, status: "issued" } : x)));
    mockAction(`${l.id} signed and issued`, { description: `${employeeName(l.employeeCode)} has been emailed a link to view and acknowledge it.` });
  };

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "typeLabel",
      header: "Letter",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.typeLabel}</p>
          <p className="tnum text-[11px] text-muted-foreground">
            {row.original.id} · template v{row.original.version}
          </p>
        </div>
      ),
    },
    { accessorKey: "employeeName", header: "Employee", cell: ({ row }) => <EmployeeLink code={row.original.employeeCode} /> },
    { accessorKey: "effectiveDate", header: "Effective", cell: ({ getValue }) => <span className="tnum text-xs">{fmtDate(getValue() as string)}</span> },
    { accessorKey: "generatedOn", header: "Generated", cell: ({ getValue }) => <span className="tnum text-xs">{fmtDate(getValue() as string)}</span> },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={LETTER_STATUS[row.original.status].status} label={LETTER_STATUS[row.original.status].label} />,
    },
    { accessorKey: "issuedBy", header: "Prepared by", cell: ({ getValue }) => <MutedCell>{getValue() as string}</MutedCell> },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.id}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setViewId(row.original.id)}>
                <Eye aria-hidden />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => download(row.original)}>
                <Download aria-hidden />
                Download PDF
              </DropdownMenuItem>
              {row.original.status === "draft" ? (
                <DropdownMenuItem disabled={!canCreate} onSelect={() => issue(row.original)}>
                  <Send aria-hidden />
                  Sign &amp; issue
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled={!canCreate} onSelect={() => setReissue(row.original)}>
                  <RefreshCw aria-hidden />
                  Re-issue
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const count = (s: LetterStatus) => letters.filter((l) => l.status === s).length;
  const viewEmp = viewing ? employeeByCode(viewing.employeeCode) : undefined;
  const viewTpl = viewing ? LETTER_TEMPLATES.find((t) => t.id === viewing.templateId) : undefined;

  return (
    <PageBody>
      <PageHeader
        title="Letters"
        description="Every letter generated from a template — offer to experience certificate — with its signature status and the employee's acknowledgement."
        actions={
          <>
            {can("people.letter_templates", "V") && (
              <Button size="sm" variant="outline" asChild>
                <Link href="/letters/templates">
                  <LayoutTemplate aria-hidden />
                  Templates
                </Link>
              </Button>
            )}
            <Gated menuKey="people.letters" action="C">
              <Button size="sm" onClick={() => setGenOpen(true)}>
                <Plus aria-hidden />
                Generate letter
              </Button>
            </Gated>
          </>
        }
      />

      <StatRow cols={4}>
        <StatTile label="Letters this year" value={num(letters.length)} icon={FileSignature} onClick={() => setStatus("all")} />
        <StatTile label="Drafts to issue" value={num(count("draft"))} icon={FilePenLine} tone="warning" onClick={() => setStatus("draft")} />
        <StatTile label="Awaiting acknowledgement" value={num(count("issued"))} icon={Send} onClick={() => setStatus("issued")} />
        <StatTile label="Acknowledged" value={num(count("acknowledged"))} icon={MailCheck} tone="good" onClick={() => setStatus("acknowledged")} />
      </StatRow>

      <Section bodyClassName="p-3">
        {loading ? (
          <TableSkeleton />
        ) : (
          <DataTable<Row>
            columns={columns}
            data={rows}
            searchKeys={["employeeName", "employeeCode", "id", "typeLabel"]}
            searchPlaceholder="Search employee, code or letter…"
            getRowId={(r) => r.id}
            onRowClick={(r) => setViewId(r.id)}
            exportName="letters"
            filters={
              <>
                <FilterSelect label="Type" value={type} onValueChange={setType} options={(Object.keys(LETTER_LABEL) as LetterType[]).map((t) => ({ value: t, label: LETTER_LABEL[t] }))} width="w-[210px]" />
                <FilterSelect label="Status" value={status} onValueChange={setStatus} options={(Object.keys(LETTER_STATUS) as LetterStatus[]).map((s) => ({ value: s, label: LETTER_STATUS[s].label }))} width="w-[180px]" />
              </>
            }
            emptyIcon={FileSignature}
            emptyTitle="No letters match"
            emptyDescription="Clear a filter, or generate a letter from a template."
            emptyAction={
              canCreate ? (
                <Button size="sm" onClick={() => setGenOpen(true)}>
                  <Plus aria-hidden />
                  Generate letter
                </Button>
              ) : undefined
            }
          />
        )}
      </Section>

      <Sheet open={!!viewing} onOpenChange={(v) => !v && setViewId(null)}>
        <SheetContent width="sm:max-w-2xl">
          {viewing && viewEmp && viewTpl && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {LETTER_LABEL[viewing.type]} · {viewing.id}
                </SheetTitle>
                <SheetDescription>
                  {LETTER_STATUS[viewing.status].label} · generated {fmtDate(viewing.generatedOn)} from {viewTpl.name} v{viewing.version}
                </SheetDescription>
              </SheetHeader>
              <SheetBody className="bg-subtle">
                <LetterPreview
                  refNo={viewing.id}
                  subject={renderLetter(viewTpl.subject, viewEmp, viewing.effectiveDate)}
                  body={renderLetter(viewTpl.body, viewEmp, viewing.effectiveDate)}
                  employee={viewEmp}
                  signed={viewing.status !== "draft"}
                />
              </SheetBody>
              <SheetFooter>
                <Button variant="outline" onClick={() => download(viewing)}>
                  <Download aria-hidden />
                  Download PDF
                </Button>
                {viewing.status === "draft" && (
                  <Gated menuKey="people.letters" action="C">
                    <Button onClick={() => issue(viewing)}>
                      <Send aria-hidden />
                      Sign &amp; issue
                    </Button>
                  </Gated>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!reissue}
        onOpenChange={(v) => !v && setReissue(null)}
        title={`Re-issue ${reissue?.id ?? ""}?`}
        description="The current copy is marked superseded and a new signed version is sent to the employee, who must acknowledge it again. The superseded copy stays in the audit trail."
        confirmLabel="Re-issue"
        destructive
        onConfirm={() => {
          if (!reissue) return;
          const tpl = LETTER_TEMPLATES.find((t) => t.id === reissue.templateId);
          setLetters((ls) => ls.map((x) => (x.id === reissue.id ? { ...x, status: "issued", version: tpl?.version ?? x.version } : x)));
          mockAction(`${reissue.id} re-issued`, { description: `Signed with template v${tpl?.version ?? reissue.version} and sent to ${employeeName(reissue.employeeCode)}.` });
        }}
      />

      <GenerateLetterDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        nextRef={nextRef}
        onGenerate={(l, issued) => {
          const id = nextRef;
          setLetters((ls) => [{ ...l, id }, ...ls]);
          mockAction(issued ? `${id} signed and issued` : `${id} saved as draft`, {
            description: `${LETTER_LABEL[l.type]} for ${employeeName(l.employeeCode)}.`,
          });
        }}
      />
    </PageBody>
  );
}
