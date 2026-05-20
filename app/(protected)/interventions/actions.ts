"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
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
const ADOPTION_STATUSES = [
  "daily",
  "weekly",
  "occasional",
  "abandoned",
] as const;

const FormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  types: z
    .array(z.enum(INTERVENTION_TYPES))
    .min(1, "Pick at least one AI initiative type"),
  workflow_ids: z
    .array(z.string().uuid())
    .min(1, "Select at least one affected workflow"),
  description: z
    .string()
    .min(3, "Description is required")
    .max(500),
  // Mandatory: how often the initiative runs. The user picks a cadence;
  // we derive uses_per_week from it so the dashboard math is consistent.
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
  attribution_confidence: z.enum(CONFIDENCES).default("medium"),
  // Adoption + satisfaction are intentionally optional at log time - most
  // interventions are logged the day they ship and there's no usage signal
  // yet. The first metric snapshot (7+ days later) is when these values
  // start to make sense; the in-app prompt nudges champions to fill them
  // in then.
  adoption_status: z.enum(ADOPTION_STATUSES).optional(),
  satisfaction: z
    .number()
    .int()
    .min(1, "Satisfaction is 1-5")
    .max(5, "Satisfaction is 1-5")
    .optional(),
  // Recipients are picked from the company directory by canonical email.
  // Required: every intervention reaches someone; "team-wide" gets logged
  // by adding the team's members explicitly.
  recipient_emails: z
    .array(z.string().email().toLowerCase())
    .min(1, "Pick at least one person affected by this AI initiative")
    .max(500, "Recipient list is unusually large; check the picker."),
  // Free-text tool names from the tag input. Optional; deduped server-side
  // by case-insensitive match to keep the cross-row list converging.
  tools_used: z
    .array(z.string().min(1).max(80))
    .max(20, "Twenty tools is the cap; trim to the most relevant."),
  // Freeform context the structured fields don't capture. Optional;
  // applied via a follow-up UPDATE after the RPC inserts the row, since
  // log_intervention doesn't accept this column yet.
  notes: z.string().max(2000, "Notes can be at most 2000 characters").optional(),
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
    workflow_ids: formData.getAll("workflow_ids"),
    description: (formData.get("description") as string) || "",
    frequency_cadence: formData.get("frequency_cadence"),
    minutes_saved_per_use: numericField("minutes_saved_per_use"),
    cost_saved_per_use: numericField("cost_saved_per_use"),
    revenue_per_use: numericField("revenue_per_use"),
    attribution_confidence:
      (formData.get("attribution_confidence") as string) || "medium",
    adoption_status:
      (formData.get("adoption_status") as string) || undefined,
    satisfaction: numericField("satisfaction"),
    recipient_emails: formData.getAll("recipient_emails").filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    ),
    tools_used: dedupeTools(
      formData
        .getAll("tools_used")
        .filter((v): v is string => typeof v === "string"),
    ),
    notes: ((formData.get("notes") as string | null) ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const data = parsed.data;
  const supabase = await createClient();
  // Derive numeric uses_per_week from the cadence. The RPC writes both,
  // so the dashboard's per-week aggregates reflect the user's choice.
  const usesPerWeek = cadenceToPerWeek(data.frequency_cadence);

  const { data: newId, error } = await supabase.rpc("log_intervention", {
    p_name: data.name,
    p_types: data.types,
    p_workflow_ids: data.workflow_ids,
    p_uses_per_week: usesPerWeek,
    p_minutes_saved_per_use: data.minutes_saved_per_use,
    p_cost_saved_per_use: data.cost_saved_per_use,
    p_revenue_per_use: data.revenue_per_use,
    p_description: data.description ?? null,
    p_attribution_confidence: data.attribution_confidence,
    p_adoption_status: data.adoption_status ?? null,
    p_satisfaction: data.satisfaction ?? null,
    p_recipient_emails: data.recipient_emails,
    p_tools_used: data.tools_used,
    p_frequency_cadence: data.frequency_cadence,
  });

  if (error || !newId) {
    return {
      kind: "error",
      message: `Could not log AI initiative: ${error?.message ?? "unknown error"}`,
    };
  }

  // log_intervention RPC doesn't accept notes yet, so write it via a
  // follow-up UPDATE on the freshly-inserted row. Failure here logs but
  // doesn't fail the whole creation - the user can re-add notes from the
  // edit dialog. Same pragmatic pattern used for status/recipients in the
  // edit action (see comment in [id]/actions.ts).
  if (data.notes) {
    const { error: notesErr } = await supabase
      .from("ai_interventions")
      .update({ notes: data.notes })
      .eq("id", newId);
    if (notesErr) {
      console.error("logIntervention: notes write failed", notesErr);
    }
  }

  revalidatePath("/interventions");
  revalidatePath("/");
  redirect(`/interventions/${newId}`);
}

// Trim, drop empties, and dedupe by case-insensitive match while keeping
// the first-seen casing - same rule the workflow action and RPC use.
function dedupeTools(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const t = r.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
