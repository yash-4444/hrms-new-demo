"use client";

import * as React from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CheckCircle2, CloudCheck } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY, TENANT } from "@/mock/org";
import { branchLabel } from "@/mock/hiring";
import { PREJOIN_CANDIDATE, PREJOIN_OFFER } from "@/mock/lifecycle-public";
import { PublicShell } from "@/components/lifecycle/public-shell";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/primitives";
import { mockAction } from "@/components/app-state";
import { StepFooter, WizardStepper } from "./stepper";
import { StepPersonal } from "./step-personal";
import { StepDocuments } from "./step-documents";
import { StepBank } from "./step-bank";
import { StepNominees } from "./step-nominees";
import { StepDeclarations } from "./step-declarations";
import { StepReview } from "./step-review";
import { REVIEW_STEP, STEPS, type WizardData } from "./types";

/* ============================================================================
   /pre-joining — the joiner's own checklist between offer acceptance and
   Day 1. Each step saves on "Save and continue"; completed steps stay open
   for edits until the whole pack is submitted.
   ========================================================================== */

const daysToJoin = differenceInCalendarDays(parseISO(PREJOIN_OFFER.joiningDate), parseISO(DEMO_TODAY));

export default function PreJoiningView() {
  const [step, setStep] = React.useState(0);
  const [done, setDone] = React.useState<Set<number>>(() => new Set());
  const [data, setData] = React.useState<WizardData>({});
  const [savedStep, setSavedStep] = React.useState<number | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const allSaved = Array.from({ length: REVIEW_STEP }, (_, i) => i).every((i) => done.has(i));
  const canOpen = (i: number) => i === step || done.has(i) || (i === REVIEW_STEP && allSaved);
  const go = (i: number) => {
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = <K extends keyof WizardData>(i: number, key: K, value: WizardData[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    const nextDone = new Set(done).add(i);
    setDone(nextDone);
    setSavedStep(i);
    mockAction(`Saved · step ${i + 1} of ${STEPS.length}`, {
      description: `${STEPS[i].label} saved. You can come back and change it until you submit.`,
    });
    const next = Array.from({ length: REVIEW_STEP }, (_, s) => s).find((s) => !nextDone.has(s)) ?? REVIEW_STEP;
    go(next);
  };

  const progress = submitted ? 100 : Math.round((done.size / STEPS.length) * 100);
  const back = () => go(Math.max(0, step - 1));
  const firstName = PREJOIN_CANDIDATE.name.split(" ")[0];

  return (
    <PublicShell subtitle="Pre-joining" nav={false} width="max-w-5xl">
      <header className="mb-5 flex flex-col gap-1">
        <p className="text-xs font-medium text-primary">
          {PREJOIN_OFFER.role} · {branchLabel(PREJOIN_OFFER.branchId)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome aboard, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          You join {TENANT.shortName} on <span className="tnum font-medium text-foreground">{fmtDate(PREJOIN_OFFER.joiningDate)}</span>
          {daysToJoin > 0 && <span className="tnum"> — {daysToJoin} days to go</span>}. Finish these six steps so your
          laptop, payroll and insurance are ready on Day 1.
        </p>
      </header>

      <div className="mb-5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="tnum font-medium text-foreground">{progress}% complete</span>
          {savedStep !== null && !submitted && (
            <span className="inline-flex items-center gap-1 text-success-fg" role="status">
              <CloudCheck className="size-3.5" aria-hidden />
              <span className="tnum">
                Saved · step {savedStep + 1} of {STEPS.length}
              </span>
            </span>
          )}
        </div>
        <Progress value={progress} tone={submitted ? "success" : "accent"} aria-label="Pre-joining progress" />
      </div>

      {submitted ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-success-soft text-success-fg">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <h2 className="text-xl font-semibold tracking-tight">All done — see you on {fmtDate(PREJOIN_OFFER.joiningDate)}</h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            HR verifies your documents within two working days and writes to you only if something needs another look.
            Your laptop is dispatched a week before you join, and your Day-1 schedule arrives by email the Friday before.
          </p>
          <ul className="mt-2 grid w-full max-w-lg gap-2 text-left text-xs sm:grid-cols-3">
            {["Documents to HR for verification", "Bank details to payroll", "Nominations to PF and gratuity"].map((t) => (
              <li key={t} className="flex items-start gap-1.5 rounded-md border border-border p-2.5">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-[200px_1fr]">
          <WizardStepper step={step} done={done} canOpen={canOpen} onJump={go} />
          <Card className="min-w-0 p-5">
            <h2 className="mb-1 text-base font-semibold tracking-tight">
              <span className="tnum text-muted-foreground">
                Step {step + 1} of {STEPS.length} ·{" "}
              </span>
              {STEPS[step].label}
            </h2>
            <div className="mt-4">
              {step === 0 && <StepPersonal key="s0" initial={data.personal} onSave={(v) => save(0, "personal", v)} />}
              {step === 1 && (
                <StepDocuments key="s1" initial={data.documents} onSave={(v) => save(1, "documents", v)} onBack={back} />
              )}
              {step === 2 && <StepBank key="s2" initial={data.bank} onSave={(v) => save(2, "bank", v)} onBack={back} />}
              {step === 3 && (
                <StepNominees key="s3" initial={data.nominees} onSave={(v) => save(3, "nominees", v)} onBack={back} />
              )}
              {step === 4 && (
                <StepDeclarations
                  key="s4"
                  initial={data.declarations}
                  onSave={(v) => save(4, "declarations", v)}
                  onBack={back}
                />
              )}
              {step === REVIEW_STEP &&
                (allSaved ? (
                  <StepReview
                    data={data}
                    onEdit={go}
                    onBack={back}
                    onSubmit={() => {
                      setDone(new Set(done).add(REVIEW_STEP));
                      setSubmitted(true);
                      mockAction("Pre-joining details submitted", {
                        description: `HR has your pack. We will see you on ${fmtDate(PREJOIN_OFFER.joiningDate)}.`,
                      });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                ) : (
                  <form onSubmit={(e) => e.preventDefault()}>
                    <p className="mb-4 text-xs text-muted-foreground">Finish the earlier steps to review your details.</p>
                    <StepFooter onBack={back} disabled />
                  </form>
                ))}
            </div>
          </Card>
        </div>
      )}
    </PublicShell>
  );
}
