"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  FileImage,
  FileText,
  Plus,
  Receipt,
  Trash2,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateShort, inr, inrCompact, num } from "@/lib/format";
import {
  EXPENSE_BY_CATEGORY,
  EXPENSE_CATEGORIES,
  EXPENSE_CLAIMS,
  EXPENSE_POLICY,
  policyFor,
  type ExpenseCategory,
  type ExpenseClaim,
  type ExpenseLine,
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
  Hint,
  Input,
  Label,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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
import { StatusBadge } from "@/components/ui/status-badge";
import { BarCompareChart, DonutChart } from "@/components/charts";
import { StatRow, StatTile } from "@/components/charts/stat-tile";
import {
  Gated,
  PageBody,
  PageHeader,
  Section,
  useFakeLoad,
} from "@/components/shell/page";

interface DraftLine {
  key: string;
  category: ExpenseCategory;
  date: string;
  description: string;
  amount: number;
  receipt: string;
}

let lineSeq = 0;
const newLine = (): DraftLine => ({
  key: `L${++lineSeq}`,
  category: "Meals",
  date: "2026-09-16",
  description: "",
  amount: 0,
  receipt: "",
});

export default function ExpensesPage() {
  const loading = useFakeLoad();
  const { persona } = useApp();

  const [claims, setClaims] = React.useState<ExpenseClaim[]>(EXPENSE_CLAIMS);
  const [status, setStatus] = React.useState("all");
  const [onlyViolations, setOnlyViolations] = React.useState(false);
  const [detail, setDetail] = React.useState<ExpenseClaim | null>(null);
  const [composeOpen, setComposeOpen] = React.useState(false);

  /* claim form */
  const [purpose, setPurpose] = React.useState("");
  const [lines, setLines] = React.useState<DraftLine[]>([newLine()]);
  const [purposeError, setPurposeError] = React.useState<string | null>(null);

  const mine = React.useMemo(
    () => claims.filter((c) => c.employeeCode === persona.employeeId),
    [claims, persona.employeeId],
  );
  const toApprove = React.useMemo(
    () => claims.filter((c) => c.status === "submitted"),
    [claims],
  );

  const filterClaims = (list: ExpenseClaim[]) =>
    list.filter(
      (c) => (status === "all" || c.status === status) && (!onlyViolations || c.hasViolation),
    );

  const total = lines.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const violations = React.useMemo(
    () =>
      lines
        .map((l) => {
          const p = policyFor(l.category);
          const excess = p ? Math.max(0, (Number(l.amount) || 0) - p.limit) : 0;
          return { key: l.key, excess, limit: p?.limit ?? 0, basis: p?.basis ?? "", category: l.category };
        })
        .filter((v) => v.excess > 0),
    [lines],
  );

  const resetForm = () => {
    setPurpose("");
    setLines([newLine()]);
    setPurposeError(null);
  };

  const submitClaim = () => {
    if (purpose.trim().length < 6) {
      setPurposeError("Give the claim a purpose of at least 6 characters — approvers read this first.");
      return;
    }
    const built: ExpenseLine[] = lines.map((l, i) => {
      const p = policyFor(l.category);
      const excess = p ? Math.max(0, l.amount - p.limit) : 0;
      return {
        id: `${l.key}-${i}`,
        category: l.category,
        date: l.date,
        description: l.description || `${l.category} expense`,
        amount: l.amount,
        receipt: l.receipt || `receipt-${l.key.toLowerCase()}.jpg`,
        receiptKind: "photo",
        limit: p?.limit ?? 0,
        limitBasis: p?.basis ?? "",
        excess,
        violation: excess > 0,
      };
    });
    const claim: ExpenseClaim = {
      id: `EXP-NEW-${claims.length}`,
      claimNo: `EXP-2026-${String(900 + claims.length)}`,
      employeeCode: persona.employeeId,
      employeeName: persona.name,
      department: persona.department,
      purpose: purpose.trim(),
      periodFrom: lines.reduce((a, b) => (b.date < a ? b.date : a), lines[0].date),
      periodTo: lines.reduce((a, b) => (b.date > a ? b.date : a), lines[0].date),
      lines: built,
      total,
      status: "submitted",
      submittedOn: "2026-09-16",
      approverCode: "STL-0031",
      approverName: "Vikram Shah",
      decidedOn: null,
      decisionNote: null,
      reimbursedOn: null,
      violationCount: built.filter((l) => l.violation).length,
      hasViolation: built.some((l) => l.violation),
      search: [`EXP-2026-${String(900 + claims.length)}`, persona.name, purpose.trim(), persona.department]
        .join(" ")
        .toLowerCase(),
    };
    setClaims((cs) => [claim, ...cs]);
    setComposeOpen(false);
    resetForm();
    mockAction(`Claim ${claim.claimNo} submitted`, {
      description: `${inr(total, { decimals: false })} across ${built.length} line${built.length === 1 ? "" : "s"} · routed to ${claim.approverName}.`,
    });
  };

  const decide = (claim: ExpenseClaim, approve: boolean) => {
    setClaims((cs) =>
      cs.map((c) =>
        c.id === claim.id
          ? {
              ...c,
              status: approve ? "approved" : "rejected",
              decidedOn: "2026-09-16",
              decisionNote: approve ? "Within policy after review." : "Returned — see policy breach.",
              approverName: persona.name,
            }
          : c,
      ),
    );
    setDetail(null);
    mockAction(approve ? `Approved ${claim.claimNo}` : `Rejected ${claim.claimNo}`, {
      description: `${claim.employeeName} · ${inr(claim.total, { decimals: false })}`,
      tone: approve ? "success" : "warning",
    });
  };

  const stats = React.useMemo(
    () => ({
      pending: claims.filter((c) => c.status === "submitted").length,
      pendingValue: claims.filter((c) => c.status === "submitted").reduce((a, b) => a + b.total, 0),
      approved: claims.filter((c) => c.status === "approved" || c.status === "completed").length,
      breaches: claims.filter((c) => c.hasViolation).length,
    }),
    [claims],
  );

  if (loading) {
    return (
      <PageBody>
        <PageHeader title="Expenses" description="Loading claims…" />
        <Skeleton className="h-[420px]" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Expenses"
        description="Claim reimbursement, track approvals, and see policy breaches flagged on the exact line that caused them."
        actions={
          <Gated menuKey="my.expenses" action="C">
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setComposeOpen(true);
              }}
            >
              <Plus /> New claim
            </Button>
          </Gated>
        }
      />

      <StatRow cols={4}>
        <StatTile
          label="Awaiting approval"
          value={num(stats.pending)}
          icon={Receipt}
          tone={stats.pending > 0 ? "warning" : "good"}
          hint={inr(stats.pendingValue, { decimals: false })}
          onClick={() => setStatus("submitted")}
        />
        <StatTile label="Approved claims" value={num(stats.approved)} icon={Check} tone="good" onClick={() => setStatus("approved")} />
        <StatTile
          label="Policy breaches"
          value={num(stats.breaches)}
          icon={TriangleAlert}
          tone={stats.breaches > 0 ? "critical" : "good"}
          hint="Claims with at least one over-limit line"
          onClick={() => setOnlyViolations(true)}
        />
        <StatTile
          label="My claims"
          value={num(mine.length)}
          icon={Wallet}
          hint={inr(mine.reduce((a, b) => a + b.total, 0), { decimals: false })}
        />
      </StatRow>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">
            <Receipt /> My claims ({mine.length})
          </TabsTrigger>
          <TabsTrigger value="queue">
            <Check /> Approval queue ({toApprove.length})
          </TabsTrigger>
          <TabsTrigger value="policy">
            <FileText /> Policy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="flex flex-col gap-3">
          <FilterRow
            status={status}
            setStatus={setStatus}
            onlyViolations={onlyViolations}
            setOnlyViolations={setOnlyViolations}
          />
          <ClaimList claims={filterClaims(mine)} onOpen={setDetail} emptyLabel="You have not raised any claims yet." />
          <div className="grid gap-3 lg:grid-cols-2">
            <DonutChart
              title="Spend by category"
              description="Across every claim in the tenant this financial year."
              data={EXPENSE_BY_CATEGORY.map((c) => ({ name: c.category, value: c.claimed }))}
              valueFormat={(v) => inr(v, { decimals: false })}
              centreValue={inrCompact(EXPENSE_BY_CATEGORY.reduce((a, b) => a + b.claimed, 0))}
              centreLabel="claimed"
              height={260}
            />
            <BarCompareChart
              title="Claims and breaches by category"
              description="Where policy is most often exceeded."
              data={EXPENSE_BY_CATEGORY.map((c) => ({
                name: c.category,
                claimed: c.claimed,
                breaches: c.over_limit,
              }))}
              xKey="name"
              series={[
                { key: "claimed", label: "Claimed" },
                { key: "breaches", label: "Over limit" },
              ]}
              horizontal
              height={260}
            />
          </div>
        </TabsContent>

        <TabsContent value="queue" className="flex flex-col gap-3">
          <FilterRow
            status={status}
            setStatus={setStatus}
            onlyViolations={onlyViolations}
            setOnlyViolations={setOnlyViolations}
          />
          {toApprove.length === 0 ? (
            <EmptyState icon={Check} title="Nothing to approve" description="Every claim routed to you has been decided." />
          ) : (
            <ClaimList
              claims={filterClaims(toApprove)}
              onOpen={setDetail}
              onDecide={decide}
              emptyLabel="No claim matches those filters."
            />
          )}
        </TabsContent>

        <TabsContent value="policy">
          <Section
            title="Reimbursement limits"
            description="The caps the inline warning quotes verbatim when a line goes over."
            bodyClassName="p-0"
          >
            <table className="w-full text-xs">
              <thead className="bg-subtle">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
                  <th data-numeric className="px-4 py-2 text-right font-medium text-muted-foreground">Limit</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Basis</th>
                </tr>
              </thead>
              <tbody>
                {EXPENSE_POLICY.map((p) => (
                  <tr key={p.category} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium">{p.category}</td>
                    <td data-numeric className="px-4 py-2 text-right">{inr(p.limit, { decimals: false })}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------- claim detail */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent size="xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.claimNo}</DialogTitle>
                <DialogDescription>
                  {detail.employeeName} · {detail.department} · {detail.purpose} ·{" "}
                  {fmtDate(detail.periodFrom)} – {fmtDate(detail.periodTo)}
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-3">
                {detail.hasViolation && (
                  <Alert
                    tone="warning"
                    icon={TriangleAlert}
                    title={`${detail.violationCount} line${detail.violationCount === 1 ? "" : "s"} breach the reimbursement policy`}
                  >
                    The offending lines are highlighted below with the applicable cap and the excess.
                  </Alert>
                )}

                <ul className="flex flex-col gap-2">
                  {detail.lines.map((l) => (
                    <li
                      key={l.id}
                      className={cn(
                        "rounded-md border p-2.5",
                        l.violation ? "border-warning/40 bg-warning-soft/40" : "border-border",
                      )}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded border border-border bg-card text-muted-foreground">
                          {l.receiptKind === "pdf" ? (
                            <FileText className="size-4" aria-hidden />
                          ) : (
                            <FileImage className="size-4" aria-hidden />
                          )}
                        </div>
                        <div className="min-w-[180px] flex-1">
                          <p className="text-xs font-medium">{l.description}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {l.category} · {fmtDateShort(l.date)} · {l.receipt}
                          </p>
                        </div>
                        <p className="tnum shrink-0 text-right text-xs font-semibold">
                          {inr(l.amount, { decimals: false })}
                        </p>
                      </div>
                      {l.violation && (
                        <p
                          role="alert"
                          className="mt-2 flex items-start gap-1.5 border-t border-warning/30 pt-2 text-[11px] text-warning-fg"
                        >
                          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                          <span>
                            Over the {l.category} cap of{" "}
                            <strong>{inr(l.limit, { decimals: false })}</strong> ({l.limitBasis}) by{" "}
                            <strong>{inr(l.excess, { decimals: false })}</strong>. Requires a written
                            exception from the cost-centre owner.
                          </span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="flex items-center justify-between rounded-md border border-border bg-subtle px-3 py-2">
                  <span className="text-xs font-semibold">Claim total</span>
                  <span className="tnum text-sm font-semibold">{inr(detail.total)}</span>
                </div>

                {detail.decisionNote && (
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{detail.approverName}</span> on{" "}
                    {detail.decidedOn ? fmtDate(detail.decidedOn) : "—"}: {detail.decisionNote}
                  </p>
                )}
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
                {detail.status === "submitted" && (
                  <>
                    <Gated menuKey="workplace.expenses" action="A">
                      <Button variant="destructive" onClick={() => decide(detail, false)}>
                        <X /> Reject
                      </Button>
                    </Gated>
                    <Gated menuKey="workplace.expenses" action="A">
                      <Button onClick={() => decide(detail, true)}>
                        <Check /> Approve {inr(detail.total, { decimals: false })}
                      </Button>
                    </Gated>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------- claim compose */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>New expense claim</DialogTitle>
            <DialogDescription>
              Add a line per receipt. The running total and any policy breach update as you type.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <Field
              label="Purpose"
              htmlFor="claim-purpose"
              required
              error={purposeError ?? undefined}
              hint="One line an approver can act on, e.g. “Client visit — Mumbai, 8–10 Sep”."
            >
              <Input
                id="claim-purpose"
                value={purpose}
                onChange={(e) => {
                  setPurpose(e.target.value);
                  if (purposeError) setPurposeError(null);
                }}
                aria-invalid={!!purposeError}
                placeholder="Client visit — Mumbai, 8–10 Sep"
              />
            </Field>

            <div className="flex items-center justify-between">
              <Label>Lines</Label>
              <Button variant="outline" size="sm" onClick={() => setLines((l) => [...l, newLine()])}>
                <Plus /> Add line
              </Button>
            </div>

            <ul className="flex flex-col gap-2">
              {lines.map((l, i) => {
                const p = policyFor(l.category);
                const excess = p ? Math.max(0, (Number(l.amount) || 0) - p.limit) : 0;
                return (
                  <li
                    key={l.key}
                    className={cn(
                      "rounded-md border p-2.5",
                      excess > 0 ? "border-warning/40 bg-warning-soft/40" : "border-border",
                    )}
                  >
                    <div className="grid gap-2 sm:grid-cols-[150px_130px_1fr_120px_32px]">
                      <Select
                        value={l.category}
                        onValueChange={(v) =>
                          setLines((ls) =>
                            ls.map((x) => (x.key === l.key ? { ...x, category: v as ExpenseCategory } : x)),
                          )
                        }
                      >
                        <SelectTrigger size="sm" aria-label={`Line ${i + 1} category`}>
                          <span className="truncate text-xs">{l.category}</span>
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="date"
                        value={l.date}
                        aria-label={`Line ${i + 1} date`}
                        className="h-7 text-xs"
                        onChange={(e) =>
                          setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, date: e.target.value } : x)))
                        }
                      />

                      <Input
                        value={l.description}
                        aria-label={`Line ${i + 1} description`}
                        placeholder="What was this for?"
                        className="h-7 text-xs"
                        onChange={(e) =>
                          setLines((ls) =>
                            ls.map((x) => (x.key === l.key ? { ...x, description: e.target.value } : x)),
                          )
                        }
                      />

                      <Input
                        type="number"
                        value={l.amount || ""}
                        aria-label={`Line ${i + 1} amount`}
                        placeholder="0"
                        className="tnum h-7 text-xs"
                        onChange={(e) =>
                          setLines((ls) =>
                            ls.map((x) =>
                              x.key === l.key ? { ...x, amount: Number(e.target.value) || 0 } : x,
                            ),
                          )
                        }
                      />

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove line ${i + 1}`}
                        disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      >
                        <Trash2 />
                      </Button>
                    </div>

                    {excess > 0 && p && (
                      <p
                        role="alert"
                        className="mt-2 flex items-start gap-1.5 border-t border-warning/30 pt-2 text-[11px] text-warning-fg"
                      >
                        <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                        <span>
                          Over the {l.category} cap of{" "}
                          <strong>{inr(p.limit, { decimals: false })}</strong> ({p.basis}) by{" "}
                          <strong>{inr(excess, { decimals: false })}</strong>. You can still submit,
                          but it will need a written exception.
                        </span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-subtle px-3 py-2">
              <span className="text-xs font-semibold">
                Claim total · {lines.length} line{lines.length === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-2">
                {violations.length > 0 && (
                  <Badge variant="outline" className="border-warning/40 text-warning-fg">
                    <TriangleAlert className="size-3" aria-hidden /> {violations.length} over limit
                  </Badge>
                )}
                <span className="tnum text-sm font-semibold">{inr(total)}</span>
              </span>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitClaim} disabled={total <= 0}>
              <Check /> Submit claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}

/* -------------------------------------------------------------- helpers */

function FilterRow({
  status,
  setStatus,
  onlyViolations,
  setOnlyViolations,
}: {
  status: string;
  setStatus: (v: string) => void;
  onlyViolations: boolean;
  setOnlyViolations: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterSelect
        label="Status"
        value={status}
        onValueChange={setStatus}
        allLabel="All statuses"
        width="w-[170px]"
        options={[
          { value: "draft", label: "Draft" },
          { value: "submitted", label: "Submitted" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "completed", label: "Reimbursed" },
          { value: "cancelled", label: "Cancelled" },
        ]}
      />
      <Button
        variant={onlyViolations ? "default" : "outline"}
        size="sm"
        aria-pressed={onlyViolations}
        onClick={() => setOnlyViolations(!onlyViolations)}
      >
        <TriangleAlert /> Policy breaches only
      </Button>
    </div>
  );
}

function ClaimList({
  claims,
  onOpen,
  onDecide,
  emptyLabel,
}: {
  claims: ExpenseClaim[];
  onOpen: (c: ExpenseClaim) => void;
  onDecide?: (c: ExpenseClaim, approve: boolean) => void;
  emptyLabel: string;
}) {
  if (claims.length === 0) {
    return <EmptyState icon={Receipt} title="Nothing here" description={emptyLabel} />;
  }
  return (
    <Card className="overflow-hidden">
      <ul>
        {claims.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/50"
          >
            <Avatar name={c.employeeName} size={28} />
            <button
              type="button"
              onClick={() => onOpen(c)}
              className="min-w-[220px] flex-1 text-left focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                {c.claimNo}
                <span className="font-normal text-muted-foreground">· {c.purpose}</span>
                {c.hasViolation && (
                  <Hint text={`${c.violationCount} line(s) exceed the reimbursement policy`}>
                    <Badge variant="outline" className="border-warning/40 text-warning-fg">
                      <TriangleAlert className="size-3" aria-hidden /> {c.violationCount}
                    </Badge>
                  </Hint>
                )}
              </p>
              <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
                {c.employeeName} · {c.department} · {c.lines.length} line
                {c.lines.length === 1 ? "" : "s"} · {fmtDateShort(c.periodFrom)}–
                {fmtDateShort(c.periodTo)}
              </p>
            </button>
            <span className="tnum shrink-0 text-right text-xs font-semibold">
              {inr(c.total, { decimals: false })}
            </span>
            <StatusBadge status={c.status} />
            <div className="flex shrink-0 gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => onOpen(c)}>
                View
              </Button>
              {onDecide && c.status === "submitted" && (
                <>
                  <Gated menuKey="workplace.expenses" action="A">
                    <Button variant="outline" size="sm" onClick={() => onDecide(c, false)}>
                      Reject
                    </Button>
                  </Gated>
                  <Gated menuKey="workplace.expenses" action="A">
                    <Button size="sm" onClick={() => onDecide(c, true)}>
                      Approve
                    </Button>
                  </Gated>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
