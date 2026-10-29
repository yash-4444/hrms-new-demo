import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  parseISO,
} from "date-fns";
import { mulberry32, pick, randInt, round2, sum } from "@/lib/utils";
import { DEMO_NOW, DEMO_TODAY, deptName } from "./org";
import { EMPLOYEES, employeeByCode, employeeName } from "./employees";

/* ============================================================================
   WORKPLACE fixtures — assets, expense claims, travel, helpdesk, announcements.

   Every value below is derived from a fixed seed and from DEMO_NOW, never from
   the wall clock, so the server render and the client hydration agree exactly.
   SLA countdowns are minutes measured against DEMO_NOW.
   ========================================================================== */

const NOW = parseISO(DEMO_NOW);
const TODAY = parseISO(DEMO_TODAY);

const iso = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss");
const isoDate = (d: Date) => format(d, "yyyy-MM-dd");

/** A seeded timestamp that would land after DEMO_NOW is pulled back to `hoursBefore` it. */
const notAfterNow = (d: Date, hoursBefore: number) => (d > NOW ? addHours(NOW, -hoursBefore) : d);

/** The six demo personas, in top-bar order — everything is seeded so each one
 *  has assets to hold, claims to file and tickets to read. */
export const PERSONA_EMPLOYEE_CODES = [
  "STL-0142", // Ananya Rao      — Employee
  "STL-0031", // Vikram Shah     — Reporting Manager
  "STL-0009", // Priya Menon     — HR Admin
  "STL-0017", // Rahul Desai     — Payroll Admin
  "STL-0058", // Sana Iqbal      — Recruiter
  "STL-0001", // Arjun Kapoor    — Tenant Owner
] as const;

const ACTIVE = EMPLOYEES.filter((e) => e.status !== "exited");

/* ==========================================================================
   1 · ASSET REGISTER
   ========================================================================== */

export type AssetCategory =
  | "Laptop"
  | "Monitor"
  | "Phone"
  | "Access Card"
  | "Headset"
  | "Docking Station"
  | "Tablet";

export const ASSET_CATEGORIES: AssetCategory[] = [
  "Laptop",
  "Monitor",
  "Phone",
  "Access Card",
  "Headset",
  "Docking Station",
  "Tablet",
];

export type AssetCondition = "New" | "Excellent" | "Good" | "Fair" | "Needs repair";

/** Only keys that exist in STATUS_MAP. */
export type AssetStatus = "allocated" | "in_stock" | "under_repair" | "retired" | "lost";

export interface Asset {
  id: string;
  tag: string;
  category: AssetCategory;
  make: string;
  model: string;
  serial: string;
  purchaseDate: string;
  purchaseCost: number;
  warrantyExpiry: string;
  inWarranty: boolean;
  condition: AssetCondition;
  status: AssetStatus;
  allocatedTo: string | null;
  allocatedToName: string;
  allocatedOn: string | null;
  branchId: string;
  location: string;
  vendor: string;
  /** Searchable flat string so the DataTable free-text search covers everything. */
  search: string;
}

interface AssetModel {
  make: string;
  model: string;
  cost: number;
  warrantyMonths: number;
  vendor: string;
}

const ASSET_MODELS: Record<AssetCategory, AssetModel[]> = {
  Laptop: [
    { make: "Apple", model: 'MacBook Pro 14" M4', cost: 209900, warrantyMonths: 36, vendor: "Redington India" },
    { make: "Dell", model: "Latitude 5450", cost: 98400, warrantyMonths: 36, vendor: "Dell Direct Enterprise" },
    { make: "Lenovo", model: "ThinkPad T14 Gen 5", cost: 112500, warrantyMonths: 36, vendor: "Ingram Micro" },
  ],
  Monitor: [
    { make: "Dell", model: 'UltraSharp U2723QE 27" 4K', cost: 42600, warrantyMonths: 36, vendor: "Dell Direct Enterprise" },
    { make: "LG", model: '27UP850N-W 27" UHD', cost: 33900, warrantyMonths: 24, vendor: "Supertron Distributors" },
  ],
  Phone: [
    { make: "Apple", model: "iPhone 15 128 GB", cost: 79900, warrantyMonths: 12, vendor: "Redington India" },
    { make: "Samsung", model: "Galaxy A55 5G", cost: 39999, warrantyMonths: 24, vendor: "Supertron Distributors" },
  ],
  "Access Card": [
    { make: "HID Global", model: "iCLASS SE Proximity Card", cost: 480, warrantyMonths: 60, vendor: "Securens Facility Services" },
  ],
  Headset: [
    { make: "Jabra", model: "Evolve2 65 UC Stereo", cost: 18500, warrantyMonths: 24, vendor: "Ingram Micro" },
    { make: "Logitech", model: "Zone Vibe 100", cost: 9200, warrantyMonths: 24, vendor: "Ingram Micro" },
  ],
  "Docking Station": [
    { make: "Dell", model: "WD22TB4 Thunderbolt Dock", cost: 27800, warrantyMonths: 36, vendor: "Dell Direct Enterprise" },
  ],
  Tablet: [
    { make: "Apple", model: 'iPad Air 11" M2', cost: 64900, warrantyMonths: 12, vendor: "Redington India" },
  ],
};

const ASSET_COUNTS: Record<AssetCategory, number> = {
  Laptop: 60,
  Monitor: 38,
  Phone: 20,
  "Access Card": 28,
  Headset: 22,
  "Docking Station": 8,
  Tablet: 4,
}; // = 180 generated, plus the persona kit appended below

const CONDITIONS: AssetCondition[] = ["New", "Excellent", "Good", "Good", "Fair"];

const SERIAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

function serialFor(rng: () => number, prefix: string, len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += SERIAL_ALPHABET[Math.floor(rng() * SERIAL_ALPHABET.length)];
  return `${prefix}${s}`;
}

function generateAssets(): Asset[] {
  const rng = mulberry32(90210);
  const out: Asset[] = [];
  let n = 0;

  for (const category of ASSET_CATEGORIES) {
    const count = ASSET_COUNTS[category];
    const models = ASSET_MODELS[category];

    for (let i = 0; i < count; i++) {
      n += 1;
      const tag = `STL-AST-${String(n).padStart(4, "0")}`;
      const m = models[i % models.length];

      /* Purchases spread over the last four financial years. */
      const purchaseDate = addDays(parseISO("2022-04-05"), randInt(rng, 0, 1580));
      const warrantyExpiry = addMonths(purchaseDate, m.warrantyMonths);

      /* The first six of each of the five "issued to a person" categories go to
         the demo personas, so every persona's "My assets" tab has content. */
      const personaSlot =
        i < PERSONA_EMPLOYEE_CODES.length &&
        category !== "Docking Station" &&
        category !== "Tablet"
          ? PERSONA_EMPLOYEE_CODES[i]
          : null;

      const roll = rng();
      let status: AssetStatus = personaSlot
        ? "allocated"
        : roll < 0.71
          ? "allocated"
          : roll < 0.89
            ? "in_stock"
            : roll < 0.945
              ? "under_repair"
              : roll < 0.99
                ? "retired"
                : "lost";

      /* An asset out of warranty for years is retired, not sitting in stock. */
      if (status === "in_stock" && warrantyExpiry < parseISO("2025-01-01")) status = "retired";

      const holderCode =
        personaSlot ?? (status === "allocated" ? ACTIVE[Math.floor(rng() * ACTIVE.length)].code : null);
      const holder = holderCode ? employeeByCode(holderCode) : undefined;

      const condition: AssetCondition =
        status === "under_repair" ? "Needs repair" : status === "retired" ? "Fair" : pick(rng, CONDITIONS);

      const allocatedOn =
        status === "allocated"
          ? isoDate(addDays(purchaseDate, randInt(rng, 2, 120)))
          : null;

      const branchId = holder?.branchId ?? pick(rng, ["BLR", "BLR", "PNQ", "EWR"]);
      const location =
        status === "in_stock"
          ? branchId === "PNQ"
            ? "Pune · IT Store Room 2F"
            : branchId === "EWR"
              ? "Newark · Ops Cabinet"
              : "Bengaluru · IT Store Room 7F"
          : status === "under_repair"
            ? `${m.make} Authorised Service Centre`
            : (holder?.location ?? "Bengaluru");

      out.push({
        id: tag,
        tag,
        category,
        make: m.make,
        model: m.model,
        serial: serialFor(rng, category === "Access Card" ? "HID" : m.make.slice(0, 2).toUpperCase(), 9),
        purchaseDate: isoDate(purchaseDate),
        purchaseCost: m.cost,
        warrantyExpiry: isoDate(warrantyExpiry),
        inWarranty: warrantyExpiry > TODAY,
        condition,
        status,
        allocatedTo: status === "allocated" ? holderCode : null,
        allocatedToName: status === "allocated" && holderCode ? employeeName(holderCode) : "—",
        allocatedOn,
        branchId,
        location,
        vendor: m.vendor,
        search: [tag, category, m.make, m.model, status === "allocated" && holderCode ? employeeName(holderCode) : ""]
          .join(" ")
          .toLowerCase(),
      });
    }
  }
  return out;
}

/** Issued kit for the five personas added after the register was generated.
 *  Appended (STL-AST-0181 onward) so every earlier tag, and every derivation
 *  that indexes into the generated register, stays exactly where it was. */
const EXTRA_PERSONA_ISSUES: [code: string, category: AssetCategory, model: number, purchased: string, allocated: string][] = [
  ["STL-0008", "Laptop", 0, "2025-06-10", "2025-06-16"],
  ["STL-0008", "Access Card", 0, "2023-01-09", "2023-01-12"],
  ["STL-0005", "Laptop", 0, "2025-02-03", "2025-02-07"],
  ["STL-0005", "Access Card", 0, "2023-01-09", "2023-01-12"],
  ["STL-0305", "Laptop", 2, "2023-11-14", "2023-11-28"],
  ["STL-0305", "Access Card", 0, "2023-11-20", "2023-11-28"],
  ["STL-0010", "Laptop", 2, "2024-08-19", "2024-08-22"],
  ["STL-0010", "Phone", 0, "2025-10-06", "2025-10-08"],
  ["STL-0010", "Access Card", 0, "2023-01-09", "2023-01-12"],
  ["STL-0296", "Laptop", 1, "2024-04-15", "2024-04-22"],
  ["STL-0296", "Access Card", 0, "2023-01-16", "2023-01-18"],
];

function extraPersonaAssets(startAt: number): Asset[] {
  const rng = mulberry32(48151);
  return EXTRA_PERSONA_ISSUES.map(([code, category, modelIdx, purchased, allocated], i) => {
    const tag = `STL-AST-${String(startAt + i).padStart(4, "0")}`;
    const m = ASSET_MODELS[category][modelIdx];
    const holder = employeeByCode(code)!;
    const warrantyExpiry = addMonths(parseISO(purchased), m.warrantyMonths);
    return {
      id: tag,
      tag,
      category,
      make: m.make,
      model: m.model,
      serial: serialFor(rng, category === "Access Card" ? "HID" : m.make.slice(0, 2).toUpperCase(), 9),
      purchaseDate: purchased,
      purchaseCost: m.cost,
      warrantyExpiry: isoDate(warrantyExpiry),
      inWarranty: warrantyExpiry > TODAY,
      condition: warrantyExpiry > TODAY ? "Excellent" : "Good",
      status: "allocated",
      allocatedTo: code,
      allocatedToName: holder.name,
      allocatedOn: allocated,
      branchId: holder.branchId,
      location: holder.location,
      vendor: m.vendor,
      search: [tag, category, m.make, m.model, holder.name].join(" ").toLowerCase(),
    } satisfies Asset;
  });
}

const GENERATED_ASSETS = generateAssets();
export const ASSETS: Asset[] = [...GENERATED_ASSETS, ...extraPersonaAssets(GENERATED_ASSETS.length + 1)];

export const assetsFor = (employeeCode: string) => ASSETS.filter((a) => a.allocatedTo === employeeCode);

export const ASSET_STATS = (() => {
  const by = (s: AssetStatus) => ASSETS.filter((a) => a.status === s).length;
  const allocated = by("allocated");
  return {
    total: ASSETS.length,
    allocated,
    inStock: by("in_stock"),
    underRepair: by("under_repair"),
    retired: by("retired"),
    lost: by("lost"),
    utilisation: (allocated / ASSETS.length) * 100,
    bookValue: sum(ASSETS.filter((a) => a.status !== "retired").map((a) => a.purchaseCost)),
    outOfWarranty: ASSETS.filter((a) => !a.inWarranty && a.status !== "retired").length,
  };
})();

