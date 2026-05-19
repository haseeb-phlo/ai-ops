"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendChampionAssignedEmail } from "@/lib/emails/champion-assigned";

const AssignSchema = z.object({
  team: z.string().trim().min(1, "Pick a team"),
  person_id: z.string().uuid("Pick a person"),
});

export type AssignChampionState =
  | { kind: "idle" }
  | { kind: "ok"; team: string; emailed: boolean; emailNote?: string }
  | { kind: "error"; message: string };

export async function assignChampion(
  _prev: AssignChampionState,
  formData: FormData,
): Promise<AssignChampionState> {
  const user = await getSessionUser();
  if (user.role !== "super_admin") {
    return { kind: "error", message: "Only super-admins can assign champions." };
  }

  const parsed = AssignSchema.safeParse({
    team: formData.get("team"),
    person_id: formData.get("person_id"),
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();

  const { data: person } = await supabase
    .from("people")
    .select("id, email, display_name, team")
    .eq("id", parsed.data.person_id)
    .maybeSingle<{
      id: string;
      email: string;
      display_name: string;
      team: string;
    }>();

  if (!person) {
    return { kind: "error", message: "Person not found." };
  }

  // Resolve auth.users.id by email if they've already signed in. Otherwise
  // user_id stays null until first login - the trigger in handle_new_user
  // doesn't backfill champions, but our champion-write RLS will start
  // working as soon as a super-admin reassigns/refreshes the row.
  const { data: resolvedUserId } = await supabase.rpc("user_id_for_email", {
    p_email: person.email,
  });

  // With the team-unique constraint dropped (multi-champion teams), this
  // is now an insert. The partial unique index on (team, user_id) catches
  // the "same person assigned twice to the same team" case as 23505.
  const { error: insertError } = await supabase.from("champions").insert({
    team: parsed.data.team,
    user_id: (resolvedUserId as string | null) ?? null,
    display_name: person.display_name,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        kind: "error",
        message: `${person.display_name} is already a champion of ${parsed.data.team}.`,
      };
    }
    return { kind: "error", message: insertError.message };
  }

  // Send notification. Failure here doesn't roll back the assignment - it's
  // surfaced as a soft note so the admin knows to retry/check Resend.
  let emailed = false;
  let emailNote: string | undefined;
  const sendResult = await sendChampionAssignedEmail({
    to: person.email,
    recipientName: person.display_name,
    team: parsed.data.team,
    assignedByName: user.displayName,
  });

  if ("ok" in sendResult && sendResult.ok) {
    emailed = true;
  } else if ("skipped" in sendResult) {
    emailNote = "RESEND_API_KEY not configured - email skipped.";
  } else if ("ok" in sendResult && !sendResult.ok) {
    emailNote = `Saved, but email failed: ${sendResult.message}`;
  }

  revalidatePath("/admin");

  return { kind: "ok", team: parsed.data.team, emailed, emailNote };
}

export async function removeChampion(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (user.role !== "super_admin") return;

  const championId = (formData.get("champion_id") as string | null)?.trim();
  const redirectTo = (formData.get("redirect_to") as string | null)?.trim();
  if (!championId) return;

  const supabase = await createClient();
  await supabase.from("champions").delete().eq("id", championId);

  revalidatePath("/admin");
  revalidatePath("/map");

  // Server Actions accept arbitrary FormData, so an unvalidated redirect target
  // is a CSRF-shaped open-redirect — only honour same-origin relative paths.
  if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
    redirect(redirectTo);
  }
}
