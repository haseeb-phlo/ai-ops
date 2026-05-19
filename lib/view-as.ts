"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSessionUser, ROLES, VIEW_AS_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPeopleTeams } from "@/lib/teams";

// Defense-in-depth cap on the cookie payload's team field. Real team names
// from the directory are short; anything longer is suspicious. Used in both
// setViewAs and readViewAs.
const TEAM_MAX_LENGTH = 80;

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
    JSON.stringify({ role, team: validatedTeam }),
    {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24,
    },
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