/** Donut source: how the register splits by category. */
export const ASSETS_BY_CATEGORY = ASSET_CATEGORIES.map((c) => ({
  name: c,
  value: ASSETS.filter((a) => a.category === c).length,
}));

/** Stacked-bar source: allocated vs in-stock per category. */
export const ASSET_ALLOCATION_BY_CATEGORY = ASSET_CATEGORIES.map((c) => {
  const rows = ASSETS.filter((a) => a.category === c);
  return {
    category: c,
    allocated: rows.filter((a) => a.status === "allocated").length,
    in_stock: rows.filter((a) => a.status === "in_stock").length,
    unavailable: rows.filter((a) => !["allocated", "in_stock"].includes(a.status)).length,
  };
});

/* ==========================================================================
   2 · EXPENSE CLAIMS
   ========================================================================== */

export type ExpenseCategory =
  | "Travel – Air"
  | "Travel – Cab"
  | "Accommodation"
  | "Meals"
  | "Client Entertainment"
  | "Internet & Telecom"
  | "Office Supplies"
  | "Training";

export interface ExpensePolicy {
  category: ExpenseCategory;
  limit: number;
  basis: string;
}

/** The reimbursement policy the inline violation warning quotes verbatim. */
export const EXPENSE_POLICY: ExpensePolicy[] = [
  { category: "Travel – Air", limit: 18000, basis: "per sector, economy class" },
  { category: "Travel – Cab", limit: 2500, basis: "per trip" },
  { category: "Accommodation", limit: 6500, basis: "per night, metro cities" },
  { category: "Meals", limit: 1200, basis: "per day, per person" },
  { category: "Client Entertainment", limit: 5000, basis: "per event" },
  { category: "Internet & Telecom", limit: 1500, basis: "per month" },
  { category: "Office Supplies", limit: 3000, basis: "per claim" },
  { category: "Training", limit: 25000, basis: "per course, pre-approval required" },
];

export const EXPENSE_CATEGORIES = EXPENSE_POLICY.map((p) => p.category);

export const policyFor = (category: string) => EXPENSE_POLICY.find((p) => p.category === category);

export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected" | "cancelled" | "completed";

export interface ExpenseLine {
  id: string;
  category: ExpenseCategory;
  date: string;
  description: string;
  amount: number;
  receipt: string;
  receiptKind: "photo" | "pdf";
  /** Policy cap that applies to this line, and by how much the line clears it. */
  limit: number;
  limitBasis: string;
  excess: number;
  violation: boolean;
}

export interface ExpenseClaim {
  id: string;
  claimNo: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  purpose: string;
  periodFrom: string;
  periodTo: string;
  lines: ExpenseLine[];
  total: number;
  status: ExpenseStatus;
  submittedOn: string | null;
  approverCode: string;
  approverName: string;
  decidedOn: string | null;
  decisionNote: string | null;
  reimbursedOn: string | null;
  violationCount: number;
  hasViolation: boolean;
  search: string;
}

const EXPENSE_DESCRIPTIONS: Record<ExpenseCategory, string[]> = {
  "Travel – Air": [
    "IndiGo 6E-2134 Bengaluru → Mumbai, customer QBR",
    "Air India AI-505 Bengaluru → Delhi, partner summit",
    "Vistara UK-864 Pune → Hyderabad, delivery review",
    "IndiGo 6E-777 Bengaluru → Chennai, on-site UAT",
  ],
  "Travel – Cab": [
    "Uber — Bellandur office to Kempegowda airport",
    "Ola Prime — Mumbai airport to Bandra Kurla Complex",
    "Meru — hotel to client office, three trips over two days",
    "Uber — Viman Nagar to Hinjewadi, vendor meeting",
  ],
  Accommodation: [
    "Lemon Tree Premier, Mumbai — 2 nights",
    "Taj Yeshwantpur, Bengaluru — 1 night, customer workshop",
    "Novotel Hyderabad — 3 nights, delivery review",
    "Courtyard by Marriott, Newark NJ — 2 nights",
  ],
  Meals: [
    "Team dinner during the release weekend",
    "Working lunch with the Tata Digital integration team",
    "Breakfast and dinner, day two of the on-site",
    "Meals during the Pune delivery review",
  ],
  "Client Entertainment": [
    "Dinner with Fincraft procurement team, 4 attendees",
    "Post-go-live dinner with the Apollo Retail steering group",
    "Lunch with the Zeta Payments evaluation committee",
  ],
  "Internet & Telecom": [
    "ACT Fibernet broadband — home office, September",
    "Airtel postpaid — international roaming during the Newark trip",
    "Jio Fiber 300 Mbps — home office, August",
  ],
  "Office Supplies": [
    "Ergonomic footrest and laptop riser for the home desk",
    "Whiteboard markers, sticky notes and A3 pads for the design studio",
    "Standing-desk converter for the Pune hot desk",
  ],
  Training: [
    "Certified Kubernetes Administrator exam and prep course",
    "AWS Solutions Architect Professional certification voucher",
    "Advanced negotiation workshop — two-day cohort",
  ],
};

const EXPENSE_PURPOSES = [
  "Customer QBR travel — Tata Digital, Mumbai",
  "On-site UAT support — Apollo Retail, Chennai",
  "Monthly home-office and connectivity reimbursement",
  "Partner summit attendance — Delhi",
  "Delivery review with the Pune engineering pod",
  "Newark office onboarding trip",
  "Certification reimbursement under the L&D policy",
  "Client escalation visit — Fincraft, Mumbai",
  "Quarterly design studio supplies",
  "Recruiting drive — campus visit, Manipal",
];

const RECEIPT_STEMS = [
  "IMG_2471",
  "IMG_3390",
  "scan_receipt_08",
  "invoice-oct",
  "uber-trip-receipt",
  "hotel-folio",
  "amex-statement-extract",
  "vendor-bill",
];

/** Claims that must breach policy, so the inline violation warning always shows. */
const FORCED_VIOLATIONS = new Set([3, 11, 19, 28, 36, 44]);

function generateClaims(): ExpenseClaim[] {
  const rng = mulberry32(5150);
  const out: ExpenseClaim[] = [];

  /* A pool weighted towards Vikram Shah's engineering team, so the manager
     persona's approval queue is never empty. */
  const pool = [
    ...PERSONA_EMPLOYEE_CODES,
    "STL-0143", "STL-0144", "STL-0145", "STL-0146", "STL-0147", "STL-0148", "STL-0149",
    ...ACTIVE.filter((e) => e.level >= 2).slice(0, 40).map((e) => e.code),
  ];

  for (let i = 0; i < 50; i++) {
    const claimNo = `EXP-2026-${String(i + 1).padStart(4, "0")}`;
    const code = pool[i % pool.length];
    const emp = employeeByCode(code)!;
    const approverCode = emp.managerCode ?? "STL-0008";

    /* Claim windows walk backwards from September 2026. */
    const monthsBack = Math.floor(i / 10);
    const periodTo = addDays(TODAY, -(monthsBack * 30) - randInt(rng, 1, 12));
    const periodFrom = addDays(periodTo, -randInt(rng, 6, 24));

    const lineCount = randInt(rng, 2, 5);
    const lines: ExpenseLine[] = [];
    const mustBreach = FORCED_VIOLATIONS.has(i);
    const breachIndex = mustBreach ? randInt(rng, 0, lineCount - 1) : -1;

    for (let l = 0; l < lineCount; l++) {
      const category = pick(rng, EXPENSE_CATEGORIES) as ExpenseCategory;
      const policy = policyFor(category)!;
      const breach = l === breachIndex || (!mustBreach && rng() > 0.965);

      const amount = breach
        ? Math.round((policy.limit * (1.18 + rng() * 0.6)) / 10) * 10
        : Math.round((policy.limit * (0.32 + rng() * 0.55)) / 10) * 10;

      const excess = Math.max(0, round2(amount - policy.limit));
      const stem = pick(rng, RECEIPT_STEMS);
      const pdf = rng() > 0.45;

      /* Every receipt falls inside the claim window, so none is dated after
         DEMO_TODAY. The modulo keeps the seeded sequence intact. */
      const offset = randInt(rng, 0, 20) % (differenceInCalendarDays(periodTo, periodFrom) + 1);

      lines.push({
        id: `${claimNo}-L${l + 1}`,
        category,
        date: isoDate(addDays(periodFrom, offset)),
        description: pick(rng, EXPENSE_DESCRIPTIONS[category]),
        amount,
        receipt: `${stem}-${String(i + 1).padStart(3, "0")}${l + 1}.${pdf ? "pdf" : "jpg"}`,
        receiptKind: pdf ? "pdf" : "photo",
        limit: policy.limit,
        limitBasis: policy.basis,
        excess,
        violation: excess > 0,
      });
    }

    const total = round2(sum(lines.map((l) => l.amount)));
    const violationCount = lines.filter((l) => l.violation).length;

    const statusRoll = rng();
    const status: ExpenseStatus =
      i % 10 === 0
        ? "draft"
        : statusRoll < 0.26
          ? "submitted"
          : statusRoll < 0.68
            ? "approved"
            : statusRoll < 0.78
              ? "completed"
              : statusRoll < 0.9
                ? "rejected"
                : "cancelled";

    /* Submission and decision never run past DEMO_NOW. */
    const submittedOn =
      status === "draft" ? null : iso(notAfterNow(addHours(periodTo, randInt(rng, 18, 72)), 6));
    const decided = ["approved", "rejected", "completed"].includes(status);
    const decidedOn =
      decided && submittedOn
        ? iso(notAfterNow(addHours(parseISO(submittedOn), randInt(rng, 4, 96)), 2))
        : null;

    out.push({
      id: claimNo,
      claimNo,
      employeeCode: code,
      employeeName: emp.name,
      department: deptName(emp.departmentId),
      purpose: EXPENSE_PURPOSES[i % EXPENSE_PURPOSES.length],
      periodFrom: isoDate(periodFrom),
      periodTo: isoDate(periodTo),
      lines,
      total,
      status,
      submittedOn,
      approverCode,
      approverName: employeeName(approverCode),
      decidedOn,
      decisionNote:
        status === "rejected"
          ? violationCount > 0
            ? "Rejected — the accommodation line is above the metro cap and no pre-approval was attached."
            : "Rejected — receipts are illegible. Please rescan and resubmit against the same claim."
          : status === "approved" && violationCount > 0
            ? "Approved with an exception noted against the over-limit line."
            : null,
      reimbursedOn:
        status === "completed" && decidedOn
          ? isoDate(notAfterNow(addDays(parseISO(decidedOn), randInt(rng, 2, 9)), 0))
          : null,
      violationCount,
      hasViolation: violationCount > 0,
      search: `${claimNo} ${emp.name} ${emp.code} ${EXPENSE_PURPOSES[i % EXPENSE_PURPOSES.length]}`.toLowerCase(),
    });
  }
  return out;
}

/* Ananya Rao's (Employee persona) own history, so her My claims tab reads like
   a real year: two reimbursed claims and one sent back. Appended after the
   seeded fifty, never submitted or approved-unpaid, so every approval queue,
   finance queue and payroll reimbursement row derived elsewhere is unchanged.
   Amounts are deliberately not multiples of ten — no false duplicate match. */
type PersonaLineSeed = [ExpenseCategory, number, string, string];

function personaClaim(
  seq: number,
  purpose: string,
  seeds: PersonaLineSeed[],
  status: "completed" | "rejected",
  submittedOn: string,
  decidedOn: string,
  reimbursedOn: string | null,
  decisionNote: string | null,
): ExpenseClaim {
  const code = PERSONA_EMPLOYEE_CODES[0];
  const emp = employeeByCode(code)!;
  const claimNo = `EXP-2026-${String(seq).padStart(4, "0")}`;
  const lines: ExpenseLine[] = seeds.map(([category, amount, date, description], i) => {
    const policy = policyFor(category)!;
    const excess = Math.max(0, round2(amount - policy.limit));
    return {
      id: `${claimNo}-L${i + 1}`,
      category,
      date,
      description,
      amount,
      receipt: `${i % 2 ? "IMG" : "invoice"}_${seq}${i + 1}.${i % 2 ? "jpg" : "pdf"}`,
      receiptKind: i % 2 ? "photo" : "pdf",
      limit: policy.limit,
      limitBasis: policy.basis,
      excess,
      violation: excess > 0,
    };
  });
  const dates = lines.map((l) => l.date).sort();
  const violationCount = lines.filter((l) => l.violation).length;
  const approverCode = emp.managerCode ?? "STL-0008";
  return {
    id: claimNo,
    claimNo,
    employeeCode: code,
    employeeName: emp.name,
    department: deptName(emp.departmentId),
    purpose,
    periodFrom: dates[0],
    periodTo: dates[dates.length - 1],
    lines,
    total: round2(sum(lines.map((l) => l.amount))),
    status,
    submittedOn,
    approverCode,
    approverName: employeeName(approverCode),
    decidedOn,
    decisionNote,
    reimbursedOn,
    violationCount,
    hasViolation: violationCount > 0,
    search: `${claimNo} ${emp.name} ${emp.code} ${purpose}`.toLowerCase(),
  };
}

