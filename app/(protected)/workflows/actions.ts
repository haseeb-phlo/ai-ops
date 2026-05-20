"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";
import { CADENCES, cadenceToPerWeek, type Cadence } from "@/lib/frequency";

const FormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  team: z.string().min(1, "Team is required"),
  frequency_cadence: z.enum(CADENCES, {
    error: "Pick how often this workflow runs",
  }),
  criticality_score: z.number().int().min(1).max(5),
  business_kpi: z.string().min(1, "Business KPI is required").max(500),
  regulatory_flag: z.boolean(),
  hours_per_week: z
    .number({ error: "Hours per week is required" })
    .min(0, "Hours can't be negative")
    .max(168, "More hours per week than exist isn't possible"),
  cost_per_week: z
    .number({ error: "Cost per week is required" })
    .min(0, "Cost can't be negative")
    .max(10_000_000),
  revenue_per_week: z
    .number({ error: "Revenue per week is required" })
    .min(0, "Revenue can't be negative")
    .max(10_000_000),
  // Owners are picked from the company directory by canonical email.
  // Required: every workflow has at least one person who actually does it.
  owner_emails: z
    .array(z.string().email().toLowerCase())
    .min(1, "Pick at least one person involved in this workflow")
    .max(50, "That's a lot of owners; consider scoping the workflow."),
  // Free-text tool names entered via the tag input. Optional, deduped by
  // case-insensitive match server-side so the same tool name converges
  // across rows without a separate `tools` table.
  tools_used: z
    .array(z.string().min(1).max(80))
    .max(20, "Twenty tools is the cap; trim to the most relevant."),
  steps: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000),
      }),
    )
    .min(1, "Add at least one step")
    .max(20, "Twenty steps is the cap; consider splitting the workflow."),
  // Freeform context the structured fields don't capture - caveats,
  // background reasoning, links. Optional; rendered as plain text with
  // line breaks on the detail page.
  notes: z.string().max(2000, "Notes can be at most 2000 characters").optional(),
});

export type CreateWorkflowState =
  | { kind: "idle" }
  | { kind: "error"; message: string };

