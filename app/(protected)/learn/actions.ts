"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, requireWriter } from "@/lib/auth";
import { fetchLoomOembed, parseLoomId } from "@/lib/loom";
import { redealBucketPositions } from "./reorder";
import {
  LEARN_SUBTOPICS,
  LEARN_TOPICS,
  VIDEO_RESOURCE_BUCKET,
  VIDEO_RESOURCE_MAX_FILE_BYTES,
  type ActionState,
  type LearnTopic,
} from "./topics";

// Coerce an empty/blank subtopic from the form to null and verify it is
// listed under the parent topic in LEARN_SUBTOPICS. Returns an error
// message when invalid; null when "no subtopic selected" is acceptable.
function resolveSubtopic(
  raw: FormDataEntryValue | null,
  topic: LearnTopic,
): { ok: true; value: string | null } | { ok: false; message: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: true, value: null };
  const valid = (LEARN_SUBTOPICS[topic] ?? []) as readonly string[];
  if (!valid.includes(value)) {
    return { ok: false, message: "Pick a valid subtopic for this topic." };
  }
  return { ok: true, value };
}

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

  const subtopic = resolveSubtopic(formData.get("subtopic"), parsed.data.topic);
  if (!subtopic.ok) return { kind: "error", message: subtopic.message };

  const loomUrl = parsed.data.loom_url.trim();
  const { thumbnailUrl } = await fetchLoomOembed(loomUrl);

  const supabase = await createClient();

  // Land new videos at the end of the (global) order. Concurrent adds can
  // race to the same max, but writes are super-admin-only and the
  // created_at tiebreaker keeps the render deterministic until a reorder.
  const { data: last } = await supabase
    .from("learn_videos")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (last?.position ?? 0) + 1;

  const { error } = await supabase.from("learn_videos").insert({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    loom_share_url: loomUrl,
    loom_embed_id: embedId,
    topic: parsed.data.topic,
    subtopic: subtopic.value,
    thumbnail_url: thumbnailUrl,
    position: nextPosition,
    added_by: gate.user.id,
  });

  if (error) {
    return { kind: "error", message: `Could not add video: ${error.message}` };
  }

  revalidatePath("/learn");
  revalidatePath("/");
  return { kind: "success" };
}

const EditVideoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  loom_url: z.string().min(1, "Loom URL is required"),
  topic: z.enum(LEARN_TOPICS, { error: "Pick a topic" }),
});

export async function editVideo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can edit videos." };
  }

  const parsed = EditVideoSchema.safeParse({
    id: formData.get("id"),
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

  const subtopic = resolveSubtopic(formData.get("subtopic"), parsed.data.topic);
  if (!subtopic.ok) return { kind: "error", message: subtopic.message };

  const loomUrl = parsed.data.loom_url.trim();
  const { thumbnailUrl } = await fetchLoomOembed(loomUrl);

  const supabase = await createClient();
  const { error } = await supabase
    .from("learn_videos")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      loom_share_url: loomUrl,
      loom_embed_id: embedId,
      topic: parsed.data.topic,
      subtopic: subtopic.value,
      thumbnail_url: thumbnailUrl,
    })
    .eq("id", parsed.data.id);

  if (error) {
    return {
      kind: "error",
      message: `Could not update video: ${error.message}`,
    };
  }

  revalidatePath("/learn");
  revalidatePath("/");
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
  revalidatePath("/");
}

const ReorderVideosSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

// Persist a drag-to-reorder of one topic/subtopic bucket. `ids` is the
// bucket's videos in their new visual order. We keep the exact multiset of
// position values those videos already hold and re-deal them in the new
// order — so reordering one bucket never disturbs any other bucket's
// positions, and we can't collide with rows we didn't touch.
export async function reorderVideos(ids: string[]): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can reorder videos." };
  }

  const parsed = ReorderVideosSchema.safeParse({ ids });
  if (!parsed.success) {
    return { kind: "error", message: "Invalid reorder request." };
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("learn_videos")
    .select("id, position")
    .in("id", parsed.data.ids);

  if (error || !rows) {
    return { kind: "error", message: "Could not load videos to reorder." };
  }

  const updates = redealBucketPositions(rows, parsed.data.ids).map(
    ({ id, position }) =>
      supabase.from("learn_videos").update({ position }).eq("id", id),
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { kind: "error", message: `Could not save order: ${failed.error.message}` };
  }

  revalidatePath("/learn");
  revalidatePath("/");
  return { kind: "success" };
}

const RecordPlaySchema = z.object({
  video_id: z.string().uuid(),
});