const PERSONA_CLAIMS: ExpenseClaim[] = [
  personaClaim(61, "Monthly home-office and connectivity reimbursement", [
    ["Internet & Telecom", 1499, "2026-07-05", "ACT Fibernet broadband — home office, July"],
    ["Office Supplies", 2187, "2026-07-11", "Ergonomic footrest and laptop riser for the home desk"],
  ], "completed", "2026-07-14T10:20:00", "2026-07-15T17:05:00", "2026-07-31", null),
  personaClaim(62, "On-site UAT support — Apollo Retail, Chennai", [
    ["Travel – Cab", 1246, "2026-08-04", "Uber — Chennai Central to the Apollo Retail office, OMR"],
    ["Accommodation", 5873, "2026-08-04", "Novotel Chennai OMR — 2 nights, UAT war-room"],
    ["Meals", 1084, "2026-08-05", "Breakfast and dinner, day two of the on-site"],
  ], "completed", "2026-08-07T09:45:00", "2026-08-08T12:30:00", "2026-08-31", null),
  personaClaim(63, "Certification reimbursement under the L&D policy", [
    ["Training", 27999, "2026-08-22", "AWS Solutions Architect Professional — exam and prep course"],
  ], "rejected", "2026-08-25T11:10:00", "2026-08-27T15:40:00", null,
  "Rejected — a course above the ₹25,000 cap needs L&D pre-approval. Raise it on the learning portal and re-file with the approval attached."),
];

export const EXPENSE_CLAIMS: ExpenseClaim[] = [...generateClaims(), ...PERSONA_CLAIMS];

export const claimsFor = (employeeCode: string) =>
  EXPENSE_CLAIMS.filter((c) => c.employeeCode === employeeCode);

/** Everything sitting in one approver's queue. */
export const claimsToApprove = (approverCode: string) =>
  EXPENSE_CLAIMS.filter((c) => c.status === "submitted" && c.approverCode === approverCode);

export const EXPENSE_STATS = (() => {
  const submitted = EXPENSE_CLAIMS.filter((c) => c.status === "submitted");
  const approved = EXPENSE_CLAIMS.filter((c) => c.status === "approved" || c.status === "completed");
  return {
    total: EXPENSE_CLAIMS.length,
    awaiting: submitted.length,
    awaitingValue: round2(sum(submitted.map((c) => c.total))),
    approvedValue: round2(sum(approved.map((c) => c.total))),
    reimbursedValue: round2(
      sum(EXPENSE_CLAIMS.filter((c) => c.status === "completed").map((c) => c.total)),
    ),
    withViolations: EXPENSE_CLAIMS.filter((c) => c.hasViolation).length,
    violationValue: round2(
      sum(EXPENSE_CLAIMS.flatMap((c) => c.lines.filter((l) => l.violation).map((l) => l.excess))),
    ),
  };
})();

/** Bar source: claimed value per category across the whole register. */
export const EXPENSE_BY_CATEGORY = EXPENSE_CATEGORIES.map((c) => {
  const lines = EXPENSE_CLAIMS.flatMap((cl) => cl.lines).filter((l) => l.category === c);
  return {
    category: c,
    claimed: Math.round(sum(lines.map((l) => l.amount))),
    over_limit: Math.round(sum(lines.map((l) => l.excess))),
  };
});

/* ==========================================================================
   3 · TRAVEL REQUESTS
   ========================================================================== */

export type TravelMode = "Flight" | "Train" | "Cab" | "Bus";
export type LegBookingStatus = "pending" | "scheduled" | "completed" | "cancelled";
export type TravelStatus = "draft" | "submitted" | "approved" | "rejected" | "completed" | "cancelled";

export interface TravelLeg {
  id: string;
  from: string;
  to: string;
  mode: TravelMode;
  departDate: string;
  returnDate: string | null;
  bookingStatus: LegBookingStatus;
  bookingRef: string | null;
  carrier: string;
  estimatedCost: number;
}

export interface TravelRequest {
  id: string;
  requestNo: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  purpose: string;
  tripType: "Domestic" | "International";
  startDate: string;
  endDate: string;
  nights: number;
  legs: TravelLeg[];
  perDiem: number;
  estimatedCost: number;
  advanceRequested: number;
  advanceDisbursed: number;
  advanceSettled: number;
  advanceOutstanding: number;
  status: TravelStatus;
  approverCode: string;
  approverName: string;
  submittedOn: string | null;
  decidedOn: string | null;
  decisionNote: string | null;
  search: string;
}

interface TravelSeed {
  code: string;
  purpose: string;
  tripType: "Domestic" | "International";
  startsInDays: number;
  nights: number;
  status: TravelStatus;
  route: { from: string; to: string; mode: TravelMode; carrier: string; cost: number }[];
}

const TRAVEL_SEEDS: TravelSeed[] = [
  {
    /* Travelled 08–09 Sep; the receipts are claimed in EXP-2026-0051 (finance-expense.ts). */
    code: "STL-0142", purpose: "Customer QBR with Tata Digital — quarterly roadmap review", tripType: "Domestic",
    startsInDays: -8, nights: 1, status: "completed",
    route: [
      { from: "Bengaluru", to: "Mumbai", mode: "Flight", carrier: "IndiGo 6E-2134", cost: 7400 },
      { from: "Mumbai", to: "Bengaluru", mode: "Flight", carrier: "IndiGo 6E-6112", cost: 8100 },
    ],
  },
  {
    code: "STL-0031", purpose: "Delivery review with the Pune engineering pod", tripType: "Domestic",
    startsInDays: 4, nights: 1, status: "approved",
    route: [
      { from: "Bengaluru", to: "Pune", mode: "Flight", carrier: "Vistara UK-864", cost: 6200 },
      { from: "Pune", to: "Bengaluru", mode: "Flight", carrier: "Vistara UK-871", cost: 6500 },
    ],
  },
  {
    code: "STL-0009", purpose: "Newark office onboarding and US benefits briefing", tripType: "International",
    startsInDays: 26, nights: 6, status: "submitted",
    route: [
      { from: "Bengaluru", to: "Newark NJ", mode: "Flight", carrier: "Air India AI-105", cost: 96400 },
      { from: "Newark NJ", to: "Bengaluru", mode: "Flight", carrier: "Air India AI-106", cost: 91800 },
    ],
  },
  {
    code: "STL-0058", purpose: "Campus recruitment drive — Manipal Institute of Technology", tripType: "Domestic",
    startsInDays: 18, nights: 2, status: "approved",
    route: [
      { from: "Bengaluru", to: "Mangaluru", mode: "Flight", carrier: "IndiGo 6E-7215", cost: 5300 },
      { from: "Mangaluru", to: "Manipal", mode: "Cab", carrier: "Pre-booked sedan", cost: 2200 },
      { from: "Mangaluru", to: "Bengaluru", mode: "Flight", carrier: "IndiGo 6E-7218", cost: 5600 },
    ],
  },
  {
    code: "STL-0017", purpose: "Statutory audit close-out with the Pune finance team", tripType: "Domestic",
    startsInDays: -9, nights: 3, status: "completed",
    route: [
      { from: "Pune", to: "Bengaluru", mode: "Flight", carrier: "IndiGo 6E-441", cost: 6100 },
      { from: "Bengaluru", to: "Pune", mode: "Flight", carrier: "IndiGo 6E-448", cost: 5900 },
    ],
  },
  {
    code: "STL-0143", purpose: "On-site UAT support — Apollo Retail, Chennai", tripType: "Domestic",
    startsInDays: 6, nights: 4, status: "approved",
    route: [
      { from: "Bengaluru", to: "Chennai", mode: "Train", carrier: "Shatabdi Express 12007", cost: 1450 },
      { from: "Chennai", to: "Bengaluru", mode: "Train", carrier: "Shatabdi Express 12008", cost: 1450 },
    ],
  },
  {
    code: "STL-0145", purpose: "KubeCon India 2026 — platform engineering track", tripType: "Domestic",
    startsInDays: 33, nights: 3, status: "submitted",
    route: [
      { from: "Bengaluru", to: "Delhi", mode: "Flight", carrier: "Air India AI-505", cost: 9800 },
      { from: "Delhi", to: "Bengaluru", mode: "Flight", carrier: "Air India AI-512", cost: 10400 },
    ],
  },
  {
    code: "STL-0146", purpose: "Client escalation visit — Fincraft, Mumbai", tripType: "Domestic",
    startsInDays: 1, nights: 1, status: "approved",
    route: [
      { from: "Bengaluru", to: "Mumbai", mode: "Flight", carrier: "Akasa QP-1408", cost: 7900 },
      { from: "Mumbai", to: "Bengaluru", mode: "Flight", carrier: "Akasa QP-1411", cost: 8300 },
    ],
  },
  {
    code: "STL-0147", purpose: "Vendor evaluation at the Hinjewadi data centre", tripType: "Domestic",
    startsInDays: 8, nights: 1, status: "submitted",
    route: [{ from: "Pune", to: "Hinjewadi", mode: "Cab", carrier: "Company cab", cost: 1800 }],
  },
  {
    code: "STL-0149", purpose: "Platform pod planning week at Bengaluru HQ", tripType: "International",
    startsInDays: 20, nights: 7, status: "approved",
    route: [
      { from: "Newark NJ", to: "Bengaluru", mode: "Flight", carrier: "United UA-82", cost: 104500 },
      { from: "Bengaluru", to: "Newark NJ", mode: "Flight", carrier: "United UA-83", cost: 99200 },
    ],
  },
  {
    code: "STL-0144", purpose: "Partner summit — integration roadmap sessions", tripType: "Domestic",
    startsInDays: -22, nights: 2, status: "completed",
    route: [
      { from: "Bengaluru", to: "Hyderabad", mode: "Flight", carrier: "IndiGo 6E-6203", cost: 5100 },
      { from: "Hyderabad", to: "Bengaluru", mode: "Flight", carrier: "IndiGo 6E-6208", cost: 5400 },
    ],
  },
  {
    code: "STL-0148", purpose: "New-joiner induction week at Bengaluru HQ", tripType: "Domestic",
    startsInDays: -4, nights: 3, status: "completed",
    route: [
      { from: "Pune", to: "Bengaluru", mode: "Flight", carrier: "IndiGo 6E-441", cost: 6000 },
      { from: "Bengaluru", to: "Pune", mode: "Flight", carrier: "IndiGo 6E-448", cost: 6300 },
    ],
  },
  {
    code: "STL-0011", purpose: "Design research sprint with the Apollo Retail store teams", tripType: "Domestic",
    startsInDays: 14, nights: 3, status: "submitted",
    route: [
      { from: "Bengaluru", to: "Kochi", mode: "Flight", carrier: "IndiGo 6E-337", cost: 6700 },
      { from: "Kochi", to: "Bengaluru", mode: "Flight", carrier: "IndiGo 6E-342", cost: 7100 },
    ],
  },
  {
    code: "STL-0013", purpose: "Brand campaign shoot supervision — Mumbai studio", tripType: "Domestic",
    startsInDays: 2, nights: 2, status: "approved",
    route: [
      { from: "Bengaluru", to: "Mumbai", mode: "Flight", carrier: "IndiGo 6E-2134", cost: 7600 },
      { from: "Mumbai", to: "Bengaluru", mode: "Flight", carrier: "IndiGo 6E-2139", cost: 8000 },
    ],
  },
  {
    code: "STL-0007", purpose: "Customer success QBR circuit — Chennai and Hyderabad", tripType: "Domestic",
    startsInDays: 9, nights: 4, status: "approved",
    route: [
      { from: "Pune", to: "Chennai", mode: "Flight", carrier: "IndiGo 6E-511", cost: 7200 },
      { from: "Chennai", to: "Hyderabad", mode: "Flight", carrier: "IndiGo 6E-613", cost: 4900 },
      { from: "Hyderabad", to: "Pune", mode: "Flight", carrier: "IndiGo 6E-618", cost: 5200 },
    ],
  },
  {
    code: "STL-0005", purpose: "Enterprise deal close — Zeta Payments leadership meeting", tripType: "Domestic",
    startsInDays: 3, nights: 1, status: "approved",
    route: [
      { from: "Bengaluru", to: "Gurugram", mode: "Flight", carrier: "Vistara UK-810", cost: 11200 },
      { from: "Gurugram", to: "Bengaluru", mode: "Flight", carrier: "Vistara UK-817", cost: 11800 },
    ],
  },
  {
    code: "STL-0010", purpose: "Newark office network refresh — hands-on cutover", tripType: "International",
    startsInDays: 45, nights: 5, status: "draft",
    route: [
      { from: "Bengaluru", to: "Newark NJ", mode: "Flight", carrier: "Air India AI-105", cost: 98900 },
      { from: "Newark NJ", to: "Bengaluru", mode: "Flight", carrier: "Air India AI-106", cost: 94100 },
    ],
  },
  {
    code: "STL-0147", purpose: "Regional partner meet — Coimbatore", tripType: "Domestic",
    startsInDays: -15, nights: 1, status: "rejected",
    route: [
      { from: "Bengaluru", to: "Coimbatore", mode: "Bus", carrier: "KSRTC Airavat Club Class", cost: 1300 },
      { from: "Coimbatore", to: "Bengaluru", mode: "Bus", carrier: "KSRTC Airavat Club Class", cost: 1300 },
    ],
  },
  /* Appended (so every seeded value above is unchanged): the trip behind Ananya
     Rao's reimbursed Chennai claim EXP-2026-0062. */
  {
    code: "STL-0142", purpose: "On-site UAT support — Apollo Retail, Chennai", tripType: "Domestic",
    startsInDays: -43, nights: 2, status: "completed",
    route: [
      { from: "Bengaluru", to: "Chennai", mode: "Train", carrier: "Shatabdi Express 12007", cost: 1450 },
      { from: "Chennai", to: "Bengaluru", mode: "Train", carrier: "Shatabdi Express 12008", cost: 1450 },
    ],
  },
];

