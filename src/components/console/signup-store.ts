"use client";

import * as React from "react";
import { format } from "date-fns";
import { SIGNUP_REQUESTS, type SignupRequest } from "@/mock/console-signups";
import { demoNowMs } from "@/components/app-state";

/* ============================================================================
   Self-serve sign-ups — the requests submitted from /register and the
   console's auto-approve switch, shared by the applicant's status page and
   /console/signups. Unlike every other demo mutation this one is kept in
   localStorage, so the demo survives a full page load and an operator
   deciding in one tab updates the applicant's page in another (the `storage`
   event). No provider to mount: a module-level store read through
   useSyncExternalStore, like the sidebar's remembered groups.

   Every storage access is guarded — private mode or blocked site data then
   keeps the store in memory for the tab. Only the fields below are ever
   written; the applicant's password never reaches this module.
   ========================================================================== */

const KEY = "hrms.signups.v1";

export interface SignupStore {
  /** Self-serve requests, newest first. */
  requests: SignupRequest[];
  /** "Auto-approve Free plan sign-ups that pass all checks". */
  autoApprove: boolean;
}

const EMPTY: SignupStore = { requests: [], autoApprove: false };
const EMPTY_RAW = JSON.stringify(EMPTY);
const listeners = new Set<() => void>();
let memory = EMPTY_RAW;

/** The persisted shape — an allow-list, so nothing else on a request object is ever stored. */
function stored(r: SignupRequest): SignupRequest {
  return {
    id: r.id,
    company: r.company,
    subdomain: r.subdomain,
    industry: r.industry,
    plan: r.plan,
    country: r.country,
    size: r.size,
    adminName: r.adminName,
    adminEmail: r.adminEmail,
    submittedAt: r.submittedAt,
    checks: { ...r.checks },
    status: r.status,
    decidedAt: r.decidedAt,
    decidedBy: r.decidedBy,
    tenantId: r.tenantId,
    rejectReason: r.rejectReason,
    infoRequest: r.infoRequest,
    selfServe: true,
  };
}

/* A missing key is an empty store, not this tab's last copy — another tab may have reset it. */
function readRaw() {
  try {
    return window.localStorage.getItem(KEY) ?? EMPTY_RAW;
  } catch {
    return memory;
  }
}

function parse(raw: string): SignupStore {
  try {
    const v = JSON.parse(raw) as Partial<SignupStore>;
    return { requests: Array.isArray(v.requests) ? v.requests.map(stored) : [], autoApprove: v.autoApprove === true };
  } catch {
    return EMPTY;
  }
}

function write(next: SignupStore) {
  memory = JSON.stringify({ requests: next.requests.map(stored), autoApprove: next.autoApprove });
  try {
    window.localStorage.setItem(KEY, memory);
  } catch {
    /* storage unavailable — the in-memory copy still works for this tab */
  }
  listeners.forEach((l) => l());
}

const update = (fn: (s: SignupStore) => SignupStore) => write(fn(parse(readRaw())));

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The store, re-rendering on every write in this tab and on writes from other tabs. */
export function useSignupStore(): SignupStore {
  const raw = React.useSyncExternalStore(subscribe, readRaw, () => EMPTY_RAW);
  return React.useMemo(() => parse(raw), [raw]);
}

/** Demo-clock timestamp in the fixtures' local wall-clock format. */
export const signupNowIso = () => format(new Date(demoNowMs()), "yyyy-MM-dd'T'HH:mm:ss");

/** Records a new pending request and returns it with its SR reference. */
export function submitSignup(input: Omit<SignupRequest, "id" | "submittedAt" | "status" | "selfServe">): SignupRequest {
  const s = parse(readRaw());
  const last = Math.max(...[...SIGNUP_REQUESTS, ...s.requests].map((r) => Number(r.id.replace(/\D/g, "")) || 0));
  const created = stored({ ...input, id: `SR-${last + 1}`, submittedAt: signupNowIso(), status: "pending" });
  write({ ...s, requests: [created, ...s.requests] });
  return created;
}

export function patchSignup(id: string, patch: Partial<SignupRequest>) {
  update((s) => ({ ...s, requests: s.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
}

export function setSignupAutoApprove(on: boolean) {
  update((s) => ({ ...s, autoApprove: on }));
}

/** Clears every self-serve request so the demo can be rerun; the auto-approve switch stays as it is. */
export function resetSignups() {
  update((s) => ({ ...s, requests: [] }));
}

/** "just now", "4 min ago" — measured on the demo clock, so another tab's slightly later stamp never reads as the future. */
export function sinceSubmitted(iso: string) {
  const minutes = Math.floor((demoNowMs() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ago`;
}
