import { CONSOLE_TODAY, type ConsoleTenant, type TenantCountry } from "@/mock/console-tenants";

/* ============================================================================
   Platform Console — hybrid-scoped reference data (CLAUDE.md § Multi-Tenancy):
   a row with TenantId NULL is the shared baseline every tenant inherits; a
   tenant's own row overrides it for that tenant only. Shown here: country
   holiday calendars and the Indian statutory rate tables.

   Rates are versioned. A change is a NEW version effective from a future
   date — a version that has taken effect is never edited, because payroll
   already stamped it on the rows it produced. Lunar-calendar dates are the
   expected dates; 2027 lists only fixed-date holidays until gazetted.
   ========================================================================== */

export interface BaselineOverride {
  tenantId: string;
  value: string;
  since: string;
}

/* ------------------------------------------------------------- holidays */

export type HolidayKind = "national" | "regional" | "optional";

export interface BaselineHoliday {
  id: string;
  country: TenantCountry;
  date: string;
  name: string;
  kind: HolidayKind;
  region?: string;
  overrides: BaselineOverride[];
  /** Saved but not yet published to tenants. */
  draft?: boolean;
}

type H = [date: string, name: string, kind: HolidayKind, fixed: boolean, region?: string];

const HOLIDAYS_2026: Record<TenantCountry, H[]> = {
  IN: [
    ["2026-01-14", "Pongal", "regional", false, "Tamil Nadu"],
    ["2026-01-26", "Republic Day", "national", true],
    ["2026-03-04", "Holi", "national", false],
    ["2026-03-20", "Eid ul-Fitr", "national", false],
    ["2026-04-03", "Good Friday", "national", false],
    ["2026-05-01", "Labour Day", "regional", true, "Maharashtra, Karnataka, Tamil Nadu, Kerala"],
    ["2026-08-15", "Independence Day", "national", true],
    ["2026-08-26", "Onam (Thiruvonam)", "regional", false, "Kerala"],
    ["2026-09-14", "Ganesh Chaturthi", "regional", false, "Maharashtra, Karnataka"],
    ["2026-10-02", "Gandhi Jayanti", "national", true],
    ["2026-10-20", "Dussehra", "national", false],
    ["2026-11-08", "Diwali", "national", false],
    ["2026-12-25", "Christmas", "national", true],
  ],
  US: [
    ["2026-01-01", "New Year's Day", "national", true],
    ["2026-01-19", "Martin Luther King Jr. Day", "national", false],
    ["2026-02-16", "Presidents' Day", "national", false],
    ["2026-05-25", "Memorial Day", "national", false],
    ["2026-06-19", "Juneteenth", "national", true],
    ["2026-07-03", "Independence Day (observed)", "national", false],
    ["2026-09-07", "Labor Day", "national", false],
    ["2026-10-12", "Columbus Day", "optional", false],
    ["2026-11-11", "Veterans Day", "national", true],
    ["2026-11-26", "Thanksgiving Day", "national", false],
    ["2026-11-27", "Day after Thanksgiving", "optional", false],
    ["2026-12-25", "Christmas Day", "national", true],
  ],
  AE: [
    ["2026-01-01", "New Year's Day", "national", true],
    ["2026-03-20", "Eid al-Fitr (20–22 Mar)", "national", false],
    ["2026-05-26", "Arafat Day", "national", false],
    ["2026-05-27", "Eid al-Adha (27–29 May)", "national", false],
    ["2026-06-16", "Islamic New Year", "national", false],
    ["2026-08-25", "Prophet's Birthday", "national", false],
    ["2026-12-01", "Commemoration Day", "national", true],
    ["2026-12-02", "National Day (2–3 Dec)", "national", true],
  ],
  SG: [
    ["2026-01-01", "New Year's Day", "national", true],
    ["2026-02-17", "Chinese New Year (17–18 Feb)", "national", false],
    ["2026-03-21", "Hari Raya Puasa", "national", false],
    ["2026-04-03", "Good Friday", "national", false],
    ["2026-05-01", "Labour Day", "national", true],
    ["2026-05-27", "Hari Raya Haji", "national", false],
    ["2026-06-01", "Vesak Day (observed)", "national", false],
    ["2026-08-10", "National Day (observed)", "national", false],
    ["2026-11-09", "Deepavali (observed)", "national", false],
    ["2026-12-25", "Christmas Day", "national", true],
  ],
};

