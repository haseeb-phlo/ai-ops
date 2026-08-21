import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { functionForTeam, unmappedTeams } from "./functions";
import type { Answers } from "./score";
import { sandboxOnlyUserIds } from "./reporting";
import type { ResponseRow } from "./reporting";
import type { Wave } from "./questions";

/**
 * Loads every AI Score response, annotated with the team and function needed
 * to slice it.
 *
 * TEST COHORTS ARE EXCLUDED TWO WAYS, and both are needed.
 *
 * By cohort_id, which catches a response taken inside a preview run. And by
 * person, because May responses carry a null cohort_id by design (they
 * predate cohorts) so the column alone would let seeded rehearsal people
 * through into the company numbers - the same trap the company-average RPC
 * had.
 *
 * The by-person leg only fires for someone whose EVERY membership is a test
 * one. An admin sitting in a preview run and a real cohort at the same time
 * is a real participant: excluding them by person would quietly delete a
 * genuine member from the very chart that has to prove the programme worked.
 *
 * Team comes from the people directory, matched on email, because a response
 * is keyed on email and some respondents have no account at all.
 */

export type ReportingData = {
  rows: ResponseRow[];
  /** Cohorts available to filter by, test ones excluded. */
  cohorts: { id: string; name: string }[];
  functions: string[];
  teams: string[];
  /** Teams the function config does not know about, surfaced as a prompt. */
  unmapped: string[];
  waveCounts: Record<Wave, number>;
  includingRehearsal: boolean;
};

/**
 * @param includeRehearsal Show test-cohort data. Off by default so real
 * figures stay clean; on, it lets someone be walked through the charts before
 * a real cohort has finished. Never a default, always a deliberate act.
 */
export const loadReportingData = cache(
  async (includeRehearsal = false): Promise<ReportingData> => {
  const supabase = await createClient();

  const [
    { data: responses },
    { data: people },
    { data: cohorts },
    { data: testMembers },
  ] = await Promise.all([
    supabase
      .from("ai_score_responses")
      .select("email, wave, cohort_id, answers_json, duration_seconds, flow")
      .returns<
        {
          email: string;
          wave: Wave;
          cohort_id: string | null;
          answers_json: Answers;
          duration_seconds: number | null;
          flow: "returner" | "first_timer" | null;
        }[]
      >(),
    supabase
      .from("people")
      .select("email, team")
      .returns<{ email: string; team: string | null }[]>(),
    supabase
      .from("programme_cohorts")
      .select("id, name, is_test")
      .returns<{ id: string; name: string; is_test: boolean }[]>(),
    // Every membership, so we can tell a sandbox-only person from someone
    // who is in a real cohort and also has a preview run.
    supabase
      .from("programme_cohort_members")
      .select("user_id, programme_cohorts!inner(is_test)")
      .returns<{ user_id: string; programme_cohorts: { is_test: boolean } }[]>(),
  ]);

  const teamByEmail = new Map(
    (people ?? []).map((p) => [p.email.trim().toLowerCase(), p.team]),
  );
  const realCohorts = (cohorts ?? []).filter((c) => includeRehearsal || !c.is_test);
  const cohortNameById = new Map((cohorts ?? []).map((c) => [c.id, c.name]));
  const testCohortIds = new Set(
    (cohorts ?? []).filter((c) => c.is_test).map((c) => c.id),
  );

  const sandboxOnly = sandboxOnlyUserIds(
    (testMembers ?? []).map((m) => ({
      user_id: m.user_id,
      isTest: m.programme_cohorts.is_test,
    })),
  );

  const testEmails = new Set<string>();
  if (sandboxOnly.length > 0) {
    const { data: emails } = await supabase.rpc("user_emails", {
      p_user_ids: sandboxOnly,
    });
    for (const e of (emails ?? []) as { email: string | null }[]) {
      if (e.email) testEmails.add(e.email.toLowerCase());
    }
  }

  const rows: ResponseRow[] = (responses ?? [])
    .filter((r) => includeRehearsal || !testEmails.has(r.email.toLowerCase()))
    .filter(
      (r) => includeRehearsal || !r.cohort_id || !testCohortIds.has(r.cohort_id),
    )
    .map((r) => {
      const team = teamByEmail.get(r.email.trim().toLowerCase()) ?? null;
      return {
        email: r.email,
        wave: r.wave,
        team,
        functionName: functionForTeam(team),
        cohortId: r.cohort_id,
        cohortName: r.cohort_id
          ? (cohortNameById.get(r.cohort_id) ?? null)
          : null,
        answers: r.answers_json ?? {},
        durationSeconds: r.duration_seconds,
        flow: r.flow,
      };
    });

  const waveCounts = rows.reduce(
    (acc, r) => {
      acc[r.wave] = (acc[r.wave] ?? 0) + 1;
      return acc;
    },
    {} as Record<Wave, number>,
  );

  const teamsInUse = [
    ...new Set(rows.map((r) => r.team).filter((t): t is string => !!t)),
  ].sort();

  return {
    rows,
    cohorts: realCohorts.map((c) => ({ id: c.id, name: c.name })),
    functions: [...new Set(rows.map((r) => r.functionName))].sort(),
    teams: teamsInUse,
    unmapped: unmappedTeams(teamsInUse),
    waveCounts,
    includingRehearsal: includeRehearsal,
  };
});

/** Applies the report's filters. Kept separate so it stays trivially testable. */
export function filterRows(
  rows: readonly ResponseRow[],
  filters: { cohortId?: string | null; functionName?: string | null; team?: string | null },
): ResponseRow[] {
  return rows.filter(
    (r) =>
      (!filters.cohortId || r.cohortId === filters.cohortId) &&
      (!filters.functionName || r.functionName === filters.functionName) &&
      (!filters.team || r.team === filters.team),
  );
}
