import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAvatar } from "@/lib/profile";

export type RoleGrant = {
  role: string;
  team: string | null;
};

export type Profile = {
  display_name: string | null;
  avatar_url: string | null;
  title: string | null;
};

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  team: string | null;
  realRole: string;
  realTeam: string | null;
  isImpersonating: boolean;
  displayName: string;
  avatarUrl: string;
  title: string | null;
};

export const VIEW_AS_COOKIE = "view_as";
export const ROLES = ["super_admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export const IMPERSONATION_BLOCK_MESSAGE =
  "Mutations are disabled while viewing as another role. Switch back to Super admin to make changes.";

// Use at the top of every mutating Server Action. A super_admin viewing as
// member still has super_admin privileges at the DB layer (auth.uid() is
// unchanged), so without this guard "test as a member" can silently write
// through any UI seam that didn't perfectly hide an admin path.
export async function requireWriter(): Promise<
  { ok: true; user: SessionUser } | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (user.isImpersonating) {
    return { ok: false, error: IMPERSONATION_BLOCK_MESSAGE };
  }
  return { ok: true, user };
}

type ViewAs = { role: string; team: string | null };

async function readViewAs(): Promise<ViewAs | null> {
  const store = await cookies();
  const raw = store.get(VIEW_AS_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ViewAs;
    if (!parsed?.role) return null;
    if (!(ROLES as readonly string[]).includes(parsed.role)) return null;
    return {
      role: parsed.role,
      team: typeof parsed.team === "string" ? parsed.team : null,
    };
  } catch {
    return null;
  }
}

/**
 * Loads the current user + role_grant + profile.
 * Cached for the duration of a single render so calling it
 * from layout + page + header doesn't hit the DB three times.
 */
export const getSessionUser = cache(async (): Promise<SessionUser> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  const [grantRes, profileRes] = await Promise.all([
    supabase
      .from("role_grants")
      .select("role, team")
      .eq("user_id", user.id)
      .maybeSingle<RoleGrant>(),
    supabase
      .from("profiles")
      .select("display_name, avatar_url, title")
      .eq("user_id", user.id)
      .maybeSingle<Profile>(),
  ]);

  if (grantRes.error) {
    throw new Error(`Failed to load role_grants: ${grantRes.error.message}`);
  }
  if (profileRes.error) {
    throw new Error(`Failed to load profile: ${profileRes.error.message}`);
  }

  const grant = grantRes.data;
  const profile = profileRes.data;
  const fallbackName = user.email.split("@")[0];
  const displayName = profile?.display_name?.trim() || fallbackName;

  const realRole = grant?.role ?? "member";
  const realTeam = grant?.team ?? null;

  let role = realRole;
  let team = realTeam;
  let isImpersonating = false;
  if (realRole === "super_admin") {
    const viewAs = await readViewAs();
    if (viewAs) {
      role = viewAs.role;
      team = viewAs.team;
      isImpersonating = true;
    }
  }

  return {
    id: user.id,
    email: user.email,
    role,
    team,
    realRole,
    realTeam,
    isImpersonating,
    displayName,
    avatarUrl: resolveAvatar(profile?.avatar_url ?? null, user.id),
    title: profile?.title ?? null,
  };
});
