/* ============================================================================
   Tenant, branches, departments, designations, grades, holidays.
   Everything else in src/mock/ is built on top of these.
   ========================================================================== */

export const TENANT = {
  id: "stellar",
  name: "Stellar Technologies Pvt Ltd",
  shortName: "Stellar",
  legalName: "Stellar Technologies Private Limited",
  cin: "U72900KA2016PTC094218",
  pan: "AAFCS4821K",
  tan: "BLRS29471C",
  pfCode: "KN/BNG/0049217",
  esiCode: "53000512340001099",
  gstin: "29AAFCS4821K1ZP",
  headcount: 340,
  defaultCountry: "IN",
  defaultTimezone: "Asia/Kolkata",
  fyStartMonth: 4 as 1 | 4,
  locale: "en-IN",
  currency: "INR",
  founded: "2016-03-14",
  website: "stellartech.in",
  supportEmail: "people@stellartech.in",
} as const;

export interface Branch {
  id: string;
  name: string;
  city: string;
  country: string | null;
  countryName: string;
  timezone: string;
  address: string;
  headcount: number;
  currency: string;
}

export const BRANCHES: Branch[] = [
  {
    id: "BLR",
    name: "Bengaluru HQ",
    city: "Bengaluru",
    country: "IN",
    countryName: "India",
    timezone: "Asia/Kolkata",
    address: "Prestige Tech Park, Outer Ring Road, Bellandur, Bengaluru 560103",
    headcount: 214,
    currency: "INR",
  },
  {
    id: "PNQ",
    name: "Pune Delivery Centre",
    city: "Pune",
    country: "IN",
    countryName: "India",
    timezone: "Asia/Kolkata",
    address: "Panchshil Business Park, Viman Nagar, Pune 411014",
    headcount: 92,
    currency: "INR",
  },
  {
    id: "EWR",
    name: "Newark NJ",
    city: "Newark NJ",
    country: "US",
    countryName: "United States",
    timezone: "America/New_York",
    address: "One Gateway Center, Suite 2600, Newark, NJ 07102",
    headcount: 31,
    currency: "USD",
  },
  {
    /* Deliberately mis-configured: used by the "Resolve work context"
       diagnostic to demonstrate the fail-closed 422 state. */
    id: "HYD",
    name: "Hyderabad Satellite",
    city: "Hyderabad",
    country: null,
    countryName: "— not set —",
    timezone: "Asia/Kolkata",
    address: "Raheja Mindspace, Madhapur, Hyderabad 500081",
    headcount: 3,
    currency: "INR",
  },
];

export const branchById = (id: string) => BRANCHES.find((b) => b.id === id);

export interface Department {
  id: string;
  name: string;
  costCentre: string;
  headcount: number;
  headEmployeeCode: string;
}

export const DEPARTMENTS: Department[] = [
  { id: "ENG", name: "Engineering", costCentre: "CC-1001", headcount: 128, headEmployeeCode: "STL-0004" },
  { id: "PRD", name: "Product", costCentre: "CC-1002", headcount: 24, headEmployeeCode: "STL-0006" },
  { id: "DES", name: "Design", costCentre: "CC-1003", headcount: 16, headEmployeeCode: "STL-0011" },
  { id: "SAL", name: "Sales", costCentre: "CC-2001", headcount: 52, headEmployeeCode: "STL-0005" },
  { id: "MKT", name: "Marketing", costCentre: "CC-2002", headcount: 19, headEmployeeCode: "STL-0013" },
  { id: "CSM", name: "Customer Success", costCentre: "CC-2003", headcount: 38, headEmployeeCode: "STL-0007" },
  { id: "FIN", name: "Finance", costCentre: "CC-3001", headcount: 17, headEmployeeCode: "STL-0008" },
  { id: "HR", name: "Human Resources", costCentre: "CC-3002", headcount: 14, headEmployeeCode: "STL-0009" },
  { id: "ITO", name: "IT & Operations", costCentre: "CC-3003", headcount: 32, headEmployeeCode: "STL-0010" },
];

export const deptById = (id: string) => DEPARTMENTS.find((d) => d.id === id);
export const deptName = (id: string) => deptById(id)?.name ?? id;

export interface Grade {
  id: string;
  label: string;
  level: number;
  minCtc: number;
  maxCtc: number;
}

export const GRADES: Grade[] = [
  { id: "G1", label: "G1 · Associate", level: 1, minCtc: 450000, maxCtc: 750000 },
  { id: "G2", label: "G2 · Executive", level: 2, minCtc: 700000, maxCtc: 1200000 },
  { id: "G3", label: "G3 · Senior", level: 3, minCtc: 1150000, maxCtc: 1900000 },
  { id: "G4", label: "G4 · Lead", level: 4, minCtc: 1800000, maxCtc: 3000000 },
  { id: "G5", label: "G5 · Manager", level: 5, minCtc: 2800000, maxCtc: 4500000 },
  { id: "G6", label: "G6 · Director", level: 6, minCtc: 4200000, maxCtc: 7000000 },
  { id: "G7", label: "G7 · Executive Leadership", level: 7, minCtc: 6500000, maxCtc: 12000000 },
];

