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
  description: z.string().max(500).optional(),
  minutes_saved_per_week: z
    .number({ error: "Minutes saved must be a number" })
    .min(0, "Minutes saved can't be negative")
    .max(100000)
    .optional(),
  estimated_gbp_saved_per_week: z
    .number({ error: "GBP saved must be a number" })
    .min(0, "GBP saved can't be negative")
    .max(10_000_000)
    .optional(),
  estimated_revenue_per_week: z
    .number({ error: "Revenue must be a number" })
    .min(0, "Revenue can't be negative")
    .max(10_000_000)
    .optional(),
  attribution_confidence: z.enum(CONFIDENCES).default("medium"),
  adoption_status: z.enum(ADOPTION_STATUSES).optional(),
  satisfaction: z
    .number({ error: "Satisfaction must be a number" })
    .int()
    .min(1, "Satisfaction is 1-5")
    .max(5, "Satisfaction is 1-5")
    .optional(),
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
    description: (formData.get("description") as string) || undefined,
    minutes_saved_per_week: numericField("minutes_saved_per_week"),
    estimated_gbp_saved_per_week: numericField("estimated_gbp_saved_per_week"),
    estimated_revenue_per_week: numericField("estimated_revenue_per_week"),
    attribution_confidence:
      (formData.get("attribution_confidence") as string) || "medium",
    adoption_status:
      (formData.get("adoption_status") as string) || undefined,
    satisfaction: numericField("satisfaction"),
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
