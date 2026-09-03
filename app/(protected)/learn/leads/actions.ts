"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import { maybeCompleteProgramme } from "@/lib/programme/complete-action";
import { notifyRejection } from "@/lib/programme/notify-rejection";

/**
 * Sign-off.
 *
 * All the rules live in the programme_sign_off RPC, not here: who may sign,
 * that nobody signs their own work, that approval needs all four rubric
 * dimensions at 3+, and that a rejection needs a comment. This action's job is
 * to validate shape, call it, and turn the reason code into a sentence.
 *
 * Doing it that way means the rules hold even if some future surface forgets
 * to check them - there is no UPDATE policy on signoff_status at all.
 */

const SignOffSchema = z.object({
  submission_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  accuracy: z.number().int().min(0).max(5).nullable(),
  completeness: z.number().int().min(0).max(5).nullable(),
  usefulness: z.number().int().min(0).max(5).nullable(),
  reusability: z.number().int().min(0).max(5).nullable(),
  comment: z.string().trim().max(2000).nullable(),
  capstone_credits: z.number().int().min(0).max(2).nullable(),
});

const REASON_MESSAGE: Record<string, string> = {
  bad_decision: "That isn't a valid decision.",
  not_found: "That submission no longer exists.",
  not_your_member: "You're not the team lead for this person.",
  cannot_sign_own_work: "You can't sign off your own work.",
  superseded: "This has already been replaced by a newer submission.",
  comment_required: "Add a comment so they know what to change.",
  rubric_required: "Score all four dimensions before approving.",
  below_threshold:
    "Approval needs all four dimensions at 3 or above. Reject with a comment instead.",
  rubric_out_of_range: "Scores must be between 0 and 5.",
  not_signed_in: "Your session expired - sign in again.",
};

export type SignOffState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; decision: "approved" | "rejected" };

export async function signOffSubmission(
  _prev: SignOffState,
  formData: FormData,
): Promise<SignOffState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };

  const num = (key: string): number | null => {
    const raw = formData.get(key);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const parsed = SignOffSchema.safeParse({
    submission_id: formData.get("submission_id"),
    decision: formData.get("decision"),
    accuracy: num("accuracy"),
    completeness: num("completeness"),
    usefulness: num("usefulness"),
    reusability: num("reusability"),
    comment: (formData.get("comment") as string)?.trim() || null,
    capstone_credits: num("capstone_credits"),
  });
  if (!parsed.success) {
    return { kind: "error", message: "Check the form and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("programme_sign_off", {
    p_submission_id: parsed.data.submission_id,
    p_decision: parsed.data.decision,
    p_accuracy: parsed.data.accuracy,
    p_completeness: parsed.data.completeness,
    p_usefulness: parsed.data.usefulness,
    p_reusability: parsed.data.reusability,
    p_comment: parsed.data.comment,
    p_capstone_credits: parsed.data.capstone_credits,
  });

  if (error) {
    return { kind: "error", message: `Could not save: ${error.message}` };
  }

  const result = data as { ok: boolean; reason?: string } | null;
  if (!result?.ok) {
    return {
      kind: "error",
      message:
        REASON_MESSAGE[result?.reason ?? ""] ?? "That sign-off was refused.",
    };
  }

  // A rejection is only actionable if the person hears about it, and the
  // comment is the actionable part. Fire and forget: a Slack outage must not
  // roll back a sign-off that is already recorded.
  if (parsed.data.decision === "rejected") {
    await notifyRejection({
      submissionId: parsed.data.submission_id,
      leadUserId: gate.user.id,
      comment: parsed.data.comment ?? "",
    });
  }

  // An approval can be the last thing standing between a member and
  // finishing - the capstone is worth two of the five credits G3 wants - so
  // check before revalidating.
  if (parsed.data.decision === "approved") {
    const { data: submission } = await supabase
      .from("programme_submissions")
      .select("cohort_member_id")
      .eq("id", parsed.data.submission_id)
      .maybeSingle<{ cohort_member_id: string }>();
    if (submission) {
      await maybeCompleteProgramme(submission.cohort_member_id);
    }
  }

  // Approval can flip G3, which changes the member's RAG and their track view.
  revalidatePath("/learn/leads");
  revalidatePath("/learn/track");
  revalidatePath("/learn/gallery");
  revalidatePath("/learn/admin");
  revalidatePath("/");

  return { kind: "success", decision: parsed.data.decision };
}

/* ------------------------------------------------------------------ */
/* Correcting the wording on a decided submission                      */
/* ------------------------------------------------------------------ */

const EditFeedbackSchema = z.object({
  submission_id: z.string().uuid(),
  comment: z.string().trim().min(1).max(2000),
});

export type EditFeedbackState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success" };

const EDIT_REASON: Record<string, string> = {
  not_found: "That submission no longer exists.",
  not_your_member: "You're not the approver for this person.",
  still_pending: "Nothing has been decided on this one yet.",
  empty: "Write something, or leave it as it is.",
};

/**
 * Rewrites the feedback a member reads, without touching the decision.
 *
 * The scores stood up; the wording did not. Every previous version is kept by
 * the RPC, and once a person has rewritten it the member is no longer told a
 * machine wrote it - because by then one did not.
 */
export async function editFeedback(
  _prev: EditFeedbackState,
  formData: FormData,
): Promise<EditFeedbackState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };

  const parsed = EditFeedbackSchema.safeParse({
    submission_id: formData.get("submission_id"),
    comment: formData.get("comment"),
  });
  if (!parsed.success) {
    return { kind: "error", message: "Write something first." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("programme_edit_feedback", {
    p_submission_id: parsed.data.submission_id,
    p_comment: parsed.data.comment,
  });
  if (error) return { kind: "error", message: `Could not save: ${error.message}` };

  const result = data as { ok: boolean; reason?: string } | null;
  if (!result?.ok) {
    return {
      kind: "error",
      message: EDIT_REASON[result?.reason ?? ""] ?? "That edit was refused.",
    };
  }

  revalidatePath("/learn/leads");
  revalidatePath("/learn/track");
  return { kind: "success" };
}
