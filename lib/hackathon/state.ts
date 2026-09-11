import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { resolveDisplayName } from "@/lib/profile";
import { hackathonAccess, type HackathonAccess } from "./access";
import { hoursPerWeek, type HoursPerWeek } from "./impact";
import { answerValue, type Answers } from "./questions";

/**
 * Server reads for the Hackathon tab.
 *
 * Split in two on purpose, because the two callers need different amounts and
 * one of them is the whole app's layout:
 *
 *   `loadHackathonInvite`  - "does this person get the tab at all", which is
 *                            one indexed lookup, and none at all for a super
 *                            admin. Called from `app/(protected)/layout.tsx`,
 *                            so it runs on every page in the app.
 *   `loadHackathonState`   - the above plus their own response. Called only
 *                            by the /hackathon routes.
 *
 * Both are `cache()`d, so the layout's question and the page's question cost
 * one round trip between them - the pattern `getSessionUser` and
 * `loadTrackState` both use.
 *
 * Cohort membership is read with the caller's own client, so RLS decides:
 * `read own or led programme_cohort_members` means a member sees their own
 * row and nobody else's.
 */

export type HackathonInvite = {
  inInvitedCohort: boolean;
  /** The invited cohort this person is in, for attributing their response. */
  cohortId: string | null;
  cohortName: string | null;
};

export const loadHackathonInvite = cache(
  async (userId: string): Promise<HackathonInvite> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("programme_cohort_members")
      .select("cohort_id, programme_cohorts!inner(name, hackathon_access)")
      .eq("user_id", userId)
      .eq("programme_cohorts.hackathon_access", true)
      .limit(1)
      .returns<
        {
          cohort_id: string;
          programme_cohorts: { name: string; hackathon_access: boolean };
        }[]
      >();

    // Fail loud, for the reason `getSessionUser` fails loud on the people
    // directory: the quiet alternative is a `false` that reads as "not
    // invited", so a transient failure or an RLS regression would take the
    // tab out of somebody's nav and bounce the link they were sent to the
    // dashboard, with nothing anywhere saying why. A misconfig should 500.
    if (error) {
      throw new Error(`Failed to load hackathon invite: ${error.message}`);
    }

    const row = data?.[0];
    return {
      inInvitedCohort: !!row,
      cohortId: row?.cohort_id ?? null,
      cohortName: row?.programme_cohorts.name ?? null,
    };
  },
);

/**
 * One person's answers, plus what the bank derives from them.
 *
 * `hours` is computed here rather than stored: it is a pure function of two
 * answers (see impact.ts), and a stored copy would be a second thing to keep
 * true on every write for a number thirty-one rows can produce for free.
 */
export type HackathonResponse = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  answers: Answers;
  /** q1 - the survey's own coarse team bucket, not the directory's team. */
  team: string | null;
  hours: HoursPerWeek | null;
  submittedAt: string;
  /** Set when the response has been revised since it was first submitted. */
  revised: boolean;
};

export type HackathonState = {
  access: HackathonAccess;
  invite: HackathonInvite;
  /** This person's own response, when they have one. */
  own: HackathonResponse | null;
};

export const loadHackathonState = cache(
  async (input: {
    userId: string;
    email: string;
    realRole: string;
    /** The session's resolved display name, for labelling their own card. */
    displayName: string;
  }): Promise<HackathonState> => {
    const supabase = await createClient();
    const [invite, ownRes] = await Promise.all([
      loadHackathonInvite(input.userId),
      supabase
        .from("hackathon_survey_responses")
        .select(
          "id, user_id, email, answers_json, submitted_at, created_at, updated_at",
        )
        .eq("user_id", input.userId)
        .maybeSingle(),
    ]);

    const own = ownRes.data
      ? toResponse(
          {
            id: ownRes.data.id,
            user_id: ownRes.data.user_id,
            email: ownRes.data.email,
            answers_json: ownRes.data.answers_json,
            submitted_at: ownRes.data.submitted_at,
            created_at: ownRes.data.created_at,
          },
          input.displayName,
        )
      : null;

    return {
      access: hackathonAccess({
        inInvitedCohort: invite.inInvitedCohort,
        hasResponded: own !== null,
        realRole: input.realRole,
      }),
      invite,
      own,
    };
  },
);

type ResponseRow = {
  id: string;
  user_id: string;
  email: string;
  answers_json: unknown;
  submitted_at: string;
  created_at: string;
};

function toResponse(row: ResponseRow, fallbackName: string): HackathonResponse {
  const answers = (row.answers_json ?? {}) as Answers;
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    displayName: fallbackName,
    answers,
    team: answerValue(answers, "q1"),
    hours: hoursPerWeek(answerValue(answers, "q3"), answerValue(answers, "q4")),
    // A minute's grace: the insert sets both stamps from the same clock but
    // not from the same statement, so exact equality is not safe to assume.
    revised:
      new Date(row.submitted_at).getTime() -
        new Date(row.created_at).getTime() >
      60_000,
    submittedAt: row.submitted_at,
  };
}

/**
 * Every response, for the problem bank.
 *
 * No access check here: the table's select policy is the gate, and it already
 * says "your own row, or everyone's once you have one of your own". The page
 * checks too, so the wrong caller gets a redirect rather than an empty list -
 * but the empty list is what happens if the page's check is ever wrong, which
 * is the correct direction for that mistake to fail in.
 *
 * Ordering is by size, biggest first, because that is the order the problems
 * get picked in. Names come from the people directory, which is the same
 * source `getSessionUser` resolves display names from.
 */
export async function loadProblemBank(): Promise<HackathonResponse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hackathon_survey_responses")
    .select("id, user_id, email, answers_json, submitted_at, created_at")
    .order("submitted_at", { ascending: true })
    .returns<ResponseRow[]>();

  if (error) {
    throw new Error(`Failed to load the problem bank: ${error.message}`);
  }
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // The whole directory rather than the emails in `rows`: `people.email` is
  // free-text-cased while the stored response email is lowercased, and
  // PostgREST's `in` is case-sensitive - so filtering would silently drop
  // anyone whose directory row is capitalised. It is 138 rows.
  const { data: people } = await supabase
    .from("people")
    .select("email, display_name")
    .returns<{ email: string; display_name: string | null }[]>();

  const nameByEmail = new Map(
    (people ?? []).map((p) => [p.email.toLowerCase(), p.display_name]),
  );

  return rows.map((row) =>
    toResponse(
      row,
      resolveDisplayName(null, nameByEmail.get(row.email) ?? null, row.email),
    ),
  );
}
