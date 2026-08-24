"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import {
  COHORT_SETUP_MESSAGE,
  deriveSessionDates,
  isMonday,
  toSessionDatesJson,
  validateCohortSetup,
  type SessionItemRef,
} from "@/lib/programme/cohort-setup";

/**
 * Creating and editing cohorts.
 *
 * Split into `_actions/` rather than a single actions.ts because the admin
 * area's actions are unrelated to each other, which is the same reason /admin
 * does it (see `_actions/champions.ts`, `_actions/invite.ts`).
 */

const FLIP_REASON: Record<string, string> = {
  not_admin: "Only super admins can change this.",
  not_found: "That cohort no longer exists.",
  preview_run:
    "A preview run can't become a real cohort - self sign-off is allowed in it, so its approvals were never independently reviewed. Create a fresh cohort instead.",
};

export type CohortActionState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; cohortId: string; joinCode: string | null };

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  join_code: z.string().trim().min(3).max(32).nullable(),
  slack_channel: z.string().trim().max(120).nullable(),
  status: z.enum(["planned", "live"]),
  is_test: z.boolean(),
  dual_slot_item_ids: z.array(z.string().uuid()),
  default_approver_user_id: z.string().uuid().nullable(),
  review_mode: z.enum(["human", "ai_assisted"]),
});

export async function createCohort(
  _prev: CohortActionState,
  formData: FormData,
): Promise<CohortActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can create cohorts." };
  }

  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    start_date: formData.get("start_date"),
    join_code: (formData.get("join_code") as string)?.trim() || null,
    slack_channel: normaliseChannel(formData.get("slack_channel") as string),
    status: formData.get("status") ?? "planned",
    is_test: formData.get("is_test") === "on",
    dual_slot_item_ids: formData.getAll("dual_slot").map(String),
    default_approver_user_id:
      (formData.get("default_approver_user_id") as string) || null,
    review_mode: formData.get("review_mode") ?? "ai_assisted",
  });
  if (!parsed.success) {
    return { kind: "error", message: "Check the form and try again." };
  }

  const supabase = await createClient();

  const { data: track } = await supabase
    .from("programme_tracks")
    .select("id")
    .eq("slug", "core-programme")
    .maybeSingle<{ id: string }>();
  if (!track) {
    return {
      kind: "error",
      message: "The Core Programme track hasn't been seeded yet.",
    };
  }

  const { data: sessionItems } = await supabase
    .from("programme_track_items")
    .select("id, title, day_index")
    .eq("track_id", track.id)
    .eq("type", "session")
    .order("day_index")
    .returns<{ id: string; title: string; day_index: number }[]>();

  const sessions: SessionItemRef[] = (sessionItems ?? []).map((i) => ({
    trackItemId: i.id,
    title: i.title,
    dayIndex: i.day_index,
  }));

  const derived = deriveSessionDates({
    startDate: parsed.data.start_date,
    sessions,
    dualSlotItemIds: new Set(parsed.data.dual_slot_item_ids),
  });

  const problems = validateCohortSetup({
    name: parsed.data.name,
    startDate: parsed.data.start_date,
    sessions: derived,
  });
  if (problems.length > 0) {
    return { kind: "error", message: COHORT_SETUP_MESSAGE[problems[0]] };
  }

  const { data: created, error } = await supabase
    .from("programme_cohorts")
    .insert({
      name: parsed.data.name,
      track_id: track.id,
      start_date: parsed.data.start_date,
      session_dates: toSessionDatesJson(derived),
      status: parsed.data.status,
      is_test: parsed.data.is_test,
      join_code: parsed.data.join_code,
      slack_channel: parsed.data.slack_channel,
      default_approver_user_id: parsed.data.default_approver_user_id,
      review_mode: parsed.data.review_mode,
    })
    .select("id, join_code")
    .maybeSingle<{ id: string; join_code: string | null }>();

  if (error || !created) {
    // A duplicate join code is the one failure worth naming precisely.
    if (error?.code === "23505") {
      return {
        kind: "error",
        message: "That join code is already in use by another cohort.",
      };
    }
    return {
      kind: "error",
      message: `Could not create the cohort: ${error?.message ?? "unknown error"}`,
    };
  }

  revalidatePath("/learn/admin");
  revalidatePath("/learn/join");
  return { kind: "success", cohortId: created.id, joinCode: created.join_code };
}