export const gradeById = (id: string) => GRADES.find((g) => g.id === id);

/** Designations per department, ordered junior -> senior. */
export const DESIGNATIONS: Record<string, string[]> = {
  ENG: [
    "Associate Software Engineer",
    "Software Engineer",
    "Senior Software Engineer",
    "Staff Engineer",
    "Engineering Manager",
    "Director of Engineering",
    "VP Engineering",
  ],
  PRD: [
    "Associate Product Manager",
    "Product Manager",
    "Senior Product Manager",
    "Group Product Manager",
    "Director of Product",
    "Director of Product",
    "Chief Product Officer",
  ],
  DES: [
    "Junior Product Designer",
    "Product Designer",
    "Senior Product Designer",
    "Design Lead",
    "Design Manager",
    "Head of Design",
    "Head of Design",
  ],
  SAL: [
    "Sales Development Rep",
    "Account Executive",
    "Senior Account Executive",
    "Regional Sales Lead",
    "Sales Manager",
    "Director of Sales",
    "Chief Revenue Officer",
  ],
  MKT: [
    "Marketing Associate",
    "Marketing Executive",
    "Senior Marketing Manager",
    "Brand Lead",
    "Marketing Manager",
    "Director of Marketing",
    "Director of Marketing",
  ],
  CSM: [
    "Support Associate",
    "Customer Success Executive",
    "Senior CSM",
    "CS Team Lead",
    "Customer Success Manager",
    "Director of Customer Success",
    "Director of Customer Success",
  ],
  FIN: [
    "Accounts Assistant",
    "Finance Executive",
    "Senior Finance Analyst",
    "Finance Lead",
    "Payroll Manager",
    "Financial Controller",
    "Chief Financial Officer",
  ],
  HR: [
    "HR Associate",
    "HR Executive",
    "Senior HR Business Partner",
    "Talent Acquisition Lead",
    "HR Manager",
    "Head of People Operations",
    "Chief People Officer",
  ],
  ITO: [
    "IT Support Associate",
    "Systems Executive",
    "Senior SRE",
    "Infrastructure Lead",
    "IT Manager",
    "Director of IT",
    "Director of IT",
  ],
};

export interface Holiday {
  date: string;
  name: string;
  country: "IN" | "US";
  optional?: boolean;
}

export const HOLIDAYS: Holiday[] = [
  { date: "2026-01-01", name: "New Year's Day", country: "IN" },
  { date: "2026-01-14", name: "Makar Sankranti / Pongal", country: "IN", optional: true },
  { date: "2026-01-26", name: "Republic Day", country: "IN" },
  { date: "2026-03-04", name: "Holi", country: "IN" },
  { date: "2026-03-21", name: "Ugadi", country: "IN", optional: true },
  { date: "2026-04-14", name: "Dr. Ambedkar Jayanti", country: "IN", optional: true },
  { date: "2026-05-01", name: "May Day", country: "IN" },
  { date: "2026-08-15", name: "Independence Day", country: "IN" },
  { date: "2026-08-28", name: "Ganesh Chaturthi", country: "IN" },
  { date: "2026-10-02", name: "Gandhi Jayanti", country: "IN" },
  { date: "2026-10-20", name: "Dussehra", country: "IN" },
  { date: "2026-11-08", name: "Deepavali", country: "IN" },
  { date: "2026-11-09", name: "Deepavali (second day)", country: "IN", optional: true },
  { date: "2026-12-25", name: "Christmas Day", country: "IN" },
  { date: "2026-01-01", name: "New Year's Day", country: "US" },
  { date: "2026-01-19", name: "Martin Luther King Jr. Day", country: "US" },
  { date: "2026-05-25", name: "Memorial Day", country: "US" },
  { date: "2026-07-03", name: "Independence Day (observed)", country: "US" },
  { date: "2026-09-07", name: "Labor Day", country: "US" },
  { date: "2026-11-26", name: "Thanksgiving", country: "US" },
  { date: "2026-12-25", name: "Christmas Day", country: "US" },
];

export const holidaysFor = (country: "IN" | "US") => HOLIDAYS.filter((h) => h.country === country);

export const holidayOn = (iso: string, country: "IN" | "US" = "IN") =>
  HOLIDAYS.find((h) => h.date === iso && h.country === country);

/** "today" for the whole demo — fixed so every screen reconciles. */
export const DEMO_TODAY = "2026-09-16";
export const DEMO_NOW = "2026-09-16T14:35:00";
