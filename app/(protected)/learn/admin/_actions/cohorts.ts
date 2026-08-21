"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import {
  COHORT_SETUP_MESSAGE,
  deriveSessionDates,
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
  status: z.enum(["planned", "live", "complete", "archived"]).nullable(),
  slack_channel: z.string().trim().max(120).nullable(),
  join_open: z.boolean().nullable(),
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
    status: (formData.get("status") as string) || null,
    slack_channel: normaliseChannel(formData.get("slack_channel") as string),
    join_open: rawJoinOpen === null ? null : rawJoinOpen === "on",
  });
  if (!parsed.success) {
    return { kind: "error", message: "Check the form and try again." };
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.status) update.status = parsed.data.status;
  if (parsed.data.join_open !== null) update.join_open = parsed.data.join_open;
  // Sent on every submit, so an empty field means "clear it".
  update.slack_channel = parsed.data.slack_channel;

  const supabase = await createClient();
  const { error } = await supabase
    .from("programme_cohorts")
    .update(update)
    .eq("id", parsed.data.cohort_id);

  if (error) {
    return { kind: "error", message: `Could not save: ${error.message}` };
  }

  revalidatePath("/learn/admin");
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
