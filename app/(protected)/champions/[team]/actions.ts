"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function recordChampionCheckIn(
  team: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getSessionUser();
  const supabase = await createClient();

  // The user can have at most one champion row for this team (partial
  // unique on team+user_id). Match by both so multi-champion teams work.
  const { data: champ } = await supabase
    .from("champions")
    .select("id")
    .eq("team", team)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!champ) {
    return { ok: false, message: "Only the team's champion can check in." };
  }

  const { error } = await supabase
    .from("champions")
    .update({ last_check_in: new Date().toISOString() })
    .eq("id", champ.id);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/champions/${team}`);
  revalidatePath("/map");
  revalidatePath("/admin");
  return { ok: true };
}
