import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth-domain";
import { resolveAvatar, resolveDisplayName } from "@/lib/profile";

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
  // null = not impersonating; "role" = role-only override; "user" = id/email/
  // role/team all snapshotted from a specific user. The mode matters because
  // user-mode swaps `id` and `email` while role-mode leaves them untouched.
  viewAsMode: "role" | "user" | null;
  // The target user's id when in user-mode (same as `id` in that case, but
  // typed separately so callers don't have to know about the override).
  impersonatedUserId: string | null;
  displayName: string;
  // The org directory's canonical name for this user (people.display_name).
  // Kept alongside `displayName` because owner_names columns are populated
  // from the directory at write time, while displayName prefers profile
  // overrides - the two can drift and we need both to match reliably.
  peopleDisplayName: string | null;
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

// Two view-as modes:
//   - "role": override just role/team. Identity (id, email, display name) is
//     unchanged - the super_admin is still themselves, just seeing the chrome
//     of a member.
//   - "user": override identity AND role/team to a specific user's snapshot,
//     so "is this my comment / my vote / my workflow" checks resolve against
//     that user. This is what makes the feature useful for reproducing bugs.
export type ViewAsRoleMode = {
  mode: "role";
  role: string;
  team: string | null;
};
export type ViewAsUserMode = {
  mode: "user";
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  title: string | null;
  role: string;
  team: string | null;
};
export type ViewAs = ViewAsRoleMode | ViewAsUserMode;

// Mirrors the cap in lib/view-as.ts. Defense-in-depth - setViewAs already
// rejects anything off, but a cookie that predates a tightening should not
// produce a long/garbled `team` value being rendered or compared later.
const VIEW_AS_TEAM_MAX_LENGTH = 80;
const VIEW_AS_TEXT_MAX_LENGTH = 200;
const VIEW_AS_URL_MAX_LENGTH = 2048;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeTeam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > VIEW_AS_TEAM_MAX_LENGTH) {
    return null;
  }
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null;
  return trimmed;
}

function sanitizeText(value: unknown, max = VIEW_AS_TEXT_MAX_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return null;
  return trimmed;
}

export function parseViewAsCookie(raw: string | undefined | null): ViewAs | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;

  // Back-compat: cookies written before user-mode have no `mode` field.
  const mode = typeof p.mode === "string" ? p.mode : "role";

  if (mode === "user") {
    const userId = typeof p.userId === "string" ? p.userId : null;
    if (!userId || !UUID_RE.test(userId)) return null;
    const email = sanitizeText(p.email);
    const displayName = sanitizeText(p.displayName);
    const role = typeof p.role === "string" ? p.role : null;
    if (!email || !displayName || !role) return null;
    if (!(ROLES as readonly string[]).includes(role)) return null;
    const avatarUrl = sanitizeText(p.avatarUrl, VIEW_AS_URL_MAX_LENGTH);
    const title = sanitizeText(p.title);
    return {
      mode: "user",
      userId,
      email,
      displayName,
      avatarUrl,
      title,
      role,
      team: sanitizeTeam(p.team),
    };
  }

  const role = typeof p.role === "string" ? p.role : null;
  if (!role || !(ROLES as readonly string[]).includes(role)) return null;
  return { mode: "role", role, team: sanitizeTeam(p.team) };
}

async function readViewAs(): Promise<ViewAs | null> {
  const store = await cookies();
  const raw = store.get(VIEW_AS_COOKIE)?.value;
  return parseViewAsCookie(raw);
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

  // Defense in depth - proxy.ts is the primary domain gate, but in case a
  // non-Phlo session reaches a Server Component (race during redirect, hook
  // change, etc.) we refuse to hand back a SessionUser. Sign-out happens on
  // the next proxy pass.
  if (!isAllowedEmail(user.email)) {
    redirect("/login?error=domain_blocked");
  }

  const [grantRes, profileRes, peopleRes] = await Promise.all([
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
    supabase
      .from("people")
      .select("display_name")
      .ilike("email", user.email)
      .maybeSingle<{ display_name: string | null }>(),
  ]);

  if (grantRes.error) {
    throw new Error(`Failed to load role_grants: ${grantRes.error.message}`);
  }
  if (profileRes.error) {
    throw new Error(`Failed to load profile: ${profileRes.error.message}`);
  }
  // Fail loud rather than silently falling through to email-local-part if the
  // people-directory RLS regresses. peopleRes is queried for display-name
  // resolution; a missing/errored result is a misconfig signal, not a normal
  // "user not in the directory" case (which returns null data with no error).
  if (peopleRes.error) {
    throw new Error(`Failed to load people directory: ${peopleRes.error.message}`);
  }

  const grant = grantRes.data;
  const profile = profileRes.data;
  const displayName = resolveDisplayName(
    profile?.display_name,
    peopleRes.data?.display_name,
    user.email,
  );

  const realRole = grant?.role ?? "member";
  const realTeam = grant?.team ?? null;

  let id = user.id;
  let email = user.email;
  let role = realRole;
  let team = realTeam;
  let isImpersonating = false;
  let viewAsMode: "role" | "user" | null = null;
  let impersonatedUserId: string | null = null;
  let effectiveDisplayName = displayName;
  let effectivePeopleDisplayName = peopleRes.data?.display_name ?? null;
  let effectiveAvatarUrl = resolveAvatar(profile?.avatar_url ?? null, user.id);
  let effectiveTitle = profile?.title ?? null;

  if (realRole === "super_admin") {
    const viewAs = await readViewAs();
    if (viewAs) {
      isImpersonating = true;
      viewAsMode = viewAs.mode;
      role = viewAs.role;
      team = viewAs.team;
      if (viewAs.mode === "user") {
        id = viewAs.userId;
        email = viewAs.email;
        impersonatedUserId = viewAs.userId;
        effectiveDisplayName = viewAs.displayName;
        // The directory's canonical name - best effort, since we only have the
        // snapshot taken at set-view-as time. Fine for owner_names matching.
        effectivePeopleDisplayName = viewAs.displayName;
        // Fall back to a Supabase avatar for the impersonated user when the
        // snapshot didn't include one.
        effectiveAvatarUrl =
          viewAs.avatarUrl ?? resolveAvatar(null, viewAs.userId);
        effectiveTitle = viewAs.title;
      }
    }
  }

  return {
    id,
    email,
    role,
    team,
    realRole,
    realTeam,
    isImpersonating,
    viewAsMode,
    impersonatedUserId,
    displayName: effectiveDisplayName,
    peopleDisplayName: effectivePeopleDisplayName,
    avatarUrl: effectiveAvatarUrl,
    title: effectiveTitle,
  };
});
