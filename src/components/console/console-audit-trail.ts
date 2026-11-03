"use client";

import * as React from "react";
import { format } from "date-fns";
import { PLATFORM_PERSONA } from "@/lib/rbac";
import { OPERATOR_IP, type ConsoleAuditEntry } from "@/mock/console-audit";
import { demoNowMs } from "@/components/app-state";

/* ============================================================================
   Console actions taken this session on screens that do not touch a tenant
   record — announcements, flags, operators, support requests — so the Audit
   Log can show them next to the fixture history and useConsole()'s tenant
   activity. A tiny module-level store (no provider to mount): it survives
   client navigation inside the console and, like every demo mutation, is
   gone on reload. Append-only — there is deliberately no update or remove.
   ========================================================================== */

let entries: ConsoleAuditEntry[] = [];
const listeners = new Set<() => void>();
const EMPTY: ConsoleAuditEntry[] = [];

export function recordConsoleAudit(e: Omit<ConsoleAuditEntry, "id" | "at" | "operator" | "ip" | "result"> & { result?: ConsoleAuditEntry["result"] }) {
  const operator = PLATFORM_PERSONA.name;
  const entry: ConsoleAuditEntry = {
    ...e,
    id: `AUD-S${String(entries.length + 1).padStart(4, "0")}`,
    at: format(new Date(demoNowMs()), "yyyy-MM-dd'T'HH:mm:ss"),
    operator,
    ip: OPERATOR_IP[operator],
    result: e.result ?? "success",
  };
  entries = [entry, ...entries];
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Entries recorded this session, newest first. */
export function useConsoleAuditTrail() {
  return React.useSyncExternalStore(
    subscribe,
    () => entries,
    () => EMPTY,
  );
}
