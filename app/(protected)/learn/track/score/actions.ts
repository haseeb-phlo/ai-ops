"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import {
  QUESTION_BY_ID,
  REQUIRED_QUESTION_IDS,
  WAVES,
  normalizeAnswerText,
} from "@/lib/programme/questions";
import { scoreAnswer, type Answers } from "@/lib/programme/score";
import { maybeCompleteProgramme } from "@/lib/programme/complete-action";
import type { ActionState } from "../../topics";

/**
 * Stores one "Your AI Score" response.
 *
 * Scoring happens HERE, from the option index, never in the browser. The
 * client sends values; the server decides what they're worth. A carried
 * forward answer scores identically - the flag exists so Part 7 can tell
 * "unchanged" from "not asked", not to discount it.
 */

const AnswerSchema = z.object({
  qid: z.string().min(1).max(8),
  value: z.string().max(5000),
  carried_forward: z.boolean().optional(),
});

const SubmitSchema = z.object({
  wave: z.enum(WAVES),
  answers: z.array(AnswerSchema).max(50),
  flow: z.enum(["returner", "first_timer"]),
  duration_seconds: z.number().int().min(0).max(86_400).nullable(),
});

export async function submitAiScore(formData: FormData): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  let rawAnswers: unknown;
  try {
    rawAnswers = JSON.parse(String(formData.get("answers") ?? "[]"));
  } catch {
    return { kind: "error", message: "Could not read your answers." };
  }

  const durationRaw = formData.get("duration_seconds");
  const parsed = SubmitSchema.safeParse({
    wave: formData.get("wave"),
    answers: rawAnswers,
    flow: formData.get("flow"),
    duration_seconds: durationRaw ? Number(durationRaw) : null,
  });
  if (!parsed.success) {
    return { kind: "error", message: "That submission didn't look right." };
  }

  // Members submit their own waves; may_2026 only ever arrives via the admin
  // import, so refuse it here whatever the client claims.
  if (parsed.data.wave === "may_2026") {
    return { kind: "error", message: "That wave is import-only." };
  }

  const answers: Answers = {};
  for (const answer of parsed.data.answers) {
    const question = QUESTION_BY_ID.get(answer.qid);
    if (!question) continue; // ignore anything not in the bank
    const value = normalizeAnswerText(answer.value);
    if (value === "") continue;

    // A closed question must carry one of its own options. Anything else is a
    // tampered payload, not a typo.
    if (question.options && !question.options.includes(value)) {
      return { kind: "error", message: `Unexpected answer for ${question.text}.` };
    }

    const score = scoreAnswer(answer.qid, value);
    answers[answer.qid] = {
      value,
      ...(score === null ? {} : { score }),
      ...(answer.carried_forward ? { carried_forward: true } : {}),
    };
  }

  const missing = REQUIRED_QUESTION_IDS.filter((qid) => !answers[qid]);
  if (missing.length > 0) {
    return {
      kind: "error",
      message: `${missing.length} compulsory question${missing.length === 1 ? "" : "s"} still to answer.`,
    };
  }

  const supabase = await createClient();

  // Which cohort this belongs to, when the member is in one. May responses
  // have no cohort by definition, which is why the column is nullable.
  const { data: membership } = await supabase
    .from("programme_cohort_members")
    .select("id, cohort_id, programme_cohorts!inner(status)")
    .eq("user_id", user.id)
    .in("programme_cohorts.status", ["live", "planned"])
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; cohort_id: string }>();

  const { error } = await supabase.from("ai_score_responses").upsert(
    {
      email: user.email.toLowerCase(),
      user_id: user.id,
      wave: parsed.data.wave,
      cohort_id: membership?.cohort_id ?? null,
      answers_json: answers,
      source: "in_app",
      flow: parsed.data.flow,
      duration_seconds: parsed.data.duration_seconds,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "email,wave" },
  );

  if (error) {
    return { kind: "error", message: `Could not save: ${error.message}` };
  }

  // The post wave is one half of G4, so submitting it can complete someone.
  if (parsed.data.wave === "post" && membership) {
    await maybeCompleteProgramme(membership.id);
  }

  revalidatePath("/learn/track");
  revalidatePath("/learn");
  revalidatePath("/learn/track/score");
  revalidatePath("/");
  redirect(`/learn/track/score?done=${parsed.data.wave}`);
}
