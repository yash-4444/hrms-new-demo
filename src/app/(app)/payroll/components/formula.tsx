"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, FlaskConical, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/format";
import { employeeByCode } from "@/mock/employees";
import { CURRENT_PERIOD } from "@/mock/payroll";
import { evaluatePayComponent, PAY_COMPONENT_TEST_EMPLOYEES } from "@/mock/finance-payroll";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/overlays";
import { Label } from "@/components/ui/primitives";

/* ----------------------------------------------------- highlighted code */

const TOKEN = /("[^"]*")|(\d[\d,]*(?:\.\d+)?%?)|([a-z_][a-z0-9_]*)(?=\()|([A-Z_][A-Z0-9_]*)|(\s+)|([\s\S])/g;

type TokenKind = "string" | "number" | "fn" | "var" | "space" | "op";

function tokenize(src: string): { kind: TokenKind; text: string }[] {
  const out: { kind: TokenKind; text: string }[] = [];
  for (const m of src.matchAll(TOKEN)) {
    const kind: TokenKind = m[1] ? "string" : m[2] ? "number" : m[3] ? "fn" : m[4] ? "var" : m[5] ? "space" : "op";
    out.push({ kind, text: m[0] });
  }
  return out;
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  string: "text-emerald-700 dark:text-emerald-300",
  number: "text-amber-700 dark:text-amber-300",
  fn: "text-violet-700 dark:text-violet-300",
  var: "text-sky-700 dark:text-sky-300 font-medium",
  space: "",
  op: "text-muted-foreground",
};

/** Read-only formula editor: line gutter, token colouring, and a lock note. */
export function FormulaCode({ formula, className }: { formula: string; className?: string }) {
  const at = formula.indexOf(" = ");
  const lhs = at > 0 ? formula.slice(0, at) : "";
  const rhs = at > 0 ? formula.slice(at + 3) : formula;
  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-subtle", className)}>
      <div className="flex items-center justify-between border-b border-border px-2.5 py-1 text-[10px] text-muted-foreground">
        <span className="font-mono">formula.pay</span>
        <span>Read-only · edit via the component dialog</span>
      </div>
      <pre className="flex overflow-x-auto py-2 font-mono text-xs leading-5" aria-label={`Formula: ${formula}`}>
        <span aria-hidden className="select-none border-r border-border px-2 text-right text-muted-foreground/70">
          1
        </span>
        <code className="px-2.5">
          {lhs && (
            <>
              <span className={TOKEN_CLASS.var}>{lhs}</span>
              <span className={TOKEN_CLASS.op}> = </span>
            </>
          )}
          {tokenize(rhs).map((t, i) => (
            <span key={i} className={TOKEN_CLASS[t.kind]}>
              {t.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

/* --------------------------------------------------------- the tester */

/** Evaluates the component for a chosen employee and checks it against the September run. */
export function ComponentTester({ code }: { code: string }) {
  const [emp, setEmp] = React.useState(PAY_COMPONENT_TEST_EMPLOYEES[0]?.code ?? "STL-0142");
  const employee = employeeByCode(emp);
  const result = React.useMemo(() => (employee ? evaluatePayComponent(code, employee) : null), [code, employee]);
  const pick = PAY_COMPONENT_TEST_EMPLOYEES.find((p) => p.code === emp);
  const matches = result && result.runValue !== null && result.runValue === result.output;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">Test with employee</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{CURRENT_PERIOD.label} run</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tester-emp">Employee</Label>
        <Select value={emp} onValueChange={setEmp}>
          <SelectTrigger id="tester-emp" size="sm">
            <span className="truncate">
              {employee?.name} · {emp}
              {pick && <span className="text-muted-foreground"> — {pick.why}</span>}
            </span>
          </SelectTrigger>
          <SelectContent>
            {PAY_COMPONENT_TEST_EMPLOYEES.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {employeeByCode(p.code)?.name} · {p.code} — {p.why}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {result && (
        <>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Resolved inputs
            </p>
            {result.inputs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No run inputs — evaluated outside payroll.</p>
            ) : (
              <dl className="divide-y divide-border rounded-md border border-border text-xs">
                {result.inputs.map((i) => (
                  <div key={i.name} className="flex items-center gap-2 px-2.5 py-1.5">
                    <dt className="font-mono text-sky-700 dark:text-sky-300">{i.name}</dt>
                    <dd className="tnum ml-auto font-medium">{i.value}</dd>
                    <dd className="hidden w-48 truncate text-right text-[11px] text-muted-foreground sm:block" title={i.source}>
                      {i.source}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-2.5 py-2 font-mono text-xs">
            <span className="min-w-0 break-all">{result.resolved}</span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="tnum font-sans text-sm font-semibold">{inr(result.output, { decimals: false })}</span>
          </div>
          {result.note && <p className="text-[11px] text-muted-foreground">{result.note}</p>}
          {result.runValue !== null && (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs",
                matches ? "text-success-fg" : "text-warning-fg",
              )}
            >
              {matches ? <CheckCircle2 className="size-3.5" aria-hidden /> : <TriangleAlert className="size-3.5" aria-hidden />}
              {matches
                ? `Matches the ${CURRENT_PERIOD.label} run line for ${employee?.name}.`
                : `Run line is ${inr(result.runValue, { decimals: false })} — the run used the pro-rated full-month amount.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
