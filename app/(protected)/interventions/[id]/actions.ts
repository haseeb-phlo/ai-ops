"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";

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
  type: z.enum(INTERVENTION_TYPES, { error: "Pick an intervention type" }),
  status: z.enum(STATUSES),
  description: z.string().max(500).nullable(),
  minutes_saved_per_week: z
    .number({ error: "Minutes saved must be a number" })
    .min(0, "Minutes saved can't be negative")
    .max(100000)
    .nullable(),
  estimated_gbp_saved_per_week: z
    .number({ error: "GBP saved must be a number" })
    .min(0, "GBP saved can't be negative")
    .max(10_000_000)
    .nullable(),
  estimated_revenue_per_week: z
    .number({ error: "Revenue must be a number" })
    .min(0, "Revenue can't be negative")
    .max(10_000_000)
    .nullable(),
  attribution_confidence: z.enum(CONFIDENCES),
  adoption_status: z.enum(ADOPTION_STATUSES).nullable(),
  satisfaction: z
    .number({ error: "Satisfaction must be a number" })
    .int()
    .min(1, "Satisfaction is 1-5")
    .max(5, "Satisfaction is 1-5")
    .nullable(),
  recipient_emails: z.array(z.string().email().toLowerCase()).max(500),
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

  const minutesRaw = formData.get("minutes_saved_per_week");
  const minutesParsed =
    typeof minutesRaw === "string" && minutesRaw.trim() !== ""
      ? Number(minutesRaw)
      : null;
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
  const gbpRaw = formData.get("estimated_gbp_saved_per_week");
  const gbpParsed =
    typeof gbpRaw === "string" && gbpRaw.trim() !== ""
      ? Number(gbpRaw)
      : null;
  const revenueRaw = formData.get("estimated_revenue_per_week");
  const revenueParsed =
    typeof revenueRaw === "string" && revenueRaw.trim() !== ""
      ? Number(revenueRaw)
      : null;
  const recipients = formData
    .getAll("recipient_emails")
    .filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );

  const parsed = UpdateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    type: formData.get("type"),
    status: formData.get("status"),
    description,
    minutes_saved_per_week: minutesParsed,
    estimated_gbp_saved_per_week: gbpParsed,
    estimated_revenue_per_week: revenueParsed,
    attribution_confidence: formData.get("attribution_confidence"),
    adoption_status: adoption,
    satisfaction,
    recipient_emails: recipients,
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  // Existing fields go through the audited RPC (writes to intervention_edits).
  const { error: rpcError } = await supabase.rpc("update_intervention", {
    p_id: data.id,
    p_name: data.name,
    p_type: data.type,
    p_description: data.description,
    p_minutes_saved_per_week: data.minutes_saved_per_week,
    p_attribution_confidence: data.attribution_confidence,
    p_adoption_status: data.adoption_status,
    p_satisfaction: data.satisfaction,
  });
  if (rpcError) {
    return {
      kind: "error",
      message: `Could not save: ${rpcError.message}`,
    };
  }

  // Newer fields (status, estimated GBP / revenue, recipients) aren't yet
  // supported by the audited RPC, so write them directly. They show up on
  // the dashboard immediately; audit-trail coverage for these can be added
  // in a follow-up migration that extends update_intervention.
  const { error: directError } = await supabase
    .from("ai_interventions")
    .update({
      status: data.status,
      estimated_gbp_saved_per_week: data.estimated_gbp_saved_per_week,
      estimated_revenue_per_week: data.estimated_revenue_per_week,
      recipient_emails: data.recipient_emails,
    })
    .eq("id", data.id);
  if (directError) {
    return {
      kind: "error",
      message: `Saved core fields, but could not update extras: ${directError.message}`,
    };
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

/**
 * Hard delete an intervention. Super-admin only. Goes through the
 * delete_intervention RPC (security definer) because the `authenticated`
 * role has no GRANT DELETE on public.ai_interventions - a direct REST
 * DELETE used to return 200 + zero rows affected and the UI looked broken.
 *
 * The RPC handles cascading dependents (workflow_baselines /
 * intervention_metrics / intervention_workflows via FK cascade) and
 * detaches any suggestion linkage so shipped suggestions don't dangle.
 *
 * Returns the deleted id; null means the row wasn't there (e.g. someone
 * else deleted it first). The action turns that into a soft failure on
 * the detail page so the user gets visible feedback.
 */
export async function deleteIntervention(formData: FormData): Promise<void> {
  const { redirect } = await import("next/navigation");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    redirect("/interventions");
  }

  const gate = await requireWriter();
  if (!gate.ok || gate.user.role !== "super_admin") {
    redirect(`/interventions/${id}?deleteFailed=permission`);
  }

  const supabase = await createClient();

  const { data: deletedId, error } = await supabase.rpc("delete_intervention", {
    p_id: id,
  });

  if (error || !deletedId) {
    if (error) console.error("deleteIntervention failed", error);
    redirect(`/interventions/${id}?deleteFailed=1`);
  }

  revalidatePath("/interventions");
  revalidatePath("/");
  redirect("/interventions");
}
