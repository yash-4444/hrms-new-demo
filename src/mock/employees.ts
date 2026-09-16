import { addDays, differenceInMonths, format, parseISO } from "date-fns";
import { mulberry32, pick, randInt } from "@/lib/utils";
import {
  BRANCHES,
  DEPARTMENTS,
  DESIGNATIONS,
  DEMO_TODAY,
  GRADES,
  TENANT,
} from "./org";

/* ============================================================================
   340 employees, generated deterministically from a fixed seed so every render
   (server and client) produces identical data.

   Guarantees the demo depends on:
     • employee codes STL-0001 … STL-0340, no gaps
     • a reporting hierarchy exactly 4 levels deep with NO cycles
       (managerCode always belongs to a strictly lower level index)
     • department headcounts match DEPARTMENTS[].headcount exactly
     • branch headcounts match BRANCHES[].headcount exactly
     • the six demo personas occupy their reserved codes
   ========================================================================== */

export type EmployeeStatus = "active" | "probation" | "notice" | "exited" | "on_leave";

export interface Employee {
  id: string; // = code, used in routes
  code: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: "Female" | "Male" | "Not disclosed";
  dob: string;
  designation: string;
  departmentId: string;
  branchId: string;
  gradeId: string;
  /** 0 = CEO, 3 = individual contributor. */
  level: number;
  managerCode: string | null;
  joiningDate: string;
  confirmationDate: string | null;
  status: EmployeeStatus;
  employmentType: "Full-time" | "Contract" | "Intern";
  workMode: "On-site" | "Hybrid" | "Remote";
  ctc: number;
  location: string;
  bankAccountLast4: string;
  hasBankDetails: boolean;
  pan: string;
  uan: string;
  skills: string[];
  exitDate?: string;
  exitReason?: string;
}

const FIRST_F = [
  "Ananya","Priya","Kavya","Sneha","Divya","Meera","Aishwarya","Nandini","Ritika","Shreya",
  "Pooja","Swati","Lakshmi","Anjali","Tanvi","Ishita","Neha","Rashmi","Deepika","Sanjana",
  "Bhavana","Gayatri","Harini","Namrata","Vaishnavi","Sana","Farah","Zoya","Aditi","Madhuri",
  "Emily","Sarah","Jessica","Rachel","Laura",
];
const FIRST_M = [
  "Arjun","Vikram","Rahul","Karthik","Rohit","Aditya","Siddharth","Nikhil","Pranav","Varun",
  "Manish","Suresh","Ganesh","Anand","Harsha","Abhishek","Sandeep","Ravi","Kiran","Naveen",
  "Tarun","Yashwanth","Chetan","Mohit","Imran","Faisal","Sameer","Ashwin","Girish","Prakash",
  "Michael","David","Brian","Kevin","Daniel",
];
const LAST = [
  "Rao","Shah","Menon","Desai","Iqbal","Kapoor","Nair","Reddy","Sharma","Iyer",
  "Verma","Gupta","Kulkarni","Joshi","Patel","Bhat","Hegde","Pillai","Chowdhury","Mukherjee",
  "Banerjee","Sinha","Mishra","Agarwal","Krishnan","Subramanian","Deshpande","Naidu","Gowda","Bose",
  "Sethi","Bansal","Chauhan","Malhotra","Khanna",
];
const LAST_US = ["Miller","Thompson","García","O'Brien","Whitaker","Okafor","Rossi","Novak"];

const SKILLS: Record<string, string[]> = {
  ENG: ["TypeScript","Go","Kubernetes","PostgreSQL","React","AWS","Kafka","Terraform","Python","gRPC"],
  PRD: ["Roadmapping","Discovery","SQL","Amplitude","Pricing","Stakeholder Mgmt"],
  DES: ["Figma","Design Systems","Prototyping","User Research","Accessibility"],
  SAL: ["Enterprise Sales","MEDDIC","Salesforce","Negotiation","Outbound"],
  MKT: ["SEO","Lifecycle","Content","HubSpot","Demand Gen","Brand"],
  CSM: ["Onboarding","Renewals","Zendesk","QBRs","Escalation Mgmt"],
  FIN: ["Ind AS","Payroll","GST","FP&A","Tally","Audit"],
  HR: ["Talent Acquisition","POSH","Employee Relations","Comp & Ben","HRIS"],
  ITO: ["Windows Server","Okta","Networking","Asset Mgmt","Incident Response","Linux"],
};

