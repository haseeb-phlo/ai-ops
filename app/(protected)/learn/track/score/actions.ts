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
import { pickMembership } from "@/lib/programme/membership";
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
  /** The cohort this check-in was opened from, when it was opened from one. */
  cohort_id: z.string().uuid().optional(),
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
    cohort_id: (formData.get("cohort_id") as string) || undefined,
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
  //
  // A REAL cohort wins over a preview run whenever the caller has not said
  // which they are on. There is one response row per person per wave, so a
  // check-in taken with no cohort in mind is still the person's actual
  // baseline, and defaulting it to a sandbox would drop them out of their own
  // cohort's reporting and put their answers where a reset can delete them.
  //
  // A check-in opened FROM a preview run is the other case, and it says so.
  // Attributing that one to the real cohort would take answers typed while
  // walking the screens and record them as the person's genuine starting
  // point, invisibly and permanently, on the one metric the whole programme
  // exists to move. It is also what the preview panel already promises out
  // loud: "starting again wipes ... the check-in if it was taken here".
  const { data: memberships } = await supabase
    .from("programme_cohort_members")
    .select("id, cohort_id, joined_at, programme_cohorts!inner(status, is_test)")
    .eq("user_id", user.id)
    .in("programme_cohorts.status", ["live", "planned"])
    .returns<
      {
        id: string;
        cohort_id: string;
        joined_at: string;
        programme_cohorts: { status: string; is_test: boolean };
      }[]
    >();

  const membership = pickMembership(
    (memberships ?? []).map((m) => ({
      row: m,
      cohortId: m.cohort_id,
      joinedAt: m.joined_at,
      status: m.programme_cohorts.status,
      isTest: m.programme_cohorts.is_test,
    })),
    parsed.data.cohort_id,
  )?.row;

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
  // Evaluated for every live membership rather than only the attributed one:
  // gates are computed per membership, and an admin walking a preview run
  // should still finish it. Each call is guarded on completed_at, so this
  // stays a single announcement either way.
  if (parsed.data.wave === "post") {
    for (const m of memberships ?? []) {
      await maybeCompleteProgramme(m.id);
    }
  }

  revalidatePath("/learn/track");
  revalidatePath("/learn");
  revalidatePath("/learn/track/score");
  revalidatePath("/");
  redirect(`/learn/track/score?done=${parsed.data.wave}`);
}
