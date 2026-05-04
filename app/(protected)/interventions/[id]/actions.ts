"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

const SnapshotSchema = z.object({
  intervention_id: z.string().uuid(),
  snapshot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date"),
  time_value: z.number().nullable(),
  cost_value: z.number().nullable(),
  people_value: z.number().nullable(),
  errors_value: z.number().nullable(),
  revenue_value: z.number().nullable(),
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
  const user = await getSessionUser();

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
      message: parsed.error.issues.map((i) => i.message).join(" — "),
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
  return { kind: "success" };
}