function generateTravel(): TravelRequest[] {
  const rng = mulberry32(1947);

  return TRAVEL_SEEDS.map((seed, i) => {
    const requestNo = `TRV-2026-${String(i + 1).padStart(4, "0")}`;
    const emp = employeeByCode(seed.code)!;
    const approverCode = emp.managerCode ?? "STL-0001";
    const start = addDays(TODAY, seed.startsInDays);
    const end = addDays(start, seed.nights);

    const legs: TravelLeg[] = seed.route.map((r, j) => {
      const departDate = isoDate(addDays(start, j === 0 ? 0 : Math.min(seed.nights, j)));
      const booked = seed.status === "approved" || seed.status === "completed";
      const bookingStatus: LegBookingStatus =
        seed.status === "cancelled" || seed.status === "rejected"
          ? "cancelled"
          : seed.status === "completed"
            ? "completed"
            : booked
              ? "scheduled"
              : "pending";
      return {
        id: `${requestNo}-L${j + 1}`,
        from: r.from,
        to: r.to,
        mode: r.mode,
        departDate,
        returnDate: j === seed.route.length - 1 ? isoDate(end) : null,
        bookingStatus,
        bookingRef: booked ? `PNR-${serialFor(rng, "", 6)}` : null,
        carrier: r.carrier,
        estimatedCost: r.cost,
      };
    });

    const perDiemRate = seed.tripType === "International" ? 6500 : 2200;
    const perDiem = perDiemRate * (seed.nights + 1);
    const estimatedCost = sum(legs.map((l) => l.estimatedCost)) + perDiem;

    const advanceRequested =
      seed.status === "draft" ? 0 : Math.round((estimatedCost * (0.4 + rng() * 0.35)) / 500) * 500;
    const advanceDisbursed =
      seed.status === "approved" || seed.status === "completed" ? advanceRequested : 0;
    /* Settlement happens against bills after the trip — an approved trip that
       has not started yet carries its advance in hand, nothing settled. */
    const advanceSettled = seed.status === "completed" ? advanceDisbursed : 0;

    /* Raised (and decided) before DEMO_NOW, even for trips a month out. */
    const submittedOn =
      seed.status === "draft" ? null : iso(notAfterNow(addDays(start, -randInt(rng, 9, 26)), 30 + i * 7));
    const decided = ["approved", "rejected", "completed"].includes(seed.status);

    return {
      id: requestNo,
      requestNo,
      employeeCode: seed.code,
      employeeName: emp.name,
      department: deptName(emp.departmentId),
      purpose: seed.purpose,
      tripType: seed.tripType,
      startDate: isoDate(start),
      endDate: isoDate(end),
      nights: seed.nights,
      legs,
      perDiem,
      estimatedCost,
      advanceRequested,
      advanceDisbursed,
      advanceSettled,
      advanceOutstanding: advanceDisbursed - advanceSettled,
      status: seed.status,
      approverCode,
      approverName: employeeName(approverCode),
      submittedOn,
      decidedOn:
        decided && submittedOn
          ? iso(notAfterNow(addHours(parseISO(submittedOn), randInt(rng, 6, 70)), 3))
          : null,
      decisionNote:
        seed.status === "rejected"
          ? "Rejected — the partner meet can be covered remotely this quarter. Please re-raise if the customer escalates."
          : null,
      search: `${requestNo} ${emp.name} ${emp.code} ${seed.purpose}`.toLowerCase(),
    } satisfies TravelRequest;
  });
}

export const TRAVEL_REQUESTS: TravelRequest[] = generateTravel();

export const travelFor = (employeeCode: string) =>
  TRAVEL_REQUESTS.filter((t) => t.employeeCode === employeeCode);

export const travelToApprove = (approverCode: string) =>
  TRAVEL_REQUESTS.filter((t) => t.status === "submitted" && t.approverCode === approverCode);

export const TRAVEL_ADVANCE_SUMMARY = {
  requested: sum(TRAVEL_REQUESTS.map((t) => t.advanceRequested)),
  disbursed: sum(TRAVEL_REQUESTS.map((t) => t.advanceDisbursed)),
  settled: sum(TRAVEL_REQUESTS.map((t) => t.advanceSettled)),
  outstanding: sum(TRAVEL_REQUESTS.map((t) => t.advanceOutstanding)),
};

export const TRAVEL_STATS = {
  total: TRAVEL_REQUESTS.length,
  awaiting: TRAVEL_REQUESTS.filter((t) => t.status === "submitted").length,
  upcoming: TRAVEL_REQUESTS.filter((t) => t.status === "approved" && parseISO(t.startDate) >= TODAY).length,
  estimatedSpend: sum(TRAVEL_REQUESTS.filter((t) => t.status !== "rejected" && t.status !== "cancelled").map((t) => t.estimatedCost)),
};

/* ==========================================================================
   4 · HELPDESK
   ========================================================================== */

export type TicketCategory = "IT" | "Facilities" | "HR" | "Payroll" | "Access";
export const TICKET_CATEGORIES: TicketCategory[] = ["IT", "Facilities", "HR", "Payroll", "Access"];

export type TicketPriority = "Critical" | "High" | "Medium" | "Low";
export const TICKET_PRIORITIES: TicketPriority[] = ["Critical", "High", "Medium", "Low"];

/** Only keys present in STATUS_MAP. */
export type TicketStatus = "submitted" | "pending" | "resolved" | "reopened" | "cancelled";
export type SlaState = "sla_ok" | "sla_at_risk" | "sla_breached";

/** Response targets the SLA countdown is measured against. */
export const SLA_HOURS: Record<TicketPriority, number> = {
  Critical: 4,
  High: 8,
  Medium: 24,
  Low: 48,
};

export interface TicketMessage {
  id: string;
  authorCode: string;
  authorName: string;
  authorRole: string;
  at: string;
  body: string;
  /** true = internal note, never shown to the requester. */
  internal: boolean;
}

export interface Ticket {
  id: string;
  ticketNo: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  requesterCode: string;
  requesterName: string;
  requesterBranch: string;
  assigneeCode: string;
  assigneeName: string;
  assigneeTeam: string;
  createdAt: string;
  updatedAt: string;
  status: TicketStatus;
  slaHours: number;
  slaDueAt: string;
  /** Minutes left against DEMO_NOW — negative once breached. */
  slaMinutesRemaining: number;
  slaState: SlaState;
  resolvedAt: string | null;
  firstResponseMins: number;
  thread: TicketMessage[];
  tags: string[];
  search: string;
}

interface TicketSeed {
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  tags: string[];
  reply: string;
  note: string;
  followUp?: string;
  resolution?: string;
  /** Pins the requester; seeds without one take the next code from the pool. */
  requester?: string;
}

