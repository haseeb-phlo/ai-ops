"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isChampionOfTeam } from "@/lib/champions";
import { createClient } from "@/lib/supabase/server";

const UpsertSchema = z.object({
  target_type: z.enum(["workflow", "intervention"]),
  target_id: z.string().uuid(),
  team: z.string().trim().min(1),
  body: z.string().trim().min(1, "Write something").max(2000),
});

export type ChampionNoteState =
  | { kind: "idle" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export async function upsertChampionNote(
  _prev: ChampionNoteState,
  formData: FormData,
): Promise<ChampionNoteState> {
  const user = await getSessionUser();

  const parsed = UpsertSchema.safeParse({
    target_type: formData.get("target_type"),
    target_id: formData.get("target_id"),
    team: formData.get("team"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const isSuper = user.realRole === "super_admin";
  const isOwner = await isChampionOfTeam(user.id, parsed.data.team);
  if (!isOwner && !isSuper) {
    return {
      kind: "error",
      message: `Only the ${parsed.data.team} champion can leave a note for that team.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("champion_notes").upsert(
    {
      target_type: parsed.data.target_type,
      target_id: parsed.data.target_id,
      team: parsed.data.team,
      body: parsed.data.body,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "target_type,target_id,team" },
  );

  if (error) return { kind: "error", message: error.message };

  const path =
    parsed.data.target_type === "workflow"
      ? `/workflows/${parsed.data.target_id}`
      : `/interventions/${parsed.data.target_id}`;
  revalidatePath(path);
  revalidatePath(`/champions/${parsed.data.team}`);
  return { kind: "ok" };
}

export async function deleteChampionNote(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("champion_notes")
    .select("team, target_type, target_id")
    .eq("id", id)
    .maybeSingle<{
      team: string;
      target_type: "workflow" | "intervention";
      target_id: string;
    }>();
  if (!existing) return;

  const isSuper = user.realRole === "super_admin";
  const isOwner = await isChampionOfTeam(user.id, existing.team);
  if (!isOwner && !isSuper) return;

  await supabase.from("champion_notes").delete().eq("id", id);

  const path =
    existing.target_type === "workflow"
      ? `/workflows/${existing.target_id}`
      : `/interventions/${existing.target_id}`;
  revalidatePath(path);
  revalidatePath(`/champions/${existing.team}`);
}
