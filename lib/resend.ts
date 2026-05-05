import "server-only";
import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  // We don't throw at import time so dev environments without a key can still
  // boot; callers check resendOrNull() before sending.
  console.warn("[resend] RESEND_API_KEY is not set; email sends will no-op.");
}

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/**
 * Default "From" address. Set EMAIL_FROM in env to override; falls back to
 * the Resend test domain so dev environments don't crash before a custom
 * domain is verified.
 */
export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Phlo AI Ops <onboarding@resend.dev>";
