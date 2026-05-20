"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, requireWriter } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import { resolveDisplayName } from "@/lib/profile";
import { sendInterventionCommentEmail } from "@/lib/emails/intervention-comment";
import { CADENCES, cadenceToPerWeek } from "@/lib/frequency";

const INTERVENTION_TYPES = [
  "tool",
  "training",
  "prompt",
  "agent",
  "automation",
  "process_change",
] as const;

const CONFIDENCES = ["high", "medium", "low"] as const;
const STATUSES = ["active", "paused", "retired"] as const;
const ADOPTION_STATUSES = [
  "daily",
  "weekly",
  "occasional",
  "abandoned",
] as const;

// Bounds catch typos (a £1,000,000 entered as £1,0000,000) before they
// poison dashboard aggregates. Ceilings are deliberately generous; mirrored
// as CHECK constraints in audit_integrity_migration.sql.
const nonNegMax = (max: number) =>
  z
    .number()
    .min(0, "Value can't be negative")
    .max(max, `Value can't exceed ${max.toLocaleString()}`)
    .nullable();

const SnapshotSchema = z.object({
  intervention_id: z.string().uuid(),
  snapshot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  time_value: nonNegMax(1_000_000),
  cost_value: nonNegMax(10_000_000),
  people_value: nonNegMax(10_000),
  errors_value: nonNegMax(1_000_000),
  revenue_value: nonNegMax(100_000_000),
  notes: z.string().max(500).optional(),
});

export type LogSnapshotState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success" };

function parseNumber(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function logMetricSnapshot(
  _prev: LogSnapshotState,
  formData: FormData,
): Promise<LogSnapshotState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;

  const parsed = SnapshotSchema.safeParse({
    intervention_id: formData.get("intervention_id"),
    snapshot_date: formData.get("snapshot_date"),
    time_value: parseNumber(formData.get("time_value")),
    cost_value: parseNumber(formData.get("cost_value")),
    people_value: parseNumber(formData.get("people_value")),
    errors_value: parseNumber(formData.get("errors_value")),
    revenue_value: parseNumber(formData.get("revenue_value")),
    notes: (formData.get("notes") as string) || undefined,
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("intervention_metrics").insert({
    intervention_id: data.intervention_id,
    snapshot_date: data.snapshot_date,
    time_value: data.time_value,
    cost_value: data.cost_value,
    people_value: data.people_value,
    errors_value: data.errors_value,
    revenue_value: data.revenue_value,
    notes: data.notes ?? null,
    created_by: user.id,
  });

  if (error) {
    return {
      kind: "error",
      message: `Could not save snapshot: ${error.message}`,
    };
  }

  revalidatePath(`/interventions/${data.intervention_id}`);
  revalidatePath("/");
  return { kind: "success" };
}

// =========================================================================
// Edit + retire
// =========================================================================

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(200),
  types: z
    .array(z.enum(INTERVENTION_TYPES))
    .min(1, "Pick at least one AI initiative type"),
  status: z.enum(STATUSES),
  description: z.string().max(500).nullable(),
  frequency_cadence: z.enum(CADENCES, {
    error: "Pick how often this AI initiative runs",
  }),
  minutes_saved_per_use: z
    .number({ error: "Minutes saved per use is required" })
    .min(0, "Minutes saved can't be negative")
    .max(100000),
  cost_saved_per_use: z
    .number({ error: "Cost saved per use is required" })
    .min(0, "Cost saved can't be negative")
    .max(10_000_000),
  revenue_per_use: z
    .number({ error: "Revenue per use is required" })
    .min(0, "Revenue can't be negative")
    .max(10_000_000),
  attribution_confidence: z.enum(CONFIDENCES),
  adoption_status: z.enum(ADOPTION_STATUSES).nullable(),
  satisfaction: z
    .number({ error: "Satisfaction must be a number" })
    .int()
    .min(1, "Satisfaction is 1-5")
    .max(5, "Satisfaction is 1-5")
    .nullable(),
  recipient_emails: z.array(z.string().email().toLowerCase()).max(500),
  // Notes write directly via UPDATE (update_intervention RPC doesn't accept
  // it yet), and the action writes an intervention_edits row to keep the
  // audit log honest. Nullable so a user can clear an existing note.
  notes: z
    .string()
    .max(2000, "Notes can be at most 2000 characters")
    .nullable(),
});

