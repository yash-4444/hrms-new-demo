"use client";

import * as React from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { DEMO_TODAY, TENANT, branchById } from "@/mock/org";
import type { Employee } from "@/mock/employees";

/* ============================================================================
   A4-like letter on Stellar letterhead with a digital-signature block. The
   sheet stays paper-white in dark mode on purpose — it is the printed output.
   ========================================================================== */

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
};

export function LetterPreview({
  refNo,
  subject,
  body,
  employee,
  aiParagraph,
  signed = true,
  className,
}: {
  refNo: string;
  subject: string;
  body: string;
  employee: Employee;
  /** Accepted AI paragraph — highlighted so the reviewer can see what the model wrote. */
  aiParagraph?: string | null;
  signed?: boolean;
  className?: string;
}) {
  const us = employee.branchId === "EWR";
  const branch = branchById(employee.branchId);
  const paras = body.split(/\n\n+/);
  const digest = hash(`${refNo}|${subject}|${body}|${aiParagraph ?? ""}`);

  return (
    <article
      aria-label={`Letter preview: ${subject}`}
      className={cn(
        "mx-auto flex aspect-[1/1.414] w-full max-w-[560px] flex-col overflow-hidden rounded-sm border border-zinc-300 bg-white text-zinc-900 shadow-md",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b-2 border-indigo-600 px-7 pb-3 pt-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white" aria-hidden>
            S
          </span>
          <div>
            <p className="text-[13px] font-bold leading-tight">{us ? "Stellar Technologies Inc." : TENANT.name}</p>
            <p className="text-[9px] text-zinc-500">{us ? "Delaware C-Corp · EIN 87-2290417" : `CIN ${TENANT.cin}`}</p>
          </div>
        </div>
        <div className="text-right text-[9px] leading-snug text-zinc-500">
          <p className="max-w-[200px]">{branch?.address}</p>
          <p>
            {TENANT.website} · {TENANT.supportEmail}
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden px-7 py-4 text-[10.5px] leading-relaxed">
        <div className="flex justify-between text-[9.5px] text-zinc-500">
          <span className="tnum">Ref: {refNo}</span>
          <span className="tnum">{fmtDate(DEMO_TODAY)}</span>
        </div>
        <div className="text-[10px]">
          <p className="font-semibold">{employee.name}</p>
          <p className="text-zinc-600">
            {employee.code} · {employee.designation}
          </p>
          <p className="text-zinc-600">{branch?.name}</p>
        </div>
        <p className="font-semibold underline decoration-zinc-300 underline-offset-2">Subject: {subject}</p>
        {paras.map((p, i) => (
          <React.Fragment key={i}>
            <p className="whitespace-pre-line">{p}</p>
            {aiParagraph && i === Math.min(1, paras.length - 1) && (
              <p className="relative rounded-sm bg-violet-50 px-1.5 py-1 ring-1 ring-violet-200">
                <Sparkles className="absolute -left-4 top-1.5 size-3 text-violet-500" aria-label="AI-drafted paragraph" />
                {aiParagraph}
              </p>
            )}
          </React.Fragment>
        ))}
        <p className="mt-1">Yours sincerely,</p>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-dashed border-zinc-300 pt-2.5">
          <div>
            {signed ? (
              <p className="font-serif text-[15px] italic text-indigo-700" aria-hidden>
                Priya Menon
              </p>
            ) : (
              <p className="text-[9px] italic text-zinc-400">Signature applied on issue</p>
            )}
            <p className="font-semibold">Priya Menon</p>
            <p className="text-zinc-600">Head of People Operations</p>
          </div>
          {signed && (
            <div className="flex items-start gap-1.5 rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[8.5px] leading-snug text-emerald-800">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold">Digitally signed</p>
                <p className="tnum">{fmtDate(DEMO_TODAY)} 14:35 IST</p>
                <p className="tnum font-mono">SHA-256 {digest}…{hash(digest)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <footer className="bg-zinc-50 px-7 py-1.5 text-center text-[8px] text-zinc-500">
        This letter is system-generated and verifiable at {TENANT.website}/verify/{refNo}
      </footer>
    </article>
  );
}
