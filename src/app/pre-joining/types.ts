import { z } from "zod";
import { DEMO_TODAY } from "@/mock/org";

/* Step list, per-step schemas and the shape of the saved wizard. */

export const STEPS = [
  { key: "personal", label: "Personal details" },
  { key: "documents", label: "Documents" },
  { key: "bank", label: "Bank details" },
  { key: "nominees", label: "Nominees" },
  { key: "declarations", label: "Declarations" },
  { key: "review", label: "Review & submit" },
] as const;
export const REVIEW_STEP = STEPS.length - 1;

/* ---------------------------------------------------------------- personal */

const ADULT_CUTOFF = `${Number(DEMO_TODAY.slice(0, 4)) - 18}${DEMO_TODAY.slice(4)}`;

export const GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"];
export const MARITAL = ["Single", "Married", "Divorced", "Widowed"];

export const personalSchema = z.object({
  dob: z
    .string()
    .min(1, "Enter your date of birth")
    .refine((v) => v <= ADULT_CUTOFF, { message: "You must be at least 18 on the joining date" }),
  gender: z.string().min(1, "Pick an option"),
  maritalStatus: z.string().min(1, "Pick an option"),
  addressLine: z.string().trim().min(5, "Enter house number and street"),
  city: z.string().trim().min(2, "Enter your city"),
  state: z.string().trim().min(2, "Enter your state"),
  pincode: z.string().trim().regex(/^\d{6}$/, "PIN codes are six digits"),
  emergencyName: z.string().trim().min(3, "Who should we call in an emergency?"),
  emergencyRelation: z.string().trim().min(2, "How are they related to you?"),
  emergencyPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 ]{9,15}$/, "Enter a 10-digit mobile number, with country code if outside India"),
});
export type PersonalValues = z.infer<typeof personalSchema>;

/* -------------------------------------------------------------------- bank */

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const bankSchema = z
  .object({
    holder: z.string().trim().min(3, "Enter the name exactly as it appears on the account"),
    accountNumber: z.string().trim().regex(/^\d{9,18}$/, "Account numbers are 9 to 18 digits"),
    confirmAccount: z.string().trim().min(1, "Re-enter the account number"),
    ifsc: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(IFSC_RE, "IFSC is 11 characters, e.g. HDFC0001234 — the fifth is always zero")),
  })
  .refine((v) => v.accountNumber === v.confirmAccount, {
    path: ["confirmAccount"],
    message: "The account numbers do not match",
  });
export type BankInput = z.input<typeof bankSchema>;
export type BankValues = z.output<typeof bankSchema>;

export const maskAccount = (n: string) => `XXXXXX${n.slice(-4)}`;

const IFSC_BANKS: Record<string, string> = {
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  SBIN: "State Bank of India",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  YESB: "Yes Bank",
  INDB: "IndusInd Bank",
};
export const bankFromIfsc = (ifsc: string) => IFSC_BANKS[ifsc.slice(0, 4).toUpperCase()];

/* ---------------------------------------------------------------- nominees */

export const RELATIONSHIPS = ["Spouse", "Father", "Mother", "Son", "Daughter", "Brother", "Sister"];

const nominee = z.object({
  name: z.string().trim().min(3, "Enter the nominee's full name"),
  relationship: z.string().min(1, "Pick a relationship"),
  share: z.number({ message: "Enter a share" }).min(1, "At least 1%").max(100, "At most 100%"),
});

const totalIs100 = (rows: { share: number }[]) => rows.reduce((a, r) => a + (Number.isFinite(r.share) ? r.share : 0), 0) === 100;

export const nomineesSchema = z.object({
  pf: z.array(nominee).min(1).refine(totalIs100, { message: "PF shares must add up to 100%" }),
  gratuity: z.array(nominee).min(1).refine(totalIs100, { message: "Gratuity shares must add up to 100%" }),
});
export type NomineeValues = z.infer<typeof nomineesSchema>;
export type Scheme = keyof NomineeValues;

/* ------------------------------------------------------------- the wizard */

export type DocsValues = Record<string, string>;
export type DeclValues = { policies: Record<string, boolean>; declaration: boolean };

export interface WizardData {
  personal?: PersonalValues;
  documents?: DocsValues;
  bank?: BankValues;
  nominees?: NomineeValues;
  declarations?: DeclValues;
}