export async function createWorkflow(
  _prev: CreateWorkflowState,
  formData: FormData,
): Promise<CreateWorkflowState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;
  const supabase = await createClient();

  const numericField = (key: string): number | undefined => {
    const raw = formData.get(key);
    return typeof raw === "string" && raw.trim() !== ""
      ? Number(raw)
      : undefined;
  };

  // Step rows arrive as parallel arrays from <input name="step_titles"> and
  // <input name="step_descriptions"> hidden fields, in matching DOM order.
  // Zip them index-by-index, drop any title-empty rows defensively, and
  // hand the array to Zod for the cap/length checks.
  const rawTitles = formData
    .getAll("step_titles")
    .filter((v): v is string => typeof v === "string");
  const rawDescriptions = formData
    .getAll("step_descriptions")
    .filter((v): v is string => typeof v === "string");
  const stepInputs = rawTitles
    .map((title, i) => ({
      title: title.trim(),
      description: (rawDescriptions[i] ?? "").trim(),
    }))
    .filter((s) => s.title.length > 0);

  const parsed = FormSchema.safeParse({
    name: formData.get("name"),
    team: formData.get("team"),
    frequency_cadence: formData.get("frequency_cadence"),
    criticality_score: Number(formData.get("criticality_score") ?? 3),
    business_kpi: (formData.get("business_kpi") as string) || undefined,
    regulatory_flag: formData.get("regulatory_flag") === "on",
    hours_per_week: numericField("hours_per_week"),
    cost_per_week: numericField("cost_per_week"),
    revenue_per_week: numericField("revenue_per_week"),
    owner_emails: formData.getAll("owner_emails").filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    ),
    tools_used: dedupeTools(
      formData
        .getAll("tools_used")
        .filter((v): v is string => typeof v === "string"),
    ),
    steps: stepInputs,
    notes: ((formData.get("notes") as string | null) ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const data = parsed.data;

  // Resolve picked emails → canonical display names so workflow.owner_names
  // (legacy text[]) stays the source of truth for human-readable owners.
  // Anything not found in the directory is silently dropped - the picker
  // already restricts the user to known emails, so this is defence in depth.
  let ownerNames: string[] = [];
  if (data.owner_emails.length > 0) {
    const { data: directoryRows } = await supabase
      .from("people")
      .select("email, display_name")
      .in("email", data.owner_emails);
    const nameByEmail = new Map<string, string>();
    for (const row of directoryRows ?? []) {
      if (row.email && row.display_name) {
        nameByEmail.set(row.email.toLowerCase(), row.display_name);
      }
    }
    ownerNames = data.owner_emails
      .map((e) => nameByEmail.get(e.toLowerCase()))
      .filter((n): n is string => !!n);
  }

  // 1. Insert the workflow row.
  // frequency_per_week is derived from the cadence here so dashboard math
  // (which still reads the numeric column) reflects what the user picked.
  const cadence: Cadence = data.frequency_cadence;
  const { data: workflow, error: insertError } = await supabase
    .from("workflows")
    .insert({
      name: data.name,
      team: data.team,
      frequency_per_week: cadenceToPerWeek(cadence),
      frequency_cadence: cadence,
      criticality_score: data.criticality_score,
      business_kpi: data.business_kpi ?? null,
      regulatory: data.regulatory_flag,
      owner_names: ownerNames,
      tools_used: data.tools_used,
      notes: data.notes ?? null,
      active: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !workflow) {
    return {
      kind: "error",
      message: `Could not save workflow: ${insertError?.message ?? "unknown error"}`,
    };
  }

  // 2. Seed workflow_metrics with today's baseline. The dashboard /
  // log_intervention RPC reads these to compute "savings vs baseline" once
  // interventions land. Time stored in minutes/week to match the rest of the
  // schema; UI gathers hours and converts here.
  {
    const timeMinutes = data.hours_per_week * 60;
    const { error: metricsError } = await supabase
      .from("workflow_metrics")
      .upsert(
        {
          workflow_id: workflow.id,
          time_baseline: timeMinutes,
          time_current: timeMinutes,
          cost_baseline: data.cost_per_week,
          cost_current: data.cost_per_week,
          revenue_baseline: data.revenue_per_week,
          revenue_current: data.revenue_per_week,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workflow_id" },
      );
    if (metricsError) {
      // Don't fail the whole creation - surface a soft warning by carrying on
      // and logging server-side. The user can re-enter numbers later.
      console.error("createWorkflow: workflow_metrics seed failed", metricsError);
    }
  }

  // 3. Insert the steps the user typed in.
  const stepRows = data.steps.map((s, idx) => ({
    workflow_id: workflow.id,
    position: idx + 1,
    title: s.title,
    description: s.description,
  }));

  const { error: stepsError } = await supabase
    .from("workflow_steps")
    .insert(stepRows);

  if (stepsError) {
    // Workflow row exists but steps failed - revalidate so the list shows
    // the workflow, and drop the user on its detail page with a soft
    // warning flag so they can re-add steps from there.
    console.error("createWorkflow: step insert failed", stepsError);
    revalidatePath("/workflows");
    revalidatePath("/map");
    revalidatePath("/");
    redirect(`/workflows/${workflow.id}?stepExtractionFailed=1`);
  }

  revalidatePath("/workflows");
  revalidatePath("/map");
  revalidatePath("/");
  redirect(`/workflows/${workflow.id}`);
}

export type SoftDeleteState =
  | { kind: "idle" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export async function softDeleteWorkflow(
  workflowId: string,
): Promise<SoftDeleteState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;
  const supabase = await createClient();

  const { error, data } = await supabase
    .from("workflows")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
    })
    .eq("id", workflowId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    return { kind: "error", message: error.message };
  }
  if (!data || data.length === 0) {
    return {
      kind: "error",
      message: "You don't have permission to delete this workflow.",
    };
  }

  revalidatePath("/workflows");
  revalidatePath(`/workflows/${workflowId}`);
  revalidatePath("/admin");
  redirect("/workflows");
}

export async function restoreWorkflow(
  workflowId: string,
): Promise<SoftDeleteState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const supabase = await createClient();

  const { error, data } = await supabase
    .from("workflows")
    .update({
      deleted_at: null,
      deleted_by: null,
    })
    .eq("id", workflowId)
    .not("deleted_at", "is", null)
    .select("id");

  if (error) {
    return { kind: "error", message: error.message };
  }
  if (!data || data.length === 0) {
    return {
      kind: "error",
      message: "You don't have permission to restore this workflow.",
    };
  }

  revalidatePath("/workflows");
  revalidatePath(`/workflows/${workflowId}`);
  revalidatePath("/admin");
  return { kind: "ok" };
}

// Trim, drop empties, and dedupe by case-insensitive match while keeping
// the first-seen casing - same rule the autocomplete uses to converge
// "Claude" / "claude" / "  Claude " into a single tag.
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
