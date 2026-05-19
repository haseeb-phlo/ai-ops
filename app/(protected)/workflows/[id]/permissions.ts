// Edit rights: super admin, the person who logged it (created_by), or anyone
// whose identity matches an entry in owner_names.
//
// "Matches" is intentionally generous - users get locked out when their
// profile.display_name has drifted from the directory's people.display_name
// that the workflow's owner_names were stamped from at creation time. So we
// compare every name we know for the user (profile-resolved display name,
// directory canonical name, email, email-local-part) against every entry in
// owner_names, all case-insensitive and trimmed.
//
// `role` here is the *effective* role - the one driving the current view.
// For an impersonating super-admin viewing as a member, this evaluates as
// the member would see it (admin chrome stays hidden). Mutation callers
// must run `requireWriter()` *before* invoking this; requireWriter rejects
// impersonating sessions, after which effective == real and the check is
// equivalent either way.
export function canUserEditWorkflow(
  user: {
    id: string;
    role: string;
    email: string;
    displayName: string;
    peopleDisplayName: string | null;
  },
  workflow: { created_by: string | null; owner_names: string[] | null },
): boolean {
  if (user.role === "super_admin") return true;
  if (workflow.created_by && workflow.created_by === user.id) return true;

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
