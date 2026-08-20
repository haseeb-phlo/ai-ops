"use server";

import { revalidatePath } from "next/cache";
import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readXlsx, parseCsv } from "@/lib/programme/xlsx";
import {
  buildImportPreview,
  type ImportPreview,
} from "@/lib/programme/may-import";
import { z } from "zod";
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from "@/lib/programme/attendance";
import { buildWorkSampleCsv } from "@/lib/programme/anonymise";
import { loadCohortAdminView } from "@/lib/programme/cohort-admin";

/**
 * May 2026 import.
 *
 * Two steps on purpose - preview, then commit - because the dangerous failure
 * here is silent. The importer keys on column order, so a shifted export files
 * every answer under the wrong question and produces plausible-looking wrong
 * scores. The preview shows per-question counts to check against the known
 * distribution before anything is written.
 *
 * Idempotent: the upsert targets (email, wave), so re-running changes nothing.
 */

export type ImportResult =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | {
      kind: "preview";
      preview: SerialisablePreview;
      fileName: string;
      payload: string;
    }
  | {
      kind: "done";
      inserted: number;
      withoutAccount: number;
    };

/** The preview, minus the full answer sets - those go in `payload`. */
export type SerialisablePreview = Omit<ImportPreview, "responses"> & {
  sampleEmails: string[];
};

const MAX_BYTES = 10 * 1024 * 1024;

function toPreview(rows: string[][]): {
  preview: SerialisablePreview;
  full: ImportPreview;
} {
  const full = buildImportPreview(rows);
  return {
    full,
    preview: {
      rowCount: full.rowCount,
      duplicatesDropped: full.duplicatesDropped,
      unmatchedCount: full.unmatchedCount,
      headerCheck: full.headerCheck,
      distribution: full.distribution,
      sampleEmails: full.responses.slice(0, 3).map((r) => r.email),
    },
  };
}

