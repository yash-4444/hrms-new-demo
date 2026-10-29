/* ============================================================================
   Reference-data fixtures — lookups, geography, currencies and FX rates.
   Hybrid-scoped: "baseline" rows ship with the platform for every tenant,
   "tenant" rows are Stellar's own additions or overrides.
   ========================================================================== */

export type LookupScope = "baseline" | "tenant";

export interface LookupValue {
  id: string;
  code: string;
  label: string;
  active: boolean;
  scope: LookupScope;
  /** Optional classification, e.g. voluntary / involuntary for separation reasons. */
  tag?: string;
  usage: number;
}

export interface LookupCategory {
  id: string;
  name: string;
  module: string;
  description: string;
  tagLabel?: string;
  tagOptions?: string[];
  values: LookupValue[];
}

let seq = 0;
const v = (code: string, label: string, usage: number, scope: LookupScope = "baseline", active = true, tag?: string): LookupValue => ({
  id: `LV-${++seq}`,
  code,
  label,
  active,
  scope,
  tag,
  usage,
});

export const LOOKUP_CATEGORIES: LookupCategory[] = [
  { id: "blood_group", name: "Blood group", module: "Core HR", description: "Captured for emergency response at branches.", values: [v("A_POS", "A+", 81), v("A_NEG", "A−", 6), v("B_POS", "B+", 98), v("B_NEG", "B−", 7), v("O_POS", "O+", 104), v("O_NEG", "O−", 9), v("AB_POS", "AB+", 27), v("AB_NEG", "AB−", 3), v("UNK", "Prefer not to say", 5, "tenant")] },
  { id: "marital_status", name: "Marital status", module: "Core HR", description: "Used for nominations and insurance dependants.", values: [v("SINGLE", "Single", 151), v("MARRIED", "Married", 176), v("DIVORCED", "Divorced", 6), v("WIDOWED", "Widowed", 2), v("NA", "Prefer not to say", 5, "tenant")] },
  { id: "relationship", name: "Relationship", module: "Core HR", description: "Family members, nominees and emergency contacts.", values: [v("SPOUSE", "Spouse", 176), v("FATHER", "Father", 290), v("MOTHER", "Mother", 301), v("SON", "Son", 88), v("DAUGHTER", "Daughter", 79), v("SIBLING", "Sibling", 44), v("PARTNER", "Domestic partner", 4, "tenant"), v("GUARDIAN", "Legal guardian", 2)] },
  { id: "document_type", name: "Document type", module: "Documents", description: "Drives OCR extraction and expiry reminders.", values: [v("PAN", "PAN card", 340), v("AADHAAR", "Aadhaar (masked)", 334), v("PASSPORT", "Passport", 162), v("DL", "Driving licence", 118), v("DEGREE", "Degree certificate", 296), v("RELIEVING", "Relieving letter", 241), v("VISA", "Work visa (US)", 18, "tenant"), v("PCC", "Police clearance", 22, "tenant", false)] },
  { id: "separation_reason", name: "Separation reason", module: "Exit", description: "Feeds attrition analytics. Classification decides voluntary vs involuntary and regretted attrition.", tagLabel: "Classification", tagOptions: ["Voluntary · regretted", "Voluntary · non-regretted", "Involuntary"], values: [v("BETTER_OPP", "Better opportunity", 21, "baseline", true, "Voluntary · regretted"), v("HIGHER_STUDIES", "Higher studies", 4, "baseline", true, "Voluntary · regretted"), v("RELOCATION", "Relocation", 6, "baseline", true, "Voluntary · non-regretted"), v("PERSONAL", "Personal reasons", 9, "baseline", true, "Voluntary · non-regretted"), v("PERFORMANCE", "Performance", 3, "baseline", true, "Involuntary"), v("MISCONDUCT", "Misconduct", 1, "baseline", true, "Involuntary"), v("REDUNDANCY", "Role redundancy", 2, "tenant", true, "Involuntary"), v("CONTRACT_END", "End of contract", 5, "baseline", true, "Involuntary")] },
  { id: "ticket_category", name: "Ticket category", module: "Helpdesk", description: "Routes helpdesk tickets to the right queue and SLA.", values: [v("PAYROLL", "Payroll & tax", 212), v("LEAVE", "Leave & attendance", 188), v("IT", "IT access", 141, "tenant"), v("BENEFITS", "Insurance & benefits", 76), v("DOCS", "Letters & documents", 94), v("POSH", "Workplace concern (confidential)", 2, "baseline")] },
  { id: "expense_category", name: "Expense category", module: "Expenses", description: "Maps claims to GL codes and policy limits.", values: [v("TRAVEL", "Travel", 402), v("MEALS", "Meals", 611), v("LODGING", "Lodging", 155), v("INTERNET", "Internet reimbursement", 290, "tenant"), v("CLIENT", "Client entertainment", 64), v("LEARNING", "Books & courses", 48, "tenant"), v("FUEL", "Fuel", 0, "baseline", false)] },
  { id: "asset_condition", name: "Asset condition", module: "Assets", description: "Recorded at allocation and return.", values: [v("NEW", "New", 120), v("GOOD", "Good", 384), v("FAIR", "Fair", 71), v("DAMAGED", "Damaged", 12), v("BEYOND_REPAIR", "Beyond economical repair", 4)] },
  { id: "interview_outcome", name: "Interview outcome", module: "Recruitment", description: "Scorecard recommendation per round.", values: [v("STRONG_HIRE", "Strong hire", 38), v("HIRE", "Hire", 112), v("NO_HIRE", "No hire", 164), v("STRONG_NO", "Strong no hire", 27), v("NO_SHOW", "Candidate no-show", 19, "tenant")] },
];

