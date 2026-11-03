import type { ConsoleTenant } from "@/mock/console-tenants";
import type { SignupChecks, SignupRequest } from "@/mock/console-signups";

/* ============================================================================
   Sign-up verification — the checks a registration from /register is given
   on submit, and the subdomain-availability rule both /register (live, while
   the applicant types) and /console/signups (at review) apply. One module so
   the applicant and the operator can never disagree about what "taken" means.

   Email verification is never computed here: it starts false and flips only
   when the applicant opens the link.
   ========================================================================== */

/** Free mailbox providers — a real address, but it proves nothing about the company. */
const WEBMAIL_DOMAINS = new Set(["gmail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "rediffmail.com"]);

/** The disposable-mailbox blocklist. */
const DISPOSABLE_DOMAINS = new Set(["tempinbox.example", "mailinator.com", "yopmail.com", "guerrillamail.com", "10minutemail.com", "trashmail.com"]);

/** Hostnames the platform keeps for itself. */
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "console", "status", "help", "docs", "mail", "auth"]);

/** Legal-form and filler words that never distinguish one company from another. */
const FILLER = new Set(["pvt", "private", "ltd", "limited", "llp", "llc", "inc", "co", "company", "corp", "the", "and", "pte", "group"]);

export const emailDomain = (email: string) => email.trim().toLowerCase().split("@")[1] ?? "";

const companyWords = (name: string) =>
  name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !FILLER.has(w));

/* "textile" and "textiles" are the same word for this purpose. */
const sameStem = (a: string, b: string) => a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a));

/**
 * The email's domain names the company: the domain is the company's first
 * word on its own (cobalt.com), or carries at least two of its words
 * (kaveritextiles.in). One shared word is not enough — nilgiricargo.co.in is
 * not Nilgiri Logistics.
 */
export function domainMatchesCompany(email: string, company: string) {
  const domain = emailDomain(email);
  if (!domain || WEBMAIL_DOMAINS.has(domain) || DISPOSABLE_DOMAINS.has(domain)) return false;
  const label = domain.split(".")[0].replace(/-/g, "");
  const words = companyWords(company);
  if (!words.length) return false;
  if (label === words[0]) return true;
  const hits = words.filter((w) => label.includes(w)).length;
  return words.length === 1 ? hits === 1 : hits >= 2;
}

/** The existing tenant a new company most likely duplicates: same owner domain, or the same name give or take a suffix. */
export function findDuplicateTenant(company: string, email: string, tenants: ConsoleTenant[]): ConsoleTenant | undefined {
  const domain = emailDomain(email);
  const ownDomain = domain && !WEBMAIL_DOMAINS.has(domain) && !DISPOSABLE_DOMAINS.has(domain);
  const [first, ...rest] = companyWords(company);
  return tenants.find((t) => {
    if (ownDomain && emailDomain(t.ownerEmail) === domain) return true;
    const [tFirst, ...tRest] = companyWords(t.name);
    if (!first || !sameStem(first, tFirst ?? "")) return false;
    return (!rest.length && !tRest.length) || rest.some((w) => tRest.some((x) => sameStem(w, x)));
  });
}

/** Every check computed when an application is submitted. */
export function computeSignupChecks(input: { company: string; adminEmail: string }, tenants: ConsoleTenant[]): SignupChecks {
  const domain = emailDomain(input.adminEmail);
  return {
    emailVerified: false,
    domainMatches: domainMatchesCompany(input.adminEmail, input.company),
    disposableEmail: DISPOSABLE_DOMAINS.has(domain),
    duplicateOf: findDuplicateTenant(input.company, input.adminEmail, tenants)?.id,
  };
}

/** A live tenant already owns this subdomain — the check the console applies at review. */
export const isSubdomainTaken = (subdomain: string, tenants: ConsoleTenant[]) => tenants.some((t) => t.subdomain === subdomain);

/**
 * Whether an applicant can claim `subdomain`: free of live tenants, reserved
 * names, and every request still pending or already approved (a pending
 * request holds its name until an operator decides).
 */
export function subdomainAvailability(subdomain: string, tenants: ConsoleTenant[], requests: SignupRequest[]): { available: boolean; reason?: string } {
  if (RESERVED_SUBDOMAINS.has(subdomain)) return { available: false, reason: "is reserved" };
  if (isSubdomainTaken(subdomain, tenants)) return { available: false, reason: "is taken" };
  if (requests.some((r) => r.subdomain === subdomain && r.status !== "rejected")) return { available: false, reason: "is held by another sign-up" };
  return { available: true };
}