export type UpdateInterventionState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success" };

export async function updateIntervention(
  _prev: UpdateInterventionState,
  formData: FormData,
): Promise<UpdateInterventionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };

  const numericField = (key: string): number | undefined => {
    const raw = formData.get(key);
    return typeof raw === "string" && raw.trim() !== ""
      ? Number(raw)
      : undefined;
  };
  const descriptionRaw = formData.get("description");
  const description =
    typeof descriptionRaw === "string" && descriptionRaw.trim() !== ""
      ? descriptionRaw
      : null;
  const adoptionRaw = formData.get("adoption_status");
  const adoption =
    typeof adoptionRaw === "string" && adoptionRaw.trim() !== ""
      ? adoptionRaw
      : null;
  const satisfactionRaw = formData.get("satisfaction");
  const satisfaction =
    typeof satisfactionRaw === "string" && satisfactionRaw.trim() !== ""
      ? Number(satisfactionRaw)
      : null;
  const recipients = formData
    .getAll("recipient_emails")
    .filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
  const notesRaw = formData.get("notes");
  const notes: string | null =
    typeof notesRaw === "string" && notesRaw.trim() !== "" ? notesRaw : null;

  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    types: Array.from(
      new Set(
        formData
          .getAll("types")
          .filter(
            (v): v is string =>
              typeof v === "string" && v.trim().length > 0,
          ),
      ),
    ),
    status: formData.get("status"),
    description,
    frequency_cadence: formData.get("frequency_cadence"),
    minutes_saved_per_use: numericField("minutes_saved_per_use"),
    cost_saved_per_use: numericField("cost_saved_per_use"),
    revenue_per_use: numericField("revenue_per_use"),
    attribution_confidence: formData.get("attribution_confidence"),
    adoption_status: adoption,
    satisfaction,
    recipient_emails: recipients,
    notes,
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const data = parsed.data;
  const supabase = await createClient();
  // Cadence is canonical; the numeric uses_per_week is derived here so
  // dashboard aggregates (which read the per-week column) reflect the
  // user's pick.
  const usesPerWeek = cadenceToPerWeek(data.frequency_cadence);

  // Audited fields (including the per-use shape) go through the RPC, which
  // computes and writes the derived per-week columns and a per-field row
  // into intervention_edits.
  const { error: rpcError } = await supabase.rpc("update_intervention", {
    p_id: data.id,
    p_name: data.name,
    p_types: data.types,
    p_description: data.description,
    p_uses_per_week: usesPerWeek,
    p_minutes_saved_per_use: data.minutes_saved_per_use,
    p_cost_saved_per_use: data.cost_saved_per_use,
    p_revenue_per_use: data.revenue_per_use,
    p_attribution_confidence: data.attribution_confidence,
    p_adoption_status: data.adoption_status,
    p_satisfaction: data.satisfaction,
    p_frequency_cadence: data.frequency_cadence,
  });
  if (rpcError) {
    return {
      kind: "error",
      message: `Could not save: ${rpcError.message}`,
    };
  }

  // Status + recipients aren't audited by the RPC yet, so write them
  // directly. Same pattern as before; audit coverage can be added in a
  // follow-up migration that extends update_intervention. Notes joins
  // them - written directly here, with an explicit intervention_edits row
  // so the audit log still reflects the change.
  //
  // Load the current notes value so we only audit + write when it changed.
  const { data: currentRow } = await supabase
    .from("ai_interventions")
    .select("notes")
    .eq("id", data.id)
    .maybeSingle<{ notes: string | null }>();
  const currentNotes = currentRow?.notes ?? null;
  const nextNotes = data.notes;
  const notesChanged = currentNotes !== nextNotes;

  const { error: directError } = await supabase
    .from("ai_interventions")
    .update({
      status: data.status,
      recipient_emails: data.recipient_emails,
      notes: nextNotes,
    })
    .eq("id", data.id);
  if (directError) {
    return {
      kind: "error",
      message: `Saved core fields, but could not update extras: ${directError.message}`,
    };
  }

  if (notesChanged) {
    const user = await getSessionUser();
    const { error: auditError } = await supabase
      .from("intervention_edits")
      .insert({
        intervention_id: data.id,
        actor_id: user.id,
        actor_email: user.email,
        action: "edit",
        field: "notes",
        old_value: currentNotes,
        new_value: nextNotes,
      });
    if (auditError) {
      console.warn("updateIntervention: notes audit write failed", auditError);
    }
  }

  revalidatePath(`/interventions/${data.id}`);
  revalidatePath("/interventions");
  revalidatePath("/");
  return { kind: "success" };
}

const StatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUSES),
});

export type SetStatusState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success" };

export async function setInterventionStatus(
  _prev: SetStatusState,
  formData: FormData,
): Promise<SetStatusState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };

  const parsed = StatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_intervention_status", {
    p_id: data.id,
    p_status: data.status,
  });

  if (error) {
    return { kind: "error", message: `Could not change status: ${error.message}` };
  }

  revalidatePath(`/interventions/${data.id}`);
  revalidatePath("/interventions");
  revalidatePath("/");
  return { kind: "success" };
}

export type DeleteInterventionState =
  | { kind: "ok" }
  | { kind: "error"; reason: "permission" | "not_found" | "db"; message: string };

/**
 * Hard delete an intervention. Super-admin only. The RLS DELETE policy
 * on public.ai_interventions (added in ai_interventions_delete_policy_-
 * migration.sql) is what makes the direct REST delete actually remove
 * rows instead of silently returning 200 + zero rows affected.
 *
 * Suggestion linkage is detached first so any shipped suggestion flips
 * back to open instead of dangling. FK cascades on intervention_-
 * workflows / workflow_baselines / intervention_metrics clean up the
 * rest.
 *
 * Returns a result object instead of redirecting. The button calls this
 * inside a transition and uses router.push on success - redirecting from
 * a Server Action triggered inside a Dialog left the dialog open and
 * the browser sitting on a now-404 detail page.
 */
export async function deleteIntervention(
  id: string,
): Promise<DeleteInterventionState> {
  const gate = await requireWriter();
  if (!gate.ok) {
    return { kind: "error", reason: "permission", message: gate.error };
  }
  if (gate.user.role !== "super_admin") {
    return {
      kind: "error",
      reason: "permission",
      message: "Only super_admin can delete an AI initiative.",
    };
  }

  const supabase = await createClient();

  // Detach suggestion linkage so a shipped suggestion flips back to open.
  // Best-effort: if this fails we still attempt the delete - the user
  // would rather lose suggestion linkage than be unable to delete the
  // sample data we're trying to clean up.
  const { error: detachError } = await supabase
    .from("intervention_suggestions")
    .update({ intervention_id: null, status: "open" })
    .eq("intervention_id", id);
  if (detachError) {
    console.warn("deleteIntervention: detach suggestions failed", detachError);
  }

  const { data: deletedRows, error } = await supabase
    .from("ai_interventions")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("deleteIntervention failed", error);
    return { kind: "error", reason: "db", message: error.message };
  }
  if (!deletedRows || deletedRows.length === 0) {
    return {
      kind: "error",
      reason: "not_found",
      message:
        "Delete returned 0 rows. Apply supabase/ai_interventions_delete_policy_migration.sql in the SQL editor and try again.",
    };
  }

  revalidatePath("/interventions");
  revalidatePath("/");
  return { kind: "ok" };
}

// =========================================================================
// Comments
// =========================================================================
// Mirrors the suggestion-comment thread. Any signed-in user can post; the
// author or a super-admin can delete (RLS enforces this).

export type CommentState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "ok" };

const CommentSchema = z.object({
  intervention_id: z.string().uuid(),
  body: z.string().trim().min(1, "Comment can't be empty.").max(2000),
});

