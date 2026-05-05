"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isChampionOfTeam } from "@/lib/champions";
import { createClient } from "@/lib/supabase/server";

const ToggleSchema = z.object({
  intervention_id: z.string().uuid(),
  team: z.string().trim().min(1),
});

export async function toggleInterventionCosign(formData: FormData): Promise<void> {
  const user = await getSessionUser();

  const parsed = ToggleSchema.safeParse({
    intervention_id: formData.get("intervention_id"),
    team: formData.get("team"),
  });
  if (!parsed.success) return;

  const isSuper = user.realRole === "super_admin";
  const isOwner = await isChampionOfTeam(user.id, parsed.data.team);
  if (!isOwner && !isSuper) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("intervention_cosigns")
    .select("intervention_id")
    .eq("intervention_id", parsed.data.intervention_id)
    .eq("team", parsed.data.team)
    .maybeSingle<{ intervention_id: string }>();

  if (existing) {
    await supabase
      .from("intervention_cosigns")
      .delete()
      .eq("intervention_id", parsed.data.intervention_id)
      .eq("team", parsed.data.team);
  } else {
    await supabase.from("intervention_cosigns").insert({
      intervention_id: parsed.data.intervention_id,
      team: parsed.data.team,
      signed_by: user.id,
      signed_by_name: user.displayName,
    });
  }

  revalidatePath(`/interventions/${parsed.data.intervention_id}`);
  revalidatePath(`/champions/${parsed.data.team}`);
}
