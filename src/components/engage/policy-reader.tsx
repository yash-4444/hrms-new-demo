"use client";

import * as React from "react";
import { CheckCircle2, History, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { PolicyDoc } from "@/mock/engage";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/primitives";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/overlays";
import { nameOf } from "./kit";

export type MyPolicyStatus = "accepted" | "reaccept" | "not_accepted" | "info";

export const MY_STATUS_META: Record<MyPolicyStatus, { label: string; status: string }> = {
  accepted: { label: "Accepted", status: "approved" },
  reaccept: { label: "Re-acceptance needed", status: "due_soon" },
  not_accepted: { label: "Not accepted", status: "pending" },
  info: { label: "For information", status: "not_started" },
};

export function PolicyReader({
  policy,
  status,
  acceptedAt,
  onOpenChange,
  onAccept,
}: {
  policy: PolicyDoc | null;
  status: MyPolicyStatus;
  acceptedAt: string | null;
  onOpenChange: (v: boolean) => void;
  onAccept: () => void;
}) {
  const [reachedEnd, setReachedEnd] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setReachedEnd(true);
  };

  /* A document shorter than the viewport has no scroll — treat it as read once shown. */
  React.useEffect(() => {
    if (!policy) return;
    const id = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el && el.scrollHeight <= el.clientHeight + 8) setReachedEnd(true);
    });
    return () => cancelAnimationFrame(id);
  }, [policy]);

  const needsAccept = status === "reaccept" || status === "not_accepted";

  return (
    <Sheet
      open={!!policy}
      onOpenChange={(v) => {
        if (!v) setReachedEnd(false);
        onOpenChange(v);
      }}
    >
      <SheetContent width="sm:max-w-2xl">
        {policy && (
          <>
            <SheetHeader>
              <SheetTitle>{policy.title}</SheetTitle>
              <SheetDescription>
                Version {policy.versions[0].version} · published {fmtDate(policy.versions[0].publishedOn)} · owner {nameOf(policy.ownerCode)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex min-h-0 flex-1 flex-col gap-3">
              {status === "reaccept" && (
                <Alert tone="warning" icon={History} title="A new version needs your acceptance">
                  {policy.versions[0].changeNote}
                </Alert>
              )}
              <div
                ref={scrollRef}
                onScroll={onScroll}
                tabIndex={0}
                aria-label={`${policy.title} — policy text`}
                className="max-h-[48vh] overflow-y-auto rounded-md border border-border bg-subtle p-4 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {policy.sections.map((s) => (
                  <section key={s.heading} className="mb-4">
                    <h3 className="text-sm font-semibold">{s.heading}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-foreground/90">{s.body}</p>
                  </section>
                ))}
                <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">— End of document —</p>
              </div>

              <div>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <History className="size-3.5" aria-hidden /> Version history
                </h3>
                <ol className="flex flex-col gap-1.5">
                  {policy.versions.map((v, i) => (
                    <li key={v.version} className="flex gap-2 text-xs">
                      <Badge variant={i === 0 ? "soft" : "muted"} className="shrink-0">
                        v{v.version}
                      </Badge>
                      <span className="text-muted-foreground">
                        {fmtDate(v.publishedOn)} — {v.changeNote}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </SheetBody>
            <SheetFooter className="items-center">
              {status === "accepted" ? (
                <p className="mr-auto flex items-center gap-1.5 text-xs text-success-fg">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Accepted v{policy.versions[0].version}
                  {acceptedAt ? ` on ${fmtDateTime(acceptedAt)}` : ""}
                </p>
              ) : needsAccept ? (
                <p className={cn("mr-auto flex items-center gap-1.5 text-xs", reachedEnd ? "text-foreground" : "text-muted-foreground")} aria-live="polite">
                  <ScrollText className="size-4" aria-hidden />
                  {reachedEnd ? "You have reached the end of the document." : "Scroll to the end of the document to accept."}
                </p>
              ) : (
                <p className="mr-auto text-xs text-muted-foreground">For information — no acceptance required.</p>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {needsAccept && (
                <Button disabled={!reachedEnd} onClick={onAccept}>
                  <CheckCircle2 /> I have read and accept
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