/* ------------------------------------------- reserved personas (codes 1-17) */

interface Seed {
  code: string;
  name: string;
  gender: Employee["gender"];
  designation: string;
  departmentId: string;
  branchId: string;
  gradeId: string;
  level: number;
  managerCode: string | null;
  joiningDate: string;
  ctc: number;
}

const SEEDED: Seed[] = [
  { code: "STL-0001", name: "Arjun Kapoor", gender: "Male", designation: "Founder & CEO", departmentId: "ENG", branchId: "BLR", gradeId: "G7", level: 0, managerCode: null, joiningDate: "2016-03-14", ctc: 11800000 },
  { code: "STL-0004", name: "Ramesh Subramanian", gender: "Male", designation: "VP Engineering", departmentId: "ENG", branchId: "BLR", gradeId: "G7", level: 1, managerCode: "STL-0001", joiningDate: "2016-07-01", ctc: 8600000 },
  { code: "STL-0005", name: "Neha Malhotra", gender: "Female", designation: "Chief Revenue Officer", departmentId: "SAL", branchId: "BLR", gradeId: "G7", level: 1, managerCode: "STL-0001", joiningDate: "2017-02-06", ctc: 8200000 },
  { code: "STL-0006", name: "Aditi Krishnan", gender: "Female", designation: "Chief Product Officer", departmentId: "PRD", branchId: "BLR", gradeId: "G7", level: 1, managerCode: "STL-0001", joiningDate: "2017-05-22", ctc: 7900000 },
  { code: "STL-0007", name: "Sandeep Nair", gender: "Male", designation: "Director of Customer Success", departmentId: "CSM", branchId: "PNQ", gradeId: "G6", level: 1, managerCode: "STL-0001", joiningDate: "2018-01-08", ctc: 5400000 },
  { code: "STL-0008", name: "Lakshmi Pillai", gender: "Female", designation: "Chief Financial Officer", departmentId: "FIN", branchId: "BLR", gradeId: "G7", level: 1, managerCode: "STL-0001", joiningDate: "2017-09-11", ctc: 7600000 },
  { code: "STL-0009", name: "Priya Menon", gender: "Female", designation: "Head of People Operations", departmentId: "HR", branchId: "BLR", gradeId: "G6", level: 1, managerCode: "STL-0001", joiningDate: "2018-04-02", ctc: 5200000 },
  { code: "STL-0010", name: "Girish Gowda", gender: "Male", designation: "Director of IT", departmentId: "ITO", branchId: "BLR", gradeId: "G6", level: 1, managerCode: "STL-0001", joiningDate: "2018-06-18", ctc: 4900000 },
  { code: "STL-0011", name: "Tanvi Deshpande", gender: "Female", designation: "Head of Design", departmentId: "DES", branchId: "BLR", gradeId: "G6", level: 2, managerCode: "STL-0006", joiningDate: "2019-02-11", ctc: 4400000 },
  { code: "STL-0013", name: "Mohit Sethi", gender: "Male", designation: "Director of Marketing", departmentId: "MKT", branchId: "BLR", gradeId: "G6", level: 2, managerCode: "STL-0005", joiningDate: "2019-08-05", ctc: 4300000 },
  { code: "STL-0017", name: "Rahul Desai", gender: "Male", designation: "Payroll Manager", departmentId: "FIN", branchId: "PNQ", gradeId: "G5", level: 2, managerCode: "STL-0008", joiningDate: "2019-11-04", ctc: 3200000 },
  { code: "STL-0031", name: "Vikram Shah", gender: "Male", designation: "Engineering Manager", departmentId: "ENG", branchId: "BLR", gradeId: "G5", level: 2, managerCode: "STL-0004", joiningDate: "2020-01-13", ctc: 3900000 },
  { code: "STL-0058", name: "Sana Iqbal", gender: "Female", designation: "Talent Acquisition Lead", departmentId: "HR", branchId: "BLR", gradeId: "G4", level: 2, managerCode: "STL-0009", joiningDate: "2021-03-15", ctc: 2450000 },
  { code: "STL-0142", name: "Ananya Rao", gender: "Female", designation: "Software Engineer", departmentId: "ENG", branchId: "BLR", gradeId: "G2", level: 3, managerCode: "STL-0031", joiningDate: "2023-06-19", ctc: 1180000 },
];

