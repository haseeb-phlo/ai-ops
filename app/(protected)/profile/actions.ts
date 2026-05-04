"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

const ProfileSchema = z.object({
  display_name: z.string().trim().min(1, "Name is required").max(100),
  avatar_url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .refine(
      (v) => !v || /^https?:\/\//i.test(v),
      "Avatar URL must start with http:// or https://",
    ),
  title: z.string().trim().min(1, "Job title is required").max(100),
  team: z.string().trim().min(1, "Team is required").max(100),
});

export type UpdateProfileState =
  | { kind: "idle" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const user = await getSessionUser();

  const parsed = ProfileSchema.safeParse({
    display_name: formData.get("display_name"),
    avatar_url: formData.get("avatar_url") ?? "",
    title: formData.get("title"),
    team: formData.get("team") ?? "",
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: parsed.data.display_name,
        avatar_url: parsed.data.avatar_url || null,
        title: parsed.data.title,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    return { kind: "error", message: `Could not save profile: ${error.message}` };
  }

  const { error: teamError } = await supabase
    .from("role_grants")
    .upsert(
      {
        user_id: user.id,
        team: parsed.data.team,
      },
      { onConflict: "user_id" },
    );

  if (teamError) {
    return { kind: "error", message: `Could not save team: ${teamError.message}` };
  }

  revalidatePath("/", "layout");
  return { kind: "ok" };
}
