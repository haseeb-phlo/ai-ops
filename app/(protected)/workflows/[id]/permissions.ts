// Edit rights: super admin, the person who logged it, or anyone whose
// display name is listed in owner_names. Name match is trimmed and
// case-insensitive so directory quirks don't lock out the actual owner.
export function canUserEditWorkflow(
  user: { id: string; role: string; displayName: string },
  workflow: { created_by: string | null; owner_names: string[] | null },
): boolean {
  if (user.role === "super_admin") return true;
  if (workflow.created_by && workflow.created_by === user.id) return true;
  const me = user.displayName.trim().toLowerCase();
  if (!me) return false;
  return (workflow.owner_names ?? []).some(
    (n) => n.trim().toLowerCase() === me,
  );
}
