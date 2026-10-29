import { KB_DEFLECTION_TREND } from "./ai";
import { employeeName } from "./employees";
import { SLA_HOURS, TICKET_CATEGORIES, TICKET_PRIORITIES, isTicketOpen } from "./workplace";
import { CHANNELS, QUEUE_TICKETS, SLA_POLICIES } from "./service-helpdesk";
import { differenceInMinutes, parseISO } from "date-fns";

/* ============================================================================
   SERVICE · HELPDESK ANALYTICS — every figure is computed from QUEUE_TICKETS
   (the same tickets on /helpdesk) except the monthly deflection series,
   which is the AI module's KB_DEFLECTION_TREND so the two screens agree.
   ========================================================================== */

const rows = QUEUE_TICKETS;
const resolved = rows.filter((t) => t.status === "resolved" && t.resolvedAt);
const std = SLA_POLICIES[0];

export const HD_VOLUME_BY_CATEGORY = TICKET_CATEGORIES.map((c) => ({
  name: c,
  open: rows.filter((t) => t.category === c && isTicketOpen(t)).length,
  closed: rows.filter((t) => t.category === c && !isTicketOpen(t)).length,
}));

export const HD_VOLUME_BY_CHANNEL = CHANNELS.map((ch) => ({
  name: ch,
  value: rows.filter((t) => t.channel === ch).length,
}));

/** Average first response and resolution (hours) against the standard policy. */
export const HD_TIMES_BY_PRIORITY = TICKET_PRIORITIES.map((p) => {
  const inP = rows.filter((t) => t.priority === p);
  const res = resolved.filter((t) => t.priority === p);
  const target = std.targets.find((x) => x.priority === p)!;
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
  return {
    name: p,
    frt: avg(inP.map((t) => t.firstResponseMins / 60)),
    frtTarget: SLA_HOURS[p],
    resolution: avg(res.map((t) => differenceInMinutes(parseISO(t.resolvedAt!), parseISO(t.createdAt)) / 60)),
    resolutionTarget: target.resolutionHrs,
  };
});

/** Twelve weekly snapshots of open tickets, ending at today's open count. */
const OPEN_NOW = rows.filter(isTicketOpen).length;
export const HD_BACKLOG_TREND = [41, 44, 39, 37, 40, 35, 33, 34, 30, 29, 28, OPEN_NOW].map((open, i) => ({
  week: `W${i + 27}`,
  open,
  target: 30,
}));

export const HD_AGENTS = Array.from(new Set(rows.map((t) => t.assigneeCode))).map((code) => {
  const mine = rows.filter((t) => t.assigneeCode === code);
  const done = mine.filter((t) => t.status === "resolved");
  const rated = done.filter((t) => t.csat !== null);
  return {
    code,
    name: employeeName(code),
    team: mine[0].assigneeTeam,
    assigned: mine.length,
    open: mine.filter(isTicketOpen).length,
    resolved: done.length,
    breached: mine.filter((t) => t.slaState === "sla_breached").length,
    avgFrtMins: Math.round(mine.reduce((s, t) => s + t.firstResponseMins, 0) / mine.length),
    csat: rated.length ? Math.round((rated.reduce((s, t) => s + (t.csat ?? 0), 0) / rated.length) * 10) / 10 : 0,
  };
});

export const HD_CSAT = (() => {
  const rated = rows.filter((t) => t.csat !== null);
  const dist = [5, 4, 3, 2, 1].map((star) => ({ name: `${star}★`, value: rated.filter((t) => t.csat === star).length }));
  return {
    responses: rated.length,
    average: Math.round((rated.reduce((s, t) => s + (t.csat ?? 0), 0) / Math.max(1, rated.length)) * 10) / 10,
    satisfiedPct: (rated.filter((t) => (t.csat ?? 0) >= 4).length / Math.max(1, rated.length)) * 100,
    dist,
  };
})();

export const HD_DEFLECTION = KB_DEFLECTION_TREND.map((m) => ({
  month: m.month,
  deflected: m.deflected,
  raised: m.raised,
  rate: Math.round((m.deflected / (m.deflected + m.raised)) * 1000) / 10,
}));