// Record a play. Authenticated users only; the play is attributed to the
// caller. Returns silently - the UI doesn't need a response, and a failed
// insert (e.g. transient network) shouldn't block the iframe from loading.
export async function recordPlay(formData: FormData): Promise<void> {
  const gate = await requireWriter();
  if (!gate.ok) return;
  const user = gate.user;
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

const ToggleCompletionSchema = z.object({
  video_id: z.string().uuid(),
});

// Toggle the caller's "completed" mark for a video. Unlike a play (an
// automatic one-way event), completion is an explicit signal the user can
// tick and untick: insert a row to mark complete, delete it to un-mark.
// One row per (video, user) is enforced by the table's unique constraint;
// RLS limits inserts/deletes to the caller's own rows. Returns an error
// state so the optimistic checkbox in the UI can revert and explain itself.
export async function toggleVideoCompletion(
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  const user = gate.user;
  const parsed = ToggleCompletionSchema.safeParse({
    video_id: formData.get("video_id"),
  });
  if (!parsed.success) {
    return { kind: "error", message: "Invalid video." };
  }

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("learn_video_completions")
    .select("id")
    .eq("video_id", parsed.data.video_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) {
    return { kind: "error", message: `Could not save: ${readError.message}` };
  }

  if (existing) {
    const { error } = await supabase
      .from("learn_video_completions")
      .delete()
      .eq("id", existing.id);
    if (error) {
      return { kind: "error", message: `Could not save: ${error.message}` };
    }
  } else {
    const { error } = await supabase.from("learn_video_completions").insert({
      video_id: parsed.data.video_id,
      user_id: user.id,
    });
    if (error) {
      return { kind: "error", message: `Could not save: ${error.message}` };
    }
  }

  revalidatePath("/learn");
  revalidatePath("/");
  return { kind: "success" };
}

// =========================================================================
// Per-video attachments
// =========================================================================
// Each video can have a list of attached URLs and files. Super-admin only
// for add/delete (the table's RLS enforces this server-side too). Files
// live in a private 'learn-video-resources' bucket; downloads are minted
// as signed URLs on click via signedUrlForResource below.

const AddResourceUrlSchema = z.object({
  video_id: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Enter a valid URL (https://...)"),
});

export async function addVideoResourceUrl(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can add attachments." };
  }

  const parsed = AddResourceUrlSchema.safeParse({
    video_id: formData.get("video_id"),
    title: formData.get("title"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("learn_video_resources").insert({
    video_id: parsed.data.video_id,
    kind: "url",
    title: parsed.data.title.trim(),
    url: parsed.data.url.trim(),
    added_by: gate.user.id,
  });

  if (error) {
    return {
      kind: "error",
      message: `Could not add attachment: ${error.message}`,
    };
  }

  revalidatePath("/learn");
  return { kind: "success" };
}

const AddResourceFileMetaSchema = z.object({
  video_id: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(200),
});

export async function addVideoResourceFile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can add attachments." };
  }

  const parsed = AddResourceFileMetaSchema.safeParse({
    video_id: formData.get("video_id"),
    title: formData.get("title"),
  });
  if (!parsed.success) {
    return {
      kind: "error",
      message: parsed.error.issues.map((i) => i.message).join(" - "),
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { kind: "error", message: "Pick a file to upload." };
  }
  if (file.size > VIDEO_RESOURCE_MAX_FILE_BYTES) {
    return { kind: "error", message: "File is over 25 MB." };
  }

  const safeName = file.name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
  const path = `${parsed.data.video_id}/${crypto.randomUUID()}-${safeName}`;
  const mime = file.type || "application/octet-stream";

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(VIDEO_RESOURCE_BUCKET)
    .upload(path, file, { contentType: mime, upsert: false });

  if (uploadError) {
    return {
      kind: "error",
      message: `Upload failed: ${uploadError.message}`,
    };
  }

  const { error: insertError } = await supabase
    .from("learn_video_resources")
    .insert({
      video_id: parsed.data.video_id,
      kind: "file",
      title: parsed.data.title.trim(),
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      file_mime: mime,
      added_by: gate.user.id,
    });

  if (insertError) {
    // Best-effort cleanup so we don't orphan the upload.
    await supabase.storage.from(VIDEO_RESOURCE_BUCKET).remove([path]);
    return {
      kind: "error",
      message: `Could not record attachment: ${insertError.message}`,
    };
  }

  revalidatePath("/learn");
  return { kind: "success" };
}

export async function deleteVideoResource(formData: FormData): Promise<void> {
  const gate = await requireWriter();
  if (!gate.ok) return;
  if (gate.user.realRole !== "super_admin") return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("learn_video_resources")
    .select("kind, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (row?.kind === "file" && row.storage_path) {
    await supabase.storage
      .from(VIDEO_RESOURCE_BUCKET)
      .remove([row.storage_path]);
  }
  await supabase.from("learn_video_resources").delete().eq("id", id);
  revalidatePath("/learn");
}

// Mint a short-lived signed URL for a file attachment. The bucket is
// private, so direct fetches require this. URL-kind rows go through this
// too for symmetry but just echo the url back.
export async function signedUrlForResource(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  // Any authed user can download; getSessionUser provides the redirect-on-anon.
  await getSessionUser();
  if (!id) return { ok: false, message: "Missing id." };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("learn_video_resources")
    .select("kind, url, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, message: "Attachment not found." };
  }

  if (row.kind === "url") {
    return row.url
      ? { ok: true, url: row.url }
      : { ok: false, message: "Attachment is missing a URL." };
  }

  if (!row.storage_path) {
    return { ok: false, message: "Attachment has no file path." };
  }

  const { data, error: signError } = await supabase.storage
    .from(VIDEO_RESOURCE_BUCKET)
    .createSignedUrl(row.storage_path, 300);

  if (signError || !data?.signedUrl) {
    return {
      ok: false,
      message: signError?.message ?? "Could not sign URL.",
    };
  }
  return { ok: true, url: data.signedUrl };
}

