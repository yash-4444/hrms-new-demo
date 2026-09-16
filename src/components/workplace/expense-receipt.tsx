"use client";

import * as React from "react";
import { FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, inr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/overlays";
import type { ExpenseLine } from "@/mock/workplace";

/* ============================================================================
   Receipt thumbnails.

   Nothing here loads an image — a receipt is a bordered tile with a file icon,
   the filename and the amount, and the preview is a paper-like placeholder
   card. No network request ever leaves the demo.
   ========================================================================== */

export function ReceiptThumb({ line, className }: { line: ExpenseLine; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const Icon = line.receiptKind === "pdf" ? FileText : ImageIcon;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Preview receipt ${line.receipt}`}
        className={cn(
          "flex w-[168px] shrink-0 items-center gap-2 rounded-md border border-border bg-subtle px-2 py-1.5 text-left transition-colors",
          "hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded border border-border bg-card text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">{line.receipt}</span>
          <span className="tnum block text-xs text-muted-foreground">{inr(line.amount)}</span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle className="truncate">{line.receipt}</DialogTitle>
            <DialogDescription>
              {line.receiptKind === "pdf" ? "PDF attachment" : "Photo attachment"} · {line.category}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ReceiptPaper line={line} />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The enlarged placeholder — a paper docket, drawn entirely in CSS. */
function ReceiptPaper({ line }: { line: ExpenseLine }) {
  const Icon = line.receiptKind === "pdf" ? FileText : ImageIcon;
  return (
    <div className="mx-auto w-full max-w-[280px] rounded-md border border-dashed border-border bg-subtle p-4 shadow-xs">
      <div className="flex items-center justify-center border-b border-dashed border-border pb-3">
        <span className="flex size-12 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </span>
      </div>
      <p className="mt-3 truncate text-center text-xs font-semibold text-foreground">{line.receipt}</p>
      <dl className="mt-3 flex flex-col gap-1.5 text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Category</dt>
          <dd className="truncate font-medium text-foreground">{line.category}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Date</dt>
          <dd className="tnum font-medium text-foreground">{fmtDate(line.date)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="tnum font-semibold text-foreground">{inr(line.amount)}</dd>
        </div>
      </dl>
      <p className="mt-3 border-t border-dashed border-border pt-2 text-center text-xs text-muted-foreground">
        {line.description}
      </p>
      <p className="mt-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        Placeholder — no scan is stored in the demo
      </p>
    </div>
  );
}

/** Horizontal strip of every receipt on a claim. */
export function ReceiptStrip({ lines, className }: { lines: ExpenseLine[]; className?: string }) {
  if (lines.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        <Paperclip className="mr-1 inline size-3" aria-hidden />
        No receipts attached yet.
      </p>
    );
  }
  return (
    <div className={cn("scrollbar-thin flex gap-2 overflow-x-auto pb-1", className)}>
      {lines.map((l) => (
        <ReceiptThumb key={l.id} line={l} />
      ))}
    </div>
  );
}