const TICKET_SEEDS: TicketSeed[] = [
  {
    category: "IT", priority: "High",
    subject: "VPN drops every 20 minutes on the Pune office Wi-Fi",
    description:
      "The FortiClient tunnel disconnects roughly every 20 minutes when I am on the PNQ-CORP SSID. It reconnects on its own but every database session and SSH session dies with it. On the guest network it is stable, so it looks like something on the corporate VLAN.",
    tags: ["vpn", "network", "pune"],
    reply: "Thanks for the detail — we can see the same drop pattern in the Fortigate logs for your MAC. Please stay on the guest SSID today while we look at the VLAN.",
    note: "Fortigate 401E on the 2F closet is renegotiating IKE keys every 1200s because the lifetime on the PNQ-CORP policy was left at the default. Needs a maintenance window to change; do not tell the requester it is a config error until we have the RCA signed off.",
    followUp: "Guest SSID has been stable all morning, thank you. Any idea when the fix lands?",
  },
  {
    category: "IT", priority: "Critical",
    subject: "Production alerting Slack channel is not receiving PagerDuty events",
    description:
      "Nothing has arrived in #prod-alerts since about 06:00 today. We confirmed PagerDuty is firing because the SMS escalation went out for the 06:12 latency alert, but the Slack leg is silent. This is our primary on-call channel.",
    tags: ["slack", "pagerduty", "on-call"],
    reply: "Acknowledged and treating this as a P1. We are re-authorising the PagerDuty Slack app now and will post a test event in the channel.",
    note: "The PagerDuty app token was revoked when we rotated the workspace owner account on Monday. This is fallout from the admin handover — flag it in the change review.",
    resolution: "Slack app re-authorised and a synthetic event delivered to #prod-alerts at 09:48. Monitoring for the next hour before closing.",
  },
  {
    category: "Facilities", priority: "Medium",
    subject: "Air conditioning on the 7th floor east wing is not cooling",
    description:
      "The east wing has been sitting around 29°C since Monday. The vents are blowing but the air is not cold. Roughly 40 people sit in that zone and several have moved to the cafeteria to work.",
    tags: ["hvac", "bengaluru", "7f"],
    reply: "Blue Star has been called out and is scheduled for a site visit tomorrow morning. In the meantime we have opened the 7F west overflow area for anyone who wants to relocate.",
    note: "Third HVAC callout for the same AHU this quarter. Building management is stalling on the compressor replacement — escalate to the landlord in writing this week.",
  },
  {
    category: "Access", priority: "High",
    subject: "Access card stopped working at the Bengaluru turnstile",
    description:
      "My card STL-AST-0091 beeps red at both the ground floor turnstiles and the 7F door. Security let me in manually today but I would rather not do that every morning.",
    tags: ["access-card", "turnstile"],
    reply: "Your card was suspended automatically because the badge record had an expired photo. We have re-enabled it — please tap once at the ground floor reader to re-sync.",
    note: "Matrix COSEC auto-suspends badges whose photo record is older than 36 months. We should turn that rule off; it has generated 11 tickets this quarter.",
    resolution: "Badge re-enabled and verified at the turnstile with the requester present.",
  },
  {
    category: "Payroll", priority: "High",
    subject: "August payslip shows LOP for a day I had approved leave",
    description:
      "My August payslip has one day of loss of pay against 18 August. I had an approved casual leave for that date, approved by Vikram Shah on 12 August. The leave still shows as approved in the leave module.",
    tags: ["payslip", "lop", "august"],
    reply: "We can see the approved leave. The August run was locked before the leave sync completed, so the day fell through as LOP. We will process an arrear in the September run.",
    note: "This affects four employees whose leave was approved between the 14th and the cut-off. Do not mention the other three by name; raise a bulk arrear line instead of four separate ones.",
  },
  {
    category: "HR", priority: "Medium",
    subject: "Need an address-proof letter for a rental agreement",
    description:
      "My landlord needs an employment and address verification letter on company letterhead, addressed to Prestige Property Management, before Friday. Happy to collect a physical copy from the 7F desk.",
    tags: ["letter", "verification"],
    reply: "Draft is ready and with Priya for signature. You can collect the signed hard copy from the People Ops desk after 3 pm tomorrow, and we will email a scanned PDF as well.",
    note: "Standard template L-04. Requester has been with us under three years, so use the tenure-neutral wording variant.",
  },
  {
    category: "IT", priority: "Medium",
    subject: "MacBook battery swells and the trackpad no longer clicks",
    description:
      "The bottom case of my MacBook Pro has started to bulge and the trackpad will not physically click any more. I have stopped charging it overnight as a precaution. Serial is on the asset tag STL-AST-0003.",
    tags: ["hardware", "macbook", "battery"],
    reply: "Please stop using the machine and bring it to the 7F IT desk today — a swelling battery is a safety issue. We will issue a loaner from stock while it goes to the service centre.",
    note: "Unit is 34 months old, still inside AppleCare. Log it under warranty, not capex. Loaner STL-AST-0058 is reserved.",
  },
  {
    category: "Facilities", priority: "Low",
    subject: "Cafeteria coffee machine on the 5th floor is out of beans by 11 am",
    description:
      "The 5F machine runs dry most mornings before eleven. The 7F one is fine. Could the refill schedule be moved earlier or the hopper topped up twice?",
    tags: ["cafeteria", "pantry"],
    reply: "We have asked Sodexo to add a second refill at 10:30 on weekdays starting Monday. Let us know if it still runs dry after that.",
    note: "Sodexo contract only funds one refill per day per machine. The second slot comes out of the pantry discretionary budget — track the spend.",
  },
  {
    category: "Access", priority: "Critical",
    subject: "Locked out of the production AWS account after MFA device reset",
    description:
      "I replaced my phone last night and restored from backup, but the Authenticator entry for the production account did not come across. I cannot assume the deploy role and I am on call this week.",
    tags: ["aws", "mfa", "production"],
    reply: "We are treating this as urgent. Please join the identity verification call on the link sent to your work email; we will reset the virtual MFA once identity is confirmed.",
    note: "Do not reset MFA on a Slack request alone. Verification call plus manager confirmation from Vikram Shah is mandatory for production roles.",
  },
  {
    category: "IT", priority: "Medium",
    subject: "Outlook keeps prompting for credentials after the password change",
    description:
      "Since changing my password on Monday, the Outlook desktop client asks for credentials every 15 minutes. Webmail works fine with the new password. I have already tried removing and re-adding the account.",
    tags: ["outlook", "sso", "credentials"],
    reply: "There is a stale credential cached in Windows Credential Manager. We will remote in and clear the MicrosoftOffice16 entries, then re-register the client.",
    note: "Same symptom as the batch of tickets after the March rotation. Add the Credential Manager clean-up step to the password-change runbook.",
    resolution: "Cached credentials cleared and the client re-registered. Requester confirmed no further prompts after two hours.",
  },
  {
    category: "Payroll", priority: "Medium",
    subject: "Form 16 for FY 2025-26 has the old PAN on it",
    description:
      "The Form 16 in my documents tab shows my previous PAN. I updated my PAN with HR in November after correcting a spelling error with the department. I need the corrected form for my filing.",
    tags: ["form-16", "pan", "tax"],
    reply: "We have confirmed the updated PAN in your profile. A revised Form 16 has to be regenerated from the TRACES filing, which takes about five working days.",
    note: "Requires a correction return for Q3 and Q4 FY25-26. Rahul to file; do not promise a date shorter than seven working days.",
  },
  {
    category: "HR", priority: "High",
    subject: "Probation confirmation letter has not arrived four weeks after the review",
    description:
      "My probation review was completed on 14 August with a positive outcome confirmed verbally by my manager. I still have no confirmation letter and my status in the portal says Probation, which is blocking my loan application.",
    tags: ["probation", "confirmation"],
    reply: "Apologies for the delay. Your review outcome is recorded; the letter was stuck in the pending-signature queue. It will be issued today and your status updated in the same batch.",
    note: "Eleven confirmations are sitting unsigned because the delegation of authority was not reassigned while Priya was on leave. Fix the delegation rule, not just this one letter.",
  },
  {
    category: "Facilities", priority: "High",
    subject: "Water leak from the ceiling above the 2F Pune server room",
    description:
      "There is a steady drip coming through the ceiling tile directly above the network rack in the 2F comms room. We have put a bucket under it and moved the UPS, but this is next to live equipment.",
    tags: ["leak", "pune", "server-room"],
    reply: "Facilities and the building engineer are on site. Power to the affected rack row has been isolated as a precaution and a temporary drip tray is in place.",
    note: "Source is the chilled-water line for the 3F AHU. Landlord's responsibility — photograph everything for the claim before anything is cleaned up.",
  },
  {
    category: "IT", priority: "Low",
    subject: "Request a second monitor for the Bengaluru hot desk",
    description:
      "I have moved to a hot desk on 7F that only has one monitor. I work across a terminal and a browser all day and a second screen would help. Happy with anything from stock.",
    tags: ["hardware", "monitor", "request"],
    reply: "There is a Dell U2723QE available in the 7F store room. Raise it as an allocation on the asset register and we will hand it over at the IT desk.",
    note: "Monitor stock is down to six units across both India offices. Hold the rest for new joiners until the October purchase order lands.",
  },
  {
    category: "Access", priority: "Medium",
    subject: "Need read access to the payroll reporting folder on SharePoint",
    description:
      "I have been asked to prepare the quarterly cost-centre variance pack, which needs the payroll reporting folder. Rahul Desai has approved it over email; I have attached the thread.",
    tags: ["sharepoint", "payroll", "access-request"],
    reply: "Approval thread received. Access will be granted as read-only and will expire automatically after 90 days, in line with the data access policy.",
    note: "Payroll folder is in scope for the ISO 27001 audit. Log this grant in the access register with the approval reference before provisioning.",
  },
  {
    category: "HR", priority: "Low",
    subject: "How do I add my newborn to the group medical policy?",
    description:
      "Our daughter was born on 2 September. I would like to add her to the family floater under the group medical cover, and understand whether there is a window I need to meet.",
    tags: ["insurance", "benefits", "dependant"],
    reply: "Congratulations. Newborns can be added within 30 days of birth with no medical underwriting. Please submit the birth certificate through the benefits portal and we will endorse the policy.",
    note: "Endorsement premium is pro-rated and recovered through payroll next month. Confirm with Rahul before the September run locks.",
  },
  {
    category: "IT", priority: "High",
    subject: "Jenkins build agents in the Pune pool are all offline",
    description:
      "All four build agents in the pune-build pool have shown offline since around 02:00. The queue is 38 jobs deep and nothing is moving. The Bengaluru pool is healthy.",
    tags: ["jenkins", "ci", "pune"],
    reply: "The agents lost their JNLP connection after the controller upgrade overnight. We are rolling the agent service restart across the pool now.",
    note: "The upgrade skipped the agent compatibility check because the pre-flight job was disabled last sprint. Re-enable it before the next controller upgrade.",
    resolution: "All four agents reconnected and the queue drained by 10:20. Agent compatibility pre-flight re-enabled.",
  },
  {
    category: "Payroll", priority: "Critical",
    subject: "Salary not credited — bank rejected the September advance",
    description:
      "My salary advance was not credited today. My bank says the transfer was returned because the account number did not match the name. I recently closed my old account and updated the new one in the portal.",
    tags: ["bank", "credit", "urgent"],
    reply: "We can see the return in the bank file. The new account was updated after the payment file was generated, so the old account was used. A re-initiation is going out today.",
    note: "Bank master change cut-off is the 25th and this one came in on the 28th. The control worked as designed — do not word the reply as an apology for a system fault.",
  },
  {
    category: "Facilities", priority: "Medium",
    subject: "Desk chair gas lift has failed and the seat sinks",
    description:
      "The chair at desk 7F-114 drops to its lowest position within a minute of sitting down. I have tried the lever both ways. It has been like this for about a week.",
    tags: ["furniture", "ergonomics"],
    reply: "A replacement chair has been pulled from the 7F store and will be swapped in this evening after hours. The faulty one goes back to Featherlite under warranty.",
    note: "Fourth gas-lift failure from the same 2023 Featherlite batch. Raise a batch claim rather than individual warranty tickets.",
  },
  {
    category: "IT", priority: "Medium",
    subject: "Zoom audio cuts out during customer calls on the Jabra headset",
    description:
      "During calls on my Jabra Evolve2 65 the far end stops hearing me for five to ten seconds at a time. It happens on Zoom and on Teams, and on both my docked and undocked setups.",
    tags: ["headset", "audio", "zoom"],
    reply: "Please try the Jabra Direct firmware update we have pushed to your machine; the 3.14 firmware fixed a known Bluetooth audio dropout on that model.",
    note: "If the firmware update does not fix it, the dongle is the usual culprit, not the headset. We have four spare Link 380 dongles in the 7F store.",
  },
  {
    category: "HR", priority: "Medium",
    subject: "Leave balance shows 2 days fewer than my ledger after the carry-forward run",
    description:
      "After the carry-forward run my earned leave balance shows 14.5 days, but adding up my ledger I get 16.5. The difference looks like the two days that lapsed, which I thought were within the carry-forward cap.",
    tags: ["leave", "balance", "carry-forward"],
    reply: "The carry-forward cap for your grade is 15 days, so 2 days lapsed at the year end. We will share the ledger extract showing the lapse entry.",
    note: "The cap is correct but the ledger label says 'Adjusted' rather than 'Lapsed', which is why it does not read clearly. Raise a product ticket on the ledger wording.",
  },
  {
    category: "Access", priority: "Medium",
    subject: "Visitor gate pass needed for the Fincraft audit team on 22 September",
    description:
      "Three auditors from Fincraft will be on site on 22 and 23 September and need access to the 7F meeting rooms and the ground-floor cafeteria. Names and ID numbers are in the attached sheet.",
    tags: ["visitor", "gate-pass"],
    reply: "Passes have been pre-registered for both days. Please ask them to carry the same photo ID used on the form and to collect their badges at the ground-floor reception.",
    note: "Auditors get cafeteria and 7F meeting room access only. Explicitly exclude the 7F engineering floor and the 2F comms room from the badge profile.",
  },
  {
    category: "IT", priority: "Low",
    subject: "Request access to the Figma organisation as an editor",
    description:
      "I have joined the design review rotation and need editor access on the Stellar Figma org to leave component-level comments and update specs. Viewer access is not enough.",
    tags: ["figma", "licence", "request"],
    reply: "Editor seats are pooled and we have two free. Tanvi has approved the upgrade, so your seat is being changed now — sign out and back in to pick it up.",
    note: "Figma renewal is in November and we are at 46 of 50 editor seats. Start a seat audit before approving any more.",
  },
  {
    category: "Facilities", priority: "Low",
    subject: "Parking allocation for the Pune basement level 2",
    description:
      "I have started driving to the office three days a week and would like a basement parking slot at Panchshil. Currently I park on the street, which is not ideal during the monsoon.",
    tags: ["parking", "pune"],
    reply: "Basement slots are allocated by a waiting list; you are currently sixth. In the meantime the Panchshil overflow lot on the north side is free for badge holders.",
    note: "Waiting list is managed in a spreadsheet by the Pune admin. Move it into the helpdesk so allocations are auditable.",
  },
  {
    category: "Payroll", priority: "Low",
    subject: "Need a salary certificate for a home loan application",
    description:
      "HDFC has asked for a salary certificate covering the last six months, stamped and signed, addressed to the branch. I have the exact format they want and can share it.",
    tags: ["certificate", "loan"],
    reply: "Please share the bank's format. We will issue the certificate on letterhead within two working days once the format is confirmed.",
    note: "Do not include variable pay projections in loan certificates — only fixed components, per the finance policy note from March.",
  },
  {
    category: "IT", priority: "High",
    subject: "Laptop encryption prompt loops after the BIOS update",
    description:
      "After last night's Dell BIOS update my Latitude asks for the BitLocker recovery key on every boot, and after entering it the same prompt comes back on the next restart. I have the key but this is not workable.",
    tags: ["bitlocker", "dell", "bios"],
    reply: "The BIOS update changed the TPM measurement, which invalidated the key protector. We need to suspend and re-enable BitLocker on the machine — please bring it to the IT desk.",
    note: "Push the BIOS update ring back to staged rollout. Five Latitudes hit this overnight because the update went to all devices at once.",
  },
  {
    category: "HR", priority: "Low",
    subject: "POSH refresher training link has expired",
    description:
      "The link in the compliance reminder email takes me to an expired session page. My POSH refresher is due on 30 September and I do not want to miss the deadline.",
    tags: ["posh", "compliance", "training"],
    reply: "The cohort link rotated last week. A fresh enrolment link has been sent to your work email and your due date has been extended by seven days.",
    note: "68 employees received the stale link. Re-send to the whole cohort rather than waiting for individual tickets.",
  },
  {
    category: "Access", priority: "High",
    subject: "Former contractor still has access to the customer data warehouse",
    description:
      "A contractor whose engagement ended on 31 August still appears as an active user on the Snowflake customer analytics role. I noticed it while reviewing the access list for the audit.",
    tags: ["offboarding", "snowflake", "audit"],
    reply: "Access has been revoked immediately and we are pulling the query history for the period after the engagement ended. Thank you for flagging it.",
    note: "Offboarding checklist covers Okta but not Snowflake local users. This is an audit finding waiting to happen — raise it formally with the security lead today.",
  },
  {
    category: "Facilities", priority: "Medium",
    subject: "Meeting room 7F-Nilgiri display shows no signal over HDMI",
    description:
      "The wall display in Nilgiri does not pick up HDMI from any laptop. We have tried three cables and two machines. The room has been unusable for customer calls all week.",
    tags: ["av", "meeting-room"],
    reply: "The HDMI extender behind the panel has failed. A replacement has been ordered and the room is blocked in the calendar until it is fitted on Thursday.",
    note: "Same extender model failed in Kaveri in July. Order two spares so we are not blocking rooms for a week each time.",
  },
  {
    category: "IT", priority: "Medium",
    subject: "Shared mailbox for people-ops@stellartech.in is not syncing",
    description:
      "New mail is arriving in the web view of the shared people-ops mailbox but not in the desktop client for any of the four of us who have it mapped. Sent items sync fine.",
    tags: ["mailbox", "exchange", "sync"],
    reply: "The mailbox exceeded the cached-mode item limit for the Inbox folder. We are moving items older than a year into the archive, which will restore the sync.",
    note: "Set a retention policy on this mailbox so it does not silently grow again. It has 84,000 items in the Inbox.",
  },
  {
    category: "Payroll", priority: "Medium",
    subject: "Professional tax deducted at the Karnataka rate after my move to Pune",
    description:
      "I relocated to the Pune office in July but my September payslip still shows Karnataka professional tax. My address and branch were updated in the portal before the July run.",
    tags: ["pt", "relocation", "statutory"],
    reply: "Your branch changed but the statutory profile still points to the Karnataka PT registration. We will correct the profile and adjust the over-deduction in the October run.",
    note: "Branch change does not cascade to the statutory profile — this is a known gap. Two others moved in the same batch; check them before October locks.",
  },
  {
    category: "HR", priority: "Medium",
    subject: "Request to change my recorded emergency contact",
    description:
      "My emergency contact still lists my previous flatmate. I would like to change it to my spouse, with a new phone number. The profile page seems to be read-only for that section.",
    tags: ["profile", "emergency-contact"],
    reply: "That section is locked for self-service because it feeds the insurance endorsement. Send the new name, relationship and number here and we will update it for you.",
    note: "Self-service on emergency contacts is a frequent request. Worth revisiting the field-level permission rather than handling each one manually.",
  },
  {
    category: "IT", priority: "Low",
    subject: "Please whitelist the Grafana Cloud domain on the corporate proxy",
    description:
      "Our Grafana Cloud dashboards will not load from the office network; the proxy returns a block page for grafana.net. They work fine over the VPN from home.",
    tags: ["proxy", "whitelist", "grafana"],
    reply: "grafana.net has been added to the allow list under the monitoring category. Please clear your browser cache and retry from the office network.",
    note: "Category-based blocking put it under 'uncategorised'. Add the other observability vendors proactively so we stop getting one ticket per tool.",
  },
  {
    category: "Access", priority: "Low",
    subject: "Temporary badge for a new joiner starting on 21 September",
    description:
      "A new engineer joins the platform team on 21 September. Her permanent badge will take a week, so she needs a temporary one for the first few days, with 7F access.",
    tags: ["new-joiner", "temp-badge"],
    reply: "A temporary badge is reserved under the joiner's employee code and can be collected from reception on her first morning. It expires automatically after 10 days.",
    note: "Temporary badges must be returned before the permanent one is issued. We are three badges short because the last four joiners kept theirs.",
  },
  {
    category: "Facilities", priority: "Critical",
    subject: "Fire alarm panel showing a fault on the Bengaluru 7th floor loop",
    description:
      "The panel at the 7F lobby has an amber fault light against loop 3 and is beeping intermittently. Security says it started around 07:30 and they have not been able to silence it.",
    tags: ["fire-safety", "alarm", "urgent"],
    reply: "The fire safety vendor has been called out under the emergency clause and is en route. Security has been briefed to run a manual floor sweep every hour until the panel is clear.",
    note: "Loop 3 fault is almost certainly the detector we damaged during the 7F ceiling work. Disclose it to the vendor so they do not bill it as a system fault.",
  },
  {
    category: "IT", priority: "Medium",
    subject: "Two-factor prompts arriving for sign-ins I did not make",
    description:
      "I have had four Okta push notifications overnight for sign-ins I did not attempt. I denied all of them. The location shown was not one I recognise.",
    tags: ["security", "okta", "mfa"],
    reply: "Thank you for denying them and reporting it. We have forced a password reset and revoked all active sessions on your account as a precaution.",
    note: "Credential stuffing attempt from a known bad ASN. Blocked at the network policy level; the security lead is reviewing whether other accounts were targeted.",
    resolution: "Password reset completed, sessions revoked, no evidence of a successful sign-in. Account confirmed clean.",
  },
  {
    category: "HR", priority: "High",
    subject: "Referral bonus for a candidate who joined in July has not been paid",
    description:
      "I referred a candidate who joined the sales team on 7 July. Per the referral policy the first instalment is payable after 30 days of joining. It has not appeared in either the August or September payslip.",
    tags: ["referral", "bonus"],
    reply: "The referral was recorded against the requisition but not flagged for payout. We have raised it for the September run and it will show as a separate earning line.",
    note: "Referral payouts are tracked manually in the recruiting sheet, which is why this slipped. Three more July referrals are unpaid — check them all before replying.",
  },
  {
    category: "Payroll", priority: "Medium",
    subject: "Investment declaration window closed before I could submit proofs",
    description:
      "I was travelling during the proof submission window and missed the deadline by two days. My 80C proofs are ready. Is there any way to submit them before the final TDS computation?",
    tags: ["tds", "80c", "declaration"],
    reply: "The portal window is closed but we can accept proofs manually until the February payroll cut-off. Please email the documents and we will apply them to the computation.",
    note: "Manual acceptance is allowed only until the Feb cut-off; after that the employee has to claim in their return. Keep a log of manual acceptances for the audit.",
  },
  {
    category: "IT", priority: "Low",
    subject: "Docking station only drives one external monitor instead of two",
    description:
      "My Dell WD22TB4 dock drives one 4K monitor fine, but the second one stays blank. Both monitors work when plugged directly into the laptop. Cables and ports have been swapped around already.",
    tags: ["dock", "monitor", "hardware"],
    reply: "This is usually the dock firmware. We have pushed the Dell Dock Firmware Update Utility to your machine — please run it from Software Center and reboot with the dock connected.",
    note: "Docks shipped before mid-2024 need the firmware update before they will drive two 4K panels. Add it to the imaging checklist.",
  },
  {
    category: "Facilities", priority: "Medium",
    subject: "Request a sit-stand desk on medical advice",
    description:
      "My physiotherapist has recommended a sit-stand desk for a lower back condition. I have the letter and am happy to share it with HR rather than attach it here.",
    tags: ["ergonomics", "accommodation"],
    reply: "No need to attach the letter here — please send it directly to People Ops. Once they confirm, Facilities will order a sit-stand converter for your desk.",
    note: "Medical documentation stays with People Ops only. Facilities acts on the confirmation, never on the clinical detail.",
  },
  /* Appended for the five later personas (HD-2026-0520 onward) — earlier
     ticket numbers, requesters and SLA clocks are unchanged. Each is routed to
     a team the requester does not work in, so no one is their own agent. */
  {
    category: "IT", priority: "Medium", requester: "STL-0008",
    subject: "Power BI Pro licence shows as expired after the annual renewal",
    description:
      "Since Monday the finance cost dashboards open in read-only mode with a banner saying my Power BI Pro licence has expired. Procurement confirmed the renewal PO was raised on 1 September, so I think the seat has simply not been re-assigned to me.",
    tags: ["licence", "power-bi", "finance"],
    reply: "You are right — the renewed seats landed in the tenant but were not re-assigned. We have assigned a Pro seat to your account; please sign out of Power BI and back in.",
    note: "Twelve renewed seats are still unassigned in the M365 admin centre. Reconcile them against the licence register before month-end close.",
  },
  {
    category: "Access", priority: "High", requester: "STL-0005",
    subject: "CRM pipeline dashboard access for two new regional sales leads",
    description:
      "Two regional sales leads joined the Pune team this month and still cannot see the pipeline dashboard in the CRM. The quarterly forecast review is on Friday and they need to present their territories.",
    tags: ["access", "crm", "sales"],
    reply: "We have the request. CRM roles need the department head's approval on record — this ticket counts as that approval, so we are provisioning the Sales Lead role for both now.",
    note: "Joiner workflow did not include the CRM role for the Sales Lead designation. Add it to the role-to-application map so the next joiners get it on day one.",
    followUp: "One of them can see the dashboard now, the other still gets 'insufficient privileges'.",
  },
  {
    category: "IT", priority: "Low", requester: "STL-0305",
    subject: "Second monitor for working the helpdesk queue",
    description:
      "Working the helpdesk queue on a single laptop screen means constant switching between the ticket, the knowledge base and the employee profile. Could I have a second monitor at my desk on 6F?",
    tags: ["monitor", "hardware", "ergonomics"],
    reply: "Approved under the standard desk kit. A 27-inch monitor is in stock at the Bengaluru store and will be set up at your desk tomorrow morning.",
    note: "Issue from Bengaluru IT Store Room 7F stock; update the asset register when it is handed over.",
  },
  {
    category: "Payroll", priority: "Medium", requester: "STL-0010",
    subject: "Mobile reimbursement cap not updated after my grade revision",
    description:
      "My grade was revised in July, which moves the monthly mobile and internet cap from ₹1,500 to ₹2,500. The August claim was still capped at the old limit.",
    tags: ["reimbursement", "grade", "telecom"],
    reply: "Thanks — the grade change reached the salary structure but not the reimbursement policy mapping. We will pay the August difference as arrears in the September run.",
    note: "Grade-linked reimbursement caps are cached per employee and not refreshed on a mid-year revision. Check every July revision for the same gap.",
  },
  {
    category: "HR", priority: "Low", requester: "STL-0296",
    subject: "Copy of my signed POSH acknowledgement for the audit file",
    description:
      "For the internal audit file I need a copy of my own signed POSH policy acknowledgement for FY 2026-27. The policy page shows it as accepted but there is no download option.",
    tags: ["posh", "policy", "audit"],
    reply: "We have attached the signed acknowledgement from the policy register to your documents. You can download it from My documents under Compliance.",
    note: "Acknowledgement PDFs are generated on request only; the download option is on the roadmap for the policies page.",
  },
];

