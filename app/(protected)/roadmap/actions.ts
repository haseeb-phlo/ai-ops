"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import { ROADMAP_STATUSES, compareQueueOrder } from "@/lib/roadmap";
import { bottomQueueRank, topQueueRank } from "@/lib/roadmap-server";
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
 * Add an item straight onto the roadmap without the suggestion-to-triage
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
  workflow_ids: z.array(z.string().uuid()).max(50),
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
    workflow_ids: formData.getAll("workflow_ids"),
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
    parsed.data.lane === "queued" ? await bottomQueueRank(supabase) : null;

  const { data, error } = await supabase
    .from("intervention_suggestions")
    .insert({
      title: parsed.data.title,
      body: parsed.data.body,
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

  // Workflow links are best-effort: the item is already on the roadmap, so
  // a failed link insert logs rather than erroring the whole add.
  if (parsed.data.workflow_ids.length > 0) {
    const { error: linkError } = await supabase
      .from("suggestion_workflows")
      .insert(
        parsed.data.workflow_ids.map((workflow_id) => ({
          suggestion_id: data.id,
          workflow_id,
        })),
      );
    if (linkError) {
      console.warn("[roadmap] workflow links failed:", linkError.message);
    }
  }

  revalidateRoadmap();
  return { kind: "ok", suggestionId: data.id };
}

/**
 * Move a single suggestion to a roadmap lane via drag-drop. Super-admin
 * only - members can't yank suggestions across lanes via DnD because the
 * lane semantics double as commit decisions.
 *
 * Lane mapping is status-only. Dropping into Queued additionally puts the
 * card at the top of the queue (matching the board's optimistic
 * insert-at-top); leaving Queued clears the rank.
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
    queue_rank:
      parsed.data.lane === "queued" ? await topQueueRank(supabase) : null,
  };

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
 * Persist a drag-to-reorder of the Queued lane. `ids` is the lane's cards
 * in their new visual order as "suggestion:<uuid>" / "initiative:<uuid>"
 * drag ids - the queue interleaves both kinds on one shared rank line. The
 * whole queue is renumbered 1..n (see renumberQueue for how
 * stale/concurrent rows are handled).
 */
const DRAG_ID = /^(suggestion|initiative):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ReorderSchema = z.object({
  ids: z.array(z.string().regex(DRAG_ID)).min(1),
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
  const [{ data: suggestionRows, error: sErr }, { data: initiativeRows, error: iErr }] =
    await Promise.all([
      supabase
        .from("intervention_suggestions")
        .select("id, queue_rank, created_at")
        .eq("status", "queued")
        .returns<{ id: string; queue_rank: number | null; created_at: string }[]>(),
      supabase
        .from("ai_interventions")
        .select("id, queue_rank, created_at")
        .eq("status", "paused")
        .is("shipped_at", null)
        .not("queue_rank", "is", null)
        .returns<{ id: string; queue_rank: number | null; created_at: string }[]>(),
    ]);
  if (sErr || iErr || !suggestionRows || !initiativeRows) {
    return { ok: false, message: "Could not load the queue to reorder." };
  }

  const current = [
    ...suggestionRows.map((r) => ({ ...r, id: `suggestion:${r.id}` })),
    ...initiativeRows.map((r) => ({ ...r, id: `initiative:${r.id}` })),
  ].sort(compareQueueOrder);

  const updates = renumberQueue(current, parsed.data.ids).map(
    ({ id, queue_rank }) => {
      const [kind, rowId] = id.split(":");
      return kind === "suggestion"
        ? supabase
            .from("intervention_suggestions")
            .update({ queue_rank })
            .eq("id", rowId)
        : supabase
            .from("ai_interventions")
            .update({ queue_rank })
            .eq("id", rowId);
    },
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
 * suggestion moves. Lane membership is a mapping over status, shipped_at,
 * and queue_rank:
 *
 *   accepted     = paused, unshipped, unranked   (planned / on hold)
 *   queued       = paused, unshipped, ranked     (prioritised, top of queue on drop)
 *   in_progress  = active, unshipped             (currently running)
 *   shipped      = shipped_at set                (live and done)
 *
 * Crucially, "shipped" is orthogonal to status: an initiative dropped into
 * the Shipped lane stays `active` and keeps counting in dashboard metrics.
 * `retired` remains a real lifecycle state, set explicitly via the status
 * button / edit dialog when an initiative is decommissioned - the roadmap
 * never writes it.
 */
const InitiativeLaneSchema = z.object({
  initiative_id: z.string().uuid(),
  lane: z.enum(ROADMAP_STATUSES),
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

  // Each lane move clears the axes it doesn't own: moving out of Shipped
  // clears shipped_at, moving into Shipped sets it and forces status back
  // to active (so paused-then-shipped doesn't leave the row counted as
  // paused), and only Queued carries a rank.
  const update: Record<string, unknown> = { queue_rank: null };
  if (parsed.data.lane === "accepted") {
    update.status = "paused";
    update.shipped_at = null;
  } else if (parsed.data.lane === "queued") {
    update.status = "paused";
    update.shipped_at = null;
    update.queue_rank = await topQueueRank(supabase);
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
