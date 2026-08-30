/**
 * Reading a pasted roster into a list of addresses.
 *
 * An admin enrolling a cohort has the list in a spreadsheet column, a Slack
 * message or an Outlook To: field, and retyping it is how a cohort ends up
 * with three people missing. So the parser accepts all the shapes those
 * produce - newlines, commas, semicolons, tabs, and `Display Name
 * <someone@wearephlo.com>` - rather than insisting on one.
 *
 * Kept beside the action rather than inside it so it can be unit-tested: a
 * "use server" file may only export async functions.
 */

import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from "@/lib/auth-domain";

export type ParsedRoster = {
  /** Lowercased, de-duplicated, order preserved. */
  emails: string[];
  /**
   * Entries that were not a usable address. Reported back rather than
   * dropped: silently ignoring a typo is how somebody misses their cohort.
   */
  rejected: string[];
};

/** Pulls the address out of `Name <addr>`, or returns the token unchanged. */
function unwrap(token: string): string {
  const angled = token.match(/<([^>]+)>/);
  return (angled ? angled[1] : token).trim().replace(/^[,;]+|[,;]+$/g, "");
}

export function parseRoster(text: string): ParsedRoster {
  const seen = new Set<string>();
  const emails: string[] = [];
  const rejected: string[] = [];

  // Split on everything that separates addresses in the wild EXCEPT the
  // characters that can appear inside one.
  for (const raw of text.split(/[\s,;]+/)) {
    const token = raw.trim();
    if (token === "") continue;

    const candidate = unwrap(token).toLowerCase();
    if (!isAllowedEmail(candidate) || candidate.split("@").length !== 2) {
      rejected.push(token);
      continue;
    }
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    emails.push(candidate);
  }

  return { emails, rejected };
}

/** For the "these weren't addresses" message. */
export function describeRejected(rejected: readonly string[]): string {
  if (rejected.length === 0) return "";
  const shown = rejected.slice(0, 5).join(", ");
  const more = rejected.length > 5 ? ` and ${rejected.length - 5} more` : "";
  return `Ignored ${rejected.length} entr${rejected.length === 1 ? "y" : "ies"} that weren't @${ALLOWED_EMAIL_DOMAIN} addresses: ${shown}${more}.`;
}

export type EnrolOutcome = {
  /** Became a member right away - they already had an account. */
  enrolled: string[];
  /** Recorded as pending; becomes a membership on their first sign-in. */
  pending: string[];
  /** Already in this cohort. Re-running an enrolment lands everyone here. */
  alreadyIn: string[];
  /** In a different planned/live cohort, so the single-cohort rule blocks it. */
  clashed: string[];
  /** Refused by the database for any other reason, with the message. */
  failed: { email: string; reason: string }[];
};

export function emptyOutcome(): EnrolOutcome {
  return { enrolled: [], pending: [], alreadyIn: [], clashed: [], failed: [] };
}

/** One line an admin can read at a glance. */
export function summariseOutcome(outcome: EnrolOutcome): string {
  const parts: string[] = [];
  if (outcome.enrolled.length > 0) {
    parts.push(`${outcome.enrolled.length} enrolled`);
  }
  if (outcome.pending.length > 0) {
    parts.push(
      `${outcome.pending.length} waiting for a first sign-in`,
    );
  }
  if (outcome.alreadyIn.length > 0) {
    parts.push(`${outcome.alreadyIn.length} already in`);
  }
  if (outcome.clashed.length > 0) {
    parts.push(`${outcome.clashed.length} in another cohort`);
  }
  if (outcome.failed.length > 0) {
    parts.push(`${outcome.failed.length} failed`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Nothing to do.";
}