const HOLIDAY_OVERRIDES: Record<string, BaselineOverride[]> = {
  "IN-2026-01-14": [{ tenantId: "TN-1017", value: "Adopted for all locations, not only Tamil Nadu", since: "2025-12-10" }],
  "IN-2026-03-04": [{ tenantId: "TN-1003", value: "Moved to 03 Mar (Holika Dahan) for hotel staff", since: "2026-01-05" }],
  "IN-2026-03-20": [{ tenantId: "TN-1007", value: "Observed 21 Mar after moon sighting", since: "2026-03-19" }],
  "IN-2026-04-03": [{ tenantId: "TN-1008", value: "Removed — replaced by Ugadi (19 Mar)", since: "2025-12-18" }],
  "IN-2026-08-26": [{ tenantId: "TN-1007", value: "Adopted as a holiday at every location", since: "2025-12-02" }],
  "IN-2026-09-14": [{ tenantId: "TN-1014", value: "Two days: 14–15 Sep at Pune plants", since: "2026-01-12" }],
  "IN-2026-11-08": [
    { tenantId: "TN-1001", value: "Observed Mon 09 Nov (falls on a Sunday)", since: "2026-01-08" },
    { tenantId: "TN-1014", value: "Observed Mon 09 Nov (falls on a Sunday)", since: "2026-01-12" },
    { tenantId: "TN-1033", value: "Two days: 09–10 Nov", since: "2026-02-03" },
  ],
  "US-2026-10-12": [{ tenantId: "TN-1023", value: "Renamed Indigenous Peoples' Day", since: "2025-12-15" }],
  "US-2026-11-27": [
    { tenantId: "TN-1024", value: "Full paid holiday, not optional", since: "2025-12-20" },
    { tenantId: "TN-1038", value: "Full paid holiday, not optional", since: "2026-06-02" },
  ],
  "AE-2026-03-20": [{ tenantId: "TN-1027", value: "Extended to 4 days for site staff", since: "2026-03-18" }],
  "SG-2026-02-17": [{ tenantId: "TN-1030", value: "Plus a half-day on the eve (16 Feb)", since: "2026-01-20" }],
};

export const BASELINE_YEARS = [2026, 2027] as const;

export const BASELINE_HOLIDAYS: BaselineHoliday[] = (Object.keys(HOLIDAYS_2026) as TenantCountry[]).flatMap((country) =>
  HOLIDAYS_2026[country].flatMap(([date, name, kind, fixed, region]) => {
    const row = (d: string): BaselineHoliday => ({ id: `${country}-${d}`, country, date: d, name, kind, region, overrides: HOLIDAY_OVERRIDES[`${country}-${d}`] ?? [] });
    return fixed ? [row(date), row(date.replace("2026", "2027"))] : [row(date)];
  }),
);

/* -------------------------------------------------------- statutory rates */

export type RateKind = "PF" | "ESI" | "PT" | "LWF" | "TDS";

export interface StatutoryRate {
  id: string;
  /** Versions of the same rule share a series. */
  series: string;
  kind: RateKind;
  component: string;
  /** "All India" or the state. */
  scope: string;
  value: string;
  effectiveFrom: string;
  version: number;
  overrides: BaselineOverride[];
  draft?: boolean;
}

type R = [series: string, kind: RateKind, component: string, scope: string, value: string, from: string, version: number];

