"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, requireWriter } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/profile";
import { sendSuggestionSubmittedEmail } from "@/lib/emails/suggestion-submitted";
import { sendSuggestionStatusChangedEmail } from "@/lib/emails/suggestion-status-changed";

const REVIEWER_EMAIL = "haseeb.hamid@wearephlo.com";

async function appUrl(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

const STATUSES = [
  "open",
  "under_review",
  "accepted",
  "in_progress",
  "declined",
  "shipped",
] as const;
type Status = (typeof STATUSES)[number];

// Champions can move suggestions through a triage subset; only super-admins
// can commit ("accepted") or close out ("shipped" via link). This is the
// guardrail against non-technical approval of unfeasible asks.
const CHAMPION_TARGETS: Status[] = ["under_review", "declined"];

export type SuggestionState =
  | { kind: "idle" }
  | { kind: "ok"; suggestionId?: string }
  | { kind: "error"; message: string };

const CreateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(5).max(2000),
  workflow_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function createSuggestion(
  _prev: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  const user = await getSessionUser();
  const parsed = CreateSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    workflow_id: formData.get("workflow_id") || undefined,
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message:
        parsed.error.issues[0]?.message ?? "Title and body are required.",
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intervention_suggestions")
    .insert({
      title: parsed.data.title,
      body: parsed.data.body,
      workflow_id: parsed.data.workflow_id ?? null,
      team: user.team ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      kind: "error",
      message: `Could not save suggestion: ${error?.message ?? "unknown"}`,
    };
  }

  // Notify the reviewer. Failures are logged but don't roll back the
  // suggestion - the in-app surface is still the source of truth.
  try {
    const result = await sendSuggestionSubmittedEmail({
      to: REVIEWER_EMAIL,
      suggestionId: data.id,
      title: parsed.data.title,
      body: parsed.data.body,
      submittedByName: user.displayName,
      team: user.team ?? null,
      appUrl: await appUrl(),
    });
    if ("ok" in result && !result.ok) {
      console.warn("[suggestion-submitted] email failed:", result.message);
    }
  } catch (err) {
    console.warn("[suggestion-submitted] email threw:", err);
  }

  revalidatePath("/suggestions");
  return { kind: "ok", suggestionId: data.id };
}

export async function toggleSuggestionVote(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const id = formData.get("suggestion_id");
  if (typeof id !== "string" || !id) return;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("intervention_suggestion_votes")
    .select("suggestion_id")
    .eq("suggestion_id", id)
    .eq("user_id", user.id)
    .maybeSingle<{ suggestion_id: string }>();
  if (existing) {
    await supabase
      .from("intervention_suggestion_votes")
      .delete()
      .eq("suggestion_id", id)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("intervention_suggestion_votes")
      .insert({ suggestion_id: id, user_id: user.id });
  }
  revalidatePath("/suggestions");
}

const StatusSchema = z.object({
  suggestion_id: z.string().uuid(),
  status: z.enum(STATUSES),
  decline_reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function setSuggestionStatus(
  _prev: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  const parsed = StatusSchema.safeParse({
    suggestion_id: formData.get("suggestion_id"),
    status: formData.get("status"),
    decline_reason: formData.get("decline_reason") ?? "",
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid status change.",
    };
  }

  const supabase = await createClient();

  // Permission gate: champions can only move to under_review / declined for
  // suggestions on their own team. accepted + shipped are super-admin only
  // because they commit the company to actually building.
  const isSuper = user.role === "super_admin";
  const target = parsed.data.status;

  const { data: row } = await supabase
    .from("intervention_suggestions")
    .select("team, status, title, created_by")
    .eq("id", parsed.data.suggestion_id)
    .maybeSingle<{
      team: string | null;
      status: Status;
      title: string;
      created_by: string | null;
    }>();
  if (!row) {
    return { kind: "error", message: "Suggestion not found." };
  }

  if (!isSuper) {
    if (!CHAMPION_TARGETS.includes(target)) {
      return {
        kind: "error",
        message:
          "Only super-admins can accept or ship a suggestion. Champions can move to Under review or Decline.",
      };
    }
    // Champion check: must be a champion of the suggestion's team.
    const { data: champ } = await supabase
      .from("champions")
      .select("id")
      .eq("user_id", user.id)
      .eq("team", row.team ?? "")
      .maybeSingle();
    if (!champ) {
      return {
        kind: "error",
        message:
          "Only the AI Champion of this team or a super-admin can change status.",
      };
    }
  }

  if (target === "declined" && !parsed.data.decline_reason) {
    return {
      kind: "error",
      message: "A reason is required when declining a suggestion.",
    };
  }

  const update: Record<string, unknown> = { status: target };
  if (target === "declined") {
    update.decline_reason = parsed.data.decline_reason;
  } else if (target === "open") {
    update.decline_reason = null;
  }

  const { error } = await supabase
    .from("intervention_suggestions")
    .update(update)
    .eq("id", parsed.data.suggestion_id);
  if (error) {
    return { kind: "error", message: error.message };
  }

  // Notify the suggestion's author when the decision matches one of the
  // three triage transitions (under_review / accepted / declined) AND the
  // status is actually changing - re-clicking the current status shouldn't
  // re-email. Email failures are logged but don't roll back the change.
  const notifyStatuses: Status[] = ["under_review", "accepted", "declined"];
  if (
    row.created_by &&
    notifyStatuses.includes(target) &&
    row.status !== target
  ) {
    try {
      await notifyAuthorOfStatusChange({
        authorUserId: row.created_by,
        suggestionId: parsed.data.suggestion_id,
        title: row.title,
        status: target as "under_review" | "accepted" | "declined",
        declineReason:
          target === "declined" ? parsed.data.decline_reason ?? null : null,
        decidedByName: user.displayName,
      });
    } catch (err) {
      console.warn("[suggestion-status-changed] email threw:", err);
    }
  }

  revalidatePath("/suggestions");
  return { kind: "ok" };
}

async function notifyAuthorOfStatusChange(args: {
  authorUserId: string;
  suggestionId: string;
  title: string;
  status: "under_review" | "accepted" | "declined";
  declineReason: string | null;
  decidedByName: string;
}): Promise<void> {
  const supabase = await createClient();
  const [{ data: emailRows }, { data: profile }, { data: peopleByEmailRows }] =
    await Promise.all([
      supabase.rpc("user_emails"),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", args.authorUserId)
        .maybeSingle<{ display_name: string | null }>(),
      supabase
        .from("people")
        .select("email, display_name")
        .returns<{ email: string; display_name: string }[]>(),
    ]);

  const authorEmail =
    ((emailRows ?? []) as { user_id: string; email: string | null }[]).find(
      (r) => r.user_id === args.authorUserId,
    )?.email ?? null;
  if (!authorEmail) return;

  const peopleName =
    (peopleByEmailRows ?? []).find(
      (p) => p.email.trim().toLowerCase() === authorEmail.trim().toLowerCase(),
    )?.display_name ?? null;
  const recipientName = resolveDisplayName(
    profile?.display_name,
    peopleName,
    authorEmail,
  );

  const result = await sendSuggestionStatusChangedEmail({
    to: authorEmail,
    recipientName,
    suggestionId: args.suggestionId,
    title: args.title,
    status: args.status,
    declineReason: args.declineReason,
    decidedByName: args.decidedByName,
    appUrl: await appUrl(),
  });
  if ("ok" in result && !result.ok) {
    console.warn("[suggestion-status-changed] email failed:", result.message);
  }
}

const EditSchema = z.object({
  suggestion_id: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(5).max(2000),
});

export async function editSuggestion(
  _prev: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };

  const parsed = EditSchema.safeParse({
    suggestion_id: formData.get("suggestion_id"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid edit.",
    };
  }
  const supabase = await createClient();
  // RLS already blocks unauthorised writes; we surface friendly errors.
  const { error } = await supabase
    .from("intervention_suggestions")
    .update({ title: parsed.data.title, body: parsed.data.body })
    .eq("id", parsed.data.suggestion_id);
  if (error) {
    return {
      kind: "error",
      message: `Could not save edit: ${error.message}`,
    };
  }
  revalidatePath("/suggestions");
  return { kind: "ok" };
}

const LinkSchema = z.object({
  suggestion_ids: z.array(z.string().uuid()).min(1),
  intervention_id: z.string().uuid(),
});

export async function linkSuggestionsToIntervention(
  _prev: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.role !== "super_admin") {
    return {
      kind: "error",
      message: "Only super-admins can link suggestions to AI initiatives.",
    };
  }
  const ids = formData.getAll("suggestion_ids").filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
  const parsed = LinkSchema.safeParse({
    suggestion_ids: ids,
    intervention_id: formData.get("intervention_id"),
  });
  if (!parsed.success) {
    return { kind: "error", message: "Pick at least one suggestion." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("intervention_suggestions")
    .update({
      intervention_id: parsed.data.intervention_id,
      status: "shipped",
    })
    .in("id", parsed.data.suggestion_ids);
  if (error) {
    return { kind: "error", message: error.message };
  }
  revalidatePath("/suggestions");
  revalidatePath(`/interventions/${parsed.data.intervention_id}`);
  return { kind: "ok" };
}

export async function deleteSuggestion(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (user.role !== "super_admin") return;
  const id = formData.get("suggestion_id");
  if (typeof id !== "string") return;
  const supabase = await createClient();
  await supabase.from("intervention_suggestions").delete().eq("id", id);
  revalidatePath("/suggestions");
}

/**
 * Server-only helper used by the suggest flow when "Open Log Intervention
 * with this suggestion pre-filled" is clicked. Drops the user into the
 * intervention list with the suggestion's title + body in the URL hash so
 * the dialog can pick them up. Keeps the suggestion-to-intervention bridge
 * lightweight without inventing a new dialog.
 */
export async function openInterventionFromSuggestion(
  formData: FormData,
): Promise<void> {
  const id = formData.get("suggestion_id");
  if (typeof id !== "string") return;
  redirect(`/interventions?from_suggestion=${encodeURIComponent(id)}`);
}

/**
 * Move a single suggestion to a roadmap lane via drag-drop. Super-admin
 * only - members can't yank suggestions across lanes via DnD because the
 * lane semantics double as commit decisions.
 *
 * Lane mapping is now status-only (after the in_progress migration):
 *   up_next      = status `accepted`
 *   in_progress  = status `in_progress`
 *   shipped      = status `shipped`
 *
 * No intervention_id required to move into in_progress. Use "Mark shipped"
 * to additionally link the closing intervention.
 */
const LaneSchema = z.object({
  suggestion_id: z.string().uuid(),
  lane: z.enum(["up_next", "in_progress", "shipped"]),
});

export async function moveSuggestionLane(
  formData: FormData,
): Promise<void> {
  const gate = await requireWriter();
  if (!gate.ok) return;
  if (gate.user.role !== "super_admin") return;
  const parsed = LaneSchema.safeParse({
    suggestion_id: formData.get("suggestion_id"),
    lane: formData.get("lane"),
  });
  if (!parsed.success) return;
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (parsed.data.lane === "up_next") {
    update.status = "accepted";
  } else if (parsed.data.lane === "in_progress") {
    update.status = "in_progress";
  } else if (parsed.data.lane === "shipped") {
    update.status = "shipped";
  }
  await supabase
    .from("intervention_suggestions")
    .update(update)
    .eq("id", parsed.data.suggestion_id);
  revalidatePath("/suggestions");
}

const CommentSchema = z.object({
  suggestion_id: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export async function createSuggestionComment(
  _prev: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  const user = await getSessionUser();
  const parsed = CommentSchema.safeParse({
    suggestion_id: formData.get("suggestion_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "Comment can't be empty.",
    };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("intervention_suggestion_comments")
    .insert({
      suggestion_id: parsed.data.suggestion_id,
      body: parsed.data.body,
      created_by: user.id,
    });
  if (error) return { kind: "error", message: error.message };
  revalidatePath(`/suggestions/${parsed.data.suggestion_id}`);
  return { kind: "ok" };
}

export async function deleteSuggestionComment(formData: FormData): Promise<void> {
  // Gate on a real session — getSessionUser redirects to /login if absent.
  // Author-or-super authorization is enforced by RLS on the delete itself.
  await getSessionUser();
  const id = formData.get("comment_id");
  const suggestionId = formData.get("suggestion_id");
  if (typeof id !== "string" || typeof suggestionId !== "string") return;
  const supabase = await createClient();
  await supabase
    .from("intervention_suggestion_comments")
    .delete()
    .eq("id", id);
  revalidatePath(`/suggestions/${suggestionId}`);
}
