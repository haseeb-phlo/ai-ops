// Edit rights, evaluated in order:
//   1. super admin
//   2. the person who logged it (created_by)
//   3. a member of the workflow's team (both sides non-null and equal)
//   4. anyone whose identity matches an entry in owner_names
//
// The owner_names match is intentionally generous - users get locked out
// when their profile.display_name has drifted from the directory's
// people.display_name that the workflow's owner_names were stamped from
// at creation time. So we compare every name we know for the user
// (profile-resolved display name, directory canonical name, email,
// email-local-part) against every entry in owner_names, all case-
// insensitive and trimmed.
//
// `role` and `team` here are the *effective* values - the ones driving
// the current view. For an impersonating super-admin viewing as a member,
// this evaluates as the member would see it (admin chrome stays hidden).
// Mutation callers must run `requireWriter()` *before* invoking this;
// requireWriter rejects impersonating sessions, after which effective ==
// real and the check is equivalent either way.
export function canUserEditWorkflow(
  user: {
    id: string;
    role: string;
    team: string | null;
    email: string;
    displayName: string;
    peopleDisplayName: string | null;
  },
  workflow: {
    created_by: string | null;
    owner_names: string[] | null;
    team: string | null;
  },
): boolean {
  if (user.role === "super_admin") return true;
  if (workflow.created_by && workflow.created_by === user.id) return true;

  // Same-team match: both sides must be non-null and equal (case-
  // insensitive, trimmed). Null-vs-null does NOT match - we don't want
  // every untyped workflow to be editable by every untyped user.
  if (user.team && workflow.team) {
    const u = user.team.trim().toLowerCase();
    const w = workflow.team.trim().toLowerCase();
    if (u && u === w) return true;
  }

  const candidates = new Set<string>();
  const add = (s: string | null | undefined) => {
    const t = s?.trim().toLowerCase();
    if (t) candidates.add(t);
  };
  add(user.displayName);
  add(user.peopleDisplayName);
  add(user.email);
  add(user.email.split("@")[0]);
  if (candidates.size === 0) return false;

  return (workflow.owner_names ?? []).some((n) =>
    candidates.has(n.trim().toLowerCase()),
  );
}