const HELPDESK_AGENTS: { code: string; team: string }[] = [
  { code: "STL-0010", team: "IT Service Desk" },
  { code: "STL-0009", team: "People Operations" },
  { code: "STL-0017", team: "Payroll Operations" },
];

const AGENT_BY_CATEGORY: Record<TicketCategory, { code: string; team: string }> = {
  IT: HELPDESK_AGENTS[0],
  Access: HELPDESK_AGENTS[0],
  Facilities: HELPDESK_AGENTS[0],
  HR: HELPDESK_AGENTS[1],
  Payroll: HELPDESK_AGENTS[2],
};

/** Hours-before-DEMO_NOW that each ticket was raised — chosen so the register
 *  always shows a spread of green, amber and red countdowns. */
const TICKET_AGE_HOURS = [
  1.5, 3, 6.5, 9, 14, 20, 26, 2.5, 34, 45, 5, 58, 0.75, 30, 12, 72, 7.5, 3.5, 22,
  18, 40, 4.5, 11, 64, 2, 27, 8.5, 50, 16, 36, 1, 23, 47, 6, 13, 31, 5.5, 19, 42, 10,
];

function generateTickets(): Ticket[] {
  const rng = mulberry32(72413);

  /* Requesters: the personas first, then Vikram's team, then a wider pool. */
  const requesterPool = [
    "STL-0142", "STL-0031", "STL-0009", "STL-0142", "STL-0017", "STL-0058",
    "STL-0143", "STL-0144", "STL-0145", "STL-0146", "STL-0147", "STL-0148", "STL-0149",
    ...ACTIVE.slice(20, 80).map((e) => e.code),
  ];

  return TICKET_SEEDS.map((seed, i) => {
    const ticketNo = `HD-2026-${String(400 + i * 3).padStart(4, "0")}`;
    const requesterCode = seed.requester ?? requesterPool[i % requesterPool.length];
    const requester = employeeByCode(requesterCode)!;
    const agent = AGENT_BY_CATEGORY[seed.category];

    const ageHours = TICKET_AGE_HOURS[i % TICKET_AGE_HOURS.length];
    const createdAt = addMinutes(NOW, -Math.round(ageHours * 60));
    const slaHours = SLA_HOURS[seed.priority];
    const slaDue = addHours(createdAt, slaHours);

    const firstResponseMins = randInt(rng, 8, Math.max(20, slaHours * 25));
    const replyAt = addMinutes(createdAt, firstResponseMins);

    /* Resolve the older tickets; keep the fresh ones live so the countdown
       chips have something to count down. */
    const resolvable = ageHours > slaHours * 0.9;
    const statusRoll = rng();
    const status: TicketStatus = resolvable
      ? statusRoll < 0.68
        ? "resolved"
        : statusRoll < 0.8
          ? "reopened"
          : statusRoll < 0.86
            ? "cancelled"
            : "pending"
      : statusRoll < 0.55
        ? "submitted"
        : "pending";

    const resolvedAt =
      status === "resolved" ? iso(addMinutes(replyAt, randInt(rng, 25, slaHours * 40))) : null;

    const minutesRemaining = differenceInMinutes(slaDue, NOW);
    const slaState: SlaState =
      status === "resolved" || status === "cancelled"
        ? "sla_ok"
        : minutesRemaining < 0
          ? "sla_breached"
          : minutesRemaining <= slaHours * 60 * 0.25
            ? "sla_at_risk"
            : "sla_ok";

    const thread: TicketMessage[] = [
      {
        id: `${ticketNo}-M1`,
        authorCode: requesterCode,
        authorName: requester.name,
        authorRole: requester.designation,
        at: iso(createdAt),
        body: seed.description,
        internal: false,
      },
      {
        id: `${ticketNo}-M2`,
        authorCode: agent.code,
        authorName: employeeName(agent.code),
        authorRole: agent.team,
        at: iso(replyAt),
        body: seed.reply,
        internal: false,
      },
      {
        id: `${ticketNo}-M3`,
        authorCode: agent.code,
        authorName: employeeName(agent.code),
        authorRole: agent.team,
        at: iso(addMinutes(replyAt, randInt(rng, 3, 25))),
        body: seed.note,
        internal: true,
      },
    ];

    if (seed.followUp) {
      thread.push({
        id: `${ticketNo}-M4`,
        authorCode: requesterCode,
        authorName: requester.name,
        authorRole: requester.designation,
        at: iso(addMinutes(replyAt, randInt(rng, 40, 180))),
        body: seed.followUp,
        internal: false,
      });
    }
    if (seed.resolution && resolvedAt) {
      thread.push({
        id: `${ticketNo}-M5`,
        authorCode: agent.code,
        authorName: employeeName(agent.code),
        authorRole: agent.team,
        at: resolvedAt,
        body: seed.resolution,
        internal: false,
      });
    }

    const updatedAt = thread[thread.length - 1].at;

    return {
      id: ticketNo,
      ticketNo,
      category: seed.category,
      priority: seed.priority,
      subject: seed.subject,
      description: seed.description,
      requesterCode,
      requesterName: requester.name,
      requesterBranch: requester.location,
      assigneeCode: agent.code,
      assigneeName: employeeName(agent.code),
      assigneeTeam: agent.team,
      createdAt: iso(createdAt),
      updatedAt,
      status,
      slaHours,
      slaDueAt: iso(slaDue),
      slaMinutesRemaining: minutesRemaining,
      slaState,
      resolvedAt,
      firstResponseMins,
      thread,
      tags: seed.tags,
      search: `${ticketNo} ${seed.subject} ${requester.name} ${seed.category} ${seed.tags.join(" ")}`.toLowerCase(),
    } satisfies Ticket;
  });
}

