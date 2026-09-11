"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadHackathonInvite } from "@/lib/hackathon/state";
import { buildSubmission } from "@/lib/hackathon/submission";
import { ANSWER_MAX_LENGTH } from "@/lib/hackathon/questions";

/**
 * Stores one hackathon problem-survey response.
 *
 * Validation is server-side and total, for the reason `submitAiScore` gives:
 * the client sends values, the server decides whether they are answers. The
 * rules themselves are in `lib/hackathon/submission.ts`, which is where they
 * can be tested; what is left here is what only an action can do.
 *
 * Revisable by design. `hackathon_survey_responses` is unique on `user_id`
 * and this upserts on it, so re-answering replaces rather than appends - "one
 * response per person" from the build sheet, but without punishing somebody
 * who realises on the way to their desk that they described the wrong task.
 * `created_at` keeps the first answer's timestamp; `submitted_at` moves.
 */

export type SurveyActionState =
  | { kind: "idle" }
  | { kind: "error"; message: string };

const AnswerSchema = z.object({
  qid: z.string().min(1).max(8),
  value: z.string().max(ANSWER_MAX_LENGTH),
});

const SubmitSchema = z.object({
  answers: z.array(AnswerSchema).max(30),
  duration_seconds: z.number().int().min(0).max(86_400).nullable(),
});

export async function submitHackathonSurvey(
  formData: FormData,
): Promise<SurveyActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  // The same gate the nav and the page use, re-asked at the write. The page
  // computed it when it rendered the form; between then and now a cohort's
  // access could have been turned off, and the table's policy would refuse
  // the insert with a Postgres error rather than a sentence anyone can read.
  const invite = await loadHackathonInvite(user.id);
  if (!invite.inInvitedCohort && user.realRole !== "super_admin") {
    return {
      kind: "error",
      message: "This survey is open to the first hackathon cohort.",
    };
  }

  let rawAnswers: unknown;
  try {
    rawAnswers = JSON.parse(String(formData.get("answers") ?? "[]"));
  } catch {
    return { kind: "error", message: "Could not read your answers." };
  }

  const durationRaw = formData.get("duration_seconds");
  const parsed = SubmitSchema.safeParse({
    answers: rawAnswers,
    duration_seconds: durationRaw ? Number(durationRaw) : null,
  });
  if (!parsed.success) {
    return { kind: "error", message: "That submission didn't look right." };
  }

  const submission = buildSubmission(parsed.data.answers);
  if (!submission.ok) {
    return { kind: "error", message: submission.message };
  }

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("hackathon_survey_responses").upsert(
    {
      user_id: user.id,
      email: user.email.toLowerCase(),
      // Null for a super admin running the event from outside the cohorts,
      // which the column allows: the answer is theirs either way, and the
      // problem bank is not scoped by cohort.
      cohort_id: invite.cohortId,
      answers_json: submission.answers,
      duration_seconds: parsed.data.duration_seconds,
      submitted_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { kind: "error", message: `Could not save: ${error.message}` };
  }

  revalidatePath("/hackathon");
  revalidatePath("/hackathon/problems");
  redirect("/hackathon?done=1");
}
