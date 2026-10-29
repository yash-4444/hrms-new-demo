"use client";

import * as React from "react";
import { Pencil, Send } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { PREJOIN_DOCS, PREJOIN_POLICIES } from "@/mock/lifecycle-public";
import { Button } from "@/components/ui/button";
import { KV } from "@/components/lifecycle/kit";
import { STEPS, maskAccount, type WizardData } from "./types";

function Section({ index, onEdit, children }: { index: number; onEdit: (i: number) => void; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`rv-${index}`} className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`rv-${index}`} className="text-sm font-semibold">
          {index + 1}. {STEPS[index].label}
        </h3>
        <Button variant="link" size="sm" className="h-auto px-0" onClick={() => onEdit(index)} aria-label={`Edit ${STEPS[index].label}`}>
          <Pencil />
          Edit
        </Button>
      </div>
      {children}
    </section>
  );
}

export function StepReview({
  data,
  onEdit,
  onBack,
  onSubmit,
}: {
  data: WizardData;
  onEdit: (i: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const { personal: p, documents: d, bank: b, nominees: n, declarations: dec } = data;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Check everything once more. After you submit, HR verifies your documents and you can no longer edit this form —
        changes then go through your HR partner.
      </p>

      <Section index={0} onEdit={onEdit}>
        {p && (
          <div className="grid gap-3 sm:grid-cols-3">
            <KV label="Date of birth">
              <span className="tnum">{fmtDate(p.dob)}</span>
            </KV>
            <KV label="Gender">{p.gender}</KV>
            <KV label="Marital status">{p.maritalStatus}</KV>
            <KV label="Address" className="sm:col-span-2">
              {p.addressLine}, {p.city}, {p.state} <span className="tnum">{p.pincode}</span>
            </KV>
            <KV label="Emergency contact">
              {p.emergencyName} ({p.emergencyRelation})<span className="tnum block text-xs text-muted-foreground">{p.emergencyPhone}</span>
            </KV>
          </div>
        )}
      </Section>

      <Section index={1} onEdit={onEdit}>
        {d && (
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {PREJOIN_DOCS.map((doc) => (
              <li key={doc.key} className="flex justify-between gap-2">
                <span className="text-foreground">{doc.label}</span>
                <span className={d[doc.key] ? "text-success-fg" : "text-muted-foreground"}>
                  {d[doc.key] ? "Uploaded" : doc.required ? "Missing" : "Not provided"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section index={2} onEdit={onEdit}>
        {b && (
          <div className="grid gap-3 sm:grid-cols-3">
            <KV label="Account holder">{b.holder}</KV>
            <KV label="Account number">
              <span className="tnum font-mono">{maskAccount(b.accountNumber)}</span>
            </KV>
            <KV label="IFSC">
              <span className="tnum font-mono">{b.ifsc}</span>
            </KV>
          </div>
        )}
      </Section>

      <Section index={3} onEdit={onEdit}>
        {n && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(["pf", "gratuity"] as const).map((s) => (
              <KV key={s} label={s === "pf" ? "Provident Fund" : "Gratuity"}>
                <ul className="flex flex-col gap-0.5 text-xs">
                  {n[s].map((r, i) => (
                    <li key={i}>
                      {r.name} · {r.relationship} · <span className="tnum">{r.share}%</span>
                    </li>
                  ))}
                </ul>
              </KV>
            ))}
          </div>
        )}
      </Section>

      <Section index={4} onEdit={onEdit}>
        {dec && (
          <p className="text-xs text-foreground">
            <span className="tnum">{PREJOIN_POLICIES.filter((x) => dec.policies[x.key]).length}</span> of{" "}
            <span className="tnum">{PREJOIN_POLICIES.length}</span> policies accepted · declaration signed
          </p>
        )}
      </Section>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSubmit}>
          <Send />
          Submit pre-joining details
        </Button>
      </div>
    </div>
  );
}