/* Vikram Shah's 8 direct reportees — fixed so the manager demo is stable. */
export const VIKRAM_TEAM_CODES = [
  "STL-0142", "STL-0143", "STL-0144", "STL-0145",
  "STL-0146", "STL-0147", "STL-0148", "STL-0149",
];

const EXTRA_VIKRAM_REPORTS: Seed[] = [
  { code: "STL-0143", name: "Karthik Reddy", gender: "Male", designation: "Senior Software Engineer", departmentId: "ENG", branchId: "BLR", gradeId: "G3", level: 3, managerCode: "STL-0031", joiningDate: "2021-08-02", ctc: 1840000 },
  { code: "STL-0144", name: "Kavya Iyer", gender: "Female", designation: "Software Engineer", departmentId: "ENG", branchId: "BLR", gradeId: "G2", level: 3, managerCode: "STL-0031", joiningDate: "2022-11-14", ctc: 1290000 },
  { code: "STL-0145", name: "Pranav Joshi", gender: "Male", designation: "Staff Engineer", departmentId: "ENG", branchId: "BLR", gradeId: "G4", level: 3, managerCode: "STL-0031", joiningDate: "2019-09-23", ctc: 2680000 },
  { code: "STL-0146", name: "Shreya Bhat", gender: "Female", designation: "Senior Software Engineer", departmentId: "ENG", branchId: "BLR", gradeId: "G3", level: 3, managerCode: "STL-0031", joiningDate: "2022-02-07", ctc: 1720000 },
  { code: "STL-0147", name: "Imran Chauhan", gender: "Male", designation: "Software Engineer", departmentId: "ENG", branchId: "PNQ", gradeId: "G2", level: 3, managerCode: "STL-0031", joiningDate: "2024-01-08", ctc: 1120000 },
  { code: "STL-0148", name: "Nandini Hegde", gender: "Female", designation: "Associate Software Engineer", departmentId: "ENG", branchId: "BLR", gradeId: "G1", level: 3, managerCode: "STL-0031", joiningDate: "2025-07-21", ctc: 720000 },
  { code: "STL-0149", name: "Daniel Whitaker", gender: "Male", designation: "Senior Software Engineer", departmentId: "ENG", branchId: "EWR", gradeId: "G3", level: 3, managerCode: "STL-0031", joiningDate: "2023-03-06", ctc: 1980000 },
];

const ALL_SEEDS = [...SEEDED, ...EXTRA_VIKRAM_REPORTS];
const SEED_BY_CODE = new Map(ALL_SEEDS.map((s) => [s.code, s]));

/* ------------------------------------------------------------- generation */

const TODAY = parseISO(DEMO_TODAY);

function slugEmail(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .trim()
      .split(/\s+/)
      .join(".") + "@stellartech.in"
  );
}

function buildDeptPlan() {
  /* Department slots, in code order, so headcounts match DEPARTMENTS exactly. */
  const plan: string[] = [];
  for (const d of DEPARTMENTS) for (let i = 0; i < d.headcount; i++) plan.push(d.id);
  return plan; // length 340
}

function buildBranchPlan(rng: () => number) {
  const plan: string[] = [];
  for (const b of BRANCHES) for (let i = 0; i < b.headcount; i++) plan.push(b.id);
  // deterministic shuffle so branches interleave across departments
  for (let i = plan.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [plan[i], plan[j]] = [plan[j], plan[i]];
  }
  return plan;
}