const RATES: R[] = [
  ["pf-ee", "PF", "Employee contribution", "All India", "12% of PF wages", "2014-09-01", 1],
  ["pf-ceiling", "PF", "PF wage ceiling", "All India", "₹6,500 / month", "2001-06-01", 1],
  ["pf-ceiling", "PF", "PF wage ceiling", "All India", "₹15,000 / month", "2014-09-01", 2],
  ["pf-eps", "PF", "Employer — pension (EPS)", "All India", "8.33%, capped at ₹1,250 / month", "2014-09-01", 1],
  ["pf-admin", "PF", "Admin charges", "All India", "0.65% of PF wages", "2015-01-01", 1],
  ["pf-admin", "PF", "Admin charges", "All India", "0.50% of PF wages, minimum ₹500", "2018-06-01", 2],
  ["esi-ee", "ESI", "Employee contribution", "All India", "1.75% of gross", "2017-01-01", 1],
  ["esi-ee", "ESI", "Employee contribution", "All India", "0.75% of gross", "2019-07-01", 2],
  ["esi-er", "ESI", "Employer contribution", "All India", "4.75% of gross", "2017-01-01", 1],
  ["esi-er", "ESI", "Employer contribution", "All India", "3.25% of gross", "2019-07-01", 2],
  ["esi-ceiling", "ESI", "ESI wage ceiling", "All India", "₹21,000 / month", "2017-01-01", 1],
  ["pt-ka", "PT", "Professional tax", "Karnataka", "₹200 / month above ₹15,000 gross", "2018-04-01", 1],
  ["pt-ka", "PT", "Professional tax", "Karnataka", "₹200 / month above ₹25,000 gross", "2025-04-01", 2],
  ["pt-mh", "PT", "Professional tax", "Maharashtra", "₹200 / month (₹300 in Feb) above ₹10,000; women to ₹25,000 exempt", "2023-07-01", 1],
  ["pt-tn", "PT", "Professional tax", "Tamil Nadu", "Half-yearly slabs, up to ₹1,250", "2024-04-01", 1],
  ["pt-wb", "PT", "Professional tax", "West Bengal", "₹200 / month above ₹40,000", "2023-04-01", 1],
  ["pt-ts", "PT", "Professional tax", "Telangana", "₹200 / month above ₹20,000", "2016-04-01", 1],
  ["lwf-mh", "LWF", "Labour welfare fund", "Maharashtra", "₹25 employee / ₹75 employer, June and December", "2024-07-01", 1],
  ["lwf-ka", "LWF", "Labour welfare fund", "Karnataka", "₹50 employee / ₹100 employer, annually in January", "2021-01-01", 1],
  ["lwf-tn", "LWF", "Labour welfare fund", "Tamil Nadu", "₹20 employee / ₹40 employer, annually in January", "2022-01-01", 1],
  ["tds-new", "TDS", "Slabs — new regime", "All India", "0–3L nil · 3–7L 5% · 7–10L 10% · 10–12L 15% · 12–15L 20% · >15L 30%", "2024-04-01", 1],
  ["tds-new", "TDS", "Slabs — new regime", "All India", "0–4L nil · 4–8L 5% · 8–12L 10% · 12–16L 15% · 16–20L 20% · 20–24L 25% · >24L 30%", "2025-04-01", 2],
  ["tds-87a", "TDS", "Rebate u/s 87A — new regime", "All India", "Up to ₹60,000; no tax to ₹12,00,000 taxable", "2025-04-01", 1],
  ["tds-sd", "TDS", "Standard deduction — new regime", "All India", "₹75,000", "2024-04-01", 1],
];

const RATE_OVERRIDES: Record<string, BaselineOverride[]> = {
  "pf-ceiling-2": [
    { tenantId: "TN-1003", value: "Contribute on full basic, no ceiling", since: "2024-01-18" },
    { tenantId: "TN-1021", value: "Contribute on full basic, no ceiling", since: "2024-08-11" },
    { tenantId: "TN-1036", value: "Contribute on full basic, no ceiling", since: "2026-01-20" },
  ],
  "lwf-mh-1": [{ tenantId: "TN-1014", value: "Employer also bears the employee share", since: "2024-07-01" }],
};

export const STATUTORY_RATES: StatutoryRate[] = RATES.map(([series, kind, component, scope, value, from, version]) => ({
  id: `${series}-${version}`,
  series,
  kind,
  component,
  scope,
  value,
  effectiveFrom: from,
  version,
  overrides: RATE_OVERRIDES[`${series}-${version}`] ?? [],
}));

export type RateStatus = "current" | "superseded" | "scheduled";

/** The day before the next version in the series takes effect, if any. */
export function effectiveTo(rate: StatutoryRate, all: StatutoryRate[]) {
  const next = all.filter((r) => r.series === rate.series && r.version > rate.version).sort((a, b) => a.version - b.version)[0];
  if (!next) return null;
  const d = new Date(`${next.effectiveFrom}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function rateStatus(rate: StatutoryRate, all: StatutoryRate[]): RateStatus {
  if (rate.effectiveFrom > CONSOLE_TODAY) return "scheduled";
  const to = effectiveTo(rate, all);
  return to && to < CONSOLE_TODAY ? "superseded" : "current";
}

/* -------------------------------------------------------- inheritance */

const subscribed = (t: ConsoleTenant) => t.status !== "churned" && t.status !== "scheduled_deletion";

/** Tenants that read this country's holiday baseline. */
export const holidayAudience = (tenants: ConsoleTenant[], country: TenantCountry) => tenants.filter((t) => subscribed(t) && t.country === country);

/** Tenants that run Indian payroll and so read the statutory baseline. */
export const rateAudience = (tenants: ConsoleTenant[]) => tenants.filter((t) => subscribed(t) && t.country === "IN" && t.modules.includes("payroll"));
