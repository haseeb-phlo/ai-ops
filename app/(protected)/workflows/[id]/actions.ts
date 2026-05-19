"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, requireWriter } from "@/lib/auth";
import { canUserEditWorkflow } from "./permissions";

export type StepField = "title" | "description" | "owner" | "duration_minutes";

const ALLOWED_FIELDS: StepField[] = [
  "title",
  "description",
  "owner",
  "duration_minutes",
];

type UpdateResult = { ok: true } | { ok: false; error: string };

export async function updateStepField(
  stepId: string,
  field: StepField,
  rawValue: string,
): Promise<UpdateResult> {
  if (!ALLOWED_FIELDS.includes(field)) {
    return { ok: false, error: `Field "${field}" is not editable.` };
  }

  const gate = await requireWriter();
  if (!gate.ok) return { ok: false, error: gate.error };
  const user = gate.user;
  const supabase = await createClient();

  const { data: step, error: stepErr } = await supabase
    .from("workflow_steps")
    .select("id, workflow_id, title, description, owner, duration_minutes")
    .eq("id", stepId)
    .maybeSingle();

  if (stepErr || !step) {
    return { ok: false, error: "Step not found." };
  }

  const { data: workflow, error: wErr } = await supabase
    .from("workflows")
    .select("team")
    .eq("id", step.workflow_id)
    .maybeSingle();

  if (wErr || !workflow) {
    return { ok: false, error: "Workflow not found." };
  }

  const canEdit =
    user.role === "super_admin" || user.team === workflow.team;
  if (!canEdit) {
    return { ok: false, error: "You don't have permission to edit this step." };
  }

  const oldValue = step[field];
  const trimmed = rawValue.trim();
  let newValue: string | number | null;

  if (field === "duration_minutes") {
    if (trimmed === "") {
      newValue = null;
    } else {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: "Duration must be a non-negative number." };
      }
      newValue = Math.round(n);
    }
  } else {
    newValue = trimmed === "" ? null : trimmed;
  }

  if (oldValue === newValue) {
    return { ok: true };
  }

  // Write the revision row BEFORE updating the step.
  const { error: revErr } = await supabase.from("step_revisions").insert({
    step_id: step.id,
    workflow_id: step.workflow_id,
    field,
    old_value: oldValue == null ? null : String(oldValue),
    new_value: newValue == null ? null : String(newValue),
    changed_by: user.id,
    changed_by_email: user.email,
  });

  if (revErr) {
    return { ok: false, error: `Could not record revision: ${revErr.message}` };
  }

  const { error: updErr } = await supabase
    .from("workflow_steps")
    .update({ [field]: newValue, updated_at: new Date().toISOString() })
    .eq("id", step.id);

  if (updErr) {
    return { ok: false, error: `Could not save change: ${updErr.message}` };
  }

  revalidatePath(`/workflows/${step.workflow_id}`);
  return { ok: true };
}

async function loadCanEdit(workflowId: string) {
  const gate = await requireWriter();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const user = gate.user;
  const supabase = await createClient();
  const { data: workflow } = await supabase
    .from("workflows")
    .select("team, created_by, owner_names")
    .eq("id", workflowId)
    .maybeSingle<{
      team: string | null;
      created_by: string | null;
      owner_names: string[] | null;
    }>();
  if (!workflow) {
    return { ok: false as const, error: "Workflow not found." };
  }
  if (!canUserEditWorkflow(user, workflow)) {
    return { ok: false as const, error: "You don't have permission." };
  }
  return { ok: true as const, supabase };
}

export async function addStep(
  workflowId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const gate = await loadCanEdit(workflowId);
  if (!gate.ok) return gate;

  const { data: last } = await gate.supabase
    .from("workflow_steps")
    .select("position")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? 0) + 1;

  const { data: inserted, error } = await gate.supabase
    .from("workflow_steps")
    .insert({
      workflow_id: workflowId,
      position: nextPosition,
      title: "New step",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Insert failed." };
  }

  revalidatePath(`/workflows/${workflowId}`);
  return { ok: true, id: inserted.id };
}

