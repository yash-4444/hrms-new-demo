import { z } from "zod";
import { passwordField } from "@/components/self-service/password";

/* The /register wizard's form contract and its option lists. The password is
   validated here and lives only in the form — it is never part of a sign-up
   request (see signup-store.ts). */

export const COUNTRIES = [
  { value: "IN", label: "India", tz: "Asia/Kolkata", fy: "4", currency: "INR" },
  { value: "US", label: "United States", tz: "America/New_York", fy: "1", currency: "USD" },
  { value: "AE", label: "United Arab Emirates", tz: "Asia/Dubai", fy: "1", currency: "AED" },
  { value: "SG", label: "Singapore", tz: "Asia/Singapore", fy: "4", currency: "SGD" },
] as const;
export const TIMEZONES = ["Asia/Kolkata", "America/New_York", "Asia/Dubai", "Asia/Singapore", "Europe/London"];
export const SIZES = ["1–25", "26–100", "101–500", "501–2,000", "2,000+"] as const;

export const registerSchema = z.object({
  company: z.string().trim().min(2, "Enter your company's name"),
  subdomain: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .regex(/^[a-z0-9-]+$/, "Lower-case letters, numbers and hyphens only"),
  size: z.string().min(1, "Choose a company size"),
  adminName: z.string().trim().min(2, "Enter your full name"),
  adminEmail: z.string().trim().email("Enter a valid work email"),
  password: passwordField,
  country: z.enum(["IN", "US", "AE", "SG"]),
  fyStart: z.enum(["1", "4"]),
  timezone: z.string().min(1, "Choose a time zone"),
  plan: z.enum(["free", "pro", "enterprise"]),
  terms: z.boolean().refine((v) => v, "Accept the terms of service and privacy policy to continue"),
});
export type RegisterValues = z.infer<typeof registerSchema>;

export const REGISTER_DEFAULTS: RegisterValues = {
  company: "",
  subdomain: "",
  size: "",
  adminName: "",
  adminEmail: "",
  password: "",
  country: "IN",
  fyStart: "4",
  timezone: "Asia/Kolkata",
  plan: "pro",
  terms: false,
};

/** Company name → a subdomain suggestion: "Kaveri Textiles" → "kaveri-textiles". */
export const toSubdomain = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