export const TICKETS: Ticket[] = generateTickets();

export const ticketsFor = (employeeCode: string) =>
  TICKETS.filter((t) => t.requesterCode === employeeCode);

export const ticketsAssignedTo = (employeeCode: string) =>
  TICKETS.filter((t) => t.assigneeCode === employeeCode);

const OPEN_TICKET_STATUSES: TicketStatus[] = ["submitted", "pending", "reopened"];
export const isTicketOpen = (t: Ticket) => OPEN_TICKET_STATUSES.includes(t.status);

export const TICKET_STATS = (() => {
  const open = TICKETS.filter(isTicketOpen);
  const breached = open.filter((t) => t.slaState === "sla_breached");
  const atRisk = open.filter((t) => t.slaState === "sla_at_risk");
  const resolved = TICKETS.filter((t) => t.status === "resolved");
  return {
    total: TICKETS.length,
    open: open.length,
    breached: breached.length,
    atRisk: atRisk.length,
    resolved: resolved.length,
    reopened: TICKETS.filter((t) => t.status === "reopened").length,
    slaCompliance: ((TICKETS.length - breached.length) / TICKETS.length) * 100,
    avgFirstResponseMins: Math.round(
      sum(TICKETS.map((t) => t.firstResponseMins)) / TICKETS.length,
    ),
  };
})();

/** Bar source: open tickets per category, split by SLA state. */
export const TICKETS_BY_CATEGORY = TICKET_CATEGORIES.map((c) => {
  const rows = TICKETS.filter((t) => t.category === c);
  return {
    category: c,
    on_track: rows.filter((t) => t.slaState === "sla_ok").length,
    at_risk: rows.filter((t) => t.slaState === "sla_at_risk").length,
    breached: rows.filter((t) => t.slaState === "sla_breached").length,
  };
});

/** Bar source: SLA compliance by priority band, met vs breached. */
export const SLA_COMPLIANCE_BY_PRIORITY = TICKET_PRIORITIES.map((p) => {
  const rows = TICKETS.filter((t) => t.priority === p);
  const breached = rows.filter((t) => t.slaState === "sla_breached").length;
  return {
    priority: `${p} · ${SLA_HOURS[p]}h`,
    met: rows.length - breached,
    breached,
  };
});

/* ==========================================================================
   5 · ANNOUNCEMENTS
   ========================================================================== */

export type AnnouncementCategory =
  | "Policy"
  | "Benefits"
  | "Office"
  | "Product"
  | "People"
  | "Compliance";

export interface Announcement {
  id: string;
  title: string;
  summary: string;
  /** Paragraphs — rendered one <p> each, no markdown parsing needed. */
  body: string[];
  category: AnnouncementCategory;
  authorCode: string;
  authorName: string;
  authorTitle: string;
  publishedAt: string;
  pinned: boolean;
  audience: string;
  audienceSize: number;
  requiresAck: boolean;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  ackCount: number;
  attachments: { name: string; size: string }[];
}

interface AnnouncementSeed {
  title: string;
  summary: string;
  body: string[];
  category: AnnouncementCategory;
  authorCode: string;
  daysAgo: number;
  pinned: boolean;
  audience: string;
  audienceSize: number;
  requiresAck: boolean;
  acknowledged: boolean;
  ackCount: number;
  attachments?: { name: string; size: string }[];
}