/* -------------------------------------------------------------- geography */

export interface City {
  name: string;
  headcount: number;
  ptApplicable?: boolean;
}

export interface StateRegion {
  code: string;
  name: string;
  ptSlab: string;
  lwf: string;
  cities: City[];
}

export interface Country {
  iso2: string;
  iso3: string;
  name: string;
  currency: string;
  timezone: string;
  dialCode: string;
  regime: string;
  fyStart: string;
  weekStart: string;
  scope: LookupScope;
  states: StateRegion[];
}

export const COUNTRIES: Country[] = [
  {
    iso2: "IN",
    iso3: "IND",
    name: "India",
    currency: "INR",
    timezone: "Asia/Kolkata (UTC+05:30)",
    dialCode: "+91",
    regime: "EPF & MP Act 1952 · ESI Act 1948 · state PT & LWF · Income-tax Act (new regime default)",
    fyStart: "1 April",
    weekStart: "Monday",
    scope: "baseline",
    states: [
      { code: "KA", name: "Karnataka", ptSlab: "₹200/month above ₹25,000 gross", lwf: "₹20 employee + ₹40 employer, yearly", cities: [{ name: "Bengaluru", headcount: 214 }, { name: "Mysuru", headcount: 3 }, { name: "Mangaluru", headcount: 1 }] },
      { code: "MH", name: "Maharashtra", ptSlab: "₹200/month (₹300 in February) above ₹10,000", lwf: "₹12 employee + ₹36 employer, half-yearly", cities: [{ name: "Pune", headcount: 74 }, { name: "Mumbai", headcount: 6 }, { name: "Nagpur", headcount: 0 }] },
      { code: "TS", name: "Telangana", ptSlab: "₹200/month above ₹20,000", lwf: "₹2 employee + ₹5 employer, yearly", cities: [{ name: "Hyderabad", headcount: 26 }] },
      { code: "TN", name: "Tamil Nadu", ptSlab: "Half-yearly slab, max ₹1,250", lwf: "₹20 employee + ₹40 employer, yearly", cities: [{ name: "Chennai", headcount: 2 }, { name: "Coimbatore", headcount: 0 }] },
      { code: "DL", name: "Delhi", ptSlab: "Not levied", lwf: "₹0.75 employee + ₹2.25 employer, half-yearly", cities: [{ name: "New Delhi", headcount: 1 }] },
    ],
  },
  {
    iso2: "US",
    iso3: "USA",
    name: "United States",
    currency: "USD",
    timezone: "America/New_York (UTC−05:00 / −04:00 DST)",
    dialCode: "+1",
    regime: "FICA · FUTA · state unemployment (SUTA) · state income tax · FLSA overtime",
    fyStart: "1 January",
    weekStart: "Sunday",
    scope: "baseline",
    states: [
      { code: "NJ", name: "New Jersey", ptSlab: "Not applicable — state income tax withheld", lwf: "NJ SDI & FLI", cities: [{ name: "Newark", headcount: 13 }, { name: "Jersey City", headcount: 1 }] },
      { code: "NY", name: "New York", ptSlab: "Not applicable — state income tax withheld", lwf: "NY SDI & PFL", cities: [{ name: "New York City", headcount: 0 }] },
    ],
  },
];

/* ------------------------------------------------------------- currencies */

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  minorUnits: number;
  rounding: string;
  isBase: boolean;
  active: boolean;
}

export const CURRENCIES: Currency[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹", minorUnits: 2, rounding: "Nearest rupee on payslips; paise in ledgers", isBase: true, active: true },
  { code: "USD", name: "US Dollar", symbol: "$", minorUnits: 2, rounding: "Nearest cent", isBase: false, active: true },
  { code: "EUR", name: "Euro", symbol: "€", minorUnits: 2, rounding: "Nearest cent", isBase: false, active: true },
  { code: "GBP", name: "Pound Sterling", symbol: "£", minorUnits: 2, rounding: "Nearest penny", isBase: false, active: true },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", minorUnits: 2, rounding: "Nearest fils", isBase: false, active: false },
];

export interface FxRate {
  id: string;
  from: string;
  to: "INR";
  rate: number;
  effectiveFrom: string;
  source: "RBI reference rate" | "Manual" | "FBIL";
  enteredBy: string;
}

const MONTHS = ["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"];
const SERIES: Record<string, number[]> = {
  USD: [83.42, 83.51, 83.38, 83.67, 83.92, 84.06],
  EUR: [90.12, 90.48, 89.97, 91.06, 91.84, 92.21],
  GBP: [105.3, 105.88, 106.12, 106.95, 107.4, 107.18],
  AED: [22.71, 22.74, 22.7, 22.78, 22.85, 22.89],
};

export const FX_RATES: FxRate[] = Object.entries(SERIES)
  .flatMap(([code, rates]) =>
    rates.map((rate, i) => ({
      id: `FX-${code}-${i}`,
      from: code,
      to: "INR" as const,
      rate,
      effectiveFrom: MONTHS[i],
      source: (code === "AED" ? "FBIL" : "RBI reference rate") as FxRate["source"],
      enteredBy: i === 5 ? "Lakshmi Pillai" : "Rahul Desai",
    })),
  )
  .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || a.from.localeCompare(b.from));
