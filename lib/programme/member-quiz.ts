import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { parseQuizConfig, type QuizConfig } from "./quiz";
import {
  buildQuizDetails,
  parseAnswersJson,
  toQuizColumn,
  type QuizDetail,
} from "./quiz-results";
import { hasDayArrived, openThroughInLondon, unlockDateFor } from "./working-days";

/**
 * One member's quiz history, with every answer they gave.
 *
 * Separate from `loadCohortAdminView` because of `answers_json`. That view's
 * attempts query is unfiltered by cohort - it reads the whole table - so
 * carrying a jsonb blob per row there would scale with the programme instead
 * of with the cohort being looked at. Here the scope is one member, stated
 * explicitly in the query rather than left to a downstream lookup.
 *
 * Reads through the CALLER's client, not the service role. The route gates on
 * `realRole === "super_admin"` and RLS re-checks the same thing, so the two
 * agree; a service-role read would serve this data on the strength of the
 * route check alone.
 */
export type MemberQuizView = {
  member: {
    cohortMemberId: string;
    userId: string;
    displayName: string;
    joinedOn: string;
  };
  cohort: {
    id: string;
    name: string;
    startDate: string;
    status: string;
    isTest: boolean;
  };
  quizzes: QuizDetail[];
  /** Attempts across every quiz, for the header line. */
  totalAttempts: number;
};

export const loadMemberQuizView = cache(
  async (cohortMemberId: string): Promise<MemberQuizView | null> => {
    const supabase = await createClient();

    const { data: member } = await supabase
      .from("programme_cohort_members")
      .select(
        "id, user_id, joined_at, cohort_id, programme_cohorts!inner(id, name, start_date, status, is_test, track_id)",
      )
      .eq("id", cohortMemberId)
      .maybeSingle<{
        id: string;
        user_id: string;
        joined_at: string;
        cohort_id: string;
        programme_cohorts: {
          id: string;
          name: string;
          start_date: string;
          status: string;
          is_test: boolean;
          track_id: string;
        };
      }>();
    if (!member) return null;

    const cohort = member.programme_cohorts;

    const [{ data: itemRows }, { data: attemptRows }, { data: profile }] =
      await Promise.all([
        supabase
          .from("programme_track_items")
          .select("id, title, day_index, config_json")
          .eq("track_id", cohort.track_id)
          .eq("type", "quiz")
          .order("day_index")
          .returns<
            {
              id: string;
              title: string;
              day_index: number;
              config_json: Record<string, unknown> | null;
            }[]
          >(),
        supabase
          .from("programme_quiz_attempts")
          .select("id, cohort_member_id, track_item_id, score, answers_json, created_at")
          .eq("cohort_member_id", cohortMemberId)
          .order("created_at", { ascending: false })
          .returns<
            {
              id: string;
              cohort_member_id: string;
              track_item_id: string;
              score: number;
              answers_json: Record<string, unknown> | null;
              created_at: string;
            }[]
          >(),
        supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", member.user_id)
          .maybeSingle<{ display_name: string | null }>(),
      ]);

    const openThrough = openThroughInLondon();
    const items = itemRows ?? [];

    const columns = items.map((i) =>
      toQuizColumn({
        id: i.id,
        title: i.title,
        day_index: i.day_index,
        config_json: i.config_json,
        opensOn: unlockDateFor(cohort.start_date, i.day_index),
        opened: hasDayArrived({
          dayIndex: i.day_index,
          startDate: cohort.start_date,
          today: openThrough,
        }),
      }),
    );

    // Parsed with the SAME function the marker used. Answer indices are
    // relative to `parseQuizConfig`'s output, which drops malformed questions
    // and reindexes, so reading them against raw `config_json.questions`
    // would misalign every question after the first dropped one.
    const configByItemId = new Map<string, QuizConfig | null>(
      items.map((i) => [i.id, parseQuizConfig(i.config_json)]),
    );

    const attempts = (attemptRows ?? []).map((a) => ({
      id: a.id,
      cohortMemberId: a.cohort_member_id,
      trackItemId: a.track_item_id,
      score: a.score,
      answers: parseAnswersJson(a.answers_json),
      createdAt: a.created_at,
    }));

    return {
      member: {
        cohortMemberId: member.id,
        userId: member.user_id,
        displayName: profile?.display_name || "(no name)",
        joinedOn: member.joined_at.slice(0, 10),
      },
      cohort: {
        id: cohort.id,
        name: cohort.name,
        startDate: cohort.start_date,
        status: cohort.status,
        isTest: cohort.is_test,
      },
      quizzes: buildQuizDetails({ columns, configByItemId, attempts }),
      totalAttempts: attempts.length,
    };
  },
);
