"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runAiReview } from "@/lib/programme/ai-review-run";
import { resolveWritableMembership } from "@/lib/programme/membership-lookup";
import { requireWriter } from "@/lib/auth";
import {
  TASK_EVIDENCE_BUCKET,
  TASK_FILE_KEY,
  TASK_FILE_MAX_BYTES,
  TASK_LINK_KEY,
  TASK_LINK_MAX_LENGTH,
  normaliseTaskLink,
  taskFileFrom,
  taskFileMime,
  taskTakesLink,
  type TaskFile,
} from "@/lib/programme/task-link";
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

/**
 * `cohort_id` is which cohort the page was showing. Optional so an older
 * client, or any caller that does not know, still works - it just falls back
 * to the same default the loader picks. See membership-lookup.ts.
 */
const MarkCompleteSchema = z.object({
  track_item_id: z.string().uuid(),
  cohort_id: z.string().uuid().optional(),
});

export async function markTrackItemComplete(
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  const parsed = MarkCompleteSchema.safeParse({
    track_item_id: formData.get("track_item_id"),
    cohort_id: (formData.get("cohort_id") as string) || undefined,
  });
  if (!parsed.success) {
    return { kind: "error", message: "Invalid item." };
  }

  const supabase = await createClient();

  // The item is re-checked against the resolved membership's track below, so
  // an item that isn't on the caller's own track is rejected rather than
  // trusted from the form.
  const membership = await resolveWritableMembership(
    user.id,
    parsed.data.cohort_id,
  );

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

  if (!item || item.track_id !== membership.trackId) {
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
const StartSchema = z.object({
  track_item_id: z.string().uuid(),
  cohort_id: z.string().uuid().optional(),
});

export async function markTrackItemStarted(formData: FormData): Promise<void> {
  const gate = await requireWriter();
  if (!gate.ok) return;
  const user = gate.user;

  const parsed = StartSchema.safeParse({
    track_item_id: formData.get("track_item_id"),
    cohort_id: (formData.get("cohort_id") as string) || undefined,
  });
  if (!parsed.success) return;

  const supabase = await createClient();

  const membership = await resolveWritableMembership(
    user.id,
    parsed.data.cohort_id,
  );
  if (!membership) return;

  const { data: item } = await supabase
    .from("programme_track_items")
    .select("id, track_id, learn_video_id")
    .eq("id", parsed.data.track_item_id)
    .maybeSingle<{ id: string; track_id: string; learn_video_id: string | null }>();
  if (!item || item.track_id !== membership.trackId) return;

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

/* ------------------------------------------------------------------ */
/* Task evidence: a link, or a screenshot                               */
/* ------------------------------------------------------------------ */

/**
 * Files what a member produced for a day's Task.
 *
 * Two write paths - `saveTaskOutputLink` and `saveTaskOutputFile` - into ONE
 * slot on their own progress row's `meta_json`, NOT into
 * `programme_submissions`; task-link.ts has the reasoning. The practical
 * consequence is the one that matters here: what a member files never reaches
 * the sign-off queue, which exists for the capstone and the two work samples.
 * It still counts toward G3; nobody has to mark it.
 *
 * Saving completes the task, on the same principle as a submission slot: the
 * evidence is the completion. It never re-stamps `completed_at`, so replacing
 * a link a week later does not move the day the work was done - which the
 * activity heatmap and the overdue sweep both read.
 */

/** Everything both writes check before they touch a row. */
async function resolveTaskEvidenceWrite(args: {
  userId: string;
  trackItemId: string;
  cohortId?: string;
}) {
  const supabase = await createClient();

  const membership = await resolveWritableMembership(
    args.userId,
    args.cohortId,
  );
  if (!membership) {
    return { ok: false as const, message: "You're not in an active cohort." };
  }

  const { data: item } = await supabase
    .from("programme_track_items")
    .select("id, type, track_id, day_index")
    .eq("id", args.trackItemId)
    .maybeSingle<{
      id: string;
      type: string;
      track_id: string;
      day_index: number;
    }>();

  if (!item || item.track_id !== membership.trackId) {
    return { ok: false as const, message: "That item isn't on your track." };
  }

  // Tasks only. A submission slot takes its link through the submission form,
  // which has sign-off attached to it.
  if (item.type !== "use_example") {
    return {
      ok: false as const,
      message: "This item is completed elsewhere in the programme.",
    };
  }

  // And only the Tasks that ask for something. The page hides the field on the
  // days in LINKLESS_TASK_DAYS; re-checked here on the convention that the
  // page computes and the action verifies, so a stale tab cannot file against
  // a day whose copy no longer asks for it - and so the admin table, which
  // drops those days entirely, never hides a row that exists.
  if (!taskTakesLink(item.day_index)) {
    return {
      ok: false as const,
      message: "This task has nothing to file. Use Mark complete instead.",
    };
  }

  const { data: existing } = await supabase
    .from("programme_item_progress")
    .select("completed_at, meta_json")
    .eq("cohort_member_id", membership.id)
    .eq("track_item_id", item.id)
    .maybeSingle<{
      completed_at: string | null;
      meta_json: Record<string, unknown> | null;
    }>();

  return {
    ok: true as const,
    supabase,
    membershipId: membership.id,
    itemId: item.id,
    existing: existing ?? null,
  };
}

/**
 * Writes one shape of evidence and clears the other.
 *
 * `meta_json` is merged rather than replaced - it is a shared bag and this
 * owns two keys in it - but the key that is NOT being written is deleted, so
 * a day never holds a link and a screenshot at once. The old screenshot's
 * blob goes with it: nothing would ever read it again, and these are pictures
 * of members' real work rather than rows we can afford to leave lying about.
 */
async function fileTaskEvidence(args: {
  resolved: Extract<
    Awaited<ReturnType<typeof resolveTaskEvidenceWrite>>,
    { ok: true }
  >;
  patch: Record<string, unknown>;
  /** Which key this write owns; the other one is dropped. */
  keep: typeof TASK_LINK_KEY | typeof TASK_FILE_KEY;
}): Promise<ActionState> {
  const { resolved, patch, keep } = args;
  const meta = { ...(resolved.existing?.meta_json ?? {}), ...patch };
  delete meta[keep === TASK_LINK_KEY ? TASK_FILE_KEY : TASK_LINK_KEY];

  const { error } = await resolved.supabase
    .from("programme_item_progress")
    .upsert(
      {
        cohort_member_id: resolved.membershipId,
        track_item_id: resolved.itemId,
        status: "complete",
        completed_at: resolved.existing?.completed_at ?? new Date().toISOString(),
        meta_json: meta,
      },
      { onConflict: "cohort_member_id,track_item_id" },
    );

  if (error) {
    return { kind: "error", message: `Could not save: ${error.message}` };
  }

  // After the row is safely written, never before: an orphaned blob costs
  // nothing, but deleting the picture and then failing to record the thing
  // that replaced it loses the member's evidence.
  const previous = taskFileFrom(resolved.existing?.meta_json);
  if (previous && previous.path !== (patch[TASK_FILE_KEY] as { path?: string } | undefined)?.path) {
    await resolved.supabase.storage
      .from(TASK_EVIDENCE_BUCKET)
      .remove([previous.path]);
  }

  revalidatePath("/learn/track");
  revalidatePath("/learn");
  revalidatePath("/");
  return { kind: "success" };
}

const TaskLinkSchema = z.object({
  track_item_id: z.string().uuid(),
  cohort_id: z.string().uuid().optional(),
  output_url: z.string().trim().min(1).max(TASK_LINK_MAX_LENGTH),
});

export async function saveTaskOutputLink(
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  const parsed = TaskLinkSchema.safeParse({
    track_item_id: formData.get("track_item_id"),
    cohort_id: (formData.get("cohort_id") as string) || undefined,
    output_url: formData.get("output_url"),
  });
  if (!parsed.success) {
    return { kind: "error", message: "Add the link to your output." };
  }

  const link = normaliseTaskLink(parsed.data.output_url);
  if (!link) {
    return {
      kind: "error",
      message: "That does not look like a link. Paste the whole thing, like https://claude.ai/share/...",
    };
  }

  const resolved = await resolveTaskEvidenceWrite({
    userId: user.id,
    trackItemId: parsed.data.track_item_id,
    cohortId: parsed.data.cohort_id,
  });
  if (!resolved.ok) return { kind: "error", message: resolved.message };

  return fileTaskEvidence({
    resolved,
    patch: { [TASK_LINK_KEY]: link },
    keep: TASK_LINK_KEY,
  });
}

const TaskFileSchema = z.object({
  track_item_id: z.string().uuid(),
  cohort_id: z.string().uuid().optional(),
});

/**
 * Files a screenshot instead of a link.
 *
 * The day that forced this is day 7: a Claude scheduled task has runs but no
 * Share link, so a member who had done the work had nothing to paste and no
 * way to complete the day. It is offered on every Task rather than that one,
 * because the same gap turns up wherever the output is a file, a desktop app
 * or somebody else's system.
 *
 * The blob goes to a private bucket keyed by cohort member and item, which is
 * what its storage policies read - see the task_evidence_uploads migration.
 * The path carries NO file extension: the app serves these back through
 * /learn/track/evidence/<path>, and proxy.ts's matcher skips anything ending
 * .png/.jpg/.webp, which would hand that route an unrefreshed session.
 *
 * RETURNS THE STORED DESCRIPTOR, unlike its sibling. The path is minted here,
 * and the card cannot wait for the revalidate to learn it: `revalidatePath`
 * re-renders the card with a fresh prop, but the field's `saved` state was
 * seeded from that prop on mount and nothing remounts it. Without the path
 * coming back, the member gets a filename and no thumbnail until they reload -
 * which is exactly the "did that work?" moment the field exists to remove.
 */
export async function saveTaskOutputFile(
  formData: FormData,
): Promise<ActionState | { kind: "success"; file: TaskFile }> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  const parsed = TaskFileSchema.safeParse({
    track_item_id: formData.get("track_item_id"),
    cohort_id: (formData.get("cohort_id") as string) || undefined,
  });
  if (!parsed.success) {
    return { kind: "error", message: "Invalid item." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { kind: "error", message: "Pick a screenshot to upload." };
  }
  if (file.size > TASK_FILE_MAX_BYTES) {
    return { kind: "error", message: "That image is over 10 MB." };
  }
  // The bucket enforces this too. Checked here as well so the member gets a
  // sentence rather than a storage error, and so a PDF of the run does not
  // get halfway uploaded before being refused.
  const mime = taskFileMime(file);
  if (!mime) {
    return {
      kind: "error",
      message: "That is not an image. A PNG or JPEG screenshot is what this takes.",
    };
  }

  const resolved = await resolveTaskEvidenceWrite({
    userId: user.id,
    trackItemId: parsed.data.track_item_id,
    cohortId: parsed.data.cohort_id,
  });
  if (!resolved.ok) return { kind: "error", message: resolved.message };

  const path = `${resolved.membershipId}/${resolved.itemId}/${crypto.randomUUID()}`;
  const { error: uploadError } = await resolved.supabase.storage
    .from(TASK_EVIDENCE_BUCKET)
    .upload(path, file, { contentType: mime, upsert: false });

  if (uploadError) {
    return { kind: "error", message: `Upload failed: ${uploadError.message}` };
  }

  const stored: TaskFile = {
    path,
    name: file.name,
    mime,
    size: file.size,
  };

  const saved = await fileTaskEvidence({
    resolved,
    patch: { [TASK_FILE_KEY]: stored },
    keep: TASK_FILE_KEY,
  });

  if (saved.kind === "error") {
    // Nothing points at it now, so leave nothing behind.
    await resolved.supabase.storage.from(TASK_EVIDENCE_BUCKET).remove([path]);
    return saved;
  }

  return { kind: "success", file: stored };
}
/* ------------------------------------------------------------------ */
/* Submissions                                                         */
/* ------------------------------------------------------------------ */

const SubmissionSchema = z.object({
  track_item_id: z.string().uuid(),
  cohort_id: z.string().uuid().optional(),
  artefact_url: z.string().trim().max(2048).optional(),
  prompt_text: z.string().trim().max(10_000).optional(),
  task_solved: z.string().trim().max(2000).optional(),
  time_saved_estimate: z.string().trim().max(200).optional(),
  share_publicly: z.boolean(),
});

/**
 * Creates or replaces a submission against a submission slot.
 *
 * The slot's `config_json.kind` decides what this is, not the client - a
 * member must not be able to file a work sample as a signed example and skip
 * sign-off. Work samples are forced private regardless of the share checkbox
 * (the schema enforces that too).
 *
 * Resubmitting after a rejection keeps the rejected version and points it at
 * the new one via superseded_by, so the sign-off history survives.
 */
export async function submitProgrammeSubmission(
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  const parsed = SubmissionSchema.safeParse({
    track_item_id: formData.get("track_item_id"),
    cohort_id: (formData.get("cohort_id") as string) || undefined,
    artefact_url: (formData.get("artefact_url") as string) || undefined,
    prompt_text: (formData.get("prompt_text") as string) || undefined,
    task_solved: (formData.get("task_solved") as string) || undefined,
    time_saved_estimate:
      (formData.get("time_saved_estimate") as string) || undefined,
    share_publicly: formData.get("share_publicly") === "on",
  });
  if (!parsed.success) {
    return { kind: "error", message: "Check the form and try again." };
  }

  const supabase = await createClient();

  const membership = await resolveWritableMembership(
    user.id,
    parsed.data.cohort_id,
  );
  if (!membership) {
    return { kind: "error", message: "You're not in an active cohort." };
  }

  const { data: item } = await supabase
    .from("programme_track_items")
    .select("id, type, track_id, config_json")
    .eq("id", parsed.data.track_item_id)
    .maybeSingle<{
      id: string;
      type: string;
      track_id: string;
      config_json: { kind?: string; visibility?: string };
    }>();

  if (
    !item ||
    item.type !== "submission_slot" ||
    item.track_id !== membership.trackId
  ) {
    return { kind: "error", message: "That slot isn't on your track." };
  }

  const kind = item.config_json?.kind ?? "signed_example";
  const isWorkSample = kind.startsWith("work_sample");

  // Work samples feed external blind scoring and are never shown to peers.
  const visibility = isWorkSample
    ? "private"
    : parsed.data.share_publicly
      ? "public_gallery"
      : "cohort";

  if (!isWorkSample && !parsed.data.prompt_text) {
    return { kind: "error", message: "Add the prompt you used." };
  }

  // A work sample asks for one field and used to require none of them, so the
  // slot could be submitted empty - which marked the item done and filed a row
  // carrying nothing. That is worse than not submitting: the before/after
  // export reads artefact_url off these, so an empty "before" silently becomes
  // a member with no baseline to measure against, discovered at the end.
  if (isWorkSample && !parsed.data.artefact_url) {
    return {
      kind: "error",
      message: "Add a link to the work itself - that is the whole submission.",
    };
  }

  // Any live (non-superseded) submission against this slot.
  const { data: existing } = await supabase
    .from("programme_submissions")
    .select("id, signoff_status")
    .eq("cohort_member_id", membership.id)
    .eq("track_item_id", item.id)
    .is("superseded_by", null)
    .maybeSingle<{ id: string; signoff_status: string }>();

  if (existing?.signoff_status === "approved") {
    return { kind: "error", message: "That one's already been approved." };
  }

  const { data: created, error } = await supabase
    .from("programme_submissions")
    .insert({
      cohort_member_id: membership.id,
      track_item_id: item.id,
      kind,
      artefact_url: parsed.data.artefact_url ?? null,
      prompt_text: parsed.data.prompt_text ?? null,
      task_solved: parsed.data.task_solved ?? null,
      time_saved_estimate: parsed.data.time_saved_estimate ?? null,
      visibility,
      // Work samples need no human sign-off; everything else queues for a lead.
      signoff_status: isWorkSample ? "approved" : "pending",
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !created) {
    return {
      kind: "error",
      message: `Could not save: ${error?.message ?? "unknown error"}`,
    };
  }

  // Keep the rejected version as history rather than overwriting it.
  if (existing) {
    await supabase
      .from("programme_submissions")
      .update({ superseded_by: created.id })
      .eq("id", existing.id);
  }

  // Submitting completes the slot; approval is what feeds G3 separately.
  await supabase.from("programme_item_progress").upsert(
    {
      cohort_member_id: membership.id,
      track_item_id: item.id,
      status: "complete",
      completed_at: new Date().toISOString(),
    },
    { onConflict: "cohort_member_id,track_item_id" },
  );

  // Review runs after the response, so the member is not left watching a
  // spinner while a model thinks. A nightly sweep catches anything this
  // never reached, and either way an unreviewed submission just waits for a
  // human - which is where it would have waited anyway.
  if (!isWorkSample) {
    const submissionId = created.id;
    after(async () => {
      await runAiReview(submissionId);
      // An automatic approval can put the submission in the gallery and flip
      // G3, which can complete the member - so the same readers the human
      // sign-off revalidates.
      revalidatePath("/learn/track");
      revalidatePath("/learn/leads");
      revalidatePath("/learn/gallery");
      revalidatePath("/learn/admin");
      revalidatePath("/");
    });
  }

  revalidatePath("/learn/track");
  revalidatePath("/learn/gallery");
  revalidatePath("/");
  return { kind: "success" };
}
