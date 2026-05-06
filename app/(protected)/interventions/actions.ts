"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
const ADOPTION_STATUSES = [
  "daily",
  "weekly",
  "occasional",
  "abandoned",
] as const;

const FormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: z.enum(INTERVENTION_TYPES, { error: "Pick an intervention type" }),
  workflow_ids: z
    .array(z.string().uuid())
    .min(1, "Select at least one affected workflow"),
  description: z
    .string()
    .min(3, "Description is required")
    .max(500),
  minutes_saved_per_week: z
    .number({ error: "Minutes saved is required" })
    .min(0, "Minutes saved can't be negative")
    .max(100000),
  estimated_gbp_saved_per_week: z
    .number({ error: "GBP saved is required" })
    .min(0, "GBP saved can't be negative")
    .max(10_000_000),
  estimated_revenue_per_week: z
    .number({ error: "Revenue is required" })
    .min(0, "Revenue can't be negative")
    .max(10_000_000),
  attribution_confidence: z.enum(CONFIDENCES).default("medium"),
  adoption_status: z.enum(ADOPTION_STATUSES, {
    error: "Pick an adoption status",
  }),
  satisfaction: z
    .number({ error: "Pick a satisfaction score" })
    .int()
    .min(1, "Satisfaction is 1-5")
    .max(5, "Satisfaction is 1-5"),
  // Recipients are picked from the company directory by canonical email.
  // Required: every intervention reaches someone; "team-wide" gets logged
  // by adding the team's members explicitly.
  recipient_emails: z
    .array(z.string().email().toLowerCase())
    .min(1, "Pick at least one person affected by this intervention")
    .max(500, "Recipient list is unusually large; check the picker."),
});

export type LogInterventionState =
  | { kind: "idle" }
  | { kind: "error"; message: string };

export async function logIntervention(
  _prev: LogInterventionState,
  formData: FormData,
): Promise<LogInterventionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };

  const numericField = (key: string): number | undefined => {
    const raw = formData.get(key);
    return typeof raw === "string" && raw.trim() !== ""
      ? Number(raw)
      : undefined;
  };

  const parsed = FormSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    workflow_ids: formData.getAll("workflow_ids"),
    description: (formData.get("description") as string) || "",
    minutes_saved_per_week: numericField("minutes_saved_per_week"),
    estimated_gbp_saved_per_week: numericField("estimated_gbp_saved_per_week"),
    estimated_revenue_per_week: numericField("estimated_revenue_per_week"),
    attribution_confidence:
      (formData.get("attribution_confidence") as string) || "medium",
    adoption_status:
      (formData.get("adoption_status") as string) || undefined,
    satisfaction: numericField("satisfaction"),
    recipient_emails: formData.getAll("recipient_emails").filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    ),
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: newId, error } = await supabase.rpc("log_intervention", {
    p_name: data.name,
    p_type: data.type,
    p_workflow_ids: data.workflow_ids,
    p_description: data.description ?? null,
    p_minutes_saved_per_week: data.minutes_saved_per_week ?? null,
    p_attribution_confidence: data.attribution_confidence,
    p_estimated_gbp_saved_per_week: data.estimated_gbp_saved_per_week ?? null,
    p_estimated_revenue_per_week: data.estimated_revenue_per_week ?? null,
    p_adoption_status: data.adoption_status ?? null,
    p_satisfaction: data.satisfaction ?? null,
    p_recipient_emails: data.recipient_emails,
  });

  if (error || !newId) {
    return {
      kind: "error",
      message: `Could not log intervention: ${error?.message ?? "unknown error"}`,
    };
  }

  revalidatePath("/interventions");
  revalidatePath("/");
  redirect(`/interventions/${newId}`);
}