const UpdateSchema = z.object({
  cohort_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  join_code: z.string().trim().min(3).max(32).nullable(),
  is_test: z.boolean(),
  status: z.enum(["planned", "live", "complete", "archived"]).nullable(),
  slack_channel: z.string().trim().max(120).nullable(),
  join_open: z.boolean().nullable(),
  default_approver_user_id: z.string().uuid().nullable(),
  review_mode: z.enum(["human", "ai_assisted"]),
});

/**
 * Edits the handful of fields that change during a cohort's life: its status,
 * its Slack channel and whether the join code still accepts people.
 *
 * Start date and session dates are deliberately NOT editable here. Moving them
 * mid-cohort would shift every unlock date under people who have already
 * started, and unlocked items never re-lock - so the change would be partly
 * applied and confusing. Recreate the cohort instead if the dates are wrong.
 */
export async function updateCohort(
  _prev: CohortActionState,
  formData: FormData,
): Promise<CohortActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can edit cohorts." };
  }

  const rawJoinOpen = formData.get("join_open");
  const parsed = UpdateSchema.safeParse({
    cohort_id: formData.get("cohort_id"),
    name: (formData.get("name") as string)?.trim() || null,
    start_date: (formData.get("start_date") as string) || null,
    join_code: (formData.get("join_code") as string)?.trim() || null,
    is_test: formData.get("is_test") === "on",
    status: (formData.get("status") as string) || null,
    slack_channel: normaliseChannel(formData.get("slack_channel") as string),
    join_open: rawJoinOpen === null ? null : rawJoinOpen === "on",
    default_approver_user_id:
      (formData.get("default_approver_user_id") as string) || null,
    review_mode: formData.get("review_mode") ?? "ai_assisted",
  });
  if (!parsed.success) {
    return { kind: "error", message: "Check the form and try again." };
  }

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("programme_cohorts")
    .select("id, name, start_date, is_test, track_id")
    .eq("id", parsed.data.cohort_id)
    .maybeSingle<{
      id: string;
      name: string;
      start_date: string;
      is_test: boolean;
      track_id: string;
    }>();
  if (!current) return { kind: "error", message: "That cohort no longer exists." };

  // is_test goes through the RPC, never the column. Making a cohort real
  // re-checks the one-active-cohort rule, which lives on a trigger on the
  // MEMBER table and so cannot see a change made here.
  if (parsed.data.is_test !== current.is_test) {
    const { data: flip, error: flipError } = await supabase.rpc(
      "programme_set_cohort_test",
      { p_cohort_id: parsed.data.cohort_id, p_is_test: parsed.data.is_test },
    );
    if (flipError) {
      return { kind: "error", message: `Could not save: ${flipError.message}` };
    }
    const flipResult = flip as
      | { ok: boolean; reason?: string; email?: string }
      | null;
    if (!flipResult?.ok) {
      return {
        kind: "error",
        message:
          flipResult?.reason === "member_in_another_cohort"
            ? `${flipResult.email ?? "Someone"} is already in another live cohort, so this one can't be made real. Move them first.`
            : (FLIP_REASON[flipResult?.reason ?? ""] ??
              "That change was refused."),
      };
    }
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.status) update.status = parsed.data.status;
  if (parsed.data.join_open !== null) update.join_open = parsed.data.join_open;
  if (parsed.data.name) update.name = parsed.data.name;
  update.join_code = parsed.data.join_code;

  // Moving the start date moves every unlock date with it - but session_dates
  // is stored as explicit dates keyed by item, so it would stay behind and
  // the sessions would land in the wrong week. Re-derive rather than let the
  // two drift apart silently.
  if (parsed.data.start_date && parsed.data.start_date !== current.start_date) {
    if (!isMonday(parsed.data.start_date)) {
      return { kind: "error", message: COHORT_SETUP_MESSAGE.start_not_a_monday };
    }
    update.start_date = parsed.data.start_date;

    const { data: sessionItems } = await supabase
      .from("programme_track_items")
      .select("id, title, day_index")
      .eq("track_id", current.track_id)
      .eq("type", "session")
      .order("day_index")
      .returns<{ id: string; title: string; day_index: number }[]>();

    const sessions: SessionItemRef[] = (sessionItems ?? []).map((i) => ({
      trackItemId: i.id,
      title: i.title,
      dayIndex: i.day_index,
    }));
    update.session_dates = toSessionDatesJson(
      deriveSessionDates({
        startDate: parsed.data.start_date,
        sessions,
        dualSlotItemIds: new Set(),
      }),
    );
  }
  // Sent on every submit, so an empty field means "clear it". Clearing the
  // approver is meaningful rather than a no-op: it puts sign-off routing back
  // on the org tree.
  update.slack_channel = parsed.data.slack_channel;
  update.default_approver_user_id = parsed.data.default_approver_user_id;
  update.review_mode = parsed.data.review_mode;

  const { error } = await supabase
    .from("programme_cohorts")
    .update(update)
    .eq("id", parsed.data.cohort_id);

  if (error) {
    if (error.code === "23505") {
      return {
        kind: "error",
        message: "That join code is already in use by another cohort.",
      };
    }
    return { kind: "error", message: `Could not save: ${error.message}` };
  }

  revalidatePath("/learn/admin");
  revalidatePath("/learn/track");
  revalidatePath("/learn");
  return { kind: "success", cohortId: parsed.data.cohort_id, joinCode: null };
}

