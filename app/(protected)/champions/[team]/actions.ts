"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const EditorialSchema = z.object({
  team: z.string().trim().min(1),
  blurb: z.string().trim().max(2000).optional().default(""),
  chewing_on: z.string().trim().max(2000).optional().default(""),
});

export type ChampionEditorialState =
  | { kind: "idle" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export async function updateChampionEditorial(
  _prev: ChampionEditorialState,
  formData: FormData,
): Promise<ChampionEditorialState> {
  const user = await getSessionUser();

  const parsed = EditorialSchema.safeParse({
    team: formData.get("team"),
    blurb: formData.get("blurb") ?? "",
    chewing_on: formData.get("chewing_on") ?? "",
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();

  // Authorisation: only the champion themself, or a super-admin, can edit.
  const { data: champ } = await supabase
    .from("champions")
    .select("user_id")
    .eq("team", parsed.data.team)
    .maybeSingle<{ user_id: string | null }>();

  const isOwner = champ?.user_id === user.id;
  const isSuper = user.realRole === "super_admin";
  if (!isOwner && !isSuper) {
    return { kind: "error", message: "You're not the champion of this team." };
  }

  const { error } = await supabase
    .from("champions")
    .update({
      blurb: parsed.data.blurb || null,
      chewing_on: parsed.data.chewing_on || null,
      updated_at: new Date().toISOString(),
    })
    .eq("team", parsed.data.team);

  if (error) {
    return { kind: "error", message: error.message };
  }

  revalidatePath(`/champions/${parsed.data.team}`);
  revalidatePath("/champions");
  return { kind: "ok" };
}

export async function recordChampionCheckIn(
  team: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data: champ } = await supabase
    .from("champions")
    .select("user_id")
    .eq("team", team)
    .maybeSingle<{ user_id: string | null }>();

  if (!champ || champ.user_id !== user.id) {
    return { ok: false, message: "Only the team's champion can check in." };
  }

  const { error } = await supabase
    .from("champions")
    .update({ last_check_in: new Date().toISOString() })
    .eq("team", team);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/champions/${team}`);
  revalidatePath("/champions");
  revalidatePath("/admin");
  return { ok: true };
}
