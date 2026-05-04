"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

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

  const user = await getSessionUser();
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

  const canEdit = user.role === "admin" || user.team === workflow.team;
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
