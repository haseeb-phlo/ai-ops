import { cache } from "react";
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
  displayName: string;
  avatarUrl: string;
  title: string | null;
};

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

  const grant = grantRes.data;
  const profile = profileRes.data;
  const fallbackName = user.email.split("@")[0];
  const displayName = profile?.display_name?.trim() || fallbackName;

  return {
    id: user.id,
    email: user.email,
    role: grant?.role ?? "member",
    team: grant?.team ?? null,
    displayName,
    avatarUrl: resolveAvatar(profile?.avatar_url ?? null, user.id),
    title: profile?.title ?? null,
  };
});