/**
 * Accepts "#ai-cohort-1", "ai-cohort-1" or a full Slack link and stores the
 * bare channel name. People paste whichever they have to hand, and Slack's own
 * API wants it without the hash.
 */
function normaliseChannel(raw: string | null): string | null {
  const value = (raw ?? "").trim();
  if (value === "") return null;
  const fromUrl = value.match(/slack\.com\/[^/]*\/?archives\/([A-Z0-9]+)/i);
  if (fromUrl) return fromUrl[1];
  return value.replace(/^#/, "");
}

/* ------------------------------------------------------------------ */
/* Deleting a cohort                                                   */
/* ------------------------------------------------------------------ */

export type DeleteCohortState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "deleted"; name: string; summary: string };

const DeleteSchema = z.object({
  cohort_id: z.string().uuid(),
  confirm_name: z.string().trim().min(1),
});

/**
 * Deletes a cohort, with the name typed to confirm.
 *
 * Everything real about this lives in the RPC - what it refuses, and the
 * response cleanup that has to happen before the cascade. This turns reason
 * codes into sentences and nothing else.
 */
export async function deleteCohort(
  _prev: DeleteCohortState,
  formData: FormData,
): Promise<DeleteCohortState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can delete cohorts." };
  }

  const parsed = DeleteSchema.safeParse({
    cohort_id: formData.get("cohort_id"),
    confirm_name: formData.get("confirm_name"),
  });
  if (!parsed.success) {
    return { kind: "error", message: "Type the cohort name to confirm." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("programme_delete_cohort", {
    p_cohort_id: parsed.data.cohort_id,
    p_confirm_name: parsed.data.confirm_name,
  });
  if (error) return { kind: "error", message: `Could not delete: ${error.message}` };

  const result = data as
    | {
        ok: boolean;
        reason?: string;
        counts?: Record<string, number>;
        deleted?: Record<string, string | number>;
      }
    | null;

  if (!result?.ok) {
    if (result?.reason === "has_work") {
      const c = result.counts ?? {};
      const parts = [
        c.submissions ? `${c.submissions} submissions` : null,
        c.quiz_attempts ? `${c.quiz_attempts} quiz attempts` : null,
        c.attendance ? `${c.attendance} attendance marks` : null,
        c.progress ? `${c.progress} completed items` : null,
      ].filter(Boolean);
      return {
        kind: "error",
        message: `People have done work in this cohort - ${parts.join(", ")}. Set it to Archived instead, which hides it and keeps the record.`,
      };
    }
    if (result?.reason === "name_mismatch") {
      return { kind: "error", message: "That name doesn't match. Nothing deleted." };
    }
    return {
      kind: "error",
      message: FLIP_REASON[result?.reason ?? ""] ?? "That delete was refused.",
    };
  }

  const d = result.deleted ?? {};
  const kept = Number(d.imported_responses_kept ?? 0);
  const summary = [
    `${d.members ?? 0} members`,
    `${d.responses ?? 0} check-in responses`,
    kept > 0 ? `${kept} imported May responses kept` : null,
  ]
    .filter(Boolean)
    .join(", ");

  revalidatePath("/learn/admin");
  revalidatePath("/learn/track");
  revalidatePath("/learn");
  revalidatePath("/");
  return { kind: "deleted", name: String(d.name ?? "Cohort"), summary };
}
