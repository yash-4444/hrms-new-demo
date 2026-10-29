import { z } from "zod";

/* Validation for the full-page application form. */

export const NOTICE_OPTIONS = ["Immediate", "15 days", "30 days", "45 days", "60 days", "90 days"];

export const applySchema = z
  .object({
    fullName: z.string().trim().min(3, "Tell us your full name"),
    email: z.email("Enter an email address we can reply to"),
    phone: z.string().trim().min(8, "Enter a phone number with the country code"),
    experienceYears: z
      .number({ message: "Enter your years of experience" })
      .min(0, "That cannot be negative")
      .max(50, "Enter years, not months"),
    currentCompany: z.string().trim().optional(),
    skills: z.string().trim().min(2, "List a few skills, separated by commas"),
    education: z.string().trim().min(3, "Add your highest qualification"),
    noticePeriod: z.string().min(1, "Pick your notice period"),
    resumeName: z.string().min(1, "Attach your resume"),
    consent: z.boolean(),
  })
  .refine((v) => v.consent, {
    path: ["consent"],
    message: "We need your consent to store the application",
  });

export type ApplyValues = {
  fullName: string;
  email: string;
  phone: string;
  experienceYears: number;
  currentCompany?: string;
  skills: string;
  education: string;
  noticePeriod: string;
  resumeName: string;
  consent: boolean;
};

export const emptyApply = (): ApplyValues => ({
  fullName: "",
  email: "",
  phone: "",
  experienceYears: 0,
  currentCompany: "",
  skills: "",
  education: "",
  noticePeriod: "",
  resumeName: "",
  consent: false,
});

/** Fields the resume parser can fill. */
export const AI_FIELDS = ["fullName", "email", "phone", "experienceYears", "currentCompany", "skills", "education"] as const;
export type AiField = (typeof AI_FIELDS)[number];
