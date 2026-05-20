import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEmail } from "@/lib/auth-domain";
import { resolveDisplayName } from "@/lib/profile";

export type ImpersonableUser = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  team: string | null;
  title: string | null;
};

/**
 * List the users a super_admin can impersonate (everyone in the org domain
 * who has a Supabase auth row).
 *
 * Uses the service-role admin client because `auth.users` isn't reachable
 * from the user's JWT, but only after the caller has been confirmed as a
 * real super_admin (the only caller is the protected layout, which checks
 * `realRole === "super_admin"` first).
 *
 * Returns an empty array if the service role key is unset (dev environments
 * boot without it) - the picker UI handles that gracefully.
 */
export async function loadImpersonableUsers(): Promise<ImpersonableUser[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }

  // Page through auth.users. Default page size is 50; cap pages so a
  // misconfig can't loop forever.
  type AuthUserLite = { id: string; email?: string | null };
  const authUsers: AuthUserLite[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) break;
    const batch = data?.users ?? [];
    for (const u of batch) {
      if (u.email && isAllowedEmail(u.email)) {
        authUsers.push({ id: u.id, email: u.email });
      }
    }
    if (batch.length < 200) break;
  }
  if (authUsers.length === 0) return [];

  const userIds = authUsers.map((u) => u.id);
  const emails = authUsers.map((u) => u.email!.toLowerCase());

  const [grantsRes, profilesRes, peopleRes] = await Promise.all([
    admin
      .from("role_grants")
      .select("user_id, role, team")
      .in("user_id", userIds)
      .returns<{ user_id: string; role: string; team: string | null }[]>(),
    admin
      .from("profiles")
      .select("user_id, display_name, title")
      .in("user_id", userIds)
      .returns<{
        user_id: string;
        display_name: string | null;
        title: string | null;
      }[]>(),
    admin
      .from("people")
      .select("email, display_name, title, team")
      .in("email", emails)
      .returns<{
        email: string;
        display_name: string | null;
        title: string | null;
        team: string | null;
      }[]>(),
  ]);

  const grantByUserId = new Map(
    (grantsRes.data ?? []).map((g) => [g.user_id, g]),
  );
  const profileByUserId = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id, p]),
  );
  const peopleByEmail = new Map(
    (peopleRes.data ?? []).map((p) => [p.email.toLowerCase(), p]),
  );

  const out: ImpersonableUser[] = authUsers.map((u) => {
    const grant = grantByUserId.get(u.id);
    const profile = profileByUserId.get(u.id);
    const person = peopleByEmail.get(u.email!.toLowerCase());
    const displayName = resolveDisplayName(
      profile?.display_name,
      person?.display_name,
      u.email!,
    );
    const rawRole = grant?.role ?? "member";
    const role = rawRole === "super_admin" ? "super_admin" : "member";
    return {
      userId: u.id,
      email: u.email!,
      displayName,
      role,
      team: grant?.team ?? person?.team ?? null,
      title: profile?.title ?? person?.title ?? null,
    };
  });

  out.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return out;
}
