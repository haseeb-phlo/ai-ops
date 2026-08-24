"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import { parseQuizConfig, scoreAttempt } from "@/lib/programme/quiz";
import { maybeCompleteProgramme } from "@/lib/programme/complete-action";
import { resolveWritableMembership } from "@/lib/programme/membership-lookup";

/**
 * Records a quiz attempt.
 *
 * Marking happens SERVER-SIDE against config_json. The client is sent the
 * questions and options but never the correct index, so the answer key is not
 * sitting in the page source of a quiz that gates a certificate.
 */

const SubmitSchema = z.object({
  track_item_id: z.string().uuid(),
  /** Which cohort the quiz was opened from. See membership-lookup.ts. */
  cohort_id: z.string().uuid().optional(),
  answers: z.array(z.number().int().min(0).max(9).nullable()).max(50),
});

export type QuizResult =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | {
      kind: "marked";
      score: number;
      total: number;
      passed: boolean;
      /** Revealed only after marking: the answer key and the explanations. */
      correctByIndex: number[];
      explanations: string[];
      justCompletedProgramme: boolean;
    };

export async function submitQuizAttempt(
  _prev: QuizResult,
  formData: FormData,
): Promise<QuizResult> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  let rawAnswers: unknown;
  try {
    rawAnswers = JSON.parse(String(formData.get("answers") ?? "[]"));
  } catch {
    return { kind: "error", message: "Could not read your answers." };
  }

  const parsed = SubmitSchema.safeParse({
    track_item_id: formData.get("track_item_id"),
    cohort_id: (formData.get("cohort_id") as string) || undefined,
    answers: rawAnswers,
  });
  if (!parsed.success) {
    return { kind: "error", message: "That submission didn't look right." };
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
      config_json: unknown;
    }>();

  if (
    !item ||
    item.type !== "quiz" ||
    item.track_id !== membership.trackId
  ) {
    return { kind: "error", message: "That quiz isn't on your track." };
  }

  const config = parseQuizConfig(item.config_json);
  if (!config) {
    return { kind: "error", message: "This quiz hasn't been written yet." };
  }

  const score = scoreAttempt(config.questions, parsed.data.answers);
  const passed = score >= config.pass_mark;

  const { error } = await supabase.from("programme_quiz_attempts").insert({
    cohort_member_id: membership.id,
    track_item_id: item.id,
    score,
    answers_json: { answers: parsed.data.answers },
  });
  if (error) {
    return { kind: "error", message: `Could not save: ${error.message}` };
  }

  // Passing marks the item complete. Failing does not, but the attempt is
  // still stored - retakes are unlimited and best score is what counts.
  if (passed) {
    await supabase.from("programme_item_progress").upsert(
      {
        cohort_member_id: membership.id,
        track_item_id: item.id,
        status: "complete",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "cohort_member_id,track_item_id" },
    );
  }

  // The summative quiz is half of G4, so passing it can be the last thing
  // standing between someone and their certificate.
  const justCompletedProgramme = passed
    ? await maybeCompleteProgramme(membership.id)
    : false;

  revalidatePath("/learn/track");
  revalidatePath("/learn");
  revalidatePath("/learn/leads");
  revalidatePath("/");

  return {
    kind: "marked",
    score,
    total: config.questions.length,
    passed,
    correctByIndex: config.questions.map((q) => q.correct),
    explanations: config.questions.map((q) => q.explanation),
    justCompletedProgramme,
  };
}
