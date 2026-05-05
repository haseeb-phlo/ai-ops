"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { requireWriter } from "@/lib/auth";

const CREATE_WORKFLOW_HOURLY_LIMIT = 10;

const StepsSchema = z.object({
  steps: z
    .array(
      z.object({
        title: z
          .string()
          .min(1)
          .describe("Short imperative title for this step (≤ 8 words)."),
        description: z
          .string()
          .describe(
            "1–2 sentence description of what happens in this step, in the user's own voice.",
          ),
      }),
    )
    .min(1)
    .max(20)
    .describe("Ordered list of steps in the workflow."),
});

const SYSTEM_PROMPT = `You convert a colleague's free-form description of a recurring work process into a clean, ordered list of steps.

Rules:
- Each step is one discrete action a person performs.
- Use the user's own terminology where possible - don't invent jargon.
- Title is imperative ("Open Excel sheet", "Email the supplier"), max ~8 words.
- Description is 1-2 sentences expanding the title.
- Order matters: list steps in the sequence they happen.
- If the user mentions parallel work, capture each branch as its own step in the order they describe.
- Aim for 3-12 steps. Avoid splitting hairs (don't make "open laptop" a step).`;

const FormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  team: z.string().min(1, "Team is required"),
  frequency_per_week: z
    .number({ error: "Frequency must be a number" })
    .min(0, "Frequency can't be negative")
    .max(1000),
  criticality_score: z.number().int().min(1).max(5),
  business_kpi: z.string().max(500).optional(),
  regulatory_flag: z.boolean(),
  walkthrough: z
    .string()
    .min(20, "Walkthrough must be at least 20 characters")
    .max(8000),
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

  // Rate limit: createWorkflow calls Claude with a high-effort budget, so a
  // single user spamming this can burn the API spend. Throttle per-user
  // against the workflows table itself (no extra storage needed).
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateError } = await supabase
    .from("workflows")
    .select("id", { count: "exact", head: true })
    .eq("created_by", user.id)
    .gte("created_at", oneHourAgo);

  if (rateError) {
    return {
      kind: "error",
      message: "Could not verify rate limit. Please try again.",
    };
  }
  if ((recentCount ?? 0) >= CREATE_WORKFLOW_HOURLY_LIMIT) {
    return {
      kind: "error",
      message: `You've created ${recentCount} workflows in the last hour. Please wait before creating more.`,
    };
  }

  const parsed = FormSchema.safeParse({
    name: formData.get("name"),
    team: formData.get("team"),
    frequency_per_week: Number(formData.get("frequency_per_week") ?? 0),
    criticality_score: Number(formData.get("criticality_score") ?? 3),
    business_kpi: (formData.get("business_kpi") as string) || undefined,
    regulatory_flag: formData.get("regulatory_flag") === "on",
    walkthrough: formData.get("walkthrough"),
  });

  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const data = parsed.data;

  // 1. Insert the workflow row.
  const { data: workflow, error: insertError } = await supabase
    .from("workflows")
    .insert({
      name: data.name,
      team: data.team,
      frequency_per_week: data.frequency_per_week,
      criticality_score: data.criticality_score,
      business_kpi: data.business_kpi ?? null,
      regulatory: data.regulatory_flag,
      walkthrough: data.walkthrough,
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

  // 2. Ask Claude to extract structured steps from the walkthrough.
  let extractedSteps: z.infer<typeof StepsSchema>["steps"];
  try {
    const response = await anthropic.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: z.toJSONSchema(StepsSchema),
        },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Workflow name: ${data.name}\nOwner team: ${data.team}\n\nWalkthrough:\n${data.walkthrough}`,
        },
      ],
    });

    const validated = StepsSchema.parse(response.parsed_output);
    extractedSteps = validated.steps;
  } catch (err) {
    // Don't surface raw SDK errors to the UI - they can leak model names,
    // request IDs, and provider hints. Log server-side, return a safe blurb.
    console.error("createWorkflow: step extraction failed", err);
    return {
      kind: "error",
      message:
        "Workflow saved, but step extraction failed. You can still open the workflow and add steps manually.",
    };
  }

  // 3. Insert the extracted steps.
  const stepRows = extractedSteps.map((s, idx) => ({
    workflow_id: workflow.id,
    position: idx + 1,
    title: s.title,
    description: s.description,
  }));

  const { error: stepsError } = await supabase
    .from("workflow_steps")
    .insert(stepRows);

  if (stepsError) {
    return {
      kind: "error",
      message: `Workflow saved, but couldn't save steps: ${stepsError.message}`,
    };
  }

  revalidatePath("/workflows");
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
