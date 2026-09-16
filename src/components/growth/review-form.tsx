"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Info, RotateCcw, Save, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { mockAction } from "@/components/app-state";
import { Gated } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Avatar, Badge, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlays";
import {
  COMPETENCIES,
  RATING_SCALE,
  ratingAnchor,
  type CompetencyReview,
  type ReviewForm,
} from "@/mock/growth";
import { employeeByCode } from "@/mock/employees";

export type ReviewColumn = "self" | "manager" | "peer";

const COLUMN_META: Record<ReviewColumn, { label: string; blurb: string }> = {
  self: { label: "Self", blurb: "Rated by the employee" },
  manager: { label: "Manager", blurb: "Rated by the reporting manager" },
  peer: { label: "Peer", blurb: "Mean of three nominated peers" },
};

/* --------------------------------------------------------- rating widgets */

function RatingPicker({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {RATING_SCALE.map((a) => {
          const active = a.value === value;
          return (
            <button
              key={a.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={a.label}
              title={`${a.label} — ${a.description}`}
              onClick={() => onChange(a.value)}
              className={cn(
                "tnum size-6 rounded-md border text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {a.value}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground">{ratingAnchor(value).label}</span>
    </div>
  );
}

function RatingValue({ value }: { value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-0.5" aria-hidden>
        {RATING_SCALE.map((a) => (
          <span
            key={a.value}
            className={cn(
              "h-1.5 w-4 rounded-full",
              a.value <= value ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        <span className="tnum font-semibold text-foreground">{value}</span> — {ratingAnchor(value).short}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ scale legend */

export function RatingScaleLegend() {
  return (
    <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
      {RATING_SCALE.map((a) => (
        <li key={a.value} className="rounded-md border border-border bg-subtle p-2">
          <p className="text-xs font-semibold text-foreground">{a.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
        </li>
      ))}
    </ol>
  );
}

/* ================================================================== form */

export function ReviewFormTable({
  form,
  editable,
  cycleName,
  onSubmitted,
  onDirtyChange,
}: {
  form: ReviewForm;
  /** Which column this persona is allowed to fill in. null = read-only. */
  editable: ReviewColumn | null;
  cycleName: string;
  onSubmitted: (next: ReviewForm) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = React.useState<CompetencyReview[]>(form.competencies);
  const [summary, setSummary] = React.useState(
    editable === "self" ? form.selfSummary : form.managerSummary,
  );
  const [openComment, setOpenComment] = React.useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);

  React.useEffect(() => {
    setDraft(form.competencies);
    setSummary(editable === "self" ? form.selfSummary : form.managerSummary);
    setOpenComment(null);
  }, [form, editable]);

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(form.competencies) ||
    summary !== (editable === "self" ? form.selfSummary : form.managerSummary);

  React.useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  /* Unsaved-changes guard — a browser navigation away loses the draft. */
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const employee = employeeByCode(form.employeeCode);
  const manager = employeeByCode(form.managerCode);

  const setRating = (competencyId: string, column: ReviewColumn, value: number) =>
    setDraft((d) => d.map((c) => (c.competencyId === competencyId ? { ...c, [column]: value } : c)));

  const setComment = (competencyId: string, column: ReviewColumn, text: string) =>
    setDraft((d) =>
      d.map((c) =>
        c.competencyId === competencyId
          ? {
              ...c,
              [column === "self" ? "selfComment" : column === "manager" ? "managerComment" : "peerComment"]:
                text,
            }
          : c,
      ),
    );

  const weightTotal = COMPETENCIES.reduce((a, c) => a + c.weight, 0);
  const overall = (column: ReviewColumn) =>
    Math.round(
      (draft.reduce((a, cr) => {
        const c = COMPETENCIES.find((x) => x.id === cr.competencyId)!;
        return a + cr[column] * c.weight;
      }, 0) /
        weightTotal) *
        100,
    ) / 100;

  const divergent = draft.filter((c) => Math.abs(c.self - c.manager) >= 2);

  const discard = () => {
    setDraft(form.competencies);
    setSummary(editable === "self" ? form.selfSummary : form.managerSummary);
    setConfirmDiscard(false);
    mockAction("Draft discarded", {
      description: "The form is back to the last saved version.",
      tone: "warning",
    });
  };

  const save = () => {
    const next: ReviewForm = {
      ...form,
      competencies: draft,
      selfSummary: editable === "self" ? summary : form.selfSummary,
      managerSummary: editable === "manager" ? summary : form.managerSummary,
      proposedRating: Math.round(overall("manager")),
    };
    onSubmitted(next);
    mockAction("Review saved as draft", {
      description: `${employee?.name ?? form.employeeCode} · ${cycleName}. Nothing is shared with the employee until you submit.`,
    });
  };

  const submit = () => {
    const next: ReviewForm = {
      ...form,
      competencies: draft,
      selfSummary: editable === "self" ? summary : form.selfSummary,
      managerSummary: editable === "manager" ? summary : form.managerSummary,
      proposedRating: Math.round(overall("manager")),
      status: editable === "self" ? "manager_pending" : "completed",
      submittedSelfOn: editable === "self" ? new Date().toISOString().slice(0, 10) : form.submittedSelfOn,
      submittedManagerOn:
        editable === "manager" ? new Date().toISOString().slice(0, 10) : form.submittedManagerOn,
    };
    onSubmitted(next);
    mockAction(editable === "self" ? "Self review submitted" : "Manager review submitted", {
      description:
        editable === "self"
          ? `Sent to ${manager?.name ?? form.managerCode} for the manager stage.`
          : `${employee?.name ?? form.employeeCode} moves to calibration with a proposed rating of ${Math.round(
              overall("manager"),
            )}.`,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ------------------------------------------------ header / context */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-subtle px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar name={employee?.name ?? form.employeeCode} size={34} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              <Link
                href={`/employees/${form.employeeCode}`}
                className="hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                {employee?.name ?? form.employeeCode}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              {employee?.designation} · {form.employeeCode} · Manager {manager?.name ?? form.managerCode}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={form.status} />
          <Badge variant="muted">
            Self submitted {form.submittedSelfOn ? fmtDate(form.submittedSelfOn) : "— not yet"}
          </Badge>
          <Badge variant="muted">Peers: {form.peerCodes.length}</Badge>
          {editable ? (
            <Badge variant="soft">Editing the {COLUMN_META[editable].label.toLowerCase()} column</Badge>
          ) : (
            <Badge variant="muted">Read-only for your role</Badge>
          )}
        </div>
      </div>

      {divergent.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs text-warning-fg"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">
              {divergent.length} competenc{divergent.length === 1 ? "y has" : "ies have"} a self / manager
              gap of 2 points or more
            </p>
            <p className="mt-0.5 opacity-90">
              {divergent
                .map((d) => {
                  const c = COMPETENCIES.find((x) => x.id === d.competencyId)!;
                  return `${c.name} (self ${d.self} vs manager ${d.manager})`;
                })
                .join(" · ")}
              . Talk these through before the form is submitted — a surprise at release is a retention risk.
            </p>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- the table */}
      <div className="scrollbar-thin overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[920px] text-xs">
          <caption className="sr-only">
            Competency ratings for {employee?.name}, self, manager and peer side by side
          </caption>
          <thead className="bg-subtle">
            <tr className="border-b border-border">
              <th scope="col" className="w-[280px] px-3 py-2 text-left font-medium text-muted-foreground">
                Competency
              </th>
              {(["self", "manager", "peer"] as ReviewColumn[]).map((col) => (
                <th
                  key={col}
                  scope="col"
                  className={cn(
                    "px-3 py-2 text-left font-medium",
                    editable === col ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground",
                  )}
                >
                  {COLUMN_META[col].label}
                  <span className="ml-1.5 font-normal opacity-70">{COLUMN_META[col].blurb}</span>
                </th>
              ))}
              <th scope="col" className="w-[120px] px-3 py-2 text-left font-medium text-muted-foreground">
                Divergence
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPETENCIES.map((c) => {
              const cr = draft.find((x) => x.competencyId === c.id)!;
              const gap = cr.self - cr.manager;
              const diverges = Math.abs(gap) >= 2;
              const commentsOpen = openComment === c.id;
              return (
                <React.Fragment key={c.id}>
                  <tr
                    className={cn(
                      "border-b border-border align-top",
                      diverges && "bg-warning-soft/40",
                    )}
                  >
                    <th scope="row" className="px-3 py-2.5 text-left font-normal">
                      <p className="text-xs font-semibold text-foreground">{c.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                      <p className="tnum mt-1 text-xs text-muted-foreground">Weight {c.weight}%</p>
                    </th>

                    {(["self", "manager", "peer"] as ReviewColumn[]).map((col) => (
                      <td key={col} className={cn("px-3 py-2.5", editable === col && "bg-primary-soft/30")}>
                        {editable === col ? (
                          <RatingPicker
                            value={cr[col]}
                            onChange={(v) => setRating(c.id, col, v)}
                            label={`${c.name} — ${COLUMN_META[col].label} rating`}
                          />
                        ) : (
                          <RatingValue value={cr[col]} />
                        )}
                        <p
                          className={cn(
                            "mt-1.5 text-xs text-muted-foreground",
                            !commentsOpen && "line-clamp-2",
                          )}
                        >
                          {col === "self" ? cr.selfComment : col === "manager" ? cr.managerComment : cr.peerComment}
                        </p>
                        {editable === col && commentsOpen && (
                          <Textarea
                            className="mt-1.5 text-xs"
                            rows={3}
                            aria-label={`${c.name} — ${COLUMN_META[col].label} comment`}
                            value={
                              col === "self" ? cr.selfComment : col === "manager" ? cr.managerComment : cr.peerComment
                            }
                            onChange={(e) => setComment(c.id, col, e.target.value)}
                          />
                        )}
                      </td>
                    ))}

                    <td className="px-3 py-2.5">
                      {diverges ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-warning/30 bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning-fg">
                          <AlertTriangle className="size-3" aria-hidden />
                          {gap > 0 ? `Self +${gap}` : `Manager +${Math.abs(gap)}`}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {gap === 0 ? "Aligned" : `${Math.abs(gap)} point apart`}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenComment(commentsOpen ? null : c.id)}
                        aria-expanded={commentsOpen}
                        className="mt-1.5 block rounded text-xs font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {commentsOpen ? "Collapse comments" : "Full comments"}
                      </button>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="bg-subtle">
            <tr>
              <th scope="row" className="px-3 py-2.5 text-left text-xs font-semibold">
                Weighted overall
              </th>
              {(["self", "manager", "peer"] as ReviewColumn[]).map((col) => (
                <td key={col} className="px-3 py-2.5">
                  <span className="tnum text-sm font-semibold text-foreground">{overall(col).toFixed(2)}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {ratingAnchor(overall(col)).short}
                  </span>
                </td>
              ))}
              <td className="px-3 py-2.5">
                <span className="tnum text-xs text-muted-foreground">
                  Self − manager {(overall("self") - overall("manager")).toFixed(2)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ------------------------------------------------------- summaries */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-semibold text-foreground">Self summary</p>
          {editable === "self" ? (
            <Textarea
              className="mt-1.5"
              rows={5}
              aria-label="Self summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">{form.selfSummary}</p>
          )}
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-semibold text-foreground">Manager summary</p>
          {editable === "manager" ? (
            <Textarea
              className="mt-1.5"
              rows={5}
              aria-label="Manager summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">{form.managerSummary}</p>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- actions */}
      <div
        className={cn(
          "sticky bottom-2 z-10 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2",
          dirty ? "border-warning/40 bg-warning-soft" : "border-border bg-card",
        )}
      >
        <Info className={cn("size-4 shrink-0", dirty ? "text-warning-fg" : "text-muted-foreground")} aria-hidden />
        <p className={cn("text-xs", dirty ? "font-medium text-warning-fg" : "text-muted-foreground")}>
          {dirty
            ? "You have unsaved changes on this form. Leaving the page or switching employee will prompt you."
            : `Proposed rating into calibration: ${Math.round(overall("manager"))} — ${
                ratingAnchor(overall("manager")).short
              }`}
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" disabled={!dirty} onClick={() => setConfirmDiscard(true)}>
            <RotateCcw /> Discard
          </Button>
          <Gated menuKey="growth.reviews" action="E">
            <Button variant="outline" size="sm" disabled={!editable || !dirty} onClick={save}>
              <Save /> Save draft
            </Button>
          </Gated>
          <Gated menuKey="growth.reviews" action="E">
            <Button size="sm" disabled={!editable} onClick={submit}>
              <Send /> Submit {editable === "self" ? "self review" : "manager review"}
            </Button>
          </Gated>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        destructive
        title="Discard unsaved changes?"
        description="Every rating and comment you have changed since the last save will be reset. This cannot be undone."
        confirmLabel="Discard changes"
        onConfirm={discard}
      />
    </div>
  );
}