const ANNOUNCEMENT_SEEDS: AnnouncementSeed[] = [
  {
    title: "Diwali 2026 holiday calendar and the festive shutdown",
    summary: "Both Deepavali days are company holidays this year, and the Bengaluru office closes for a three-day shutdown.",
    body: [
      "Deepavali falls on Sunday 8 November this year, so the company holiday moves to Monday 9 November. The second day, previously an optional holiday, is confirmed as a full company holiday for all India-based employees.",
      "The Bengaluru office will be physically closed from Saturday 7 November to Monday 9 November inclusive. Badge access will be restricted to the security desk and the 2F comms room during that period. If you need to be on site for a customer commitment, please raise a Facilities ticket by 30 October so we can arrange cover.",
      "Teams supporting the Apollo Retail and Fincraft go-lives should agree their on-call rota with their manager before 25 October. Anyone on the rota over the shutdown is entitled to compensatory off, to be taken before 31 December.",
      "Newark colleagues are not affected and follow the US holiday calendar as published.",
    ],
    category: "Office", authorCode: "STL-0009", daysAgo: 2, pinned: true,
    audience: "All employees", audienceSize: 340, requiresAck: true, acknowledged: false, ackCount: 214,
    attachments: [{ name: "Holiday-Calendar-2026-IN.pdf", size: "182 KB" }],
  },
  {
    title: "Updated expense reimbursement policy takes effect on 1 October",
    summary: "Per-category caps have been revised and receipts are now mandatory on every line above ₹500.",
    body: [
      "We have refreshed the reimbursement policy for the first time since 2023. The headline changes: the metro accommodation cap rises from ₹5,500 to ₹6,500 per night, the daily meal cap rises to ₹1,200 per person, and cab reimbursement is capped at ₹2,500 per trip.",
      "From 1 October a receipt is mandatory on every line above ₹500. Claims submitted without a receipt on a qualifying line will be sent back automatically rather than rejected, so you can attach the missing document and resubmit against the same claim number.",
      "Lines that exceed a category cap are no longer blocked at submission. They will be flagged inline for you before you submit, and your approver will see the same flag with the exact excess amount. Approving an over-limit line is a deliberate exception and is recorded in the audit log.",
      "The full policy document is attached. Please read it before your next claim — the finance team will not apply the old caps after the effective date.",
    ],
    category: "Policy", authorCode: "STL-0008", daysAgo: 5, pinned: true,
    audience: "All employees", audienceSize: 340, requiresAck: true, acknowledged: false, ackCount: 168,
    attachments: [
      { name: "Expense-Policy-v4.pdf", size: "412 KB" },
      { name: "Category-Limits-Summary.pdf", size: "96 KB" },
    ],
  },
  {
    title: "Mandatory POSH refresher — complete by 30 September",
    summary: "Every employee must complete the annual Prevention of Sexual Harassment refresher module.",
    body: [
      "The annual POSH refresher is now live in the Learning module. It takes around 35 minutes and must be completed by every employee, including contractors and interns, by 30 September 2026.",
      "This is a statutory requirement under the Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013, and completion rates are reported to the Internal Committee. Managers will see their team's completion status on the Learning compliance panel.",
      "If your enrolment link has expired, raise a Helpdesk ticket under the HR category and we will re-issue it the same day. Completion is tracked automatically; there is nothing to submit once you finish the module.",
    ],
    category: "Compliance", authorCode: "STL-0009", daysAgo: 8, pinned: true,
    audience: "All employees", audienceSize: 340, requiresAck: true, acknowledged: true, ackCount: 287,
  },
  {
    title: "Group medical cover renewal — what changes from 1 November",
    summary: "The family floater sum insured rises to ₹7,50,000 and parental cover becomes opt-in rather than automatic.",
    body: [
      "Our group medical policy renews on 1 November with ICICI Lombard continuing as the insurer. The family floater sum insured increases from ₹5,00,000 to ₹7,50,000 at no additional cost to employees.",
      "Parental cover changes from automatic inclusion to an opt-in top-up. If you currently have parents covered and want that to continue, you must confirm during the enrolment window from 1 to 20 October. The top-up premium is ₹18,400 per year for a parent pair, recovered in equal instalments through payroll.",
      "Room rent capping has been removed entirely, and the pre-existing disease waiting period stays waived for all enrolled members. Maternity cover rises to ₹75,000 for both normal and caesarean deliveries.",
      "An insurer-led session is scheduled for 14 October at 15:00 IST with a recording circulated afterwards. Bring your questions — the enrolment window is short and we cannot make changes after it closes.",
    ],
    category: "Benefits", authorCode: "STL-0009", daysAgo: 11, pinned: false,
    audience: "All employees", audienceSize: 340, requiresAck: true, acknowledged: false, ackCount: 131,
    attachments: [{ name: "Medical-Policy-Renewal-2026-27.pdf", size: "638 KB" }],
  },
  {
    title: "Apollo Retail go-live completed across 410 stores",
    summary: "The largest deployment in the company's history went live over the weekend with no rollback.",
    body: [
      "Over the weekend the delivery and platform teams completed the Apollo Retail rollout across all 410 stores, four distribution centres and the central office. This is the largest single deployment Stellar has run, and it went out without a rollback and without a Sev-1.",
      "Peak load on Sunday evening hit 11,400 concurrent sessions, roughly three times our previous high-water mark. The autoscaling work the platform pod shipped in July absorbed it without manual intervention.",
      "Thank you to everyone who worked the weekend rota, and to the Pune team who carried the overnight shift. Compensatory off has already been credited to everyone on the rota — please plan it with your manager before the end of October.",
      "Apollo's CIO has asked to record a joint case study. If you worked on the programme and would like to take part, let Sandeep know by the end of the week.",
    ],
    category: "Product", authorCode: "STL-0001", daysAgo: 4, pinned: false,
    audience: "All employees", audienceSize: 340, requiresAck: false, acknowledged: false, ackCount: 0,
  },
  {
    title: "Hybrid working: three days on site from October",
    summary: "The minimum on-site expectation moves from two days to three, with team-level anchor days.",
    body: [
      "From 1 October the minimum on-site expectation across Bengaluru and Pune moves from two days a week to three. This follows the working-group review and the all-hands discussion in August.",
      "Rather than a company-wide fixed pattern, each team sets two anchor days when everyone is in, and individuals choose their third day. Managers will confirm their team's anchor days by 25 September so you can plan commutes and childcare.",
      "Fully remote arrangements that were formally approved before 1 July remain in place and are unaffected. If you have a medical or caregiving situation that makes three days difficult, speak to your manager or People Ops — we will handle those case by case and in confidence.",
      "Desk capacity has been re-planned for the new pattern. If your team cannot find seats on your anchor days, raise it with Facilities rather than working around it.",
    ],
    category: "Policy", authorCode: "STL-0001", daysAgo: 16, pinned: false,
    audience: "Bengaluru HQ · Pune Delivery Centre", audienceSize: 306, requiresAck: true, acknowledged: true, ackCount: 261,
  },
  {
    title: "September pay run: payslips available from 28 September",
    summary: "Payslips publish on the 28th and credits land on the last working day of the month.",
    body: [
      "The September pay run is on track. Payslips will be published to the portal on the evening of 28 September and salary credits will reach accounts on 30 September, the last working day of the month.",
      "If you changed your bank account this month, please check the last four digits on your profile before 25 September. Bank master changes after the 25th cannot be picked up by the September payment file and will apply from October.",
      "Investment proof submission for FY 2026-27 opens on 1 December. There is nothing you need to do now, but if you have already made 80C investments this year, keep the receipts.",
    ],
    category: "People", authorCode: "STL-0017", daysAgo: 6, pinned: false,
    audience: "All employees", audienceSize: 340, requiresAck: false, acknowledged: false, ackCount: 0,
  },
  {
    title: "Pune office expands to the third floor from 1 November",
    summary: "An additional 8,200 sq ft at Panchshil adds 96 desks, four meeting rooms and a wellness room.",
    body: [
      "We have signed for an additional 8,200 square feet on the third floor at Panchshil Business Park, taking the Pune office to 168 desks. Fit-out starts on 6 October and we expect to occupy from 1 November.",
      "The new floor adds 96 desks, four meeting rooms including one twelve-seat customer room, a wellness room and a proper phone-booth bank. The 2F comms room stays where it is.",
      "Expect noise on 2F during the fit-out, particularly in the first two weeks. If your team has customer calls that cannot tolerate it, book the 2F Kaveri room, which sits away from the work zone, or work from home on those days.",
      "Seating plans for the new floor will be shared for comment in mid-October. Team leads should send their headcount projections through to Facilities by 30 September.",
    ],
    category: "Office", authorCode: "STL-0010", daysAgo: 19, pinned: false,
    audience: "Pune Delivery Centre", audienceSize: 92, requiresAck: false, acknowledged: false, ackCount: 0,
  },
  {
    title: "Introducing the quarterly learning stipend",
    summary: "Every employee gets ₹25,000 a year for courses, certifications and conferences, no approval chain.",
    body: [
      "From this quarter every permanent employee has a learning budget of ₹25,000 per financial year. It covers online courses, certification exams, technical books and conference tickets.",
      "There is no approval chain. Spend it, claim it through the Expenses module under the Training category, and it is reimbursed with your next cycle. Your manager sees the claim but does not need to approve anything under the cap.",
      "Anything above the cap, or anything requiring travel, still goes through the normal approval route. Unused budget does not carry into the next financial year, so plan it early rather than in March.",
      "If you are not sure what to spend it on, the Learning catalogue has curated tracks for each discipline, and your manager can help you pick something that fits your growth plan.",
    ],
    category: "Benefits", authorCode: "STL-0009", daysAgo: 24, pinned: false,
    audience: "All employees", audienceSize: 340, requiresAck: false, acknowledged: true, ackCount: 198,
  },
  {
    title: "Security: mandatory hardware key enrolment for production access",
    summary: "Anyone with production access must enrol a hardware security key by 15 October.",
    body: [
      "Following the credential stuffing attempts detected this month, everyone holding production access must enrol a hardware security key. Push-based multi-factor authentication will no longer be accepted for production roles after 15 October.",
      "YubiKey 5C NFC units have been ordered for all affected employees and will be distributed at the IT desk on both India sites from 22 September. Newark colleagues will receive theirs by courier.",
      "Enrolment takes about five minutes in Okta and IT will run drop-in sessions at 11:00 and 16:00 daily during the rollout week. Please bring your laptop and your existing MFA device.",
      "If you do not hold production access, nothing changes for you. If you are unsure whether you do, check the access register linked in the IT knowledge base.",
    ],
    category: "Compliance", authorCode: "STL-0010", daysAgo: 9, pinned: false,
    audience: "Engineering · IT & Operations", audienceSize: 160, requiresAck: true, acknowledged: false, ackCount: 104,
  },
  {
    title: "Welcome to the 14 people who joined us in September",
    summary: "New joiners across Engineering, Sales, Customer Success and Design — say hello.",
    body: [
      "Fourteen people joined Stellar this month: six in Engineering, three in Sales, three in Customer Success and two in Design. Eleven are based in Bengaluru, two in Pune and one in Newark.",
      "Induction for the September cohort runs on 22 and 23 September in the 7F Nilgiri room. If you are a buddy for one of the new joiners, your session is on the afternoon of the 22nd.",
      "Please take a few minutes to introduce yourself if someone new has joined your floor. The first fortnight shapes how people feel about the place for a long time afterwards.",
    ],
    category: "People", authorCode: "STL-0058", daysAgo: 3, pinned: false,
    audience: "All employees", audienceSize: 340, requiresAck: false, acknowledged: false, ackCount: 0,
  },
  {
    title: "Performance review cycle H2 FY 2026-27 opens on 1 October",
    summary: "Self-assessments open on 1 October, manager reviews close on 24 October, calibration follows.",
    body: [
      "The half-yearly review cycle opens on 1 October. Self-assessments are due by 12 October, manager reviews by 24 October, and calibration sessions run in the first week of November.",
      "This cycle introduces the revised rating scale agreed after the last round of feedback: five bands instead of four, with clearer behavioural descriptors for each. The descriptors are in the Reviews module and are worth reading before you write anything.",
      "Goals set in April carry into this cycle automatically. If your goals have materially changed because of a re-org or a project change, update them before you start your self-assessment so the review reflects what you actually worked on.",
      "Compensation decisions from this cycle take effect from 1 January and will be communicated individually in December.",
    ],
    category: "People", authorCode: "STL-0009", daysAgo: 13, pinned: false,
    audience: "All employees", audienceSize: 340, requiresAck: false, acknowledged: true, ackCount: 176,
  },
  {
    title: "Newark office moves to One Gateway Center Suite 2600",
    summary: "The US team relocates within the same building on 12 October, with no change to the mailing address.",
    body: [
      "The Newark team moves from Suite 1400 to Suite 2600 in the same building on Monday 12 October. The move happens over the preceding weekend and the mailing address is unchanged.",
      "The new suite is 40 per cent larger and includes a dedicated customer meeting room and a proper kitchen. Badge access will be updated automatically on the Friday evening; your existing card will work in the new suite from Monday morning.",
      "Please clear your desk and pack your pedestal into the crates provided by 17:00 on Friday 9 October. IT will move and reconnect monitors and docks; take your laptop home with you over the weekend.",
    ],
    category: "Office", authorCode: "STL-0010", daysAgo: 21, pinned: false,
    audience: "Newark NJ", audienceSize: 31, requiresAck: true, acknowledged: false, ackCount: 22,
  },
  {
    title: "Quarterly all-hands — Thursday 24 September, 16:00 IST",
    summary: "Q2 results, the Apollo Retail retrospective and an open floor for questions.",
    body: [
      "Our quarterly all-hands is on Thursday 24 September at 16:00 IST, in the 7F Nilgiri room and on Zoom for everyone remote. It will run for about 75 minutes including questions.",
      "On the agenda: the Q2 numbers and what they mean for the second half, an honest retrospective on the Apollo Retail programme including what we got wrong, an update on the hybrid working change, and the usual open floor.",
      "Questions can be submitted anonymously through the form linked in the calendar invite until 22 September. We will answer as many as we can live and publish written answers to the rest within a week.",
      "The session will be recorded and posted to the Announcements feed for anyone who cannot attend live.",
    ],
    category: "People", authorCode: "STL-0001", daysAgo: 1, pinned: false,
    audience: "All employees", audienceSize: 340, requiresAck: false, acknowledged: false, ackCount: 0,
  },
];

function generateAnnouncements(): Announcement[] {
  return ANNOUNCEMENT_SEEDS.map((seed, i) => {
    const author = employeeByCode(seed.authorCode)!;
    const publishedAt = iso(addHours(addDays(NOW, -seed.daysAgo), -(i % 5) - 1));
    return {
      id: `ANN-2026-${String(i + 1).padStart(3, "0")}`,
      title: seed.title,
      summary: seed.summary,
      body: seed.body,
      category: seed.category,
      authorCode: seed.authorCode,
      authorName: author.name,
      authorTitle: author.designation,
      publishedAt,
      pinned: seed.pinned,
      audience: seed.audience,
      audienceSize: seed.audienceSize,
      requiresAck: seed.requiresAck,
      acknowledged: seed.acknowledged,
      acknowledgedAt: seed.acknowledged
        ? iso(addHours(parseISO(publishedAt), 6 + (i % 9)))
        : null,
      ackCount: seed.ackCount,
      attachments: seed.attachments ?? [],
    } satisfies Announcement;
  });
}

export const ANNOUNCEMENTS: Announcement[] = generateAnnouncements();

export const ANNOUNCEMENT_STATS = (() => {
  const needingAck = ANNOUNCEMENTS.filter((a) => a.requiresAck);
  return {
    total: ANNOUNCEMENTS.length,
    pinned: ANNOUNCEMENTS.filter((a) => a.pinned).length,
    requiringAck: needingAck.length,
    outstandingForMe: needingAck.filter((a) => !a.acknowledged).length,
    avgAckRate:
      needingAck.length === 0
        ? 0
        : (sum(needingAck.map((a) => a.ackCount / a.audienceSize)) / needingAck.length) * 100,
  };
})();
