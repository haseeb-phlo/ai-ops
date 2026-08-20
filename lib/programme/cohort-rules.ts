/**
 * Membership rules for the Core Programme, as pure predicates.
 *
 * These MIRROR database constraints rather than replacing them - the schema is
 * what makes the rules true (`programme_cohort_members_no_self_lead_check` and
 * the `enforce_single_active_cohort` trigger). These exist so a Server Action
 * can reject bad input with a readable message instead of surfacing a raw
 * Postgres error, and so the logic is unit-testable without a database.
 *
 * If you change a rule here, change the constraint too. The constraint is the
 * one that matters.
 */

/** Cohort statuses that block a second membership. */
export const ACTIVE_COHORT_STATUSES = ["planned", "live"] as const;

export type CohortStatus = "planned" | "live" | "complete" | "archived";

export function isActiveCohortStatus(status: string): boolean {
  return (ACTIVE_COHORT_STATUSES as readonly string[]).includes(status);
}

export type ExistingMembership = {
  cohortId: string;
  cohortName: string;
  status: string;
};

export type AddMemberCheck =
  | { ok: true }
  | { ok: false; reason: "self_lead" | "already_active"; message: string };

/**
 * Validates adding `userId` to a cohort.
 *
 * Two rules:
 *   1. A member's team lead may not be themselves. A lead who is also a cohort
 *      member has their own submissions signed off by THEIR lead - otherwise
 *      sign-off is self-approval.
 *   2. A user may not sit in two planned/live cohorts at once. Joining a
 *      complete/archived cohort is allowed (backfilling history), and so is
 *      being in an archived cohort while joining a live one.
 */
export function checkCanAddMember(args: {
  userId: string;
  teamLeadUserId: string | null;
  targetCohortStatus: string;
  existingMemberships: readonly ExistingMembership[];
}): AddMemberCheck {
  if (args.teamLeadUserId && args.teamLeadUserId === args.userId) {
    return {
      ok: false,
      reason: "self_lead",
      message:
        "A member can't be their own team lead — route their sign-offs to their manager.",
    };
  }

  if (isActiveCohortStatus(args.targetCohortStatus)) {
    const clash = args.existingMemberships.find((m) =>
      isActiveCohortStatus(m.status),
    );
    if (clash) {
      return {
        ok: false,
        reason: "already_active",
        message: `Already in an active cohort (${clash.cohortName}). Complete or archive it first.`,
      };
    }
  }

  return { ok: true };
}
