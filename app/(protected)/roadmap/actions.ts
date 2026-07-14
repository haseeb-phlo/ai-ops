"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import { ROADMAP_STATUSES } from "@/lib/roadmap";
import { nextQueueRank } from "@/lib/roadmap-server";
import { renumberQueue } from "./reorder";

export type RoadmapState =
  | { kind: "idle" }
  | { kind: "ok"; suggestionId?: string }
  | { kind: "error"; message: string };

/**
 * Every reader of roadmap data: the board itself, the suggestions
 * list/detail (status pill), and the dashboard's roadmap snapshot.
 */
function revalidateRoadmap() {
  revalidatePath("/roadmap");
  revalidatePath("/suggestions");
  revalidatePath("/");
}

/**
 * Add an item straight onto the roadmap without the suggestion→triage
 * funnel. Super-admin only: this is the "I decided we're building this"
 * path, so it lands directly in a committed status. Reuses the suggestions
 * table (same card, comments, and audit surface as an accepted suggestion)
 * rather than inventing a parallel roadmap_items table. The DB-level
 * status-transition trigger already exempts super-admins from the
 * "new rows start open" rule, so no policy change is needed.
 */
const CreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(5).max(2000),
  workflow_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  lane: z.enum(["accepted", "queued", "in_progress"]),
});

export async function createRoadmapItem(
  _prev: RoadmapState,
  formData: FormData,
): Promise<RoadmapState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;
  if (user.realRole !== "super_admin") {
    return {
      kind: "error",
      message: "Only super-admins can add items directly to the roadmap.",
    };
  }
  const parsed = CreateSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    workflow_id: formData.get("workflow_id") || undefined,
    lane: formData.get("lane"),
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message:
        parsed.error.issues[0]?.message ?? "Title and description are required.",
    };
  }
  const supabase = await createClient();

  // Queued items join the bottom of the queue; everything else is unranked.
  const queueRank =
    parsed.data.lane === "queued" ? await nextQueueRank(supabase) : null;

  const { data, error } = await supabase
    .from("intervention_suggestions")
    .insert({
      title: parsed.data.title,
      body: parsed.data.body,
      workflow_id: parsed.data.workflow_id ?? null,
      team: null,
      status: parsed.data.lane,
      queue_rank: queueRank,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[roadmap] create failed:", error?.message);
    return {
      kind: "error",
      message: "Could not add to the roadmap. Please try again.",
    };
  }
  revalidateRoadmap();
  return { kind: "ok", suggestionId: data.id };
}

/**
 * Move a single suggestion to a roadmap lane via drag-drop. Super-admin
 * only - members can't yank suggestions across lanes via DnD because the
 * lane semantics double as commit decisions.
 *
 * Lane mapping is status-only; dropping into Queued additionally puts the
 * card at the top of the queue (rank min-1, matching the board's optimistic
 * insert-at-top), and leaving Queued clears the rank.
 */
const LaneSchema = z.object({
  suggestion_id: z.string().uuid(),
  lane: z.enum(ROADMAP_STATUSES),
});

export async function moveSuggestionLane(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const gate = await requireWriter();
  if (!gate.ok) return { ok: false, message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { ok: false, message: "Only super-admins can move cards." };
  }
  const parsed = LaneSchema.safeParse({
    suggestion_id: formData.get("suggestion_id"),
    lane: formData.get("lane"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Invalid move." };
  }
  const supabase = await createClient();

  const update: Record<string, unknown> = {
    status: parsed.data.lane,
    queue_rank: null,
  };
  if (parsed.data.lane === "queued") {
    const { data: first } = await supabase
      .from("intervention_suggestions")
      .select("queue_rank")
      .eq("status", "queued")
      .not("queue_rank", "is", null)
      .order("queue_rank", { ascending: true })
      .limit(1)
      .maybeSingle<{ queue_rank: number | null }>();
    update.queue_rank = (first?.queue_rank ?? 1) - 1;
  }

  const { error } = await supabase
    .from("intervention_suggestions")
    .update(update)
    .eq("id", parsed.data.suggestion_id);
  if (error) {
    return { ok: false, message: `Could not move card: ${error.message}` };
  }
  revalidateRoadmap();
  return { ok: true };
}

/**
 * Persist a drag-to-reorder of the Queued lane. `ids` is the lane's
 * suggestions in their new visual order; the whole queue is renumbered 1..n
 * (see renumberQueue for how stale/concurrent rows are handled).
 */
const ReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export async function reorderQueue(
  ids: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const gate = await requireWriter();
  if (!gate.ok) return { ok: false, message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { ok: false, message: "Only super-admins can reorder the queue." };
  }
  const parsed = ReorderSchema.safeParse({ ids });
  if (!parsed.success) {
    return { ok: false, message: "Invalid reorder request." };
  }
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("intervention_suggestions")
    .select("id")
    .eq("status", "queued")
    .order("queue_rank", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .returns<{ id: string }[]>();
  if (error || !rows) {
    return { ok: false, message: "Could not load the queue to reorder." };
  }

  const updates = renumberQueue(rows, parsed.data.ids).map(
    ({ id, queue_rank }) =>
      supabase
        .from("intervention_suggestions")
        .update({ queue_rank })
        .eq("id", id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return {
      ok: false,
      message: `Could not save order: ${failed.error.message}`,
    };
  }
  revalidateRoadmap();
  return { ok: true };
}

/**
 * Move an AI initiative across roadmap lanes. Same super-admin gate as
 * suggestion moves. Initiatives have no queued state, so the Queued lane
 * only ever accepts suggestions. Lane membership is a 2D mapping over
 * status and shipped_at:
 *
 *   accepted     = shipped_at null + status `paused`  (planned / on hold)
 *   in_progress  = shipped_at null + status `active`  (currently running)
 *   shipped      = shipped_at set                     (live and done)
 *
 * Crucially, "shipped" is orthogonal to status: an initiative dropped into
 * the Shipped lane stays `active` and keeps counting in dashboard metrics.
 * `retired` remains a real lifecycle state, set explicitly via the status
 * button / edit dialog when an initiative is decommissioned - the roadmap
 * never writes it.
 */
const InitiativeLaneSchema = z.object({
  initiative_id: z.string().uuid(),
  lane: z.enum(["accepted", "in_progress", "shipped"]),
});

export async function moveInitiativeLane(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const gate = await requireWriter();
  if (!gate.ok) return { ok: false, message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { ok: false, message: "Only super-admins can move cards." };
  }
  const parsed = InitiativeLaneSchema.safeParse({
    initiative_id: formData.get("initiative_id"),
    lane: formData.get("lane"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Invalid move." };
  }
  const supabase = await createClient();

  // Build the update so each lane move clears the "other" axis. Moving out
  // of Shipped clears shipped_at; moving into Shipped sets it and forces
  // status back to active (so paused-then-shipped doesn't leave the row
  // counted as paused).
  const update: Record<string, unknown> = {};
  if (parsed.data.lane === "accepted") {
    update.status = "paused";
    update.shipped_at = null;
  } else if (parsed.data.lane === "in_progress") {
    update.status = "active";
    update.shipped_at = null;
  } else if (parsed.data.lane === "shipped") {
    update.status = "active";
    update.shipped_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("ai_interventions")
    .update(update)
    .eq("id", parsed.data.initiative_id);
  if (error) {
    return { ok: false, message: `Could not move card: ${error.message}` };
  }
  revalidateRoadmap();
  revalidatePath("/interventions");
  revalidatePath(`/interventions/${parsed.data.initiative_id}`);
  return { ok: true };
}
