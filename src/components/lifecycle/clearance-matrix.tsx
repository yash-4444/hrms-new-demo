"use client";

import * as React from "react";
import { BadgeIndianRupee, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr } from "@/lib/format";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Field, Hint, Input, Progress, Textarea } from "@/components/ui/primitives";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { CLEARANCE_DEPTS, CLEARANCE_SIGNERS, DEPT_SIGNER_NAME, type ClearanceDept, type ClearanceItem } from "@/mock/lifecycle";
import { LcBadge, OwnerChip } from "./kit";

/* ============================================================================
   Departments × items. A persona can sign off only their own desk's rows —
   everyone else sees who owns the row and why the button is disabled.
   ========================================================================== */

function RecoveryDialog({ item, onClose, onRaise }: { item: ClearanceItem; onClose: () => void; onRaise: (amount: number, note: string) => void }) {
  const [amount, setAmount] = React.useState(item.recovery ? String(item.recovery) : "");
  const [note, setNote] = React.useState("");
  const [tried, setTried] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const n = Math.round(Number(amount));
  const amountErr = !Number.isFinite(n) || n <= 0 ? "Enter the amount to recover" : undefined;
  const noteErr = note.trim().length < 8 ? "Say what is being recovered and why" : undefined;
  return (
    <>
      <Dialog open={!confirm} onOpenChange={(v) => !v && onClose()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Raise a recovery</DialogTitle>
            <DialogDescription>{item.label} — the amount is deducted in the full &amp; final settlement.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3.5">
            <Field label="Amount (₹)" htmlFor="rc-amt" required error={tried ? amountErr : undefined}>
              <Input id="rc-amt" type="number" min={1} className="tnum w-40" value={amount} aria-invalid={tried && !!amountErr} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Reason" htmlFor="rc-note" required error={tried ? noteErr : undefined}>
              <Textarea id="rc-note" value={note} aria-invalid={tried && !!noteErr} onChange={(e) => setNote(e.target.value)} placeholder="Charger not returned; replacement cost per IT price list." />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setTried(true);
                if (!amountErr && !noteErr) setConfirm(true);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={(v) => {
          if (!v) onClose();
        }}
        title={`Recover ${inr(n)} in F&F?`}
        description={`${item.label}. The employee sees this line on their F&F statement with your note.`}
        confirmLabel="Raise recovery"
        destructive
        onConfirm={() => onRaise(n, note.trim())}
      />
    </>
  );
}

export function ClearanceMatrix({
  items,
  open,
  managerName,
  onSignOff,
  onRecovery,
}: {
  items: ClearanceItem[];
  open: boolean;
  managerName: string;
  onSignOff: (item: ClearanceItem) => void;
  onRecovery: (item: ClearanceItem, amount: number, note: string) => void;
}) {
  const { role } = useApp();
  const [recovering, setRecovering] = React.useState<ClearanceItem | null>(null);
  const canSign = (d: ClearanceDept) => role === "tenant_owner" || CLEARANCE_SIGNERS[d].includes(role);
  const signer = (d: ClearanceDept) => (d === "Manager" ? managerName : DEPT_SIGNER_NAME[d]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {CLEARANCE_DEPTS.map((d) => {
          const rows = items.filter((i) => i.dept === d);
          const done = rows.filter((i) => i.status === "cleared").length;
          return (
            <div key={d} className="rounded-md border border-border bg-card px-2.5 py-2">
              <OwnerChip owner={d} />
              <p className="tnum mt-1.5 text-xs font-medium">
                {done}/{rows.length} cleared
              </p>
              <Progress value={(done / Math.max(1, rows.length)) * 100} tone={done === rows.length ? "success" : "accent"} className="mt-1" aria-label={`${d} clearance progress`} />
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] text-xs">
          <caption className="sr-only">Clearance items by department</caption>
          <thead className="bg-subtle text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Department</th>
              <th scope="col" className="px-3 py-2 font-medium">Item</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Recovery</th>
              <th scope="col" className="px-3 py-2 font-medium">Signed off</th>
              <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((it, idx) => {
              const first = idx === 0 || items[idx - 1].dept !== it.dept;
              const allowed = canSign(it.dept);
              const why = allowed ? "" : `Signed off by ${it.dept} — ${signer(it.dept)}`;
              return (
                <tr key={it.id} className={cn(it.status === "recovery" && "bg-warning-soft/40")}>
                  <td className="px-3 py-2 align-top">{first && <OwnerChip owner={it.dept} />}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{it.label}</p>
                    <p className="text-[11px] text-muted-foreground">{it.detail}</p>
                  </td>
                  <td className="px-3 py-2">
                    <LcBadge status={it.status} />
                  </td>
                  <td className="tnum px-3 py-2 text-right">{it.recovery ? inr(it.recovery) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{it.signedBy ? `${it.signedBy} · ${fmtDate(it.signedOn!)}` : "—"}</td>
                  <td className="px-3 py-2">
                    {open && it.status !== "cleared" && (
                      <span className="flex justify-end gap-1">
                        <Hint text={why}>
                          <span className="inline-flex">
                            <Button size="sm" variant="outline" disabled={!allowed} onClick={() => onSignOff(it)}>
                              <CheckCheck aria-hidden /> Sign off
                            </Button>
                          </span>
                        </Hint>
                        <Hint text={why}>
                          <span className="inline-flex">
                            <Button size="sm" variant="ghost" disabled={!allowed} onClick={() => setRecovering(it)}>
                              <BadgeIndianRupee aria-hidden /> Recovery
                            </Button>
                          </span>
                        </Hint>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {recovering && (
        <RecoveryDialog
          item={recovering}
          onClose={() => setRecovering(null)}
          onRaise={(amount, note) => {
            onRecovery(recovering, amount, note);
            setRecovering(null);
          }}
        />
      )}
    </div>
  );
}
