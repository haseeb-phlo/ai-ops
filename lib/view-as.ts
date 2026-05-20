"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSessionUser, ROLES, VIEW_AS_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedEmail } from "@/lib/auth-domain";
import { loadPeopleTeams } from "@/lib/teams";
import { resolveDisplayName } from "@/lib/profile";

// Defense-in-depth cap on the cookie payload's team field. Real team names
// from the directory are short; anything longer is suspicious. Used in both
// setViewAs and readViewAs.
const TEAM_MAX_LENGTH = 80;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cookieOptions() {
  return {
    path: "/" as const,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
  };
}

export async function setViewAs(role: string, team: string | null) {
  const user = await getSessionUser();
  if (user.realRole !== "super_admin") {
    return { error: "Only super admins can switch view-as." };
  }
  if (!(ROLES as readonly string[]).includes(role)) {
    return { error: "Invalid role." };
  }

  let validatedTeam: string | null = null;
  if (team !== null) {
    const trimmed = team.trim();
    if (trimmed.length === 0 || trimmed.length > TEAM_MAX_LENGTH) {
      return { error: "Invalid team." };
    }
    // Verify the team exists in the people directory so a super-admin can't
    // stash arbitrary cookie content (the cookie is read back into `user.team`
    // and shown in the impersonation banner).
    const supabase = await createClient();
    const teams = await loadPeopleTeams(supabase);
    if (!teams.includes(trimmed)) {
      return { error: "Invalid team." };
    }
    validatedTeam = trimmed;
  }

  const store = await cookies();
  store.set(
    VIEW_AS_COOKIE,
    JSON.stringify({ mode: "role", role, team: validatedTeam }),
    cookieOptions(),
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Impersonate a specific user. Looks up the target's identity, role, and
 * profile via the service-role admin client and snapshots them into the
 * cookie. Identity-based UI ("your comments / your votes / your workflows")
 * then resolves against the target's id; mutations remain blocked by
 * `requireWriter()` because `isImpersonating` is true.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (createAdminClient throws otherwise) -
 * dev environments without the key will surface a clear error to the caller.
 */
export async function setViewAsUser(userId: string) {
  const session = await getSessionUser();
  if (session.realRole !== "super_admin") {
    return { error: "Only super admins can switch view-as." };
  }
  if (typeof userId !== "string" || !UUID_RE.test(userId)) {
    return { error: "Invalid user id." };
  }
  if (userId === session.id) {
    // Picking yourself is the same as clearing impersonation.
    return clearViewAs();
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        "View-as-user requires SUPABASE_SERVICE_ROLE_KEY to be set on the server.",
    };
  }

  const { data: authRes, error: authErr } = await admin.auth.admin.getUserById(
    userId,
  );
  if (authErr || !authRes?.user?.email) {
    return { error: "User not found." };
  }
  const targetEmail = authRes.user.email;
  if (!isAllowedEmail(targetEmail)) {
    return { error: "User is outside the allowed domain." };
  }

  const [grantRes, profileRes, peopleRes] = await Promise.all([
    admin
      .from("role_grants")
      .select("role, team")
      .eq("user_id", userId)
      .maybeSingle<{ role: string; team: string | null }>(),
    admin
      .from("profiles")
      .select("display_name, avatar_url, title")
      .eq("user_id", userId)
      .maybeSingle<{
        display_name: string | null;
        avatar_url: string | null;
        title: string | null;
      }>(),
    admin
      .from("people")
      .select("display_name, title, team")
      .ilike("email", targetEmail)
      .maybeSingle<{
        display_name: string | null;
        title: string | null;
        team: string | null;
      }>(),
  ]);

  const targetRole = grantRes.data?.role ?? "member";
  // The cookie payload only carries `super_admin` or `member` - other DB
  // roles aren't meaningful in this app's UI gating yet.
  const normalizedRole =
    targetRole === "super_admin" ? "super_admin" : "member";
  const targetTeam =
    grantRes.data?.team ?? peopleRes.data?.team ?? null;
  const targetDisplayName = resolveDisplayName(
    profileRes.data?.display_name,
    peopleRes.data?.display_name,
    targetEmail,
  );
  const targetAvatar = profileRes.data?.avatar_url ?? null;
  const targetTitle = profileRes.data?.title ?? peopleRes.data?.title ?? null;

  const store = await cookies();
  store.set(
    VIEW_AS_COOKIE,
    JSON.stringify({
      mode: "user",
      userId,
      email: targetEmail,
      displayName: targetDisplayName,
      avatarUrl: targetAvatar,
      title: targetTitle,
      role: normalizedRole,
      team: targetTeam,
    }),
    cookieOptions(),
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearViewAs() {
  const store = await cookies();
  store.delete(VIEW_AS_COOKIE);
  revalidatePath("/", "layout");
  return { ok: true };
}