export async function previewMayImport(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can import." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { kind: "error", message: "Pick a file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { kind: "error", message: "That file is over 10 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rows: string[][];
  try {
    rows = file.name.toLowerCase().endsWith(".csv")
      ? parseCsv(buffer.toString("utf8"))
      : readXlsx(buffer);
  } catch (error) {
    return {
      kind: "error",
      message: `Could not read that file: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }

  if (rows.length < 2) {
    return { kind: "error", message: "That file has no data rows." };
  }

  const { preview, full } = toPreview(rows);
  return {
    kind: "preview",
    preview,
    fileName: file.name,
    // Carried through the round-trip so committing doesn't re-upload or
    // re-parse, and so what's written is exactly what was previewed.
    payload: JSON.stringify(full.responses),
  };
}

export async function commitMayImport(
  _prev: ImportResult,
  formData: FormData,
): Promise<ImportResult> {
  const gate = await requireWriter();
  if (!gate.ok) return { kind: "error", message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { kind: "error", message: "Only super admins can import." };
  }

  let responses: {
    email: string;
    answers: Record<string, { value: string; score?: number }>;
    completionTime: string;
  }[];
  try {
    responses = JSON.parse(String(formData.get("payload") ?? "[]"));
  } catch {
    return { kind: "error", message: "Preview expired — upload again." };
  }
  if (responses.length === 0) {
    return { kind: "error", message: "Nothing to import." };
  }

  const supabase = await createClient();

  // Resolve user_ids where an account exists. Rows without one are still
  // imported - user_id binds on their first sign-in - because dropping them
  // would shed exactly the sample the before/after comparison depends on.
  const { data: userRows } = await supabase.rpc("user_emails", {
    p_user_ids: [],
  });
  void userRows; // placeholder: the RPC is id-keyed, so match after insert.

  const chunkSize = 200;
  let inserted = 0;
  for (let i = 0; i < responses.length; i += chunkSize) {
    const chunk = responses.slice(i, i + chunkSize).map((r) => ({
      email: r.email.toLowerCase(),
      wave: "may_2026" as const,
      source: "import" as const,
      answers_json: r.answers,
      submitted_at: parseCompletionTime(r.completionTime),
    }));

    const { error, count } = await supabase
      .from("ai_score_responses")
      .upsert(chunk, { onConflict: "email,wave", count: "exact" });

    if (error) {
      return { kind: "error", message: `Import failed: ${error.message}` };
    }
    inserted += count ?? chunk.length;
  }

  // Backfill user_id for anyone who already has an account. The rest bind at
  // their next sign-in, via the hook in /auth/callback.
  const { data: linked } = await supabase.rpc("link_ai_score_responses");
  const withoutAccount = Math.max(
    0,
    responses.length - (typeof linked === "number" ? linked : 0),
  );

  revalidatePath("/learn/admin");
  revalidatePath("/learn/track/score");
  return { kind: "done", inserted, withoutAccount };
}

/**
 * Microsoft Forms exports completion time in a few shapes. Anything we can't
 * confidently read falls back to now() rather than inventing a date.
 */
function parseCompletionTime(raw: string): string {
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed)
    ? new Date().toISOString()
    : new Date(parsed).toISOString();
}

/* ------------------------------------------------------------------ */
/* Attendance roster                                                   */
/* ------------------------------------------------------------------ */


const MarkAttendanceSchema = z.object({
  cohort_id: z.string().uuid(),
  track_item_id: z.string().uuid(),
  user_id: z.string().uuid(),
  // null clears the mark, which is what the fourth tap does.
  status: z.enum(ATTENDANCE_STATUSES).nullable(),
  slot: z.number().int().min(1).max(2).nullable(),
  make_up: z.boolean(),
});

export type MarkAttendanceResult =
  | { ok: true; status: AttendanceStatus | null }
  | { ok: false; message: string };

/**
 * Marks one roster cell. Called on every tap, so it stays a single upsert or
 * delete - the grid is meant to be filled in during a session, at speed.
 */
export async function markAttendance(input: {
  cohortId: string;
  trackItemId: string;
  userId: string;
  status: AttendanceStatus | null;
  slot: number | null;
  makeUp: boolean;
}): Promise<MarkAttendanceResult> {
  const gate = await requireWriter();
  if (!gate.ok) return { ok: false, message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { ok: false, message: "Only super admins can mark attendance." };
  }

  const parsed = MarkAttendanceSchema.safeParse({
    cohort_id: input.cohortId,
    track_item_id: input.trackItemId,
    user_id: input.userId,
    status: input.status,
    slot: input.slot,
    make_up: input.makeUp,
  });
  if (!parsed.success) return { ok: false, message: "Invalid mark." };

  const supabase = await createClient();

  if (parsed.data.status === null) {
    const { error } = await supabase
      .from("programme_session_attendance")
      .delete()
      .eq("cohort_id", parsed.data.cohort_id)
      .eq("track_item_id", parsed.data.track_item_id)
      .eq("user_id", parsed.data.user_id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase
      .from("programme_session_attendance")
      .upsert(
        {
          cohort_id: parsed.data.cohort_id,
          track_item_id: parsed.data.track_item_id,
          user_id: parsed.data.user_id,
          status: parsed.data.status,
          slot: parsed.data.slot,
          marked_by: gate.user.id,
          // make_up only means anything alongside an excusal.
          meta_json:
            parsed.data.status === "excused" && parsed.data.make_up
              ? { make_up: true }
              : {},
        },
        { onConflict: "cohort_id,track_item_id,user_id" },
      );
    if (error) return { ok: false, message: error.message };
  }

  // Attendance can flip G2, and therefore RAG. Recompute now rather than
  // waiting for the nightly job.
  await recomputeCohortRag(parsed.data.cohort_id);

  revalidatePath("/learn/admin");
  revalidatePath("/learn/track");
  return { ok: true, status: parsed.data.status };
}

/**
 * Recomputes and stores rag_status for every member of a cohort.
 *
 * Shared by the nightly cron and by any event that can change a gate. The
 * arithmetic lives in the pure modules; this is just the write.
 */
export async function recomputeCohortRag(cohortId: string): Promise<number> {
  const view = await loadCohortAdminView(cohortId);
  if (!view) return 0;

  const supabase = await createClient();
  const now = new Date().toISOString();

  const updates = view.members.map((member) =>
    supabase
      .from("programme_cohort_members")
      .update({ rag_status: member.rag, rag_computed_at: now })
      .eq("id", member.cohortMemberId),
  );
  await Promise.all(updates);
  return view.members.length;
}

/**
 * CSV of work-sample pairs for external blind scoring.
 *
 * Returns the text rather than streaming a file so this stays a Server Action
 * (app/api is reserved for system endpoints); the client turns it into a
 * download.
 *
 * The member key is a hash of a random UUID - there is no name, email or team
 * in the output, because the scorer must not be able to tell whose work they
 * are reading and the file leaves our control on download.
 */
export async function exportWorkSamplePairs(
  cohortId: string,
): Promise<{ ok: true; csv: string; filename: string } | { ok: false; message: string }> {
  const gate = await requireWriter();
  if (!gate.ok) return { ok: false, message: gate.error };
  if (gate.user.realRole !== "super_admin") {
    return { ok: false, message: "Only super admins can export." };
  }

  const view = await loadCohortAdminView(cohortId);
  if (!view) return { ok: false, message: "Cohort not found." };

  return {
    ok: true,
    csv: buildWorkSampleCsv(view.workSamplePairs),
    filename: `work-samples-${view.cohort.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`,
  };
}
