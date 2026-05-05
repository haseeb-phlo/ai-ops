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
  attribution_confidence: z.enum(CONFIDENCES).default("medium"),
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

  const minutesRaw = formData.get("minutes_saved_per_week");
  const minutesParsed =
    typeof minutesRaw === "string" && minutesRaw.trim() !== ""
      ? Number(minutesRaw)
      : undefined;

  const parsed = FormSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    workflow_ids: formData.getAll("workflow_ids"),
    description: (formData.get("description") as string) || undefined,
    minutes_saved_per_week: minutesParsed,
    attribution_confidence:
      (formData.get("attribution_confidence") as string) || "medium",
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
  });

  if (error || !newId) {
    return {
      kind: "error",
      message: `Could not log intervention: ${error?.message ?? "unknown error"}`,
    };
  }

  revalidatePath("/interventions");
  revalidatePath("/dashboard");
  redirect(`/interventions/${newId}`);
}
