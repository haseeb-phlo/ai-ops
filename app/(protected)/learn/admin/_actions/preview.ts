"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";

/**
 * A private run through the programme, for an admin.
 *
 * The point is to experience it exactly as a member does - the entry gate, the
 * drip, marking a video, submitting work, the quiz, the certificate - rather
 * than to look at a mock of it. So this enrols you for real, in a cohort
 * marked `is_test`, backdated so nothing is locked.
 *
 * That means every write is a real write and every screen is the real screen.
 * The sandbox is the cohort, not the code path: there is no "preview mode"
 * branch anywhere in the member experience, because a preview that runs
 * different code proves nothing about the thing it is previewing.
 */

export type PreviewState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "started" }
  | { kind: "reset" };

const REASON: Record<string, string> = {
  not_admin: "Only super admins can start a preview run.",
  no_track: "The Core Programme track has not been seeded yet.",
  no_preview: "You do not have a preview run to reset.",
};

export async function startPreview(
  _prev: PreviewState,
  _formData: FormData,
): Promise<PreviewState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_programme_preview");
  if (error) return { kind: "error", message: error.message };

  const result = data as { ok: boolean; reason?: string } | null;
  if (!result?.ok) {
    return {
      kind: "error",
      message: REASON[result?.reason ?? ""] ?? "Could not start a preview run.",
    };
  }

  revalidatePath("/learn");
  revalidatePath("/learn/track");
  revalidatePath("/learn/admin");
  return { kind: "started" };
}

export async function resetPreview(
  _prev: PreviewState,
  _formData: FormData,
): Promise<PreviewState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_programme_preview");
  if (error) return { kind: "error", message: error.message };

  const result = data as { ok: boolean; reason?: string } | null;
  if (!result?.ok) {
    return {
      kind: "error",
      message: REASON[result?.reason ?? ""] ?? "Could not reset the preview.",
    };
  }

  revalidatePath("/learn");
  revalidatePath("/learn/track");
  revalidatePath("/learn/track/score");
  revalidatePath("/learn/admin");
  return { kind: "reset" };
}
