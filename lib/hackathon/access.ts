/**
 * Who can open the Hackathon tab, and how much of it.
 *
 * Three states, and every hackathon surface branches on this one function
 * rather than deciding for itself - the same shape, and for the same reason,
 * as `lib/programme/learn-access.ts`:
 *
 *   "locked" - not invited. The tab is not in the nav and the route
 *              redirects. The hackathon has its own guest list, kept in
 *              `hackathon_participants`, and this is what not being on it
 *              looks like.
 *   "survey" - invited, has not answered. The form, and only the form. The
 *              problem bank is deliberately shut until you have put your own
 *              problem in it: the bank is colleagues' unedited descriptions
 *              of what they find tedious, and reading those before writing
 *              your own is how you end up writing theirs.
 *   "open"   - invited and answered. Form (revisable) plus the bank.
 *
 * SUPER ADMINS ARE ALWAYS "open", never "locked", whether or not they are on
 * the list - because they are the ones who write the list, and an empty
 * register would otherwise lock the organiser out of the tab that holds the
 * only way to fill it. This mirrors the `is_super_admin()` arm on the
 * table's policies; if one changes the other has to.
 *
 * REAL ROLE, not the effective one, for that admin arm - the rule every
 * mutation guard and every Learn surface follows. The consequence is that a
 * super admin keeps the tab while viewing as a member rather than seeing the
 * member's gate, which is the same trade Learn makes for its admin tabs: the
 * chrome you administer should not vanish because you are reproducing
 * somebody else's view. What they cannot do while impersonating is submit -
 * `requireWriter()` blocks that, as it does everywhere.
 */

export type HackathonAccess = "locked" | "survey" | "open";

export function hackathonAccess(input: {
  /** Their email is in `hackathon_participants`. */
  isParticipant: boolean;
  /** A `hackathon_survey_responses` row exists for this person. */
  hasResponded: boolean;
  /** `user.realRole`. */
  realRole: string;
}): HackathonAccess {
  const isAdmin = input.realRole === "super_admin";
  if (!input.isParticipant && !isAdmin) return "locked";
  if (input.hasResponded || isAdmin) return "open";
  return "survey";
}

/** Whether the Hackathon tab appears in the sidebar, mobile bar and palette. */
export function canSeeHackathon(access: HackathonAccess): boolean {
  return access !== "locked";
}

/** Whether the problem bank is readable. Mirrors the table's select policy. */
export function canSeeProblemBank(access: HackathonAccess): boolean {
  return access === "open";
}
