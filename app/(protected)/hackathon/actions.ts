"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadHackathonInvite } from "@/lib/hackathon/state";
import {
  ANSWER_MAX_LENGTH,
  QUESTION_BY_ID,
  REQUIRED_QUESTION_IDS,
  normalizeAnswerText,
  normalizeLongText,
  type Answers,
} from "@/lib/hackathon/questions";

/**
 * Stores one hackathon problem-survey response.
 *
 * Validation is server-side and total, for the reason `submitAiScore` gives:
 * the client sends values, the server decides whether they are answers. A
 * closed question must carry one of its own option strings verbatim - not
 * because anyone is expected to tamper, but because question 7's options are
 * matched as text by the shortlisting rule, so a near-miss string would read
 * as a different screening answer later.
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

  const answers: Answers = {};
  for (const answer of parsed.data.answers) {
    const question = QUESTION_BY_ID.get(answer.qid);
    if (!question) continue; // ignore anything not in the bank

    // Line breaks survive in the long description and are collapsed
    // everywhere else - see normalizeLongText.
    const value =
      question.kind === "text_long"
        ? normalizeLongText(answer.value)
        : normalizeAnswerText(answer.value);
    if (value === "") continue;

    if (question.options && !question.options.includes(value)) {
      return {
        kind: "error",
        message: `Unexpected answer for "${question.text}".`,
      };
    }

    answers[answer.qid] = { value };
  }

  const missing = REQUIRED_QUESTION_IDS.filter((qid) => !answers[qid]);
  if (missing.length > 0) {
    return {
      kind: "error",
      message: `${missing.length} question${missing.length === 1 ? "" : "s"} still to answer.`,
    };
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
      answers_json: answers,
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