export async function createInterventionComment(
  _prev: CommentState,
  formData: FormData,
): Promise<CommentState> {
  // Comments are deliberately allowed under impersonation - they're a
  // discussion surface, not a record-of-truth mutation. We still need a
  // real session so getSessionUser (not requireWriter) is the right gate.
  const user = await getSessionUser();
  const parsed = CommentSchema.safeParse({
    intervention_id: formData.get("intervention_id"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues[0]?.message ?? "Comment can't be empty.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("ai_intervention_comments").insert({
    intervention_id: parsed.data.intervention_id,
    body: parsed.data.body,
    created_by: user.id,
  });
  if (error) return { kind: "error", message: error.message };

  // Fan out to the initiative owner + every prior commenter (minus self).
  // Failures log but don't fail the comment - in-app remains source of truth.
  try {
    await notifyInterventionCommentThread({
      interventionId: parsed.data.intervention_id,
      commentBody: parsed.data.body,
      commenterUserId: user.id,
      commenterName: user.displayName,
    });
  } catch (err) {
    console.warn("[intervention-comment] notify thread threw:", err);
  }

  revalidatePath(`/interventions/${parsed.data.intervention_id}`);
  revalidatePath("/");
  return { kind: "ok" };
}

async function notifyInterventionCommentThread(args: {
  interventionId: string;
  commentBody: string;
  commenterUserId: string;
  commenterName: string;
}): Promise<void> {
  const supabase = await createClient();
  const [
    { data: intervention },
    { data: priorComments },
    { data: profileRows },
    { data: peopleRows },
  ] = await Promise.all([
    supabase
      .from("ai_interventions")
      .select("id, name, created_by")
      .eq("id", args.interventionId)
      .maybeSingle<{ id: string; name: string; created_by: string | null }>(),
    supabase
      .from("ai_intervention_comments")
      .select("created_by")
      .eq("intervention_id", args.interventionId)
      .returns<{ created_by: string | null }[]>(),
    supabase
      .from("profiles")
      .select("user_id, display_name")
      .returns<{ user_id: string; display_name: string | null }[]>(),
    supabase
      .from("people")
      .select("email, display_name")
      .returns<{ email: string; display_name: string }[]>(),
  ]);

  if (!intervention) return;

  const recipientIds = new Set<string>();
  if (intervention.created_by && intervention.created_by !== args.commenterUserId) {
    recipientIds.add(intervention.created_by);
  }
  for (const c of priorComments ?? []) {
    if (c.created_by && c.created_by !== args.commenterUserId) {
      recipientIds.add(c.created_by);
    }
  }
  if (recipientIds.size === 0) return;

  const { data: emailRows } = await supabase.rpc("user_emails", {
    p_user_ids: Array.from(recipientIds),
  });
  const emailByUserId = new Map<string, string>();
  for (const r of (emailRows ?? []) as { user_id: string; email: string | null }[]) {
    if (r.email) emailByUserId.set(r.user_id, r.email);
  }
  const profileByUserId = new Map<string, string | null>();
  for (const p of profileRows ?? []) {
    profileByUserId.set(p.user_id, p.display_name);
  }
  const peopleByEmail = new Map<string, string>();
  for (const p of peopleRows ?? []) {
    if (p.email && p.display_name) {
      peopleByEmail.set(p.email.trim().toLowerCase(), p.display_name);
    }
  }

  const url = appUrl();
  await Promise.all(
    Array.from(recipientIds).map(async (recipientId) => {
      const email = emailByUserId.get(recipientId);
      if (!email) return;
      const peopleName = peopleByEmail.get(email.trim().toLowerCase()) ?? null;
      const displayName = resolveDisplayName(
        profileByUserId.get(recipientId),
        peopleName,
        email,
      );
      const result = await sendInterventionCommentEmail({
        recipient: { email, displayName },
        interventionId: args.interventionId,
        interventionName: intervention.name,
        commentBody: args.commentBody,
        commenterName: args.commenterName,
        isOwner: recipientId === intervention.created_by,
        appUrl: url,
      });
      if ("ok" in result && !result.ok) {
        console.warn(
          `[intervention-comment] email to ${email} failed:`,
          result.message,
        );
      }
    }),
  );
}

export async function deleteInterventionComment(formData: FormData): Promise<void> {
  await getSessionUser();
  const id = formData.get("comment_id");
  const interventionId = formData.get("intervention_id");
  if (typeof id !== "string" || typeof interventionId !== "string") return;
  const supabase = await createClient();
  await supabase.from("ai_intervention_comments").delete().eq("id", id);
  revalidatePath(`/interventions/${interventionId}`);
  revalidatePath("/");
}
