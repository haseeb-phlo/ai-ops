"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, requireWriter } from "@/lib/auth";
import { parseLoomId } from "@/lib/loom";

export type ActionState =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success" };

export const LEARN_TOPICS = [
  "ai_ops",
  "ai_foundations",
  "prompt_engineering",
  "ai_tools",
] as const;
export type LearnTopic = (typeof LEARN_TOPICS)[number];

export const LEARN_TOPIC_LABEL: Record<LearnTopic, string> = {
  ai_ops: "AI Ops",
  ai_foundations: "AI Foundations",
  prompt_engineering: "Prompt Engineering",
  ai_tools: "AI Tools",
};

const AddVideoSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  loom_url: z.string().min(1, "Loom URL is required"),
  topic: z.enum(LEARN_TOPICS, { error: "Pick a topic" }),
});

export async function addVideo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can add videos." };
  }

  const parsed = AddVideoSchema.safeParse({
    title: formData.get("title"),
    description: (formData.get("description") as string) || undefined,
    loom_url: formData.get("loom_url"),
    topic: formData.get("topic"),
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const embedId = parseLoomId(parsed.data.loom_url);
  if (!embedId) {
    return {
      kind: "error",
      message:
        "That doesn't look like a Loom URL. Paste a https://www.loom.com/share/... link.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("learn_videos").insert({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    loom_share_url: parsed.data.loom_url.trim(),
    loom_embed_id: embedId,
    topic: parsed.data.topic,
    added_by: gate.user.id,
  });

  if (error) {
    return { kind: "error", message: `Could not add video: ${error.message}` };
  }

  revalidatePath("/learn");
  return { kind: "success" };
}

export async function deleteVideo(formData: FormData): Promise<void> {
  const gate = await requireWriter();
  if (!gate.ok) return;
  if (gate.user.realRole !== "super_admin") return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const supabase = await createClient();
  await supabase.from("learn_videos").delete().eq("id", id);
  revalidatePath("/learn");
}

const RecordPlaySchema = z.object({
  video_id: z.string().uuid(),
});

// Record a play. Authenticated users only; the play is attributed to the
// caller. Returns silently - the UI doesn't need a response, and a failed
// insert (e.g. transient network) shouldn't block the iframe from loading.
export async function recordPlay(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  const parsed = RecordPlaySchema.safeParse({
    video_id: formData.get("video_id"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.from("learn_video_plays").insert({
    video_id: parsed.data.video_id,
    user_id: user.id,
  });
  revalidatePath("/learn");
}

const AddResourceSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Enter a valid URL (https://...)"),
  description: z.string().max(500).optional(),
});

export async function addResource(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };

  const parsed = AddResourceSchema.safeParse({
    title: formData.get("title"),
    url: formData.get("url"),
    description: (formData.get("description") as string) || undefined,
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("learn_resources").insert({
    title: parsed.data.title,
    url: parsed.data.url,
    description: parsed.data.description ?? null,
    added_by: gate.user.id,
  });

  if (error) {
    return { kind: "error", message: `Could not add resource: ${error.message}` };
  }

  revalidatePath("/learn");
  return { kind: "success" };
}

export async function deleteResource(formData: FormData): Promise<void> {
  const gate = await requireWriter();
  if (!gate.ok) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  // RLS enforces "author or super_admin" - the policy will reject other users.
  const supabase = await createClient();
  await supabase.from("learn_resources").delete().eq("id", id);
  revalidatePath("/learn");
}
