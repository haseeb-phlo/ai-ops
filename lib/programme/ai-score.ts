import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  axisScores,
  capAverage,
  type Answers,
  type AxisScores,
} from "./score";
import { WAVE_LABEL, type Wave } from "./questions";
import { WAVE_ORDER } from "./waves";

/**
 * Server-side loader for "Your AI Score".
 *
 * Returns the exact shape the playbook specifies for the radar:
 *   { waves: [{ wave, submitted_at, scores: {q1..q7}, cap_avg, hours_band }],
 *     company_avg }
 *
 * The playbook describes this as `GET /api/ai-score/{user_id}`. It's a loader
 * rather than a route because CLAUDE.md reserves app/api for system endpoints
 * (cron, search indexing) and application reads belong in route-local server
 * code. The requirement that actually matters - "scores computed SERVER-SIDE
 * from option index; no client-side scoring" - is satisfied either way: the
 * radar receives numbers as props and does no arithmetic.
 *
 * Keyed on EMAIL, not user_id: May 2026 respondents predate their auth.users
 * row and some have never signed in.
 */

export type WaveScore = {
  wave: Wave;
  waveLabel: string;
  submitted_at: string;
  scores: AxisScores;
  cap_avg: number | null;
  hours_band: string | null;
  answers: Answers;
};

export type AiScore = {
  waves: WaveScore[];
  company_avg: number | null;
};

export const loadAiScore = cache(async (email: string): Promise<AiScore> => {
  const supabase = await createClient();

  const [{ data: rows }, companyAvgResult] = await Promise.all([
    supabase
      .from("ai_score_responses")
      .select("wave, submitted_at, answers_json")
      .eq("email", email.toLowerCase())
      .returns<
        { wave: Wave; submitted_at: string; answers_json: Answers }[]
      >(),
    // Aggregate only, suppressed below five respondents, and computed by a
    // SECURITY DEFINER function so a member can't read anyone's raw answers.
    supabase.rpc("ai_score_company_average"),
  ]);

  const waves: WaveScore[] = (rows ?? [])
    .map((row) => {
      const answers = row.answers_json ?? {};
      const scores = axisScores(answers);
      return {
        wave: row.wave,
        waveLabel: WAVE_LABEL[row.wave] ?? row.wave,
        submitted_at: row.submitted_at,
        scores,
        cap_avg: capAverage(scores),
        hours_band: answers.q19b?.value ?? null,
        answers,
      };
    })
    .sort(
      (a, b) => WAVE_ORDER.indexOf(a.wave) - WAVE_ORDER.indexOf(b.wave),
    );

  const raw = companyAvgResult.data;
  const company_avg =
    typeof raw === "number" ? raw : raw === null ? null : Number(raw);

  return {
    waves,
    company_avg: Number.isFinite(company_avg) ? company_avg : null,
  };
});

export { priorWaveFor, prefillSourceFor } from "./waves";
