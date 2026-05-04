import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type RoleGrant = {
  role: string;
  team: string | null;
};

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  team: string | null;
};

/**
 * Loads the current user + their role_grants row.
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

  const { data: grant } = await supabase
    .from("role_grants")
    .select("role, team")
    .eq("user_id", user.id)
    .maybeSingle<RoleGrant>();

  return {
    id: user.id,
    email: user.email,
    role: grant?.role ?? "member",
    team: grant?.team ?? null,
  };
});