export async function deleteStep(
  stepId: string,
): Promise<UpdateResult> {
  const supabase = await createClient();
  const { data: step } = await supabase
    .from("workflow_steps")
    .select("workflow_id")
    .eq("id", stepId)
    .maybeSingle();
  if (!step) return { ok: false, error: "Step not found." };

  const gate = await loadCanEdit(step.workflow_id);
  if (!gate.ok) return gate;

  const { error } = await gate.supabase
    .from("workflow_steps")
    .delete()
    .eq("id", stepId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/workflows/${step.workflow_id}`);
  return { ok: true };
}

export async function moveStep(
  stepId: string,
  direction: "up" | "down",
): Promise<UpdateResult> {
  const supabase = await createClient();
  const { data: step } = await supabase
    .from("workflow_steps")
    .select("id, workflow_id, position")
    .eq("id", stepId)
    .maybeSingle();
  if (!step) return { ok: false, error: "Step not found." };

  const gate = await loadCanEdit(step.workflow_id);
  if (!gate.ok) return gate;

  // Find the adjacent step in the chosen direction.
  const query = gate.supabase
    .from("workflow_steps")
    .select("id, position")
    .eq("workflow_id", step.workflow_id)
    .limit(1);
  const { data: neighbours } =
    direction === "up"
      ? await query.lt("position", step.position).order("position", { ascending: false })
      : await query.gt("position", step.position).order("position", { ascending: true });

  const neighbour = neighbours?.[0];
  if (!neighbour) {
    // Already at the boundary - silent no-op.
    return { ok: true };
  }

  // Swap positions atomically via the swap_step_positions RPC so a partial
  // failure can't leave both rows sharing a position (which would make the
  // next move non-deterministic, since position-ordered reads have no tie-
  // breaker).
  const { error: swapErr } = await gate.supabase.rpc(
    "swap_step_positions",
    { p_step_a: step.id, p_step_b: neighbour.id },
  );
  if (swapErr) return { ok: false, error: swapErr.message };

  revalidatePath(`/workflows/${step.workflow_id}`);
  return { ok: true };
}

const UpdateWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  team: z.string().max(120).nullable(),
  regulatory: z.boolean(),
  frequency_per_week: z
    .number({ error: "Frequency must be a number" })
    .min(0, "Frequency can't be negative")
    .max(1000)
    .nullable(),
  criticality_score: z
    .number({ error: "Criticality must be a number" })
    .int()
    .min(1)
    .max(5)
    .nullable(),
  business_kpi: z.string().max(500).nullable(),
  owner_names: z.array(z.string().min(1)).max(20),
  tools_used: z
    .array(z.string().min(1).max(80))
    .max(20, "Twenty tools is the cap; trim to the most relevant."),
  hours_per_week: z
    .number({ error: "Hours must be a number" })
    .min(0, "Hours can't be negative")
    .max(168, "More hours per week than exist isn't possible")
    .nullable(),
});

// Same rule the new-workflow flow uses: trim, drop empties, dedupe by
// case-insensitive match, keep first-seen casing.
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

export type UpdateWorkflowState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success" };

export async function updateWorkflow(
  workflowId: string,
  _prev: UpdateWorkflowState,
  formData: FormData,
): Promise<UpdateWorkflowState> {
  const gate = await loadCanEdit(workflowId);
  if (!gate.ok) return { kind: "error", message: gate.error };

  const rawTeam = (formData.get("team") as string | null)?.trim() || null;
  const rawFrequency =
    (formData.get("frequency_per_week") as string | null)?.trim() || "";
  const frequencyValue: number | null =
    rawFrequency === "" ? null : Number(rawFrequency);
  const rawCriticality =
    (formData.get("criticality_score") as string | null)?.trim() || "";
  const criticalityValue: number | null =
    rawCriticality === "" ? null : Number(rawCriticality);
  const rawKpi =
    (formData.get("business_kpi") as string | null)?.trim() || null;
  const rawOwners = ((formData.get("owner_names") as string | null) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const rawHours =
    (formData.get("hours_per_week") as string | null)?.trim() || "";
  const hoursValue: number | null =
    rawHours === "" ? null : Number(rawHours);
  const rawTools = dedupeTools(
    formData
      .getAll("tools_used")
      .filter((v): v is string => typeof v === "string"),
  );

  const parsed = UpdateWorkflowSchema.safeParse({
    name: (formData.get("name") as string | null)?.trim() ?? "",
    team: rawTeam,
    regulatory: formData.get("regulatory") === "on",
    frequency_per_week: frequencyValue,
    criticality_score: criticalityValue,
    business_kpi: rawKpi,
    owner_names: rawOwners,
    tools_used: rawTools,
    hours_per_week: hoursValue,
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const next = parsed.data;

  const { data: current, error: curErr } = await gate.supabase
    .from("workflows")
    .select(
      "id, name, team, regulatory, frequency_per_week, criticality_score, business_kpi, owner_names, tools_used",
    )
    .eq("id", workflowId)
    .maybeSingle();

  if (curErr || !current) {
    return { kind: "error", message: "Workflow not found." };
  }

  // Hours/wk lives on workflow_metrics.time_baseline (in minutes). Load
  // the current value so the diff/revision log skips no-op writes.
  const { data: currentMetrics } = await gate.supabase
    .from("workflow_metrics")
    .select("time_baseline")
    .eq("workflow_id", workflowId)
    .maybeSingle<{ time_baseline: number | null }>();

  const currentHours: number | null =
    currentMetrics?.time_baseline != null
      ? currentMetrics.time_baseline / 60
      : null;

  // Diff each field. Skip writes if nothing changed; record one revision row
  // per changed field so /admin's audit log lists them individually.
  const user = await getSessionUser();
  const revisions: {
    workflow_id: string;
    field: string;
    old_value: string | null;
    new_value: string | null;
    changed_by: string;
    changed_by_email: string;
  }[] = [];

  function record(field: string, oldV: unknown, newV: unknown) {
    revisions.push({
      workflow_id: workflowId,
      field,
      old_value: oldV == null ? null : String(oldV),
      new_value: newV == null ? null : String(newV),
      changed_by: user.id,
      changed_by_email: user.email,
    });
  }

  if (current.name !== next.name) record("name", current.name, next.name);
  if ((current.team ?? null) !== next.team)
    record("team", current.team, next.team);
  if (Boolean(current.regulatory) !== next.regulatory)
    record("regulatory", current.regulatory, next.regulatory);
  if ((current.frequency_per_week ?? null) !== next.frequency_per_week)
    record(
      "frequency_per_week",
      current.frequency_per_week,
      next.frequency_per_week,
    );
  if ((current.criticality_score ?? null) !== next.criticality_score)
    record(
      "criticality_score",
      current.criticality_score,
      next.criticality_score,
    );
  if ((current.business_kpi ?? null) !== next.business_kpi)
    record("business_kpi", current.business_kpi, next.business_kpi);
  const currentOwners = (current.owner_names as string[] | null) ?? [];
  if (currentOwners.join("|") !== next.owner_names.join("|"))
    record("owner_names", currentOwners.join(", "), next.owner_names.join(", "));
  const currentTools = (current.tools_used as string[] | null) ?? [];
  const toolsChanged =
    currentTools.map((t) => t.toLowerCase()).join("|") !==
    next.tools_used.map((t) => t.toLowerCase()).join("|");
  if (toolsChanged)
    record("tools_used", currentTools.join(", "), next.tools_used.join(", "));
  const hoursChanged = currentHours !== next.hours_per_week;
  if (hoursChanged) {
    record("hours_per_week", currentHours, next.hours_per_week);
  }

  if (revisions.length === 0) {
    return { kind: "success" };
  }

  const { error: revErr } = await gate.supabase
    .from("workflow_revisions")
    .insert(revisions);
  if (revErr) {
    return { kind: "error", message: `Could not record revisions: ${revErr.message}` };
  }

  const { error: updErr } = await gate.supabase
    .from("workflows")
    .update({
      name: next.name,
      team: next.team,
      regulatory: next.regulatory,
      frequency_per_week: next.frequency_per_week,
      criticality_score: next.criticality_score,
      business_kpi: next.business_kpi,
      owner_names: next.owner_names,
      tools_used: next.tools_used,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workflowId);

  if (updErr) {
    return { kind: "error", message: `Could not save: ${updErr.message}` };
  }

  // Hours/wk → workflow_metrics.time_baseline (minutes). Update only when
  // the value actually changed; upsert so workflows missing a metrics row
  // (legacy seeds) get one on first edit.
  if (hoursChanged) {
    const minutes =
      next.hours_per_week == null ? null : next.hours_per_week * 60;
    const { error: metricsErr } = await gate.supabase
      .from("workflow_metrics")
      .upsert(
        {
          workflow_id: workflowId,
          time_baseline: minutes,
          time_current: minutes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workflow_id" },
      );
    if (metricsErr) {
      return {
        kind: "error",
        message: `Could not save hours/week: ${metricsErr.message}`,
      };
    }
  }

  revalidatePath(`/workflows/${workflowId}`);
  revalidatePath("/workflows");
  revalidatePath("/");
  return { kind: "success" };
}