function generate(): Employee[] {
  const rng = mulberry32(20260916);
  const deptPlan = buildDeptPlan();
  const branchPlan = buildBranchPlan(mulberry32(777));

  // Reserve department/branch slots for the seeded people first.
  const takeDept = (id: string) => {
    const i = deptPlan.indexOf(id);
    if (i >= 0) deptPlan.splice(i, 1);
  };
  const takeBranch = (id: string) => {
    const i = branchPlan.indexOf(id);
    if (i >= 0) branchPlan.splice(i, 1);
  };
  for (const s of ALL_SEEDS) {
    takeDept(s.departmentId);
    takeBranch(s.branchId);
  }

  const list: Employee[] = [];
  const managersByLevel: Record<number, string[]> = { 0: [], 1: [], 2: [] };
  /* Names already spoken for by the seeded personas — no accidental twins. */
  const usedNames = new Set(ALL_SEEDS.map((s) => s.name));
  /* Vikram's team is hand-authored at exactly 8; the generator must not
     hang extra reportees off him, or the persona blurb stops being true. */
  const CLOSED_MANAGERS = new Set(["STL-0031"]);

  const finalise = (base: Omit<Employee, "skills" | "location" | "confirmationDate" | "status" | "bankAccountLast4" | "hasBankDetails" | "pan" | "uan" | "dob" | "phone" | "email" | "firstName" | "lastName" | "employmentType" | "workMode">): Employee => {
    const [firstName, ...rest] = base.name.split(" ");
    const branch = BRANCHES.find((b) => b.id === base.branchId)!;
    const monthsIn = differenceInMonths(TODAY, parseISO(base.joiningDate));
    const confirmed = monthsIn >= 6;
    const r = rng();
    let status: EmployeeStatus = confirmed ? "active" : "probation";
    if (confirmed && r > 0.972) status = "notice";
    else if (confirmed && r > 0.955) status = "on_leave";

    const hasBank = rng() > 0.012; // a handful lack bank details -> payroll exception
    return {
      ...base,
      firstName,
      lastName: rest.join(" "),
      email: slugEmail(base.name),
      phone:
        branch.country === "US"
          ? `+1 ${randInt(rng, 201, 989)} ${randInt(rng, 200, 999)} ${String(randInt(rng, 0, 9999)).padStart(4, "0")}`
          : `+91 ${randInt(rng, 70, 99)}${String(randInt(rng, 0, 99999999)).padStart(8, "0")}`,
      dob: format(addDays(parseISO("1985-01-01"), randInt(rng, 0, 5800)), "yyyy-MM-dd"),
      confirmationDate: confirmed ? format(addDays(parseISO(base.joiningDate), 180), "yyyy-MM-dd") : null,
      status,
      employmentType: rng() > 0.94 ? (rng() > 0.5 ? "Contract" : "Intern") : "Full-time",
      workMode: rng() > 0.72 ? "Remote" : rng() > 0.35 ? "Hybrid" : "On-site",
      location: branch.city,
      bankAccountLast4: String(randInt(rng, 1000, 9999)),
      hasBankDetails: hasBank,
      pan: `${["A","B","C","D","E"][randInt(rng, 0, 4)]}${["A","K","M","P","R"][randInt(rng, 0, 4)]}XPS${String(randInt(rng, 1000, 9999))}${["A","D","G","K","N"][randInt(rng, 0, 4)]}`,
      uan: `1010${String(randInt(rng, 10000000, 99999999))}`,
      skills: [...(SKILLS[base.departmentId] ?? [])]
        .sort(() => rng() - 0.5)
        .slice(0, randInt(rng, 3, 5)),
    };
  };

  for (let i = 1; i <= TENANT.headcount; i++) {
    const code = `STL-${String(i).padStart(4, "0")}`;
    const seed = SEED_BY_CODE.get(code);

    if (seed) {
      const emp = finalise({
        id: code,
        code,
        name: seed.name,
        gender: seed.gender,
        designation: seed.designation,
        departmentId: seed.departmentId,
        branchId: seed.branchId,
        gradeId: seed.gradeId,
        level: seed.level,
        managerCode: seed.managerCode,
        joiningDate: seed.joiningDate,
        ctc: seed.ctc,
      });
      emp.status = "active";
      emp.hasBankDetails = true;
      list.push(emp);
      if (seed.level <= 2 && !CLOSED_MANAGERS.has(code)) managersByLevel[seed.level].push(code);
      continue;
    }

    const departmentId = deptPlan.shift() ?? "ENG";
    const branchId = branchPlan.shift() ?? "BLR";

    /* Level: keep the tree exactly 4 deep (0..3) and fill managers first. */
    let level: number;
    if (managersByLevel[1].length < 8) level = 1;
    else if (managersByLevel[2].length < 34) level = 2;
    else level = 3;

    const designations = DESIGNATIONS[departmentId];
    const gradeIdx = level === 1 ? 5 : level === 2 ? 4 : randInt(rng, 0, 3);
    const gradeId = GRADES[gradeIdx].id;
    const designation = designations[Math.min(gradeIdx, designations.length - 1)];

    const female = rng() > 0.62;
    const isUs = branchId === "EWR";
    const first = female ? pick(rng, FIRST_F) : pick(rng, FIRST_M);
    const last = isUs && rng() > 0.4 ? pick(rng, LAST_US) : pick(rng, LAST);
    let name = `${first} ${last}`;
    while (usedNames.has(name)) {
      name = `${female ? pick(rng, FIRST_F) : pick(rng, FIRST_M)} ${pick(rng, LAST)}`;
    }
    usedNames.add(name);

    /* Joining dates spread over 8 years, weighted toward recent hires. */
    const t = Math.pow(rng(), 0.72);
    const joiningDate = format(addDays(parseISO("2017-09-16"), Math.floor(t * 3280)), "yyyy-MM-dd");

    const pool = managersByLevel[level - 1] ?? managersByLevel[0];
    const managerCode = pool[Math.floor(rng() * pool.length)] ?? "STL-0001";

    const g = GRADES[gradeIdx];
    const ctc = Math.round((g.minCtc + rng() * (g.maxCtc - g.minCtc)) / 1000) * 1000;

    const emp = finalise({
      id: code,
      code,
      name,
      gender: female ? "Female" : rng() > 0.99 ? "Not disclosed" : "Male",
      designation,
      departmentId,
      branchId,
      gradeId,
      level,
      managerCode,
      joiningDate,
      ctc,
    });
    list.push(emp);
    if (level <= 2 && !CLOSED_MANAGERS.has(code)) managersByLevel[level].push(code);
  }

  /* A handful of exits this quarter so attrition numbers have a source. */
  const exitRng = mulberry32(31337);
  const exitReasons = [
    "Better opportunity",
    "Relocation",
    "Higher studies",
    "Compensation",
    "Personal reasons",
    "Performance",
  ];
  list
    .filter((e) => e.status === "notice")
    .forEach((e) => {
      e.exitDate = format(addDays(TODAY, randInt(exitRng, 5, 58)), "yyyy-MM-dd");
      e.exitReason = pick(exitRng, exitReasons);
    });

  return list;
}

