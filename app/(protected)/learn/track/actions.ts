"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import type { ActionState } from "../topics";

/**
 * The ONE write path for track item completion.
 *
 * Two stores are touched and the asymmetry is deliberate:
 *
 *   - `programme_item_progress` is the durable, monotonic record. Gates and
 *     RAG read it. The track never un-completes a row.
 *   - `learn_video_completions` is Learn's own toggle, shared with /learn. We
 *     INSERT into it so the tick appears there too, but we never DELETE - an
 *     untick on /learn must not be able to regress someone past G1.
 *
 * Marking complete is therefore one-way here. That is the intended behaviour
 * for a mandatory programme: "I finished day 4" is not something you undo.
 */

const MarkCompleteSchema = z.object({
  track_item_id: z.string().uuid(),
});

export async function markTrackItemComplete(
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  const parsed = MarkCompleteSchema.safeParse({
    track_item_id: formData.get("track_item_id"),
  });
  if (!parsed.success) {
    return { kind: "error", message: "Invalid item." };
  }

  const supabase = await createClient();

  // Resolve the caller's membership and the item together, so we can reject an
  // item that isn't on the caller's own track rather than trusting the form.
  const { data: membership } = await supabase
    .from("programme_cohort_members")
    .select("id, programme_cohorts!inner(track_id, status)")
    .eq("user_id", user.id)
    .in("programme_cohorts.status", ["live", "planned"])
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      programme_cohorts: { track_id: string; status: string };
    }>();

  if (!membership) {
    return { kind: "error", message: "You're not in an active cohort." };
  }

  const { data: item } = await supabase
    .from("programme_track_items")
    .select("id, type, track_id, learn_video_id")
    .eq("id", parsed.data.track_item_id)
    .maybeSingle<{
      id: string;
      type: string;
      track_id: string;
      learn_video_id: string | null;
    }>();

  if (!item || item.track_id !== membership.programme_cohorts.track_id) {
    return { kind: "error", message: "That item isn't on your track." };
  }

  // Only content items are completed this way. Sessions are marked by an admin
  // on the roster, submissions by submitting, quizzes by scoring.
  if (item.type !== "video" && item.type !== "use_example") {
    return {
      kind: "error",
      message: "This item is completed elsewhere in the programme.",
    };
  }

  // Mirror the tick into Learn so /learn agrees - insert only, never delete.
  // ignoreDuplicates keeps this idempotent against the (video, user) unique
  // constraint when the member already ticked it on /learn.
  if (item.learn_video_id) {
    await supabase
      .from("learn_video_completions")
      .upsert(
        { video_id: item.learn_video_id, user_id: user.id },
        { onConflict: "video_id,user_id", ignoreDuplicates: true },
      );
  }

  const { error } = await supabase.from("programme_item_progress").upsert(
    {
      cohort_member_id: membership.id,
      track_item_id: item.id,
      status: "complete",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "cohort_member_id,track_item_id" },
  );

  if (error) {
    return { kind: "error", message: `Could not save: ${error.message}` };
  }

  revalidatePath("/learn/track");
  revalidatePath("/learn");
  revalidatePath("/");
  return { kind: "success" };
}

/**
 * Records that a member opened a video, so a part-watched day reads as "in
 * progress" rather than untouched.
 *
 * Never downgrades: a completed item stays complete. Also records a play in
 * Learn's own table, which is what /learn's "N plays from M people" counts.
 */
const StartSchema = z.object({ track_item_id: z.string().uuid() });

export async function markTrackItemStarted(formData: FormData): Promise<void> {
  const gate = await requireWriter();
  if (!gate.ok) return;
  const user = gate.user;

  const parsed = StartSchema.safeParse({
    track_item_id: formData.get("track_item_id"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("programme_cohort_members")
    .select("id, programme_cohorts!inner(track_id, status)")
    .eq("user_id", user.id)
    .in("programme_cohorts.status", ["live", "planned"])
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      programme_cohorts: { track_id: string; status: string };
    }>();
  if (!membership) return;

  const { data: item } = await supabase
    .from("programme_track_items")
    .select("id, track_id, learn_video_id")
    .eq("id", parsed.data.track_item_id)
    .maybeSingle<{ id: string; track_id: string; learn_video_id: string | null }>();
  if (!item || item.track_id !== membership.programme_cohorts.track_id) return;

  if (item.learn_video_id) {
    await supabase
      .from("learn_video_plays")
      .insert({ video_id: item.learn_video_id, user_id: user.id });
  }

  const { data: existing } = await supabase
    .from("programme_item_progress")
    .select("status")
    .eq("cohort_member_id", membership.id)
    .eq("track_item_id", item.id)
    .maybeSingle<{ status: string }>();

  // Don't walk a completion backwards to "started".
  if (existing?.status === "complete") return;

  await supabase.from("programme_item_progress").upsert(
    {
      cohort_member_id: membership.id,
      track_item_id: item.id,
      status: "started",
    },
    { onConflict: "cohort_member_id,track_item_id" },
  );

  revalidatePath("/learn/track");
}
