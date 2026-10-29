import { addDays, format, parseISO } from "date-fns";
import { employeeByCode } from "./employees";
import { assetsFor } from "./workplace";
import { LOANS } from "./finance-loans";
import type { RoleId } from "@/lib/rbac";
import { daysToLwd, type Separation } from "./lifecycle-exit";

/* ============================================================================
   Clearance matrix — one row per department, items under it, each signed off
   by the persona who owns that desk. Assets are read from the asset register,
   loans from the loan book, so recovery amounts are never invented here.
   ========================================================================== */

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export type ClearanceDept = "Manager" | "IT" | "Admin & Assets" | "Finance" | "Payroll" | "HR";
export const CLEARANCE_DEPTS: ClearanceDept[] = ["Manager", "IT", "Admin & Assets", "Finance", "Payroll", "HR"];

/** Which personas may sign off a department's items. */
export const CLEARANCE_SIGNERS: Record<ClearanceDept, RoleId[]> = {
  Manager: ["manager", "hr_admin"],
  IT: ["it_admin"],
  "Admin & Assets": ["helpdesk_agent", "it_admin"],
  Finance: ["finance_controller"],
  Payroll: ["payroll_admin"],
  HR: ["hr_admin"],
};

export const DEPT_SIGNER_NAME: Record<ClearanceDept, string> = {
  Manager: "Reporting manager",
  IT: "Girish Gowda",
  "Admin & Assets": "Ishita Kulkarni",
  Finance: "Lakshmi Pillai",
  Payroll: "Rahul Desai",
  HR: "Priya Menon",
};

export type ClearanceStatus = "cleared" | "pending" | "recovery";

export interface ClearanceItem {
  id: string;
  dept: ClearanceDept;
  label: string;
  detail: string;
  status: ClearanceStatus;
  /** Amount to recover in F&F when the item cannot be cleared. */
  recovery: number;
  signedBy: string | null;
  signedOn: string | null;
  assetTag?: string;
}

/** Clearance opens 15 days before the last working day. */
export const clearanceOpensOn = (s: Separation) => iso(addDays(parseISO(s.lwd), -15));
export const clearanceOpen = (s: Separation) => s.status === "clearance" || s.status === "completed";

const activeLoan = (code: string) => LOANS.find((l) => l.employeeCode === code && l.status === "active" && l.outstanding > 0);

export function clearanceFor(s: Separation): ClearanceItem[] {
  const managerName = employeeByCode(s.managerCode)?.name ?? "Reporting manager";
  const assets = s.former ? [] : assetsFor(s.code);
  const laptop = assets.filter((a) => a.category === "Laptop");
  const other = assets.filter((a) => a.category !== "Laptop");
  const loan = s.former ? undefined : activeLoan(s.code);

  const raw: Omit<ClearanceItem, "id" | "status" | "signedBy" | "signedOn" | "recovery">[] = [
    { dept: "Manager", label: "Knowledge transfer complete", detail: "Handover document reviewed and filed." },
    { dept: "Manager", label: "Open work reassigned", detail: "Tickets, accounts and on-call rotations moved to named owners." },
    ...laptop.map((a) => ({ dept: "IT" as const, label: `Laptop returned — ${a.make} ${a.model}`, detail: `${a.tag} · serial ${a.serial}`, assetTag: a.tag })),
    { dept: "IT", label: "Email, SSO and VPN deactivation scheduled", detail: "Accounts disabled at 18:00 on the last working day; mailbox retained 90 days." },
    { dept: "IT", label: "SaaS licences reclaimed", detail: "GitHub, Slack, Google Workspace and Jira seats released." },
    ...other.map((a) => ({ dept: "Admin & Assets" as const, label: `${a.category} returned — ${a.make} ${a.model}`, detail: a.tag, assetTag: a.tag })),
    ...(other.some((a) => a.category === "Access Card") ? [] : [{ dept: "Admin & Assets" as const, label: "ID and access card surrendered", detail: "Badge deactivated at the reception desk." }]),
    { dept: "Admin & Assets", label: "Locker and desk keys returned", detail: "Desk pedestal key and locker key." },
    { dept: "Finance", label: "Expense and travel advances settled", detail: "No open advances against this employee." },
    loan
      ? { dept: "Finance" as const, label: `Loan ${loan.id} outstanding`, detail: `${loan.purpose} — balance recovered in F&F.` }
      : { dept: "Finance" as const, label: "No outstanding loans", detail: "Loan book checked." },
    { dept: "Payroll", label: "Final salary inputs locked", detail: "LOP, overtime and reimbursements up to the last working day." },
    { dept: "Payroll", label: "PF exit date and Form 13 / Form 19", detail: "Exit date updated on the EPFO portal." },
    { dept: "HR", label: "Exit interview", detail: "Conducted by HR business partner." },
    { dept: "HR", label: "Relieving and experience letters", detail: "Issued on the last working day once clearance is complete." },
  ];

  const recoveryFor = (label: string) => s.recoveries.find((r) => label.toLowerCase().includes(r.label.split(" ")[0].toLowerCase()));

  return raw.map((r, i) => {
    const id = `${s.id}-C${String(i + 1).padStart(2, "0")}`;
    let status: ClearanceStatus = "pending";
    if (s.status === "completed") status = "cleared";
    else if (s.status === "clearance") {
      /* Mid-clearance: manager and finance have signed, the rest are moving. */
      const days = daysToLwd(s);
      const cleared = r.dept === "Manager" || (r.dept === "Finance" && !r.label.startsWith("Loan")) || (r.dept === "IT" && days < 8 && !r.label.startsWith("Laptop"));
      status = cleared ? "cleared" : "pending";
    }
    const rec = recoveryFor(r.label);
    const loanRec = r.label.startsWith("Loan") && loan ? loan.outstanding : 0;
    if (status === "pending" && (rec || loanRec) && s.status === "clearance") status = "recovery";
    const signer = r.dept === "Manager" ? managerName : DEPT_SIGNER_NAME[r.dept];
    return {
      ...r,
      id,
      status,
      recovery: rec?.amount ?? loanRec,
      signedBy: status === "cleared" ? signer : null,
      signedOn: status === "cleared" ? iso(addDays(parseISO(s.lwd), s.status === "completed" ? -1 : -15 + (i % 3))) : null,
    };
  });
}

/** Recoveries raised during clearance that are not loans (loans are their own F&F line). */
export const assetRecoveries = (s: Separation) => s.recoveries;
export const loanOutstanding = (s: Separation) => (s.former ? 0 : (activeLoan(s.code)?.outstanding ?? 0));