export const EMPLOYEES: Employee[] = generate();

export const EMPLOYEE_BY_CODE = new Map(EMPLOYEES.map((e) => [e.code, e]));
export const employeeByCode = (code: string) => EMPLOYEE_BY_CODE.get(code);
export const employeeName = (code: string | null | undefined) =>
  (code && EMPLOYEE_BY_CODE.get(code)?.name) || "—";

export const reporteesOf = (code: string) => EMPLOYEES.filter((e) => e.managerCode === code);

/** Full chain to the CEO — proves the hierarchy has no cycles. */
export function managerChain(code: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur = employeeByCode(code)?.managerCode ?? null;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    chain.push(cur);
    cur = employeeByCode(cur)?.managerCode ?? null;
  }
  return chain;
}

/** Everyone under `code`, at any depth. */
export function descendantsOf(code: string): Employee[] {
  const out: Employee[] = [];
  const stack = [code];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const r of reporteesOf(cur)) {
      out.push(r);
      stack.push(r.code);
    }
  }
  return out;
}

/* ------------------------------------------------- headline people stats */

export const PEOPLE_STATS = (() => {
  const active = EMPLOYEES.filter((e) => e.status !== "exited");
  const female = active.filter((e) => e.gender === "Female").length;
  const male = active.filter((e) => e.gender === "Male").length;
  const other = active.length - female - male;
  const managers = new Set(active.map((e) => e.managerCode).filter(Boolean)).size;
  const tenures = active.map((e) => differenceInMonths(TODAY, parseISO(e.joiningDate)) / 12);
  return {
    headcount: active.length,
    female,
    male,
    other,
    femalePct: (female / active.length) * 100,
    managers,
    spanOfControl: active.length / Math.max(1, managers),
    avgTenureYears: tenures.reduce((a, b) => a + b, 0) / tenures.length,
    onNotice: active.filter((e) => e.status === "notice").length,
    onProbation: active.filter((e) => e.status === "probation").length,
    totalCtc: active.reduce((a, e) => a + e.ctc, 0),
  };
})();

/** Demo subset that has 90 days of attendance generated for it. */
export const ATTENDANCE_SUBSET = EMPLOYEES.filter(
  (e) => VIKRAM_TEAM_CODES.includes(e.code) || e.departmentId === "ENG",
)
  .slice(0, 40)
  .map((e) => e.code);
